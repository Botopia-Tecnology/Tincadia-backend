import { IsNotEmpty, IsString } from 'class-validator';

export class EditMessageDto {
    @IsString()
    @IsNotEmpty()
    messageId: string;

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    content: string;
}
