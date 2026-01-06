import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmergencyModule } from './emergency/emergency.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        EmergencyModule,
    ],
})
export class AppModule { }
