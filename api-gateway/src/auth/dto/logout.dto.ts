import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({ example: 'uuid-123', description: 'ID del usuario que cierra sesión' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Token JWT activo del usuario' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
