import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly client: ClientProxy,
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.client.send('login', loginDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.client.send('register', registerDto);
  }

  @Post('logout')
  logout(@Body() logoutDto: { userId: string; token: string }) {
    return this.client.send('logout', logoutDto);
  }

  @Get('profile/:id')
  getProfile(@Param('id') id: string) {
    return this.client.send('get_profile', { id });
  }
}

