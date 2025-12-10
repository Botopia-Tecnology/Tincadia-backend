import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { ProfileService } from './services/profile.service';
import { Profile, DocumentType } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, DocumentType]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        } as any,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, ProfileService],
  exports: [AuthService, TokenService, ProfileService, JwtModule],
})
export class AuthModule { }
