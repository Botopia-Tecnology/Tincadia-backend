/**
 * DTOs for App Notifications
 */

import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { NotificationType } from '../entities/app-notification.entity';

export class CreateAppNotificationDto {
    @IsString()
    title: string;

    @IsString()
    message: string;

    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    linkUrl?: string;

    @IsOptional()
    @IsNumber()
    priority?: number;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class UpdateAppNotificationDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    linkUrl?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    priority?: number;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class MarkAsReadDto {
    @IsString()
    userId: string;

    @IsString()
    notificationId: string;
}
