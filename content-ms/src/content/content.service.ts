import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';

@Injectable()
export class ContentService {
    constructor(
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
    ) { }

    async findAll() {
        return this.courseRepository.find({ relations: ['category', 'modules'] });
    }

    async create(data: any) {
        const course = this.courseRepository.create(data);
        return this.courseRepository.save(course);
    }
}
