import { IsNotEmpty, IsString } from 'class-validator';

export class GetConversationsDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}
