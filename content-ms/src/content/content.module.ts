import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Course } from './entities/course.entity';
import { Category } from './entities/category.entity';
import { Module as CourseModule } from './entities/module.entity'; // Rename to avoid conflict
import { Lesson } from './entities/lesson.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Course, Category, CourseModule, Lesson])],
    controllers: [ContentController],
    providers: [ContentService],
})
export class ContentModule { }
