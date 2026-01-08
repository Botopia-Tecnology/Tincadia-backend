import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetMessagesDto {
    @ApiProperty({ description: 'ID de la conversación' })
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @ApiProperty({ description: 'Límite de mensajes', default: 50, required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    limit?: number = 50;

    @ApiProperty({ description: 'Offset para paginación', default: 0, required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    offset?: number = 0;

    @ApiProperty({ description: 'Filtrar mensajes después de esta fecha (ISO)', required: false })
    @IsDateString()
    @IsOptional()
    after?: string;
}

export class GetConversationsDto {
    @ApiProperty({ description: 'ID del usuario' })
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class MarkAsReadDto {
    @ApiProperty({ description: 'ID de la conversación' })
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @ApiProperty({ description: 'ID del usuario' })
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class EditMessageDto {
    @ApiProperty({ description: 'ID del mensaje' })
    @IsString()
    @IsNotEmpty()
    messageId: string;

    @ApiProperty({ description: 'ID del usuario' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Nuevo contenido' })
    @IsString()
    @IsNotEmpty()
    content: string;
}

export class DeleteMessageDto {
    @ApiProperty({ description: 'ID del mensaje' })
    @IsString()
    @IsNotEmpty()
    messageId: string;

    @ApiProperty({ description: 'ID del usuario' })
    @IsString()
    @IsNotEmpty()
    userId: string;
}
