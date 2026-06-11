import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateTokenDto {
    @ApiProperty({ example: 'sala-emergencia-123', description: 'Nombre de la sala de video llamada' })
    @IsString()
    @IsNotEmpty()
    roomName: string;

    @ApiPropertyOptional({ example: 'Juan Pérez', description: 'Nombre que se mostrará en la llamada', default: 'Guest' })
    @IsString()
    @IsOptional()
    username?: string;
}
