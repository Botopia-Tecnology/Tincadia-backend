import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class CreateSubscriptionDto {
    @IsString()
    userId: string;

    @IsString()
    planId: string;

    @IsString()
    @IsOptional()
    paymentSourceId?: string;

    @IsEnum(['monthly', 'annual'])
    billingCycle: 'monthly' | 'annual';

    @IsNumber()
    amountCents: number;

    @IsString()
    @IsOptional()
    cardLastFour?: string;

    @IsString()
    @IsOptional()
    cardBrand?: string;

    @IsString()
    @IsOptional()
    paymentReference?: string;
}
