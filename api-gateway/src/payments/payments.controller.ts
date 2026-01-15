import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Query,
    Headers,
    HttpCode,
    HttpStatus,
    Logger,
    UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(
        @Inject('PAYMENTS_SERVICE') private readonly client: ClientProxy,
        private readonly paymentsService: PaymentsService,
    ) {}

    /**
     * Obtiene la configuración pública de Wompi para el frontend
     */
    @Get('config')
    @ApiOperation({ summary: 'Get Wompi public configuration' })
    @ApiResponse({ status: 200, description: 'Returns Wompi public config' })
    async getConfig() {
        return firstValueFrom(this.client.send('payments.config', {}));
    }

    /**
     * Inicia un nuevo pago y devuelve la configuración del widget
     */
    @Post('initiate')
    @ApiOperation({ summary: 'Initiate a new payment' })
    @ApiResponse({ status: 201, description: 'Payment initiated successfully' })
    async initiatePayment(@Body() initiatePaymentDto: InitiatePaymentDto) {
        this.logger.log(`Initiating payment for plan: ${initiatePaymentDto.planType} (${initiatePaymentDto.planId})`);
        return firstValueFrom(this.client.send('payments.initiate', initiatePaymentDto));
    }

    /**
     * Webhook endpoint para recibir eventos de Wompi
     * Este endpoint debe ser público (sin autenticación)
     */
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Wompi webhook endpoint' })
    @ApiResponse({ status: 200, description: 'Event processed successfully' })
    async handleWebhook(
        @Body() event: any,
        @Headers('x-event-checksum') checksum: string,
    ) {
        this.logger.log(`Received Wompi webhook: ${event.event}`);
        
        return firstValueFrom(
            this.client.send('payments.webhook', { 
                event, 
                checksum: checksum || event.signature?.checksum 
            })
        );
    }

    /**
     * Verifica el estado de una transacción directamente con Wompi
     */
    @Get('verify/:transactionId')
    @ApiOperation({ summary: 'Verify payment status with Wompi' })
    @ApiResponse({ status: 200, description: 'Transaction status retrieved' })
    async verifyPayment(@Param('transactionId') transactionId: string) {
        this.logger.log(`Verifying transaction: ${transactionId}`);
        return firstValueFrom(
            this.client.send('payments.verify', { transactionId })
        );
    }

    /**
     * Obtiene un pago por su referencia
     */
    @Get('reference/:reference')
    @ApiOperation({ summary: 'Get payment by reference' })
    @ApiResponse({ status: 200, description: 'Payment found' })
    async findByReference(@Param('reference') reference: string) {
        return firstValueFrom(
            this.client.send('payments.findByReference', { reference })
        );
    }

    /**
     * Lista todos los pagos (con filtros opcionales)
     */
    @Get()
    @ApiOperation({ summary: 'List all payments' })
    @ApiResponse({ status: 200, description: 'List of payments' })
    async findAll(
        @Query('userId') userId?: string,
        @Query('status') status?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return firstValueFrom(
            this.client.send('payments.findAll', { userId, status, page, limit })
        );
    }

    /**
     * Obtiene un pago por ID
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get payment by ID' })
    @ApiResponse({ status: 200, description: 'Payment found' })
    async findOne(@Param('id') id: string) {
        return firstValueFrom(this.client.send('payments.findOne', { id }));
    }

    /**
     * Actualiza un pago
     */
    @Put(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update payment' })
    @ApiResponse({ status: 200, description: 'Payment updated' })
    async update(@Param('id') id: string, @Body() updatePaymentDto: any) {
        return firstValueFrom(
            this.client.send('payments.update', { id, updatePaymentDto })
        );
    }

    /**
     * Elimina un pago
     */
    @Delete(':id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete payment' })
    @ApiResponse({ status: 200, description: 'Payment deleted' })
    async remove(@Param('id') id: string) {
        return firstValueFrom(this.client.send('payments.remove', { id }));
    }
}
