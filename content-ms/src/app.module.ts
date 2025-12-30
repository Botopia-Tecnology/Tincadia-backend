import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentModule } from './content/content.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: parseInt(configService.get<string>('DB_PORT') || '5432'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Auto-schema sync (careful in prod, good for dev)
          ssl: configService.get<string>('DB_HOST')?.includes('railway') || 
               configService.get<string>('DB_HOST')?.includes('supabase') ||
               configService.get<string>('DB_HOST')?.includes('supabase.co')
            ? { rejectUnauthorized: false }
            : false,
        };
      },
    }),
    ContentModule,
  ],
})
export class AppModule { }
