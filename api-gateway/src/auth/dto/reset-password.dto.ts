import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'usuario@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
