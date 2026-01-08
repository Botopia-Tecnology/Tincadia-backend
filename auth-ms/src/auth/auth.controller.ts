import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { GetProfileDto } from './dto/get-profile.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateInterpreterRequestDto } from './dto/create-interpreter-request.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @MessagePattern('login')
  login(@Payload() data: LoginDto): Promise<any> {
    return this.authService.login(data);
  }

  @MessagePattern('register')
  register(@Payload() data: RegisterDto): Promise<any> {
    return this.authService.register(data);
  }

  @MessagePattern('oauth_login')
  loginWithOAuth(@Payload() data: OAuthLoginDto): Promise<any> {
    return this.authService.loginWithOAuth(data);
  }

  @MessagePattern('logout')
  logout(@Payload() data: LogoutDto): Promise<any> {
    return this.authService.logout(data);
  }

  @MessagePattern('get_profile')
  getProfile(@Payload() data: GetProfileDto): Promise<any> {
    return this.authService.getProfile(data);
  }

  @MessagePattern('verify_token')
  verifyToken(@Payload() data: { token: string }): Promise<any> {
    return this.authService.verifyToken(data.token);
  }

  @MessagePattern('update_profile')
  updateProfile(@Payload() data: { userId: string; updateData: UpdateProfileDto }): Promise<any> {
    return this.authService.updateProfile(data.userId, data.updateData);
  }

  @MessagePattern('update_push_token')
  updatePushToken(@Payload() data: UpdatePushTokenDto): Promise<void> {
    return this.authService.updatePushToken(data.userId, data.pushToken);
  }

  @MessagePattern('reset_password')
  resetPassword(@Payload() data: ResetPasswordDto): Promise<any> {
    return this.authService.resetPassword(data);
  }

  @MessagePattern('get_users')
  getUsers(@Payload() data: { excludeUserId: string }): Promise<any> {
    return this.authService.getUsers(data.excludeUserId);
  }

  @MessagePattern('update_password')
  updatePassword(@Payload() data: { accessToken: string; password: string }): Promise<any> {
    return this.authService.updatePassword(data.accessToken, { password: data.password });
  }

  @MessagePattern('upload_profile_picture')
  uploadProfilePicture(@Payload() data: { userId: string; file: { data: number[] } | Buffer; mimeType: string }): Promise<{ avatarUrl: string }> {
    // Reconstruct Buffer from network payload
    const buffer = Buffer.isBuffer(data.file) ? data.file : Buffer.from(data.file.data);
    return this.authService.uploadProfilePicture(data.userId, buffer, data.mimeType);
  }

  @MessagePattern('delete_profile_picture')
  deleteProfilePicture(@Payload() data: { userId: string }): Promise<any> {
    return this.authService.deleteProfilePicture(data.userId);
  }

  // Interpreter Management
  @MessagePattern('promote_to_interpreter')
  promoteToInterpreter(@Payload() data: { email: string }): Promise<any> {
    return this.authService.promoteToInterpreter(data);
  }

}
