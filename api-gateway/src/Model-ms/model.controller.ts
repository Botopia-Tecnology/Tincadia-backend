import { Controller, Post, UploadedFile, UseInterceptors, Body, Res, StreamableFile, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModelService } from './model.service';
import { Response } from 'express';

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

    // POST /model/video-to-audio
    @Post('video-to-audio')
    @UseInterceptors(FileInterceptor('file'))
    async videoToAudio(
        @UploadedFile() file?: Express.Multer.File
    ) {
        return this.modelService.videoToAudio(file);
    }

    // POST /model/confirm-word
    @Post('confirm-word')
    async confirmWord(
        @Body() body: { word: string; userId?: string; timestamp?: Date }
    ) {
        return this.modelService.confirmWord(body.word, body.userId, body.timestamp);
    }
}
