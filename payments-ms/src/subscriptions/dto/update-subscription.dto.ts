import { IsString, IsOptional, IsEnum, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSubscriptionDto {
    @IsString()
    @IsOptional()
    paymentSourceId?: string;

    @IsEnum(['active', 'canceled', 'past_due', 'paused', 'trialing'])
    @IsOptional()
    status?: 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';

    @IsBoolean()
    @IsOptional()
    cancelAtPeriodEnd?: boolean;

    @IsDate()
    @IsOptional()
    @Type(() => Date)
    canceledAt?: Date;

    @IsString()
    @IsOptional()
    cardLastFour?: string;

    @IsString()
    @IsOptional()
    cardBrand?: string;
}
