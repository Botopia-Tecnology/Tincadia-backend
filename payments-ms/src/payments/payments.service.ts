import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  create(data: CreatePaymentDto) {
    return { message: 'Create payment', data };
  }

  findAll(query?: PaymentQueryDto) {
    return { message: 'Find all payments', data: [], query };
  }

  findOne(id: string) {
    return { message: 'Find one payment', id };
  }

  update(id: string, data: UpdatePaymentDto) {
    return { message: 'Update payment', id, data };
  }

  remove(id: string) {
    return { message: 'Delete payment', id };
  }
}

