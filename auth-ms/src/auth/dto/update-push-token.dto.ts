import { IsString, IsNotEmpty, Allow } from 'class-validator';

export class UpdatePushTokenDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    // Cadena vacia = liberar el token de este dispositivo (logout).
    @IsString()
    @Allow()
    pushToken: string;
}
