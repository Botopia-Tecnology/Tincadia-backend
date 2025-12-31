import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { Lesson } from './entities/lesson.entity';
import { Module as CourseModule } from './entities/module.entity';
import { Category } from './entities/category.entity';

@Injectable()
export class ContentService {
    constructor(
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
        @InjectRepository(Lesson)
        private lessonRepository: Repository<Lesson>,
        @InjectRepository(CourseModule)
        private moduleRepository: Repository<CourseModule>,
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
    ) { }

    async findAll() {
        return this.courseRepository.find({ relations: ['category', 'modules'] });
    }

    async findAllCategories() {
        return this.categoryRepository.find();
    }

    async createCategory(data: { name: string; description?: string }) {
        const category = this.categoryRepository.create(data);
        return this.categoryRepository.save(category);
    }

    async create(data: any) {
        const course = this.courseRepository.create(data);
        return this.courseRepository.save(course);
    }

    async update(id: string, data: any) {
        await this.courseRepository.update(id, data);
        return this.findOne(id);
    }

    async findOne(id: string) {
        return this.courseRepository.findOne({
            where: { id },
            relations: ['category', 'modules', 'modules.lessons'],
            order: {
                modules: {
                    order: 'ASC',
                    lessons: {
                        order: 'ASC'
                    }
                }
            }
        });
    }

    async createModule(data: any) {
        const module = this.moduleRepository.create(data);
        return this.moduleRepository.save(module);
    }

    async createLesson(data: any) {
        const lesson = this.lessonRepository.create(data);
        return this.lessonRepository.save(lesson);
    }

    async updateLessonVideo(lessonId: string, videoUrl: string, durationSeconds?: number) {
        // Find lesson first to ensure it exists
        // Note: You'll need to inject LessonRepository in constructor
        const lesson = await this.lessonRepository.findOneBy({ id: lessonId });
        if (lesson) {
            lesson.videoUrl = videoUrl;
            if (durationSeconds) lesson.durationSeconds = durationSeconds;
            return this.lessonRepository.save(lesson);
        }
        return null;
    }

    async updateCourseThumbnail(courseId: string, thumbnailUrl: string) {
        return this.courseRepository.update(courseId, { thumbnailUrl });
    }

    async deleteCourse(id: string) {
        return this.courseRepository.delete(id);
    }

    // --- Category CRUD ---
    async updateCategory(id: string, data: any) {
        await this.categoryRepository.update(id, data);
        return this.categoryRepository.findOneBy({ id });
    }

    async deleteCategory(id: string) {
        return this.categoryRepository.delete(id);
    }

    // --- Module CRUD ---
    async updateModule(id: string, data: any) {
        await this.moduleRepository.update(id, data);
        return this.moduleRepository.findOneBy({ id });
    }

    async deleteModule(id: string) {
        return this.moduleRepository.delete(id);
    }

    // --- Lesson CRUD ---
    async updateLesson(id: string, data: any) {
        await this.lessonRepository.update(id, data);
        return this.lessonRepository.findOneBy({ id });
    }

    async deleteLesson(id: string) {
        return this.lessonRepository.delete(id);
    }

    // --- Helpers for Cloudinary Hierarchy ---

    async getLessonHierarchy(lessonId: string) {
        const lesson = await this.lessonRepository.findOne({
            where: { id: lessonId },
            relations: ['module', 'module.course', 'module.course.category'],
        });

        if (!lesson) return null;

        const categoryName = lesson.module?.course?.category?.name || 'Uncategorized';
        const courseTitle = lesson.module?.course?.title || 'Unknown Course';
        const moduleTitle = lesson.module?.title || 'Unknown Module';

        return { categoryName, courseTitle, moduleTitle };
    }

    async getCourseHierarchy(courseId: string) {
        const course = await this.courseRepository.findOne({
            where: { id: courseId },
            relations: ['category'],
        });

        if (!course) return null;

        const categoryName = course.category?.name || 'Uncategorized';
        const courseTitle = course.title || 'Unknown Course';

        return { categoryName, courseTitle };
    }
}
