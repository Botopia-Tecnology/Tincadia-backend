import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupDto {
    @ApiProperty({ description: 'ID of the user creating the group' })
    @IsNotEmpty()
    @IsUUID()
    creatorId: string;

    @ApiProperty({ description: 'Title of the group' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ description: 'Description of the group (optional)', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Image URL of the group (optional)', required: false })
    @IsOptional()
    @IsString()
    imageUrl?: string;

    @ApiProperty({ description: 'List of participant User IDs', type: [String] })
    @IsArray()
    @IsUUID('4', { each: true })
    participants: string[];
}
