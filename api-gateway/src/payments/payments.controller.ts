import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject('PAYMENTS_SERVICE') private readonly client: ClientProxy,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.client.send('create_payment', createPaymentDto);
  }

  @Get()
  findAll() {
    return this.client.send('find_all_payments', {});
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.client.send('find_one_payment', { id });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: any) {
    return this.client.send('update_payment', { id, updateData: updatePaymentDto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.client.send('delete_payment', { id });
  }
}

