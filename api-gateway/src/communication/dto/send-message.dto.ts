import { IsEmail, IsEnum, IsNotEmpty, IsString, IsObject, IsOptional, IsArray } from 'class-validator';

export enum MessageType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export class SendMessageDto {
  @IsEnum(MessageType)
  @IsNotEmpty()
  type: MessageType;

  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

