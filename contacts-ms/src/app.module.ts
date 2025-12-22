import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsModule } from './contacts/contacts.module';
import {
  ContactMatchCache,
  ContactSyncChunkResult,
  ContactSyncState,
  Profile,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        entities: [Profile, ContactSyncState, ContactMatchCache, ContactSyncChunkResult],
        synchronize: false,
        ssl: configService.get<string>('DB_HOST')?.includes('supabase.co')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
    ContactsModule,
  ],
})
export class AppModule {}









