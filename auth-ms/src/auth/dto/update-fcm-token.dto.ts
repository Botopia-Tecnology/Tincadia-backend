import { IsString, IsNotEmpty, Allow } from 'class-validator';

/**
 * El @Payload() de update_fcm_token estaba tipado con un objeto inline. Ese
 * tipo se borra al compilar, asi que el ValidationPipe de auth-ms —que corre
 * con whitelist: true— no reconocia ninguna propiedad y vaciaba el payload:
 * el userId sobrevivia lo justo para aparecer en el log, pero fcmToken llegaba
 * undefined y se guardaba vacio.
 *
 * update_push_token ya usaba una clase DTO, y por eso era el unico que
 * funcionaba de verdad.
 */
export class UpdateFcmTokenDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    // Cadena vacia = liberar el token de este dispositivo (logout), igual que
    // en UpdatePushTokenDto.
    @IsString()
    @Allow()
    fcmToken: string;
}
