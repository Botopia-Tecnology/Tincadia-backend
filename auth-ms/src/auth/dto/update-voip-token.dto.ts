import { IsString, IsNotEmpty, Allow } from 'class-validator';

/**
 * Mismo problema que UpdateFcmTokenDto: el @Payload() con tipo inline hacia que
 * el ValidationPipe de auth-ms vaciara el campo del token.
 */
export class UpdateVoipTokenDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    // Cadena vacia = liberar el token de este dispositivo (logout).
    @IsString()
    @Allow()
    voipToken: string;
}
