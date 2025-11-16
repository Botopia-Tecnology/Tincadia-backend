import { IsNotEmpty, IsNumber, IsString, IsEnum, Min } from 'class-validator';

export enum PaymentMethod {
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
}

export class CreatePaymentDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

