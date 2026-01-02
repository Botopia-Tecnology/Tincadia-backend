import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { Profile, DocumentType } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Profile, DocumentType],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true, // Auto-run migrations on startup
        synchronize: false,
        ssl: configService.get<string>('DB_HOST')?.includes('supabase.co')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
    SupabaseModule,
    AuthModule,
  ],
})
export class AppModule { }
