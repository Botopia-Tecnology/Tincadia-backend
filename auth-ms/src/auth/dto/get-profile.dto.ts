import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GetProfileDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsString()
  ifNoneMatch?: string;
}

