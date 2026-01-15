import { IsString, IsNumber, IsObject, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class CustomerData {
    @IsString()
    @IsOptional()
    full_name?: string;

    @IsString()
    @IsOptional()
    phone_number?: string;

    @IsString()
    @IsOptional()
    legal_id?: string;

    @IsString()
    @IsOptional()
    legal_id_type?: string;
}

class TransactionData {
    @IsString()
    id: string;

    @IsNumber()
    amount_in_cents: number;

    @IsString()
    reference: string;

    @IsString()
    @IsOptional()
    customer_email?: string;

    @ValidateNested()
    @Type(() => CustomerData)
    @IsOptional()
    customer_data?: CustomerData;

    @IsString()
    currency: string;

    @IsString()
    @IsOptional()
    payment_method_type?: string;

    @IsString()
    @IsOptional()
    redirect_url?: string;

    @IsString()
    status: string;

    @IsString()
    @IsOptional()
    finalized_at?: string;

    @IsOptional()
    shipping_address?: any;

    @IsOptional()
    payment_link_id?: string;

    @IsOptional()
    payment_source_id?: string;
}

class EventDataDto {
    @ValidateNested()
    @Type(() => TransactionData)
    transaction: TransactionData;
}

class SignatureDto {
    @IsArray()
    properties: string[];

    @IsString()
    checksum: string;
}

export class WompiEventDto {
    @IsString()
    event: string;

    @ValidateNested()
    @Type(() => EventDataDto)
    data: EventDataDto;

    @IsString()
    environment: string;

    @ValidateNested()
    @Type(() => SignatureDto)
    signature: SignatureDto;

    @IsNumber()
    timestamp: number;

    @IsString()
    sent_at: string;
}
