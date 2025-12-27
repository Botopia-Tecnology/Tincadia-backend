import { IsString, IsNotEmpty } from 'class-validator';

export class UpdatePushTokenDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    pushToken: string;
}
