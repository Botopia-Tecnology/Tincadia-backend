import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { MessagePriority } from './send-message.dto';

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export class UpdateMessageDto {
  @IsEnum(MessageStatus)
  @IsOptional()
  status?: MessageStatus;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

