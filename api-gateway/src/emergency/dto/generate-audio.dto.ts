import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateAudioDto {
    @ApiProperty({
        example: 'incendio',
        description: 'Tipo de emergencia',
        enum: ['incendio', 'robo', 'accidente', 'medica', 'otro'],
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['incendio', 'robo', 'accidente', 'medica', 'otro'])
    emergencyType: string;

    @ApiProperty({
        example: 'Calle 72 con Carrera 15, Bogotá',
        description: 'Ubicación de la emergencia (dirección o coordenadas)',
    })
    @IsString()
    @IsNotEmpty()
    location: string;

    @ApiPropertyOptional({
        example: 'es',
        description: 'Idioma del audio generado. Por defecto español.',
        enum: ['es', 'en', 'pt'],
        default: 'es',
    })
    @IsString()
    @IsIn(['es', 'en', 'pt'])
    @IsOptional()
    language?: string;
}
