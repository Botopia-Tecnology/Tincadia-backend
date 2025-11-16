import { IsNotEmpty, IsString, IsArray, IsEnum, IsObject } from 'class-validator';

export enum FormType {
  CONTACT = 'contact',
  APPOINTMENT = 'appointment',
  FEEDBACK = 'feedback',
  REGISTRATION = 'registration',
}

export class FormFieldDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsObject()
  @IsNotEmpty()
  validation: Record<string, any>;

  @IsArray()
  options?: any[];
}

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(FormType)
  @IsNotEmpty()
  type: FormType;

  @IsArray()
  @IsNotEmpty()
  fields: FormFieldDto[];

  @IsString()
  @IsNotEmpty()
  userId: string;
}

