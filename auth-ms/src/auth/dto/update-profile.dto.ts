import { IsString, IsOptional, IsUrl, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeAndValidatePhone } from '../../common/utils/phone.util';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsNumber()
  @IsOptional()
  documentTypeId?: number;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? normalizeAndValidatePhone(value) : value))
  phone?: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  pushToken?: string;

  @IsOptional()
  readReceiptsEnabled?: boolean;
}
