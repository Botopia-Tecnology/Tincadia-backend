import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingPlan } from './entities/pricing-plan.entity';

@Injectable()
export class PricingService {
    constructor(
        @InjectRepository(PricingPlan)
        private readonly pricingRepo: Repository<PricingPlan>,
    ) { }

    async findAll(activeOnly: boolean = true) {
        const query = this.pricingRepo.createQueryBuilder('plan');
        if (activeOnly) {
            query.where('plan.is_active = :active', { active: true });
        }
        return query.orderBy('plan.order', 'ASC').getMany();
    }

    async findOne(id: string) {
        const plan = await this.pricingRepo.findOne({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async create(data: Partial<PricingPlan>) {
        const plan = this.pricingRepo.create(data);
        return this.pricingRepo.save(plan);
    }

    async update(id: string, data: Partial<PricingPlan>) {
        const plan = await this.findOne(id);
        Object.assign(plan, data);
        return this.pricingRepo.save(plan);
    }

    async seedDefaults() {
        const count = await this.pricingRepo.count();
        if (count > 0) return;

        const defaults = [
            // Personal
            {
                name: 'Gratis',
                type: 'personal',
                price_monthly: 'Gratis',
                price_annual: 'Gratis',
                description: 'Perfecto para empezar a aprender señas básicas.',
                button_text: 'Comenzar Gratis',
                includes: ['Acceso a lecciones básicas', 'Diccionario limitado', 'Comunidad básica'],
                excludes: ['Certificados', 'Videos HD', 'Soporte prioritario'],
                order: 1
            },
            {
                name: 'Premium',
                type: 'personal',
                price_monthly: 'COP 29.900',
                price_annual: 'COP 299.000',
                description: 'Para estudiantes dedicados que quieren dominar la LSC.',
                button_text: 'Obtener Premium',
                includes: ['Todo lo de Gratis', 'Lecciones avanzadas', 'Sin publicidad', 'Certificados'],
                excludes: [],
                order: 2
            },
            // Empresa
            {
                name: 'Negocios',
                type: 'empresa',
                price_monthly: 'COP 199.000',
                price_annual: 'COP 1.990.000',
                description: 'Para pequeñas empresas inclusivas.',
                button_text: 'Contactar Ventas',
                includes: ['Hasta 10 usuarios', 'Dashboard de uso', 'Facturación centralizada'],
                excludes: [],
                order: 1
            }
        ];

        for (const p of defaults) {
            await this.pricingRepo.save(this.pricingRepo.create(p as any));
        }
    }
}
