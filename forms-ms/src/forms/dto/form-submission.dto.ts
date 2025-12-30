import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';

export class FormSubmissionDto {
  @IsString()
  @IsNotEmpty()
  formId: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @IsString()
  @IsOptional()
  submittedBy?: string;
}

