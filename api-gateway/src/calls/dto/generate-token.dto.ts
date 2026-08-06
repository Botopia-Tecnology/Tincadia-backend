import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateTokenDto {
    @ApiProperty({ example: 'sala-emergencia-123', description: 'Nombre de la sala de video llamada' })
    @IsString()
    @IsNotEmpty()
    roomName: string;

    @ApiProperty({ example: 'uuid-123', description: 'ID del usuario que solicita el token' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiPropertyOptional({ example: 'Juan P?rez', description: 'Nombre que se mostrar? en la llamada', default: 'Guest' })
    @IsString()
    @IsOptional()
    username?: string;
}
