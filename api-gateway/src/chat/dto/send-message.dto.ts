import { IsNotEmpty, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    FILE = 'file',
}

export class SendMessageDto {
    @ApiProperty({ description: 'ID de la conversación' })
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @ApiProperty({ description: 'ID del remitente' })
    @IsString()
    @IsNotEmpty()
    senderId: string;

    @ApiProperty({ description: 'Contenido del mensaje' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiProperty({ enum: MessageType, default: MessageType.TEXT, required: false })
    @IsEnum(MessageType)
    @IsOptional()
    type?: MessageType = MessageType.TEXT;

    @ApiProperty({ description: 'Metadata adicional', required: false })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
