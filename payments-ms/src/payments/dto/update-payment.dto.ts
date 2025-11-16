import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from './create-payment.dto';

export class UpdatePaymentDto {
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

