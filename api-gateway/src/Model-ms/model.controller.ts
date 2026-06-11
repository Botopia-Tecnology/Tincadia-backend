import { Controller, Post, UploadedFile, UseInterceptors, Body, Res, StreamableFile, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { ModelService } from './model.service';
import { Response } from 'express';
import { TextToSpeechDto, ConfirmWordDto, TranscriptionDto } from './dto/model.dto';

@ApiTags('AI Models')
@ApiBearerAuth()
@Controller('model')
export class ModelController {
    constructor(private readonly modelService: ModelService) { }

    @Post('video-to-text')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Convertir video (señas) a texto' })
    @ApiResponse({ status: 200, description: 'Traducción exitosa' })
    @UseInterceptors(FileInterceptor('file'))
    async videoToText(
        @UploadedFile() file: Express.Multer.File
    ) {
        return this.modelService.videoToText(file);
    }

    @Post('video-to-audio')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Convertir video (señas) a audio' })
    @ApiResponse({ status: 200, description: 'Conversión exitosa' })
    @UseInterceptors(FileInterceptor('file'))
    async videoToAudio(
        @UploadedFile() file?: Express.Multer.File
    ) {
        return this.modelService.videoToAudio(file);
    }

    @Post('tts')
    @ApiOperation({ summary: 'Texto a Voz (TTS)' })
    @ApiResponse({ status: 200, description: 'Audio generado' })
    async textToSpeech(
        @Body() dto: TextToSpeechDto
    ) {
        return this.modelService.textToSpeech(dto.text);
    }

    @Post('confirm-word')
    @ApiOperation({ summary: 'Confirmar palabra o seña detectada' })
    @ApiResponse({ status: 200, description: 'Confirmación registrada' })
    async confirmWord(
        @Body() dto: ConfirmWordDto
    ) {
        return this.modelService.confirmWord(dto.word, dto.userId, dto.timestamp);
    }

    @Post('transcribe')
    @ApiOperation({ summary: 'Iniciar transcripción en tiempo real de una sala' })
    @ApiResponse({ status: 200, description: 'Transcripción iniciada' })
    async startTranscription(
        @Body() dto: TranscriptionDto
    ) {
        return this.modelService.startTranscription(dto.room_name);
    }

    @Post('transcribe/stop')
    @ApiOperation({ summary: 'Detener transcripción de una sala' })
    @ApiResponse({ status: 200, description: 'Transcripción detenida' })
    async stopTranscription(
        @Body() dto: TranscriptionDto
    ) {
        return this.modelService.stopTranscription(dto.room_name);
    }
}
