import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) { }

  async create(data: CreatePaymentDto) {
    const payment = this.paymentRepository.create(data);
    return this.paymentRepository.save(payment);
  }

  async findAll(query: PaymentQueryDto) {
    const { userId, status, limit = 50, page = 1 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [items, total] = await this.paymentRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async update(id: string, data: UpdatePaymentDto) {
    await this.findOne(id); // Ensure exists
    await this.paymentRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    const payment = await this.findOne(id);
    return this.paymentRepository.remove(payment);
  }
}
