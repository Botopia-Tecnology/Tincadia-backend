import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdatePushTokenDto {
    @ApiProperty({
        description: 'ID del usuario',
        example: 'uuid-123'
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'Token de Expo Push Notification',
        example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    })
    @IsString()
    @IsNotEmpty()
    pushToken: string;
}
