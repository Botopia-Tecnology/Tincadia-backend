import { IsString, IsOptional, IsUrl, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { normalizeAndValidatePhone } from '../../common/utils/phone.util';

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

  @ApiProperty({ example: '+573001234567', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? normalizeAndValidatePhone(value) : value))
  phone?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ example: true, required: false, description: 'Habilitar confirmaciones de lectura' })
  @IsOptional()
  readReceiptsEnabled?: boolean;
}
