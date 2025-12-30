import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
    constructor(private readonly contentService: ContentService) { }

    @MessagePattern('findAllCourses')
    findAll() {
        return this.contentService.findAll();
    }

    @MessagePattern('createCourse')
    create(@Payload() data: any) {
        return this.contentService.create(data);
    }
}
