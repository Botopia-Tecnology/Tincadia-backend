import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para el registro del token FCM (Android).
 *
 * Antes este endpoint tipaba el @Body() con un objeto inline
 * (`{ userId: string; fcmToken: string }`). Un tipo inline de TypeScript se
 * borra en tiempo de ejecucion, asi que el ValidationPipe global —que corre con
 * whitelist: true— no encontraba ninguna propiedad declarada y vaciaba el body:
 * el handler recibia undefined y el token nunca llegaba a guardarse.
 *
 * El endpoint de Expo (push-token) si usaba una clase DTO, y por eso era el
 * unico de los tres que funcionaba.
 */
export class UpdateFcmTokenDto {
  @ApiProperty({ description: 'ID del usuario dueño del dispositivo' })
  @IsUUID('4', { message: 'userId debe ser un UUID válido' })
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Token de FCM para llamadas nativas en Android' })
  @IsString()
  @IsNotEmpty({ message: 'El token de FCM es requerido' })
  @MaxLength(512)
  fcmToken: string;
}
