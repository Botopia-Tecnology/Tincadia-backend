import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Allow } from 'class-validator';

export class UpdatePushTokenDto {
    @ApiProperty({
        description: 'ID del usuario',
        example: 'uuid-123'
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'Token de Expo Push Notification. Cadena vacia para borrar el token al cerrar sesion.',
        example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    })
    // Sin @IsNotEmpty: el logout envia '' para liberar el token del dispositivo.
    // Con @IsNotEmpty el ValidationPipe global respondia 400 y el token nunca se borraba.
    @IsString()
    @Allow()
    pushToken: string;
}
