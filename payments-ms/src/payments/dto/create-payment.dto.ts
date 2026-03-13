import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsIn } from 'class-validator';

export enum PaymentPlan {
    PERSONAL_FREE = 'personal_free',
    PERSONAL_PREMIUM = 'personal_premium',
    PERSONAL_CORPORATE = 'personal_corporate',
    EMPRESA_FREE = 'empresa_free',
    EMPRESA_BUSINESS = 'empresa_business',
    EMPRESA_CORPORATE = 'empresa_corporate',
    COURSE_ACCESS = 'course_access',
}

export type BillingCycle = 'mensual' | 'anual';

/**
 * DTO para iniciar un pago
 * 
 * SEGURIDAD: El precio NO viene del frontend.
 * Se determina en el backend basándose en planId/planType y billingCycle.
 */
export class CreatePaymentDto {
    @IsString()
    @IsNotEmpty()
    planId: string; // ID del plan en la tabla pricing_plans

    @IsEnum(PaymentPlan)
    @IsNotEmpty()
    planType: PaymentPlan;

    @IsIn(['mensual', 'anual'])
    @IsNotEmpty()
    billingCycle: BillingCycle;

    @IsString()
    @IsOptional()
    userId?: string; // Se obtiene del token JWT en el API Gateway

    @IsEmail()
    @IsOptional()
    customerEmail?: string;

    @IsString()
    @IsOptional()
    customerName?: string;

    @IsString()
    @IsOptional()
    customerPhone?: string;

    @IsString()
    @IsOptional()
    customerPhonePrefix?: string;

    @IsString()
    @IsOptional()
    customerLegalId?: string;

    @IsString()
    @IsOptional()
    customerLegalIdType?: string;

    @IsString()
    @IsOptional()
    redirectUrl?: string;
}
