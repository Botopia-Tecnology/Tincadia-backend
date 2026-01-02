import { Controller, Post, Body, Get, Param, Put, Delete, Inject, HttpCode, HttpStatus, Headers, UnauthorizedException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import { Express } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly client: ClientProxy,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión con email y contraseña',
    description: 'Autentica al usuario y devuelve un token JWT y la información del usuario'
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: {
      example: {
        user: {
          id: 'uuid-123',
          email: 'usuario@ejemplo.com',
          firstName: 'Juan',
          lastName: 'Pérez',
          emailVerified: true
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        session: { access_token: '...', refresh_token: '...' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  login(@Body() loginDto: LoginDto) {
    return this.client.send('login', loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description: 'Crea una cuenta nueva con email y contraseña. El usuario recibirá un email de verificación.'
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
    schema: {
      example: {
        user: {
          id: 'uuid-456',
          email: 'nuevo@ejemplo.com',
          firstName: 'María',
          lastName: 'García',
          phoneNumber: '+1234567890',
          emailVerified: false
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        session: { access_token: '...', refresh_token: '...' }
      }
    }
  })
  @ApiResponse({ status: 409, description: 'El usuario ya existe' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  register(@Body() registerDto: RegisterDto) {
    return this.client.send('register', registerDto);
  }

  @Post('oauth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión con OAuth (Google o Apple)',
    description: 'Autentica al usuario usando token de OAuth de Google o Apple. Si el usuario no existe, se crea automáticamente.'
  })
  @ApiResponse({
    status: 200,
    description: 'Login con OAuth exitoso',
    schema: {
      example: {
        user: {
          id: 'uuid-789',
          email: 'usuario@gmail.com',
          firstName: 'Carlos',
          lastName: 'López',
          avatarUrl: 'https://lh3.googleusercontent.com/...',
          authProvider: 'google',
          emailVerified: true
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Token de OAuth inválido o expirado' })
  loginWithOAuth(@Body() oauthDto: OAuthLoginDto) {
    return this.client.send('oauth_login', oauthDto);
  }

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar token de notificaciones push',
    description: 'Guarda el token de Expo para enviar notificaciones push al dispositivo.'
  })
  @ApiResponse({ status: 200, description: 'Token actualizado exitosamente' })
  updatePushToken(@Body() data: UpdatePushTokenDto) {
    return this.client.send('update_push_token', data);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Invalida el token del usuario y cierra todas sus sesiones activas en Supabase'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'uuid-123' },
        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
      },
      required: ['userId', 'token']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión cerrada exitosamente',
    schema: { example: { message: 'Sesión cerrada exitosamente' } }
  })
  @ApiResponse({ status: 401, description: 'Token inválido o no corresponde al usuario' })
  @ApiResponse({ status: 400, description: 'Error al cerrar sesión' })
  logout(@Body() logoutDto: { userId: string; token: string }) {
    return this.client.send('logout', logoutDto);
  }

  @Get('profile/:id')
  @ApiOperation({
    summary: 'Obtener perfil de usuario por ID',
    description: 'Recupera la información del perfil de un usuario específico'
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil obtenido exitosamente',
    schema: {
      example: {
        user: {
          id: 'uuid-123',
          email: 'usuario@ejemplo.com',
          firstName: 'Juan',
          lastName: 'Pérez',
          phoneNumber: '+1234567890',
          emailVerified: true
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 400, description: 'ID inválido' })
  getProfile(@Param('id') id: string) {
    return this.client.send('get_profile', { id });
  }

  @Put('profile/:userId')
  @ApiOperation({
    summary: 'Actualizar perfil de usuario',
    description: 'Actualiza la información del perfil (nombre, apellido, teléfono, avatar). Solo se actualizan los campos enviados.'
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil actualizado exitosamente',
    schema: {
      example: {
        user: {
          id: 'uuid-123',
          email: 'usuario@ejemplo.com',
          firstName: 'Juan',
          lastName: 'Pérez Actualizado',
          phoneNumber: '+1234567890',
          avatarUrl: 'https://ejemplo.com/avatar.jpg'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  updateProfile(@Param('userId') userId: string, @Body() updateData: UpdateProfileDto) {
    return this.client.send('update_profile', { userId, updateData });
  }

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar validez del token JWT',
    description: 'Valida que el token JWT sea válido y no haya expirado, devuelve información del usuario'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
      },
      required: ['token']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Token válido',
    schema: {
      example: {
        user: {
          id: 'uuid-123',
          email: 'usuario@ejemplo.com',
          firstName: 'Juan',
          lastName: 'Pérez'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado o malformado' })
  verifyToken(@Body() data: { token: string }) {
    return this.client.send('verify_token', data);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña',
    description: 'Envía un email al usuario con un enlace para restablecer su contraseña. El enlace redirige a la aplicación frontend.'
  })
  @ApiResponse({
    status: 200,
    description: 'Email de recuperación enviado exitosamente',
    schema: { example: { message: 'Email de recuperación enviado exitosamente' } }
  })
  @ApiResponse({ status: 400, description: 'Email inválido o error al enviar email' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.client.send('reset_password', resetPasswordDto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener usuario actual',
    description: 'Obtiene la información del usuario autenticado a partir del token JWT en el header Authorization'
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario obtenido exitosamente',
    schema: {
      example: {
        user: {
          id: 'uuid-123',
          email: 'usuario@ejemplo.com',
          firstName: 'Juan',
          lastName: 'Pérez',
          documentNumber: '12345678',
          phone: '+1234567890'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado o no proporcionado' })
  getMe(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    return this.client.send('verify_token', { token });
  }

  @Get('users/:userId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener todos los usuarios disponibles',
    description: 'Retorna lista de usuarios excluyendo al usuario actual'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios',
    schema: {
      example: {
        users: [
          { id: 'uuid-123', firstName: 'Juan', lastName: 'Pérez', phone: '+123456789' }
        ]
      }
    }
  })
  getUsers(@Param('userId') userId: string) {
    return this.client.send('get_users', { excludeUserId: userId });
  }

  @Post('update-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar contraseña del usuario',
    description: 'Actualiza la contraseña del usuario usando el token de recuperación de Supabase. Requiere el access_token en el header Authorization.'
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
    schema: { example: { message: 'Contraseña actualizada exitosamente' } }
  })
  @ApiResponse({ status: 400, description: 'Error al actualizar contraseña o contraseña inválida' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  updatePassword(
    @Headers('authorization') authHeader: string,
    @Body() updatePasswordDto: UpdatePasswordDto
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const accessToken = authHeader.replace('Bearer ', '');
    if (!accessToken) {
      throw new UnauthorizedException('Token is required');
    }

    return this.client.send('update_password', {
      accessToken,
      password: updatePasswordDto.password
    });
  }

  @Post('profile/:userId/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir foto de perfil' })
  @ApiResponse({ status: 201, description: 'Foto subida exitosamente' })
  async uploadAvatar(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');

    return this.client.send('upload_profile_picture', {
      userId,
      file: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Delete('profile/:userId/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar foto de perfil' })
  @ApiResponse({ status: 200, description: 'Foto eliminada exitosamente' })
  deleteAvatar(@Param('userId') userId: string) {
    return this.client.send('delete_profile_picture', { userId });
  }

}

