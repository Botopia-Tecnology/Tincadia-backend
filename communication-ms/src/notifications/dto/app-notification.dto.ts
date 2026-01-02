/**
 * DTOs for App Notifications
 */

import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class CreateAppNotificationDto {
    @IsString()
    title: string;

    @IsString()
    message: string;

    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

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

    @IsOptional()
    @IsBoolean()
    sendPush?: boolean;
}

export class UpdateAppNotificationDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    categoryId?: string;

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

export class CreateNotificationCategoryDto {
    @IsString()
    name: string;

    @IsString()
    label: string;

    @IsString()
    color: string;

    @IsOptional()
    @IsString()
    icon?: string;
}

export class UpdateNotificationCategoryDto {
    @IsOptional()
    @IsString()
    label?: string;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
