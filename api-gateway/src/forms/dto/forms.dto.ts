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
    @IsUUID('4', { message: 'El ID del formulario debe ser un UUID válido' })
    @IsNotEmpty({ message: 'El ID del formulario es requerido' })
    formId: string;

    @ApiProperty({ example: 'user-uuid-456', description: 'ID del usuario que envía' })
    @IsString({ message: 'Debes registrarte o iniciar sesión primero para poder enviar este formulario.' })
    @IsNotEmpty({ message: 'Debes registrarte o iniciar sesión primero para poder enviar este formulario.' })
    submittedBy: string;

    @ApiProperty({ example: { nombre: 'Juan', edad: 30 }, description: 'Datos del formulario' })
    @IsObject({ message: 'Los datos del formulario deben ser válidos' })
    @IsNotEmpty({ message: 'Los datos del formulario son requeridos' })
    data: any;
}

export class UpdateSubmissionDto {
    @ApiProperty({ example: { status: 'reviewed' }, description: 'Nuevos datos para la entrega' })
    @IsObject()
    @IsNotEmpty()
    updateData: any;
}
