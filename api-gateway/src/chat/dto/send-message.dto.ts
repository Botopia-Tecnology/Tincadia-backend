import { IsNotEmpty, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ChatMessageType {
    TEXT = 'text',
    IMAGE = 'image',
    AUDIO = 'audio',
    FILE = 'file',
    VIDEO = 'video',
    CALL = 'call',
    CALL_ENDED = 'call_ended',
}

export class SendChatMessageDto {
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

    @ApiProperty({ enum: ChatMessageType, default: ChatMessageType.TEXT, required: false })
    @IsEnum(ChatMessageType)
    @IsOptional()
    type?: ChatMessageType = ChatMessageType.TEXT;

    @ApiProperty({ description: 'Metadata adicional', required: false })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
