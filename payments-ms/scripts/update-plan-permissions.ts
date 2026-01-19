
import { DataSource } from 'typeorm';
import { PricingPlan } from '../src/payments/entities/pricing-plan.entity';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [PricingPlan],
    synchronize: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seed() {
    try {
        await AppDataSource.initialize();
        console.log('📦 Connected to database');

        const planRepo = AppDataSource.getRepository(PricingPlan);
        const plans = await planRepo.find();

        console.log(`Found ${plans.length} plans`);

        for (const plan of plans) {
            if (!plan.isFree) {
                // Check if already has permission
                if (!plan.includes) plan.includes = [];

                if (Array.isArray(plan.includes)) {
                    // Parse if string? No, entity says string[] jsonb
                    if (!plan.includes.includes('ACCESS_COURSES')) {
                        plan.includes.push('ACCESS_COURSES');
                        await planRepo.save(plan);
                        console.log(`✅ Added ACCESS_COURSES to plan: ${plan.name} (${plan.id})`);
                    } else {
                        console.log(`ℹ️ Plan ${plan.name} already has permission`);
                    }
                }
            }
        }

        console.log('Done');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
}

seed();
