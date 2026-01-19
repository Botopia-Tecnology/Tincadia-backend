
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';

@Injectable()
export class PurchasesService {
    private readonly logger = new Logger(PurchasesService.name);

    constructor(
        @InjectRepository(Purchase)
        private readonly purchaseRepo: Repository<Purchase>,
    ) { }

    async create(data: Partial<Purchase>): Promise<Purchase> {
        const purchase = this.purchaseRepo.create(data);
        return this.purchaseRepo.save(purchase);
    }

    async hasPurchasedProduct(userId: string, productId: string, productType: string = 'COURSE'): Promise<boolean> {
        const count = await this.purchaseRepo.count({
            where: {
                userId,
                productId,
                productType
            }
        });
        return count > 0;
    }

    async getUserPurchases(userId: string): Promise<Purchase[]> {
        return this.purchaseRepo.find({
            where: { userId },
            order: { purchasedAt: 'DESC' }
        });
    }
}
