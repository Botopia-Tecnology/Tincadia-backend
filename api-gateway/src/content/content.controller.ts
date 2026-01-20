import { Controller, Get, Post, Put, Delete, Body, Inject, UseInterceptors, UploadedFile, Param, Query, Headers } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from '../payments/payments.service';
// ...
@Controller('content')
@ApiTags('content')
export class ContentController {
    constructor(
        @Inject('CONTENT_SERVICE') private readonly client: ClientProxy,
        @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
        private readonly paymentsService: PaymentsService,
    ) { }

    @Get('courses')
    @ApiOperation({ summary: 'Get all courses' })
    @ApiResponse({ status: 200, description: 'Return all courses.' })
    async findAll(@Query('after') after?: string) {
        return this.client.send('findAllCourses', { after });
    }

    @Get('categories')
    @ApiOperation({ summary: 'Get all categories' })
    async findAllCategories() {
        return this.client.send('findAllCategories', {});
    }

    @Post('categories')
    @ApiOperation({ summary: 'Create a new category' })
    async createCategory(@Body() data: any) {
        return this.client.send('createCategory', data);
    }

    @Put('categories/:id')
    @ApiOperation({ summary: 'Update category' })
    async updateCategory(@Param('id') id: string, @Body() data: any) {
        return this.client.send('updateCategory', { id, updateData: data });
    }

    @Delete('categories/:id')
    @ApiOperation({ summary: 'Delete category' })
    async deleteCategory(@Param('id') id: string) {
        return this.client.send('deleteCategory', id);
    }

    // --- Course ---

    @Post('courses')
    @ApiOperation({ summary: 'Create a new course' })
    async create(@Body() data: any) {
        return this.client.send('createCourse', data);
    }

    @Put('courses/:id')
    @ApiOperation({ summary: 'Update course' })
    async update(@Param('id') id: string, @Body() data: any) {
        return this.client.send('updateCourse', { id, updateData: data });
    }

    @Delete('courses/:id')
    @ApiOperation({ summary: 'Delete course' })
    async deleteCourse(@Param('id') id: string) {
        return this.client.send('deleteCourse', id);
    }

