import { IsString, IsOptional, IsUrl, IsNumber } from 'class-validator';

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
  phone?: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  pushToken?: string;
}
