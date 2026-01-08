import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class RemoveParticipantDto {
    @ApiProperty()
    @IsString()
    conversationId: string;

    @ApiProperty()
    @IsString()
    adminId: string;

    @ApiProperty()
    @IsString()
    userIdToRemove: string;
}

export class AddParticipantDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    adminId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    userIdToAdd: string;
}

export class PromoteToAdminDto {
    @ApiProperty()
    @IsString()
    conversationId: string;

    @ApiProperty()
    @IsString()
    adminId: string;

    @ApiProperty()
    @IsString()
    userIdToPromote: string;
}

export class LeaveGroupDto {
    @ApiProperty()
    @IsString()
    conversationId: string;

    @ApiProperty()
    @IsString()
    userId: string;
}

export class UpdateGroupDto {
    @ApiProperty()
    @IsString()
    conversationId: string;

    @ApiProperty()
    @IsString()
    adminId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;
}
