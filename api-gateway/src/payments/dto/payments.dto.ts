import {
    IsEmail,
    IsNotEmpty,
    IsString,
    IsOptional,
    IsNumber,
    IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ChargeCardDto {
    @ApiProperty({ example: 'TINC-20260818-ABC123', description: 'Referencia del pago creada por /payments/initiate' })
    @IsString()
    @IsNotEmpty()
    reference: string;

    @ApiProperty({ example: 'tok_test_12345', description: 'Token de la tarjeta de crédito generado por Wompi' })
    @IsString()
    @IsNotEmpty()
    cardToken: string;

    @ApiProperty({ example: 'acceptance-token', description: 'Token de aceptación de términos devuelto por Wompi' })
    @IsString()
    @IsNotEmpty()
    acceptanceToken: string;

    @ApiProperty({ example: 'usuario@email.com', description: 'Correo electrónico usado para crear el pago en Wompi' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiPropertyOptional({ example: 1, description: 'Número de cuotas' })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    installments?: number;
}

export class UpdatePaymentDto {
    @ApiPropertyOptional({ example: 'APPROVED', description: 'Nuevo estado del pago', enum: ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiPropertyOptional({ example: 'txn_wompi_abc123', description: 'ID de transacción de Wompi' })
    @IsString()
    @IsOptional()
    transactionId?: string;

    @ApiPropertyOptional({ example: 150000, description: 'Monto del pago en centavos' })
    @IsNumber()
    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    amountCents?: number;
}
