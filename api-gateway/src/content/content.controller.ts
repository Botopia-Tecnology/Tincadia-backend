import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Content')
@Controller('content')
export class ContentController {
    constructor(
        @Inject('CONTENT_SERVICE') private readonly client: ClientProxy,
    ) { }

    @Get('courses')
    @ApiOperation({ summary: 'Get all courses' })
    @ApiResponse({ status: 200, description: 'Return all courses.' })
    async findAll() {
        return this.client.send('findAllCourses', {});
    }

    @Post('courses')
    @ApiOperation({ summary: 'Create a new course' })
    async create(@Body() data: any) {
        return this.client.send('createCourse', data);
    }
}
