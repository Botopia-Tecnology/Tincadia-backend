import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, IsInt, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ===================== CATEGORY =====================

export class CreateCategoryDto {
    @ApiProperty({ example: 'Lengua de Señas Colombiana', description: 'Nombre de la categoría' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Cursos relacionados con LSC', description: 'Descripción de la categoría' })
    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateCategoryDto {
    @ApiPropertyOptional({ example: 'LSC Avanzado', description: 'Nuevo nombre de la categoría' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ example: 'Contenido avanzado de LSC', description: 'Nueva descripción' })
    @IsString()
    @IsOptional()
    description?: string;
}

// ===================== COURSE =====================

export class CreateCourseDto {
    @ApiProperty({ example: 'Introducción a la LSC', description: 'Título del curso' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Aprende los fundamentos de la Lengua de Señas Colombiana', description: 'Descripción del curso' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'uuid-categoria-123', description: 'ID de la categoría a la que pertenece el curso' })
    @IsUUID()
    @IsNotEmpty()
    categoryId: string;

    @ApiPropertyOptional({ example: false, description: 'Si el curso está publicado y visible para los usuarios' })
    @IsBoolean()
    @IsOptional()
    isPublished?: boolean;

    @ApiPropertyOptional({
        example: 'free',
        description: 'Scope de acceso: free | course | module | lesson',
        enum: ['free', 'course', 'module', 'lesson'],
    })
    @IsString()
    @IsOptional()
    accessScope?: string;

    @ApiPropertyOptional({ example: false, description: 'Si el curso completo es de pago' })
    @IsBoolean()
    @IsOptional()
    isPaid?: boolean;

    @ApiPropertyOptional({ example: 3, description: 'Número de lecciones disponibles como vista previa gratuita' })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    previewLimit?: number;

    @ApiPropertyOptional({ example: ['Aprenderás el alfabeto', 'Comunicación básica'], description: 'Lista de puntos de aprendizaje' })
    @IsArray()
    @IsOptional()
    learningPoints?: string[];
}

export class UpdateCourseDto {
    @ApiPropertyOptional({ example: 'LSC Intermedio', description: 'Nuevo título del curso' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ example: 'Nivel intermedio de LSC', description: 'Nueva descripción del curso' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 'uuid-categoria-456', description: 'Nueva categoría del curso' })
    @IsUUID()
    @IsOptional()
    categoryId?: string;

    @ApiPropertyOptional({ example: true, description: 'Estado de publicación del curso' })
    @IsBoolean()
    @IsOptional()
    isPublished?: boolean;

    @ApiPropertyOptional({ example: 'module', enum: ['free', 'course', 'module', 'lesson'] })
    @IsString()
    @IsOptional()
    accessScope?: string;

    @ApiPropertyOptional({ example: false })
    @IsBoolean()
    @IsOptional()
    isPaid?: boolean;

    @ApiPropertyOptional({ example: 4 })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    previewLimit?: number;

    @ApiPropertyOptional({ example: ['Vocabulario avanzado', 'Gramática de señas'] })
    @IsArray()
    @IsOptional()
    learningPoints?: string[];
}

// ===================== MODULE =====================

export class CreateModuleDto {
    @ApiProperty({ example: 'Módulo 1: Fundamentos', description: 'Título del módulo' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Introducción a los conceptos básicos', description: 'Descripción del módulo' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 0, description: 'Orden del módulo dentro del curso', minimum: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    order?: number;

    @ApiPropertyOptional({ example: false, description: 'Si el módulo completo requiere pago' })
    @IsBoolean()
    @IsOptional()
    isPaid?: boolean;
}

export class UpdateModuleDto {
    @ApiPropertyOptional({ example: 'Módulo 2: Vocabulario', description: 'Nuevo título del módulo' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ example: 'Vocabulario cotidiano en señas', description: 'Nueva descripción del módulo' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 1, minimum: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    order?: number;

    @ApiPropertyOptional({ example: true })
    @IsBoolean()
    @IsOptional()
    isPaid?: boolean;
}

// ===================== LESSON =====================

export class CreateLessonDto {
    @ApiProperty({ example: 'Lección 1: El alfabeto', description: 'Título de la lección' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'En esta lección aprenderás el alfabeto manual completo.', description: 'Contenido descriptivo de la lección' })
    @IsString()
    @IsOptional()
    content?: string;

    @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...', description: 'URL del video en Cloudinary' })
    @IsString()
    @IsOptional()
    videoUrl?: string;

    @ApiPropertyOptional({ example: 300, description: 'Duración del video en segundos' })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    durationSeconds?: number;

    @ApiPropertyOptional({ example: 0, description: 'Orden de la lección dentro del módulo', minimum: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    order?: number;

    @ApiPropertyOptional({ example: false, description: 'Si la lección requiere pago para ver el video' })
    @IsBoolean()
    @IsOptional()
    isPaid?: boolean;

    @ApiPropertyOptional({ example: true, description: 'Si la lección es una vista previa gratuita aunque el curso sea de pago' })
    @IsBoolean()
    @IsOptional()
    isFreePreview?: boolean;
}

export class UpdateLessonDto {
    @ApiPropertyOptional({ example: 'Lección 1 actualizada', description: 'Nuevo título de la lección' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ example: 'Contenido actualizado de la lección.' })
    @IsString()
    @IsOptional()
    content?: string;

    @ApiPropertyOptional({ example: 'https://res.cloudinary.com/nuevo-video...' })
    @IsString()
    @IsOptional()
    videoUrl?: string;

    @ApiPropertyOptional({ example: 420 })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    durationSeconds?: number;

    @ApiPropertyOptional({ example: 1, minimum: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    order?: number;

    @ApiPropertyOptional({ example: true })
    @IsBoolean()
    @IsOptional()
    isPaid?: boolean;

    @ApiPropertyOptional({ example: false })
    @IsBoolean()
    @IsOptional()
    isFreePreview?: boolean;
}

// ===================== TESTIMONIAL =====================

export class CreateTestimonialDto {
    @ApiProperty({ example: 'María García', description: 'Nombre de la persona que da el testimonio' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Docente de primaria', description: 'Rol o profesión del autor del testimonio' })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiProperty({ example: 'Tincadia me ayudó a comunicarme con mis estudiantes sordos.', description: 'Texto del testimonio' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiPropertyOptional({ example: 'https://res.cloudinary.com/avatar.jpg', description: 'URL de la foto del autor' })
    @IsString()
    @IsOptional()
    avatarUrl?: string;

    @ApiPropertyOptional({ example: 5, description: 'Calificación de 1 a 5' })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    rating?: number;
}

export class UpdateTestimonialDto {
    @ApiPropertyOptional({ example: 'Carlos López' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ example: 'Ingeniero de sistemas' })
    @IsString()
    @IsOptional()
    role?: string;

    @ApiPropertyOptional({ example: 'La mejor plataforma de lengua de señas.' })
    @IsString()
    @IsOptional()
    content?: string;

    @ApiPropertyOptional({ example: 'https://res.cloudinary.com/nuevo-avatar.jpg' })
    @IsString()
    @IsOptional()
    avatarUrl?: string;

    @ApiPropertyOptional({ example: 4 })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    rating?: number;
}

// ===================== FAQ =====================

export class CreateFaqDto {
    @ApiProperty({ example: '¿Tincadia tiene versión gratuita?', description: 'Pregunta de la FAQ' })
    @IsString()
    @IsNotEmpty()
    question: string;

    @ApiProperty({ example: 'Sí, Tincadia ofrece acceso gratuito a contenido básico.', description: 'Respuesta a la pregunta' })
    @IsString()
    @IsNotEmpty()
    answer: string;

    @ApiPropertyOptional({ example: 0, description: 'Orden de aparición de la FAQ', minimum: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    order?: number;
}

export class UpdateFaqDto {
    @ApiPropertyOptional({ example: '¿Puedo usar Tincadia offline?' })
    @IsString()
    @IsOptional()
    question?: string;

    @ApiPropertyOptional({ example: 'Actualmente Tincadia requiere conexión a internet.' })
    @IsString()
    @IsOptional()
    answer?: string;

    @ApiPropertyOptional({ example: 1, minimum: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    order?: number;
}
