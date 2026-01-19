import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaymentsService {
    constructor(
        @Inject('PAYMENTS_SERVICE') private readonly client: ClientProxy,
    ) { }

    async hasPermission(userId: string, permission: string): Promise<boolean> {
        if (!userId) return false;
        try {
            const status = await firstValueFrom(
                this.client.send('subscriptions.getStatus', { userId })
            );

            if (!status || !status.hasSubscription) return false;
            if (status.status !== 'active' && status.status !== 'trialing') return false;

            const permissions = status.permissions || [];
            return permissions.includes(permission);
        } catch (error) {
            return false;
        }
    }

    async hasPurchasedProduct(userId: string, productId: string, productType: string = 'COURSE'): Promise<boolean> {
        if (!userId) return false;
        try {
            return await firstValueFrom(
                this.client.send('payments.hasPurchasedProduct', { userId, productId, productType })
            );
        } catch (error) {
            return false;
        }
    }
}

