import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TextToSpeechDto {
    @ApiProperty({ example: 'Hola, ¿cómo estás?', description: 'Texto a convertir en voz' })
    @IsString()
    @IsNotEmpty()
    text: string;
}

export class ConfirmWordDto {
    @ApiProperty({ example: 'Seña', description: 'Palabra o seña confirmada' })
    @IsString()
    @IsNotEmpty()
    word: string;

    @ApiPropertyOptional({ example: 'user-uuid-123' })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiPropertyOptional({ example: '2025-05-06T12:00:00Z' })
    @IsDateString()
    @IsOptional()
    timestamp?: Date;
}

export class TranscriptionDto {
    @ApiProperty({ example: 'sala-123', description: 'Nombre de la sala para la transcripción' })
    @IsString()
    @IsNotEmpty()
    room_name: string;
}
