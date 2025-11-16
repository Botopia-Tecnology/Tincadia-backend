import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaymentStatus } from './create-payment.dto';

export class PaymentQueryDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

