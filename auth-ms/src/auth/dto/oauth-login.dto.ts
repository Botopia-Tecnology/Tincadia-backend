import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum OAuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
  MICROSOFT = 'microsoft',
}

export class OAuthLoginDto {
  @IsEnum(OAuthProvider)
  @IsNotEmpty()
  provider: OAuthProvider;

  @IsString()
  @IsOptional()
  accessToken?: string; // Token de acceso del proveedor OAuth (opcional)

  @IsString()
  @IsOptional()
  idToken?: string; // Token ID (opcional, usado por algunos proveedores)
}
