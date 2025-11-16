import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern('create_payment')
  create(@Payload() data: CreatePaymentDto) {
    return this.paymentsService.create(data);
  }

  @MessagePattern('find_all_payments')
  findAll(@Payload() query?: PaymentQueryDto) {
    return this.paymentsService.findAll(query || {});
  }

  @MessagePattern('find_one_payment')
  findOne(@Payload() data: { id: string }) {
    return this.paymentsService.findOne(data.id);
  }

  @MessagePattern('update_payment')
  update(@Payload() data: { id: string; updateData: UpdatePaymentDto }) {
    return this.paymentsService.update(data.id, data.updateData);
  }

  @MessagePattern('delete_payment')
  remove(@Payload() data: { id: string }) {
    return this.paymentsService.remove(data.id);
  }
}

