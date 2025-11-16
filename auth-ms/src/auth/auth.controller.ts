import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { GetProfileDto } from './dto/get-profile.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern('login')
  login(@Payload() data: LoginDto) {
    return this.authService.login(data);
  }

  @MessagePattern('register')
  register(@Payload() data: RegisterDto) {
    return this.authService.register(data);
  }

  @MessagePattern('logout')
  logout(@Payload() data: LogoutDto) {
    return this.authService.logout(data);
  }

  @MessagePattern('get_profile')
  getProfile(@Payload() data: GetProfileDto) {
    return this.authService.getProfile(data);
  }
}

