import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class RemoveParticipantDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsString()
    @IsNotEmpty()
    adminId: string;

    @IsString()
    @IsNotEmpty()
    userIdToRemove: string;
}

export class AddParticipantDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsString()
    @IsNotEmpty()
    adminId: string;

    @IsString()
    @IsNotEmpty()
    userIdToAdd: string;
}

export class PromoteToAdminDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsString()
    @IsNotEmpty()
    adminId: string;

    @IsString()
    @IsNotEmpty()
    userIdToPromote: string;
}

export class LeaveGroupDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class UpdateGroupDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsString()
    @IsNotEmpty()
    adminId: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
