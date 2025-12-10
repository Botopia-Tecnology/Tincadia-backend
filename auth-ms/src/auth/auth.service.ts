import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
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
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
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
          throw new ConflictException('User already exists');
        }
        throw new BadRequestException(authError.message);
      }

      if (!authData.user) {
        throw new BadRequestException('Error creating user');
      }

      // 2. Create profile
      await this.profileService.create({
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
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error registering user');
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

      if (authError || !authData.user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const profile = await this.profileService.findById(authData.user.id);
      const token = this.tokenService.generateToken(authData.user);

      return {
        user: this.profileService.toUserResponse(profile, authData.user),
        token,
        session: authData.session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error logging in');
    }
  }

  async loginWithOAuth(data: OAuthLoginDto): Promise<any> {
    const { provider, accessToken } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

      if (userError || !userData.user) {
        throw new UnauthorizedException('Invalid OAuth token');
      }

      const supabaseUser = userData.user;
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
          emailVerified: true,
        },
        token,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error authenticating with OAuth');
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
          phone: profile.phone,
        },
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
}
