import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { GetProfileDto } from './dto/get-profile.dto';

@Injectable()
export class AuthService {
  login(data: LoginDto) {
    return { message: 'Login endpoint', data };
  }

  register(data: RegisterDto) {
    return { message: 'Register endpoint', data };
  }

  logout(data: LogoutDto) {
    return { message: 'Logout endpoint', data };
  }

  getProfile(data: GetProfileDto) {
    return { message: 'Get profile endpoint', data };
  }
}

