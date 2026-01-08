import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class GetMessagesDto {
    @IsString()
    @IsNotEmpty()
    conversationId: string;

    @IsNumber()
    @IsOptional()
    limit?: number = 50;

    @IsNumber()
    @IsOptional()
    offset?: number = 0;

    @IsDateString()
    @IsOptional()
    after?: string;
}
