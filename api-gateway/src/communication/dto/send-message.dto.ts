import { IsEmail, IsEnum, IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MessageType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export class SendMessageDto {
  @ApiProperty({
    enum: MessageType,
    example: MessageType.EMAIL,
    description: 'Tipo de mensaje a enviar'
  })
  @IsEnum(MessageType)
  @IsNotEmpty()
  type: MessageType;

  @ApiProperty({ example: 'usuario@ejemplo.com', description: 'Destinatario del mensaje' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 'Bienvenido a Tincadia', description: 'Asunto del mensaje' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: '<p>Hola!</p>', description: 'Contenido del mensaje (HTML o texto)' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'noreply@tincadia.com', description: 'Remitente (opcional)' })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Metadatos adicionales para el mensaje' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateMessageDto {
  @ApiPropertyOptional({ enum: MessageType })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ example: 'usuario@ejemplo.com' })
  @IsEmail()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

