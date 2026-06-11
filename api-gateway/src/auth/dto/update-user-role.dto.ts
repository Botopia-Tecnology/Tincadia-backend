import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  USER = 'User',
  ADMIN = 'Admin',
  INTERPRETER = 'Interpreter',
}

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.INTERPRETER,
    description: 'Nuevo rol del usuario',
  })
  @IsEnum(UserRole, { message: 'El rol debe ser User, Admin o Interpreter' })
  @IsNotEmpty()
  role: UserRole;
}
