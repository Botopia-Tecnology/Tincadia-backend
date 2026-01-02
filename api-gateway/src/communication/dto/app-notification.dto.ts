/**
 * DTOs for App Notifications (API Gateway)
 */

import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
    NEWS = 'news',
    UPDATE = 'update',
    PROMOTION = 'promotion',
}

export class CreateAppNotificationDto {
    @ApiProperty({ example: 'Nueva actualización disponible' })
    @IsString()
    title: string;

    @ApiProperty({ example: 'Hemos lanzado nuevas funcionalidades en Tincadia.' })
    @IsString()
    message: string;

    @ApiPropertyOptional({ example: 'news' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({ example: 'uuid-category-123' })
    @IsOptional()
    @IsString()
    categoryId?: string;

    @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
    @IsOptional()
    @IsString()
    imageUrl?: string;

    @ApiPropertyOptional({ example: 'https://tincadia.com/blog/update' })
    @IsOptional()
    @IsString()
    linkUrl?: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsNumber()
    priority?: number;

    @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    sendPush?: boolean;
}

export class UpdateAppNotificationDto {
    @ApiPropertyOptional({ example: 'Título actualizado' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: 'Mensaje actualizado' })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiPropertyOptional({ example: 'news' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({ example: 'uuid-category-123' })
    @IsOptional()
    @IsString()
    categoryId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    imageUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    linkUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    priority?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class MarkAsReadDto {
    @ApiProperty({ example: 'user-uuid-123' })
    @IsString()
    userId: string;

    @ApiProperty({ example: 'notification-uuid-456' })
    @IsString()
    notificationId: string;
}

export class CreateNotificationCategoryDto {
    @ApiProperty({ example: 'urgent_alert' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Aviso Urgente' })
    @IsString()
    label: string;

    @ApiProperty({ example: '#ff0000' })
    @IsString()
    color: string;

    @ApiPropertyOptional({ example: 'AlertTriangle' })
    @IsOptional()
    @IsString()
    icon?: string;
}

export class UpdateNotificationCategoryDto {
    @ApiPropertyOptional({ example: 'Aviso Muy Urgente' })
    @IsOptional()
    @IsString()
    label?: string;

    @ApiPropertyOptional({ example: '#cc0000' })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiPropertyOptional({ example: 'Siren' })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
