import { IsEmail, IsEnum, IsNotEmpty, IsString, IsObject, IsOptional, IsArray } from 'class-validator';

export enum MessageType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
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

  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsArray()
  @IsOptional()
  attachments?: string[];

  @IsString()
  @IsOptional()
  templateId?: string;
}

