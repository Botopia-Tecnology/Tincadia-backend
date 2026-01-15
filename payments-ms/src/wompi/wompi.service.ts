import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface WompiTransactionData {
    reference: string;
    amountInCents: number;
    currency: string;
    customerEmail?: string;
    customerFullName?: string;
    customerPhoneNumber?: string;
    customerPhonePrefix?: string;
    customerLegalId?: string;
    customerLegalIdType?: string;
    expirationTime?: string;
    redirectUrl?: string;
    plan?: string;
}

export interface WompiWidgetConfig {
    publicKey: string;
    currency: string;
    amountInCents: number;
    reference: string;
    signatureIntegrity: string;
    redirectUrl?: string;
    expirationTime?: string;
    customerData?: {
        email?: string;
        fullName?: string;
        phoneNumber?: string;
        phoneNumberPrefix?: string;
        legalId?: string;
        legalIdType?: string;
    };
}

@Injectable()
export class WompiService {
    private readonly logger = new Logger(WompiService.name);
    private readonly publicKey: string;
    private readonly integritySecret: string;
    private readonly eventsSecret: string;
    private readonly isSandbox: boolean;
    private readonly baseUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.isSandbox = this.configService.get<string>('WOMPI_ENVIRONMENT', 'sandbox') === 'sandbox';
        this.publicKey = this.configService.get<string>('WOMPI_PUBLIC_KEY', '');
        this.integritySecret = this.configService.get<string>('WOMPI_INTEGRITY_SECRET', '');
        this.eventsSecret = this.configService.get<string>('WOMPI_EVENTS_SECRET', '');
        
        this.baseUrl = this.isSandbox 
            ? 'https://sandbox.wompi.co/v1'
            : 'https://production.wompi.co/v1';
    }

    /**
     * Genera la firma de integridad SHA256 para una transacción
     * Concatena: referencia + monto + moneda + [expirationTime] + secreto de integridad
     */
    generateIntegritySignature(
        reference: string,
        amountInCents: number,
        currency: string = 'COP',
        expirationTime?: string
    ): string {
        let concatenated = `${reference}${amountInCents}${currency}`;
        
        if (expirationTime) {
            concatenated += expirationTime;
        }
        
        concatenated += this.integritySecret;

        const signature = crypto.createHash('sha256').update(concatenated).digest('hex');
        
        this.logger.log(`🔐 Generating signature:`);
        this.logger.log(`   Reference: ${reference}`);
        this.logger.log(`   Amount: ${amountInCents}`);
        this.logger.log(`   Currency: ${currency}`);
        this.logger.log(`   Secret (first 20 chars): ${this.integritySecret.substring(0, 20)}...`);
        this.logger.log(`   Concatenated (without secret): ${reference}${amountInCents}${currency}`);
        this.logger.log(`   Signature: ${signature}`);

        return signature;
    }

    /**
     * Genera una referencia única para el pago
     */
    generateReference(prefix: string = 'TINC'): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Prepara la configuración para el Widget de Wompi
     */
    prepareWidgetConfig(data: WompiTransactionData): WompiWidgetConfig {
        const reference = data.reference || this.generateReference();
        const signature = this.generateIntegritySignature(
            reference,
            data.amountInCents,
            data.currency,
            data.expirationTime
        );

        const config: WompiWidgetConfig = {
            publicKey: this.publicKey,
            currency: data.currency || 'COP',
            amountInCents: data.amountInCents,
            reference,
            signatureIntegrity: signature,
            redirectUrl: data.redirectUrl,
            expirationTime: data.expirationTime,
        };

        if (data.customerEmail || data.customerFullName) {
            config.customerData = {
                email: data.customerEmail,
                fullName: data.customerFullName,
                phoneNumber: data.customerPhoneNumber,
                phoneNumberPrefix: data.customerPhonePrefix || '+57',
                legalId: data.customerLegalId,
                legalIdType: data.customerLegalIdType,
            };
        }

        return config;
    }

    /**
     * Valida la firma de un evento webhook de Wompi
     */
    validateEventSignature(
        properties: string[],
        eventData: any,
        timestamp: number,
        receivedChecksum: string
    ): boolean {
        // Concatenar los valores de las propiedades en orden
        let concatenated = '';
        
        for (const prop of properties) {
            const keys = prop.split('.');
            let value = eventData;
            for (const key of keys) {
                value = value?.[key];
            }
            if (value !== undefined) {
                concatenated += value;
            }
        }

        // Agregar timestamp y secreto de eventos
        concatenated += timestamp;
        concatenated += this.eventsSecret;

        const calculatedChecksum = crypto
            .createHash('sha256')
            .update(concatenated)
            .digest('hex')
            .toUpperCase();

        this.logger.debug(`Event validation - Calculated: ${calculatedChecksum}, Received: ${receivedChecksum}`);

        return calculatedChecksum === receivedChecksum.toUpperCase();
    }

    /**
     * Consulta el estado de una transacción en Wompi
     */
    async getTransaction(transactionId: string): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/${transactionId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch transaction: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            this.logger.error(`Error fetching transaction ${transactionId}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene la URL del checkout web de Wompi
     */
    getCheckoutUrl(): string {
        return 'https://checkout.wompi.co/p/';
    }

    /**
     * Obtiene la URL del widget de Wompi
     */
    getWidgetScriptUrl(): string {
        return 'https://checkout.wompi.co/widget.js';
    }

    /**
     * Verifica si estamos en modo sandbox
     */
    isInSandboxMode(): boolean {
        return this.isSandbox;
    }

    getPublicKey(): string {
        return this.publicKey;
    }
}
