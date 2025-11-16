import { IsNotEmpty, IsString } from 'class-validator';

export class GetProfileDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

