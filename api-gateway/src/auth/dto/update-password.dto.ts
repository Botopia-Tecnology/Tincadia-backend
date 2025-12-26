import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
    @ApiProperty({
        example: 'newSecurePassword123',
        description: 'Nueva contraseña del usuario (mínimo 6 caracteres)',
        minLength: 6
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
