import { IsOptional, IsString, IsArray, IsEnum, IsObject } from 'class-validator';
import { FormFieldDto, FormType } from './create-form.dto';

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FormType)
  @IsOptional()
  type?: FormType;

  @IsArray()
  @IsOptional()
  fields?: FormFieldDto[];

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

