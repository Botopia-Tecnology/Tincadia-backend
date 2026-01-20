import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateFaqDto {
    @IsString()
    question: string;

    @IsString()
    answer: string;

    @IsNumber()
    @IsOptional()
    order?: number;
}

export class UpdateFaqDto {
    @IsString()
    id: string;

    @IsString()
    @IsOptional()
    question?: string;

    @IsString()
    @IsOptional()
    answer?: string;

    @IsNumber()
    @IsOptional()
    order?: number;
}
