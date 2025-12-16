import { IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddContactDto {
    @ApiProperty({ description: 'ID del usuario que agrega el contacto' })
    @IsUUID()
    @IsNotEmpty()
    ownerId: string;

    @ApiProperty({ description: 'Número de teléfono del contacto a agregar' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiPropertyOptional({ description: 'Alias personalizado para el contacto' })
    @IsString()
    @IsOptional()
    alias?: string;

    @ApiPropertyOptional({ description: 'Nombre personalizado' })
    @IsString()
    @IsOptional()
    customFirstName?: string;

    @ApiPropertyOptional({ description: 'Apellido personalizado' })
    @IsString()
    @IsOptional()
    customLastName?: string;
}

export class UpdateContactDto {
    @ApiPropertyOptional({ description: 'Alias personalizado' })
    @IsString()
    @IsOptional()
    alias?: string;

    @ApiPropertyOptional({ description: 'Nombre personalizado' })
    @IsString()
    @IsOptional()
    customFirstName?: string;

    @ApiPropertyOptional({ description: 'Apellido personalizado' })
    @IsString()
    @IsOptional()
    customLastName?: string;
}
