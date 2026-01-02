import { IsNotEmpty, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    AUDIO = 'audio',
    FILE = 'file',
    VIDEO = 'video',
    CALL = 'call',
    CALL_ENDED = 'call_ended',
}

export class SendMessageDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsString()
    @IsNotEmpty()
    senderId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsEnum(MessageType)
    @IsOptional()
    type?: MessageType = MessageType.TEXT;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
