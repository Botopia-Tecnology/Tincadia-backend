import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModelService } from './model.service';

@Controller('model')
export class ModelController {
    constructor(private readonly modelService: ModelService) { }

    // POST /model/video-to-text
    @Post('video-to-text')
    @UseInterceptors(FileInterceptor('file'))
    async videoToText(
        @UploadedFile() file?: Express.Multer.File,
        @Body('url') url?: string,
    ) {
        return this.modelService.videoToText(file, url);
    }
}