    @Get('courses/:id')
    @ApiOperation({ summary: 'Get course by id' })
    async findOne(
        @Param('id') id: string,
        @Headers('authorization') authHeader: string
    ) {
        let hasAccess = false;

        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                // Verify token using Auth Service
                const authResult = await firstValueFrom(
                    this.authClient.send('verify_token', { token })
                );

                if (authResult?.user?.id) {
                    // Check subscription permissions
                    hasAccess = await this.paymentsService.hasPermission(
                        authResult.user.id,
                        'ACCESS_COURSES'
                    );

                    // If no subscription access, check if user purchased the specific course
                    if (!hasAccess) {
                        hasAccess = await this.paymentsService.hasPurchasedProduct(
                            authResult.user.id,
                            id
                        );
                    }
                }
            } catch (error) {
                // Token invalid or service error, treat as no access
            }
        }

        return this.client.send('findOneCourse', { id, hasAccess });
    }

    // --- Module ---

    @Post('courses/:courseId/modules')
    @ApiOperation({ summary: 'Create a module for a course' })
    async createModule(@Param('courseId') courseId: string, @Body() data: any) {
        return this.client.send('createModule', { ...data, courseId });
    }

    @Put('modules/:id')
    @ApiOperation({ summary: 'Update module' })
    async updateModule(@Param('id') id: string, @Body() data: any) {
        return this.client.send('updateModule', { id, updateData: data });
    }

    @Delete('modules/:id')
    @ApiOperation({ summary: 'Delete module' })
    async deleteModule(@Param('id') id: string) {
        return this.client.send('deleteModule', id);
    }

    // --- Lesson ---

    @Post('modules/:moduleId/lessons')
    @ApiOperation({ summary: 'Create a lesson for a module' })
    async createLesson(@Param('moduleId') moduleId: string, @Body() data: any) {
        return this.client.send('createLesson', { ...data, moduleId });
    }

    @Put('lessons/:id')
    @ApiOperation({ summary: 'Update lesson' })
    async updateLesson(@Param('id') id: string, @Body() data: any) {
        return this.client.send('updateLesson', { id, updateData: data });
    }

    @Delete('lessons/:id')
    @ApiOperation({ summary: 'Delete lesson' })
    async deleteLesson(@Param('id') id: string) {
        return this.client.send('deleteLesson', id);
    }

    @Delete('lessons/:id/video')
    @ApiOperation({ summary: 'Remove lesson video' })
    async removeLessonVideo(@Param('id') id: string) {
        // We reuse the update method to set videoUrl to null
        return this.client.send('updateLesson', { id, updateData: { videoUrl: null, durationSeconds: null } });
    }

    @Post('lessons/:lessonId/video')
    @UseInterceptors(FileInterceptor('video'))
    @ApiOperation({ summary: 'Upload lesson video' })
    async uploadLessonVideo(
        @Param('lessonId') lessonId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.client.send('uploadLessonVideo', {
            buffer: Array.from(file.buffer),
            fileName: file.originalname,
            lessonId,
        });
    }

    @Post('courses/:courseId/thumbnail')
    @UseInterceptors(FileInterceptor('thumbnail'))
    @ApiOperation({ summary: 'Upload course thumbnail' })
    async uploadCourseThumbnail(
        @Param('courseId') courseId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.client.send('uploadCourseThumbnail', {
            buffer: Array.from(file.buffer),
            fileName: file.originalname,
            courseId,
        });
    }

    @Post('chat/media')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({ summary: 'Upload secure chat media (image/video/audio)' })
    async uploadChatMedia(
        @UploadedFile() file: Express.Multer.File,
        @Body('type') type: 'image' | 'video' | 'raw',
    ) {
        return this.client.send('uploadChatMedia', {
            buffer: Array.from(file.buffer),
            fileName: file.originalname,
            type: type || 'image',
        });
    }
    @Post('chat/media/url')
    @ApiOperation({ summary: 'Generate signed URL for private media' })
    async generateSignedUrl(@Body() data: { publicId: string; resourceType?: 'image' | 'video' | 'raw' }) {
        return this.client.send('generateSignedUrl', {
            publicId: data.publicId,
            resourceType: data.resourceType || 'image'
        });
    }

    // --- Landing Page Config ---

    @Get('landing-config')
    @ApiOperation({ summary: 'Get all landing page configurations' })
    async getLandingConfig() {
        return this.client.send('get_landing_config', {});
    }

    @Get('landing-config/:key')
    @ApiOperation({ summary: 'Get landing page config by key' })
    async getLandingConfigByKey(@Param('key') key: string) {
        return this.client.send('get_landing_config_by_key', { key });
    }

    @Put('landing-config')
    @ApiOperation({ summary: 'Update landing page config' })
    async updateLandingConfig(@Body() data: { key: string; value: string; description?: string }) {
        return this.client.send('update_landing_config', data);
    }

    @Delete('landing-config/:key')
    @ApiOperation({ summary: 'Delete landing page config by key' })
    async deleteLandingConfig(@Param('key') key: string) {
        return this.client.send('delete_landing_config', { key });
    }

    // --- Testimonials ---

    @Get('testimonials')
    @ApiOperation({ summary: 'Get all testimonials' })
    async getTestimonials() {
        return this.client.send('get_testimonials', {});
    }

    @Get('testimonials/:id')
    @ApiOperation({ summary: 'Get testimonial by id' })
    async getTestimonial(@Param('id') id: string) {
        return this.client.send('get_testimonial', { id });
    }

    @Post('testimonials')
    @ApiOperation({ summary: 'Create a new testimonial' })
    async createTestimonial(@Body() data: { authorName: string; authorRole: string; quote: string; rating?: number; order?: number }) {
        return this.client.send('create_testimonial', data);
    }

    @Put('testimonials/:id')
    @ApiOperation({ summary: 'Update testimonial' })
    async updateTestimonial(@Param('id') id: string, @Body() data: { authorName?: string; authorRole?: string; quote?: string; rating?: number; order?: number }) {
        return this.client.send('update_testimonial', { id, ...data });
    }

    @Delete('testimonials/:id')
    @ApiOperation({ summary: 'Delete testimonial' })
    async deleteTestimonial(@Param('id') id: string) {
        return this.client.send('delete_testimonial', { id });
    }

    // --- FAQs ---

    @Get('faqs')
    @ApiOperation({ summary: 'Get all FAQs' })
    async getFaqs() {
        return this.client.send('get_faqs', {});
    }

    @Get('faqs/:id')
    @ApiOperation({ summary: 'Get FAQ by id' })
    async getFaq(@Param('id') id: string) {
        return this.client.send('get_faq', { id });
    }

    @Post('faqs')
    @ApiOperation({ summary: 'Create a new FAQ' })
    async createFaq(@Body() data: { question: string; answer: string; order?: number }) {
        return this.client.send('create_faq', data);
    }

    @Put('faqs/:id')
    @ApiOperation({ summary: 'Update FAQ' })
    async updateFaq(@Param('id') id: string, @Body() data: { question?: string; answer?: string; order?: number }) {
        return this.client.send('update_faq', { id, ...data });
    }

    @Delete('faqs/:id')
    @ApiOperation({ summary: 'Delete FAQ' })
    async deleteFaq(@Param('id') id: string) {
        return this.client.send('delete_faq', { id });
    }
}
