import { IsNotEmpty, IsString } from 'class-validator';

export class StartConversationDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    otherUserId: string;
}
