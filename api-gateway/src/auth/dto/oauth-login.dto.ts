import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OAuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

export class OAuthLoginDto {
  @ApiProperty({
    enum: OAuthProvider,
    description: 'Proveedor de OAuth (Google o Apple)',
    example: 'google',
  })
  @IsEnum(OAuthProvider)
  @IsNotEmpty()
  provider: OAuthProvider;

  @ApiProperty({
    description: 'Token de acceso del proveedor OAuth',
    example: 'ya29.a0AfH6SMBx...',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiProperty({
    description: 'Token ID (opcional, usado por algunos proveedores)',
    example: 'eyJhbGciOiJSUzI1NiIs...',
    required: false,
  })
  @IsString()
  @IsOptional()
  idToken?: string;
}
