import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContentService } from './content.service';
import { CloudinaryService } from './cloudinary.service';

@Controller()
export class ContentController {
    constructor(
        private readonly contentService: ContentService,
        private readonly cloudinaryService: CloudinaryService
    ) { }

    @MessagePattern('findAllCourses')
    findAll(@Payload() data?: { after?: string }) {
        return this.contentService.findAll(data?.after);
    }

    @MessagePattern('findAllCategories')
    findAllCategories() {
        return this.contentService.findAllCategories();
    }

    @MessagePattern('createCategory')
    createCategory(@Payload() data: any) {
        return this.contentService.createCategory(data);
    }

    @MessagePattern('createCourse')
    create(@Payload() data: any) {
        return this.contentService.create(data);
    }

    @MessagePattern('updateCourse')
    update(@Payload() data: { id: string; updateData: any }) {
        return this.contentService.update(data.id, data.updateData);
    }

    @MessagePattern('findOneCourse')
    findOne(@Payload() data: any) {
        // Accept legacy payload as string id or object { id, hasAccess }
        const id = typeof data === 'string' ? data : data?.id;
        const hasAccess = typeof data === 'object' ? !!data?.hasAccess : false;
        return this.contentService.findOneWithAccess(id, hasAccess);
    }

    @MessagePattern('createModule')
    createModule(@Payload() data: any) {
        return this.contentService.createModule(data);
    }

    @MessagePattern('createLesson')
    createLesson(@Payload() data: any) {
        return this.contentService.createLesson(data);
    }

    @MessagePattern('uploadLessonVideo')
    async uploadVideo(@Payload() data: { buffer: number[]; fileName: string; lessonId: string }) {
        const buffer = Buffer.from(data.buffer);

        // Fetch hierarchy for folder structure
        const hierarchy = await this.contentService.getLessonHierarchy(data.lessonId);
        const folderPath = hierarchy
            ? `Tincadia/${this.sanitize(hierarchy.categoryName)}/${this.sanitize(hierarchy.courseTitle)}/${this.sanitize(hierarchy.moduleTitle)}`
            : 'Tincadia/Uncategorized';

        const result = await this.cloudinaryService.uploadVideo(buffer, data.fileName, folderPath);
        const duration = Math.round(result.duration);
        await this.contentService.updateLessonVideo(data.lessonId, result.secure_url, duration);
        return { url: result.secure_url, duration };
    }

    @MessagePattern('uploadCourseThumbnail')
    async uploadThumbnail(@Payload() data: { buffer: number[]; fileName: string; courseId: string }) {
        const buffer = Buffer.from(data.buffer);

        // Fetch hierarchy for folder structure
        const hierarchy = await this.contentService.getCourseHierarchy(data.courseId);
        const folderPath = hierarchy
            ? `Tincadia/${this.sanitize(hierarchy.categoryName)}/${this.sanitize(hierarchy.courseTitle)}/thumbnail`
            : 'Tincadia/Uncategorized/thumbnail';

        const result = await this.cloudinaryService.uploadImage(buffer, data.fileName, folderPath);
        await this.contentService.updateCourseThumbnail(data.courseId, result.secure_url);
        return { url: result.secure_url };
    }

    private sanitize(str: string): string {
        return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    @MessagePattern('deleteCourse')
    deleteCourse(@Payload() id: string) {
        return this.contentService.deleteCourse(id);
    }

    @MessagePattern('updateCategory')
    updateCategory(@Payload() data: { id: string; updateData: any }) {
        return this.contentService.updateCategory(data.id, data.updateData);
    }

    @MessagePattern('deleteCategory')
    deleteCategory(@Payload() id: string) {
        return this.contentService.deleteCategory(id);
    }

    @MessagePattern('updateModule')
    updateModule(@Payload() data: { id: string; updateData: any }) {
        return this.contentService.updateModule(data.id, data.updateData);
    }

    @MessagePattern('deleteModule')
    deleteModule(@Payload() id: string) {
        return this.contentService.deleteModule(id);
    }

    @MessagePattern('updateLesson')
    updateLesson(@Payload() data: { id: string; updateData: any }) {
        return this.contentService.updateLesson(data.id, data.updateData);
    }

    @MessagePattern('deleteLesson')
    deleteLesson(@Payload() id: string) {
        return this.contentService.deleteLesson(id);
    }

    @MessagePattern('uploadChatMedia')
    async uploadChatMedia(@Payload() data: { buffer: number[]; fileName: string; type: 'image' | 'video' | 'raw' }) {
        const buffer = Buffer.from(data.buffer);

        // Define subfolder based on type
        let folder = 'tincadia/chat-media';
        if (data.type === 'video') folder += '/videos';
        else if (data.type === 'raw') folder += '/audio';
        else folder += '/images';

        const result = await this.cloudinaryService.uploadSecureFile(
            buffer,
            data.fileName,
            folder,
            data.type
        );
        return {
            public_id: result.public_id,
            url: result.secure_url,
            format: result.format,
            resource_type: result.resource_type
        };
    }

    @MessagePattern('generateSignedUrl')
    generateSignedUrl(@Payload() data: { publicId: string; resourceType?: string }) {
        return {
            url: this.cloudinaryService.generateSignedUrl(
                data.publicId,
                data.resourceType || 'image'
            )
        };
    }

    @MessagePattern('getUploadSignature')
    getUploadSignature(@Payload() data: any) {
        return this.cloudinaryService.getUploadSignature(data || {});
    }
}
