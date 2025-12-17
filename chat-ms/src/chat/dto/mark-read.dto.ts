import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class MarkReadDto {
    @IsString()
    @IsNotEmpty()
    roomId: string;

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsOptional()
    lastMessageId?: string;
}
