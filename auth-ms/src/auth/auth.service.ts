import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
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
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  async login(data: LoginDto): Promise<any> {
    const { email, password } = data;

    try {
      const supabase = this.supabaseService.getClient(); // Use public/anon client for login
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new UnauthorizedException(error.message);
      }

      const profile = await this.profileService.findById(authData.user.id);
      const token = this.tokenService.generateToken({ id: authData.user.id, email: authData.user.email });

      return {
        user: this.profileService.toUserResponse(profile, authData.user),
        token,
        session: authData.session,
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      this.logger.error(`Login error detail: ${error.message}`, error.stack); // Added log
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Login failed: ' + error.message); // Include info
    }
  }

  async register(data: RegisterDto): Promise<any> {
    const { email, password, firstName, lastName, documentTypeId, documentNumber, phone } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();

      // 1. Create user in Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          throw new ConflictException('Email already registered');
        }
        throw new BadRequestException(signUpError.message);
      }

      if (!authData.user) {
        throw new BadRequestException('User registration failed');
      }

      // 2. Create profile in local database
      const profile = await this.profileService.create({
        id: authData.user.id,
        firstName,
        lastName,
        documentTypeId,
        documentNumber: documentNumber || '',
        phone: phone || '',
      });

      // 3. Generate JWT token
      const token = this.tokenService.generateToken({ id: authData.user.id, email });

      return {
        user: this.profileService.toUserResponse(profile, authData.user),
        token,
        session: authData.session,
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Registration error: ${error.message}`);
      throw new BadRequestException('Registration failed');
    }
  }

  async loginWithOAuth(data: OAuthLoginDto): Promise<any> {
    const { provider, idToken } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();

      // Verify the OAuth token with Supabase
      // Fix for iOS Google Sign In: Extract nonce if present in the token payload
      // Supabase requires the nonce to be passed if it exists in the token
      let nonce: string | undefined;
      const parts = (idToken as string).split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.nonce) {
            nonce = payload.nonce;
          }
        } catch (e) {
          this.logger.warn(`Failed to parse idToken payload for nonce extraction: ${e.message}`);
        }
      }

      const { data: authData, error } = await supabase.auth.signInWithIdToken({
        provider: provider as any,
        token: idToken as string,
        nonce,
      });

      if (error) {
        throw new UnauthorizedException(error.message);
      }

      if (!authData.user) {
        throw new UnauthorizedException('OAuth login failed');
      }

      // Check if profile exists, if not create one
      let profile = await this.profileService.findById(authData.user.id);

      if (!profile) {
        const metadata = authData.user.user_metadata || {};
        profile = await this.profileService.create({
          id: authData.user.id,
          firstName: metadata.full_name?.split(' ')[0] || metadata.name?.split(' ')[0] || '',
          lastName: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.name?.split(' ').slice(1).join(' ') || '',
          documentNumber: '',
          phone: '',
        });
      }

      const token = this.tokenService.generateToken({ id: authData.user.id, email: authData.user.email });

      return {
        user: this.profileService.toUserResponse(profile, authData.user),
        token,
        session: authData.session,
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`OAuth login error: ${error.message}`);
      throw new UnauthorizedException('OAuth login failed');
    }
  }

  async logout(data: LogoutDto): Promise<any> {
    try {
      // For stateless JWT, we don't need to do anything server-side
      // The client should just discard the token
      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new BadRequestException('Logout failed');
    }
  }

  async getProfile(data: GetProfileDto & { ifNoneMatch?: string }): Promise<any> {
    const { id: userId, ifNoneMatch } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const [profile, { data: { user: authUser } }] = await Promise.all([
        this.profileService.findByIdOrFail(userId),
        supabase.auth.admin.getUserById(userId),
      ]);

      if (!authUser) {
        throw new UnauthorizedException('User not found');
      }

      // Generate ETag (simple hash of updatedAt)
      const etag = `W/"${new Date(profile.updatedAt).getTime()}"`;

      if (ifNoneMatch === etag) {
        return { status: 304 };
      }

      return {
        user: this.profileService.toUserResponse(profile, authUser),
        isProfileComplete: this.profileService.isProfileComplete(profile),
        etag,
      };
    } catch (error) {
      throw new BadRequestException('Error getting profile');
    }
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<any> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      // Update profile in local database
      const updateData: any = {};
      if (data.documentTypeId !== undefined) updateData.documentTypeId = data.documentTypeId;
      if (data.documentNumber !== undefined) updateData.documentNumber = data.documentNumber;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.pushToken !== undefined) updateData.pushToken = data.pushToken;
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.readReceiptsEnabled !== undefined) updateData.readReceiptsEnabled = data.readReceiptsEnabled;

      const profile = await this.profileService.update(userId, updateData);

      // Get auth user for response
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);

      return {
        user: this.profileService.toUserResponse(profile, authUser!),
        isProfileComplete: this.profileService.isProfileComplete(profile),
      };
    } catch (error) {
      this.logger.error(`Error updating profile: ${error.message}`);
      throw new BadRequestException('Error updating profile');
    }
  }

  private extractPublicId(url: string): string | null {
    if (!url || !url.includes('cloudinary')) return null;
    try {
      // Example: https://res.cloudinary.com/.../image/upload/v1234/folder/id.jpg
      // Split by /upload/
      const parts = url.split(/\/upload\/(?:v\d+\/)?/);
      if (parts.length < 2) return null;

      // Get the part after upload/ (and optional version)
      const publicIdWithExt = parts[1];

      // Remove extension
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");
      return publicId;
    } catch (e) {
      return null;
    }
  }

  async uploadProfilePicture(userId: string, fileBuffer: Buffer, mimeType: string): Promise<{ avatarUrl: string }> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      // 1. Check for existing avatar to delete
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      const oldAvatarUrl = user?.user_metadata?.avatar_url;

      if (oldAvatarUrl) {
        const publicId = this.extractPublicId(oldAvatarUrl);
        if (publicId) {
          try {
            await this.cloudinaryService.deleteAsset(publicId);
            this.logger.log(`🗑️ Deleted old avatar: ${publicId}`);
          } catch (delError) {
            this.logger.warn(`Failed to delete old avatar: ${delError.message}`);
          }
        }
      }

      // 2. Upload to Cloudinary
      const result = await this.cloudinaryService.uploadImage(fileBuffer, `avatar_${userId}`, 'tincadia/avatars');
      const avatarUrl = result.secure_url;

      // 3. Update Supabase Auth User metadata
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { avatar_url: avatarUrl },
      });

      if (error) {
        throw new BadRequestException('Error updating user metadata with avatar URL');
      }

      // 4. Also update the local database profile if needed
      await this.profileService.update(userId, { avatarUrl });

      this.logger.log(`✅ Avatar updated for ${userId}: ${avatarUrl}`);

      return { avatarUrl };
    } catch (error) {
      this.logger.error(`Error uploading profile picture for ${userId}:`, error);
      throw new BadRequestException('Failed to upload profile picture');
    }
  }

  async deleteProfilePicture(userId: string): Promise<{ success: boolean }> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      // 1. Get current avatar
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      const oldAvatarUrl = user?.user_metadata?.avatar_url;

      if (oldAvatarUrl) {
        const publicId = this.extractPublicId(oldAvatarUrl);
        if (publicId) {
          await this.cloudinaryService.deleteAsset(publicId);
        }
      }

      // 2. Remove from Metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { avatar_url: null },
      });

      // 3. Remove from Profile Entity
      await this.profileService.update(userId, { avatarUrl: null });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting profile picture: ${error.message}`);
      throw new BadRequestException('Error al eliminar foto de perfil');
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const payload = this.tokenService.verifyToken(token);

      // Fetch both profile and auth user (to get metadata like avatarUrl)
      const supabase = this.supabaseService.getAdminClient();
      const [profile, { data: { user: authUser } }] = await Promise.all([
        this.profileService.findByIdOrFail(payload.sub),
        supabase.auth.admin.getUserById(payload.sub)
      ]);

      if (!authUser) {
        throw new UnauthorizedException('User not found in Auth system');
      }

      return {
        user: this.profileService.toUserResponse(profile, authUser),
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
        redirectTo: 'https://tincadia.com/auth/callback?next=/reset-password', // Update this based on frontend URL
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
      const supabase = this.supabaseService.getAdminClient();

      // 1. Get all profiles from local DB
      const profiles = await this.profileService.findAllExcept(excludeUserId);

      // 2. Get all users from Supabase Auth (for email, last_sign_in, etc.)
      // 2. Get all users from Supabase Auth (for email, last_sign_in, etc.)
      const { data: { users: authUsers }, error } = await supabase.auth.admin.listUsers() as { data: { users: any[] }, error: any };

      if (error) {
        this.logger.error(`Error fetching Supabase users: ${error.message}`);
      }

      // 3. Map profiles with auth data
      const mappedUsers = profiles.map(profile => {
        const authUser = authUsers?.find(u => u.id === profile.id);

        let role = profile.role || 'User';
        // If you have roles in metadata, use them (Deprecated):
        // if (authUser?.user_metadata?.role) role = authUser.user_metadata.role;

        // Determine status
        let status = 'Inactive';
        if (authUser?.email_confirmed_at) status = 'Active';
        if ((authUser as any)?.banned_until) status = 'Banned';

        return {
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: authUser?.email || '',
          phone: profile.phone,
          role: role,
          status: status,
          lastActive: authUser?.last_sign_in_at || profile.updatedAt,
          createdAt: profile.createdAt,
          avatarUrl: profile.avatarUrl || authUser?.user_metadata?.avatar_url || null,
        };
      });

      return { users: mappedUsers };
    } catch (error) {
      this.logger.error(`Error getting users: ${error.message}`);
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
      // Use admin client to verify token and update user
      const supabase = this.supabaseService.getAdminClient();

      // 1. Verify token and get user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

      if (userError || !user) {
        throw new UnauthorizedException('Token inválido o expirado. Por favor solicita un nuevo enlace.');
      }

      // 2. Update password using Admin API
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
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

  // Interpreter Management

  // Interpreter Management

  async promoteToInterpreter(data: { email: string }) {
    const supabase = this.supabaseService.getAdminClient();

    // 1. Find user by email
    // 1. Find user by email in Auth System (since profiles might not have email synced yet)
    // We list users and find by email. Note: In a large system, this should be an RPC or direct DB query.
    const { data: authData, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      this.logger.error(`Error listing users: ${userError.message}`);
      throw new BadRequestException('Error al buscar usuario en el sistema de autenticación');
    }

    const user = authData.users.find(u => u.email === data.email);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado con ese email. El usuario debe registrarse primero.');
    }

    const userId = user.id;

    // 2. Update Role
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: 'interpreter' })
      .eq('id', userId);

    if (roleError) {
      this.logger.error(`Error updating role: ${roleError.message}`);
      throw new BadRequestException('Error actualizando rol de usuario');
    }

    return { success: true };
  }
}
