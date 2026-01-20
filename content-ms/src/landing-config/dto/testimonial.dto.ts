import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateTestimonialDto {
    @IsString()
    authorName: string;

    @IsString()
    authorRole: string;

    @IsString()
    quote: string;

    @IsNumber()
    @Min(1)
    @Max(5)
    @IsOptional()
    rating?: number;

    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateTestimonialDto {
    @IsString()
    id: string;

    @IsString()
    @IsOptional()
    authorName?: string;

    @IsString()
    @IsOptional()
    authorRole?: string;

    @IsString()
    @IsOptional()
    quote?: string;

    @IsNumber()
    @Min(1)
    @Max(5)
    @IsOptional()
    rating?: number;

    @IsNumber()
    @IsOptional()
    order?: number;
}
