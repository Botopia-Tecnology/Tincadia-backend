import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ChargeCardDto {
    @ApiProperty({ example: 'tok_test_12345', description: 'Token de la tarjeta de crédito generado por Wompi' })
    @IsString()
    cardToken: string;

    @ApiProperty({ example: 'uuid-user-123', description: 'ID del usuario que realiza el pago' })
    @IsString()
    userId: string;

    @ApiProperty({ example: 'uuid-plan-456', description: 'ID del plan a activar' })
    @IsString()
    planId: string;

    @ApiProperty({ example: 'mensual', enum: ['mensual', 'anual'], description: 'Ciclo de facturación' })
    @IsString()
    billingCycle: 'mensual' | 'anual';

    @ApiPropertyOptional({ example: 'usuario@email.com', description: 'Correo electrónico del cliente' })
    @IsString()
    @IsOptional()
    customerEmail?: string;
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
