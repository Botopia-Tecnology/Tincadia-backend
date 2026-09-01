import { Allow, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para el registro del token VoIP / PushKit (iOS).
 *
 * Mismo problema que UpdateFcmTokenDto: el @Body() estaba tipado con un objeto
 * inline, que no sobrevive a la compilacion. Con whitelist: true el
 * ValidationPipe vaciaba el body y el token nunca se guardaba.
 */
export class UpdateVoipTokenDto {
  @ApiProperty({ description: 'ID del usuario dueño del dispositivo' })
  @IsUUID('4', { message: 'userId debe ser un UUID válido' })
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Token de PushKit para llamadas nativas en iOS' })
  // Cadena vacia = liberar el token de este dispositivo (logout).
  @IsString()
  @Allow()
  @MaxLength(512)
  voipToken: string;
}
