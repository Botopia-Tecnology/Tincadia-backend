import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
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
  ) { }

  async register(data: RegisterDto): Promise<any> {
    const { email, password, firstName, lastName, phoneNumber } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new ConflictException('El usuario ya existe!');
        }
        throw new BadRequestException(authError.message);
      }

      if (!authData.user) {
        throw new BadRequestException('Error al crear usuario');
      }

      const token = this.generateJwtToken(authData.user);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName,
          lastName,
          phoneNumber,
          emailVerified: false,
        },
        token,
        session: authData.session,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al registrar usuario');
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
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const token = this.generateJwtToken(authData.user);

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName: authData.user.user_metadata?.first_name || '',
          lastName: authData.user.user_metadata?.last_name || '',
          emailVerified: !!authData.user.email_confirmed_at,
        },
        token,
        session: authData.session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error al iniciar sesión');
    }
  }

  async loginWithOAuth(data: OAuthLoginDto) {
    const { provider, accessToken } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

      if (userError || !userData.user) {
        throw new UnauthorizedException('Token de OAuth inválido');
      }

      const supabaseUser = userData.user;
      const token = this.generateJwtToken(supabaseUser);

      return {
        user: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          firstName: supabaseUser.user_metadata?.full_name?.split(' ')[0] || '',
          lastName: supabaseUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
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
      throw new BadRequestException('Error al autenticar con OAuth');
    }
  }

  async logout(data: LogoutDto) {
    const { userId, token } = data;

    try {
      const payload = this.jwtService.verify(token);
      if (payload.sub !== userId) {
        throw new UnauthorizedException('Token no corresponde al usuario');
      }

      const supabase = this.supabaseService.getAdminClient();
      const { error } = await supabase.auth.admin.signOut(userId, 'global');

      if (error) {
        throw new BadRequestException(error.message);
      }

      return { message: 'Sesión cerrada exitosamente' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error al cerrar sesión');
    }
  }

  async getProfile(data: GetProfileDto) {
    const { id } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data: userData, error } = await supabase.auth.admin.getUserById(id);

      if (error || !userData.user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      return {
        user: {
          id: userData.user.id,
          email: userData.user.email,
          firstName: userData.user.user_metadata?.first_name || '',
          lastName: userData.user.user_metadata?.last_name || '',
          phoneNumber: userData.user.user_metadata?.phone_number || '',
          emailVerified: !!userData.user.email_confirmed_at,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener perfil');
    }
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    try {
      const supabase = this.supabaseService.getAdminClient();
      const { data, error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: updateData,
      });

      if (error) {
        throw new NotFoundException('Usuario no encontrado');
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          ...data.user.user_metadata,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al actualizar perfil');
    }
  }

  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const supabase = this.supabaseService.getAdminClient();
      const { data: userData, error } = await supabase.auth.admin.getUserById(payload.sub);

      if (error || !userData.user) {
        throw new UnauthorizedException('Usuario no válido');
      }

      return {
        user: {
          id: userData.user.id,
          email: userData.user.email,
          firstName: userData.user.user_metadata?.first_name || '',
          lastName: userData.user.user_metadata?.last_name || '',
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async resetPassword(data: ResetPasswordDto) {
    const { email } = data;

    try {
      const supabase = this.supabaseService.getAdminClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://tincadia.vercel.app/reset-password',
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return { message: 'Email de recuperación enviado exitosamente' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al enviar email de recuperación');
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
