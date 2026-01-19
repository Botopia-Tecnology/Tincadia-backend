import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentPlan {
    PERSONAL_FREE = 'personal_free',
    PERSONAL_PREMIUM = 'personal_premium',
    PERSONAL_CORPORATE = 'personal_corporate',
    EMPRESA_FREE = 'empresa_free',
    EMPRESA_BUSINESS = 'empresa_business',
    EMPRESA_CORPORATE = 'empresa_corporate',
    COURSE_ACCESS = 'course_access',
}

/**
 * DTO para iniciar un pago
 * 
 * SEGURIDAD: El precio NO viene del frontend.
 * Se determina en el backend basándose en planId y billingCycle.
 */
export class InitiatePaymentDto {
    @ApiProperty({ description: 'ID del plan en la base de datos' })
    @IsString()
    @IsNotEmpty()
    planId: string;

    @ApiProperty({ description: 'Tipo de plan', enum: PaymentPlan })
    @IsEnum(PaymentPlan)
    @IsNotEmpty()
    planType: PaymentPlan;

    @ApiProperty({ description: 'Ciclo de facturación', enum: ['mensual', 'anual'] })
    @IsIn(['mensual', 'anual'])
    @IsNotEmpty()
    billingCycle: 'mensual' | 'anual';

    @ApiPropertyOptional({ description: 'User ID from Auth' })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiPropertyOptional({ description: 'Customer email' })
    @IsEmail()
    @IsOptional()
    customerEmail?: string;

    @ApiPropertyOptional({ description: 'Customer full name' })
    @IsString()
    @IsOptional()
    customerName?: string;

    @ApiPropertyOptional({ description: 'Customer phone number' })
    @IsString()
    @IsOptional()
    customerPhone?: string;

    @ApiPropertyOptional({ description: 'Customer phone prefix', default: '+57' })
    @IsString()
    @IsOptional()
    customerPhonePrefix?: string;

    @ApiPropertyOptional({ description: 'Customer legal ID (CC, NIT, etc.)' })
    @IsString()
    @IsOptional()
    customerLegalId?: string;

    @ApiPropertyOptional({ description: 'Customer legal ID type (CC, CE, NIT, PP, TI, DNI, RG, OTHER)' })
    @IsString()
    @IsOptional()
    customerLegalIdType?: string;

    @ApiPropertyOptional({ description: 'Redirect URL after payment' })
    @IsString()
    @IsOptional()
    redirectUrl?: string;

    @ApiPropertyOptional({ description: 'Product Type (e.g., COURSE)' })
    @IsString()
    @IsOptional()
    productType?: string;

    @ApiPropertyOptional({ description: 'Product ID (e.g., Course ID)' })
    @IsString()
    @IsOptional()
    productId?: string;

    @ApiPropertyOptional({ description: 'Amount in cents (for one-time purchases)' })
    @IsOptional()
    amountInCents?: number;
}
