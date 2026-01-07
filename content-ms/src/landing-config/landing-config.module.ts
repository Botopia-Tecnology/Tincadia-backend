import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingConfigService } from './landing-config.service';
import { LandingConfigController } from './landing-config.controller';
import { LandingPageConfig } from './entities/landing-config.entity';

@Module({
    imports: [TypeOrmModule.forFeature([LandingPageConfig])],
    controllers: [LandingConfigController],
    providers: [LandingConfigService],
})
export class LandingConfigModule { }
