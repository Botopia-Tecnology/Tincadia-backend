import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Course } from './entities/course.entity';
import { Category } from './entities/category.entity';
import { Module as CourseModule } from './entities/module.entity'; // Rename to avoid conflict
import { Lesson } from './entities/lesson.entity';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingPlan } from './entities/pricing-plan.entity';

@Module({
    imports: [
        ConfigModule.forRoot(),
        TypeOrmModule.forFeature([Course, Category, CourseModule, Lesson, PricingPlan])
    ],
    controllers: [ContentController, PricingController],
    providers: [ContentService, CloudinaryService, PricingService],
})
export class ContentModule { }
