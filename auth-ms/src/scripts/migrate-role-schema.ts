import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function migrate() {
    console.log('Starting migration...');
    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_HOST?.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        console.log('Adding "role" column to profiles table...');

        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN 
                    ALTER TABLE profiles ADD COLUMN role VARCHAR(50) DEFAULT 'User' NOT NULL; 
                    RAISE NOTICE 'Column "role" added';
                ELSE 
                    RAISE NOTICE 'Column "role" already exists';
                END IF; 
            END $$;
        `);

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
