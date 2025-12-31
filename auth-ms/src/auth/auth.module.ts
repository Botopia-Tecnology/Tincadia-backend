import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { ProfileService } from './services/profile.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Profile } from '../entities/profile.entity';
import { DocumentType } from '../entities/document-type.entity';

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
  providers: [AuthService, TokenService, ProfileService, SupabaseService, CloudinaryService],
  exports: [AuthService, TokenService, ProfileService, JwtModule],
})
export class AuthModule { }
