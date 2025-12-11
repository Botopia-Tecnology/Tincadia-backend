import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

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
}
