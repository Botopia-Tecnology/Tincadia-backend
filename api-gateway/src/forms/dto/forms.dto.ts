import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFormDto {
    @ApiPropertyOptional({ example: 'Nuevo Título del Formulario' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ example: 'Nueva descripción' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: [] })
    @IsOptional()
    fields?: any[];
}

export class SubmitFormDto {
    @ApiProperty({ example: 'form-uuid-123', description: 'ID del formulario' })
    @IsUUID()
    @IsNotEmpty()
    formId: string;

    @ApiProperty({ example: 'user-uuid-456', description: 'ID del usuario que envía' })
    @IsString()
    @IsNotEmpty()
    submittedBy: string;

    @ApiProperty({ example: { nombre: 'Juan', edad: 30 }, description: 'Datos del formulario' })
    @IsObject()
    @IsNotEmpty()
    data: any;
}

export class UpdateSubmissionDto {
    @ApiProperty({ example: { status: 'reviewed' }, description: 'Nuevos datos para la entrega' })
    @IsObject()
    @IsNotEmpty()
    updateData: any;
}
