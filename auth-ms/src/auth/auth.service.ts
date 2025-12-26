import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TokenService } from './services/token.service';
import { ProfileService } from './services/profile.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { GetProfileDto } from './dto/get-profile.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly tokenService: TokenService,
    private readonly profileService: ProfileService,
  ) { }

  async register(data: RegisterDto): Promise<any> {
    const { email, password, firstName, lastName, documentTypeId, documentNumber, phone } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();

      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new ConflictException('El usuario ya está registrado');
        }
        if (authError.message.includes('Password should be at least')) {
          throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
        }
        throw new BadRequestException(authError.message);
      }

      if (!authData.user) {
        throw new BadRequestException('Error al crear el usuario');
      }

      // 2. Create profile
      const profile = await this.profileService.create({
        id: authData.user.id,
        firstName,
        lastName,
        documentTypeId,
        documentNumber,
        phone,
      });

      // 3. Generate JWT
      const token = this.tokenService.generateToken(authData.user);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName,
          lastName,
          documentNumber,
          phone,
          emailVerified: false,
        },
        token,
        session: authData.session,
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Error al registrar usuario');
    }
  }

  async login(data: LoginDto): Promise<any> {
    const { email, password } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new UnauthorizedException('Correo o contraseña incorrectos');
        }
        if (authError.message.includes('Email not confirmed')) {
          throw new UnauthorizedException('Debes verificar tu correo electrónico antes de iniciar sesión');
        }
        throw new BadRequestException(authError.message);
      }

      if (!authData.user) {
        throw new UnauthorizedException('Correo o contraseña incorrectos');
      }

      const profile = await this.profileService.findById(authData.user.id);
      const token = this.tokenService.generateToken(authData.user);

      return {
        user: this.profileService.toUserResponse(profile, authData.user),
        token,
        session: authData.session,
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Error al iniciar sesión');
    }
  }

  async loginWithOAuth(data: OAuthLoginDto): Promise<any> {
    const { provider, accessToken, idToken } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();

      // Use signInWithIdToken to exchange the provider's ID token for a Supabase session
      // This allows the frontend to use Google/Apple SDK directly without Supabase SDK
      const tokenToUse = idToken || accessToken;

      if (!tokenToUse) {
        throw new BadRequestException('Either idToken or accessToken is required');
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: provider as 'google' | 'apple',
        token: tokenToUse,
        access_token: accessToken,
      });

      if (authError || !authData.user) {
        throw new UnauthorizedException('Invalid OAuth token: ' + (authError?.message || 'Unknown error'));
      }

      const supabaseUser = authData.user;
      const token = this.tokenService.generateToken(supabaseUser);

      // Get or create profile
      let profile = await this.profileService.findById(supabaseUser.id);

      if (!profile) {
        const fullName = supabaseUser.user_metadata?.full_name || '';
        const nameParts = fullName.split(' ');
        profile = await this.profileService.create({
          id: supabaseUser.id,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          documentNumber: '',
          phone: '',
        });
      }


      return {
        user: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
          authProvider: provider,
          emailVerified: supabaseUser.email_confirmed_at ? true : false,
        },
        token,
        session: authData.session,
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error authenticating with OAuth: ' + (error as Error).message);
    }
  }

  async logout(data: LogoutDto): Promise<any> {
    const { userId, token } = data;

    try {
      const payload = this.tokenService.verifyToken(token);
      if (payload.sub !== userId) {
        throw new UnauthorizedException('Token does not match user');
      }

      const supabase = this.supabaseService.getAdminClient();
      const { error } = await supabase.auth.admin.signOut(userId, 'global');

      if (error) {
        throw new BadRequestException(error.message);
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error logging out');
    }
  }

  async getProfile(data: GetProfileDto): Promise<any> {
    const { id } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: userData, error } = await supabase.auth.admin.getUserById(id);

      if (error || !userData.user) {
        throw new BadRequestException('User not found');
      }

      const profile = await this.profileService.findById(id);

      return {
        user: this.profileService.toUserResponse(profile, userData.user),
      };
    } catch (error) {
      throw new BadRequestException('Error getting profile');
    }
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<any> {
    const profile = await this.profileService.update(userId, updateData);
    return { user: { ...profile } };
  }

  async uploadProfilePicture(userId: string, fileBuffer: Buffer, mimeType: string): Promise<{ avatarUrl: string }> {
    try {
      // 1. Upload to Supabase Storage
      const avatarUrl = await this.supabaseService.uploadProfilePicture(userId, fileBuffer, mimeType);

      // 2. Update Supabase Auth User metadata
      const supabase = this.supabaseService.getAdminClient();
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { avatar_url: avatarUrl },
      });

      if (error) {
        throw new BadRequestException('Error updating user metadata with avatar URL');
      }

      return { avatarUrl };
    } catch (error) {
      this.logger.error(`Error uploading profile picture for ${userId}:`, error);
      throw new BadRequestException('Failed to upload profile picture');
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const payload = this.tokenService.verifyToken(token);
      const profile = await this.profileService.findByIdOrFail(payload.sub);

      return {
        user: {
          id: profile.id,
          email: payload.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          documentNumber: profile.documentNumber,
          documentTypeId: profile.documentTypeId,
          phone: profile.phone,
        },
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async resetPassword(data: ResetPasswordDto): Promise<any> {
    const { email } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://tincadia.vercel.app/reset-password',
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return { message: 'Recovery email sent successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error sending recovery email');
    }
  }

  async getUsers(excludeUserId: string): Promise<any> {
    try {
      const profiles = await this.profileService.findAllExcept(excludeUserId);

      return {
        users: profiles.map(p => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
        })),
      };
    } catch (error) {
      throw new BadRequestException('Error getting users');
    }
  }

  async updatePushToken(userId: string, pushToken: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      this.logger.log(`📱 Updating push token for user ${userId}`);

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: pushToken })
        .eq('id', userId);

      if (error) {
        this.logger.error(`Error updating push token: ${error.message}`);
        throw new Error(error.message);
      }

      this.logger.log('✅ Push token updated successfully');
    } catch (error) {
      this.logger.error(`Error updating push token: ${error.message}`);
      throw new BadRequestException('Error al actualizar token de notificaciones');
    }
  }

  async updatePassword(accessToken: string, data: UpdatePasswordDto): Promise<any> {
    const { password } = data;

    try {
      // Create a Supabase client with the user's access token
      const supabase = this.supabaseService.getClientWithToken(accessToken);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        this.logger.error(`Error updating password: ${error.message}`);
        throw new BadRequestException(error.message);
      }

      return { message: 'Contraseña actualizada exitosamente' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating password: ${error.message}`);
      throw new BadRequestException('Error al actualizar la contraseña');
    }
  }
}
