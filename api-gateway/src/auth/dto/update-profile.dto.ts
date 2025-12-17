import { IsString, IsOptional, IsUrl, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Juan', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Pérez', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 1, required: false, description: 'ID del tipo de documento' })
  @IsNumber()
  @IsOptional()
  documentTypeId?: number;

  @ApiProperty({ example: '12345678', required: false, description: 'Número de documento' })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
