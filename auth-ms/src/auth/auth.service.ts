import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseService } from '../supabase/supabase.service';
import { Profile } from '../entities/profile.entity';
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
    private jwtService: JwtService,
    private supabaseService: SupabaseService,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
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

      // 2. Create profile in profiles table with TypeORM
      const profile = this.profileRepository.create({
        id: authData.user.id,
        firstName,
        lastName,
        documentTypeId,
        documentNumber,
        phone,
      });

      await this.profileRepository.save(profile);

      // 3. Generate JWT
      const token = this.generateJwtToken(authData.user);

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

      // Get profile from TypeORM
      const profile = await this.profileRepository.findOne({
        where: { id: authData.user.id },
        relations: ['documentType'],
      });

      const token = this.generateJwtToken(authData.user);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName: profile?.firstName || '',
          lastName: profile?.lastName || '',
          documentNumber: profile?.documentNumber || '',
          phone: profile?.phone || '',
          documentType: profile?.documentType?.name || null,
          emailVerified: !!authData.user.email_confirmed_at,
        },
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
      const token = this.generateJwtToken(supabaseUser);

      // Get or create profile
      let profile = await this.profileRepository.findOne({
        where: { id: supabaseUser.id },
      });

      if (!profile) {
        const fullName = supabaseUser.user_metadata?.full_name || '';
        const nameParts = fullName.split(' ');
        profile = this.profileRepository.create({
          id: supabaseUser.id,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          documentNumber: '',
          phone: '',
        });
        await this.profileRepository.save(profile);
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
      const payload = this.jwtService.verify(token);
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
        throw new NotFoundException('User not found');
      }

      // Get profile from TypeORM
      const profile = await this.profileRepository.findOne({
        where: { id },
        relations: ['documentType'],
      });

      return {
        user: {
          id: userData.user.id,
          email: userData.user.email,
          firstName: profile?.firstName || '',
          lastName: profile?.lastName || '',
          documentNumber: profile?.documentNumber || '',
          phone: profile?.phone || '',
          documentType: profile?.documentType?.name || null,
          emailVerified: !!userData.user.email_confirmed_at,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error getting profile');
    }
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<any> {
    try {
      const profile = await this.profileRepository.findOne({
        where: { id: userId },
      });

      if (!profile) {
        throw new NotFoundException('User not found');
      }

      // Update profile fields
      Object.assign(profile, updateData);
      await this.profileRepository.save(profile);

      return {
        user: {
          ...profile,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error updating profile');
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      const profile = await this.profileRepository.findOne({
        where: { id: payload.sub },
        relations: ['documentType'],
      });

      if (!profile) {
        throw new UnauthorizedException('Invalid user');
      }

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

  private generateJwtToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    return this.jwtService.sign(payload);
  }
}
