import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Motivos por los que el registro de un push token no llega a completarse.
 * Se corresponden uno a uno con los puntos de salida de registerForPush()
 * en la app (src/hooks/useNotifications.ts).
 */
export const PUSH_DIAGNOSTIC_REASONS = [
  'permiso_denegado',            // el usuario rechazó las notificaciones
  'permiso_denegado_permanente', // denegado sin posibilidad de volver a pedir
  'token_vacio',                 // Expo devolvió un token vacío
  'error_obtener_token',         // getExpoPushTokenAsync lanzó excepción
  'no_es_dispositivo',           // emulador
  'error_backend',               // el backend rechazó el token
  'fcm_error',                   // messaging().getToken() falló
] as const;

/**
 * Reporte de por qué NO se pudo registrar un push token.
 *
 * Existe porque el fallo era mudo: si la app no conseguía el token, no llegaba
 * ninguna petición y en los logs del backend no quedaba rastro. Con usuarios
 * remotos —sin acceso a su consola— era imposible distinguir "permiso
 * denegado" de "error de credenciales" o de "el efecto nunca corrió".
 */
export class PushDiagnosticDto {
  @ApiProperty({ enum: PUSH_DIAGNOSTIC_REASONS })
  @IsString()
  @IsIn(PUSH_DIAGNOSTIC_REASONS as unknown as string[])
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ required: false, description: 'expo | fcm | voip' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  kind?: string;

  @ApiProperty({ required: false, description: 'Detalle del error, truncado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @ApiProperty({ required: false, description: 'android | ios' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  @ApiProperty({ required: false, description: 'Versión de la app' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}
