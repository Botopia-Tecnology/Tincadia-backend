import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
    imports: [ConfigModule],
    controllers: [EmergencyController],
    providers: [EmergencyService],
})
export class EmergencyModule { }
