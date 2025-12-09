import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum OAuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

export class OAuthLoginDto {
  @IsEnum(OAuthProvider)
  @IsNotEmpty()
  provider: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  accessToken: string; // Token de acceso del proveedor OAuth

  @IsString()
  @IsOptional()
  idToken?: string; // Token ID (opcional, usado por algunos proveedores)
}
