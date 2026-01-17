import { IsString, IsNumber, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class ChargeCardDto {
    @IsString()
    @IsNotEmpty()
    reference: string;

    @IsString()
    @IsNotEmpty()
    cardToken: string;

    @IsString()
    @IsNotEmpty()
    acceptanceToken: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsNumber()
    @IsOptional()
    installments?: number;
}
