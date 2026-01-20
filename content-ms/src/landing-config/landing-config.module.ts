import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingConfigService } from './landing-config.service';
import { LandingConfigController } from './landing-config.controller';
import { LandingPageConfig } from './entities/landing-config.entity';
import { Testimonial } from './entities/testimonial.entity';
import { FAQ } from './entities/faq.entity';

@Module({
    imports: [TypeOrmModule.forFeature([LandingPageConfig, Testimonial, FAQ])],
    controllers: [LandingConfigController],
    providers: [LandingConfigService],
})
export class LandingConfigModule { }

