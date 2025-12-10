import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private readonly logger = new Logger(SupabaseService.name);
    private supabaseClient: SupabaseClient;
    private supabaseAdminClient: SupabaseClient;

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
        const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

        if (!supabaseUrl) {
            throw new Error('SUPABASE_URL is not defined');
        }

        if (supabaseAnonKey) {
            this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: { autoRefreshToken: true, persistSession: false },
            });
            this.logger.log('Supabase public client initialized');
        }

        if (supabaseServiceKey) {
            this.supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
            this.logger.log('Supabase admin client initialized');
        }
    }

    getClient(): SupabaseClient {
        if (!this.supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        return this.supabaseClient;
    }

    getAdminClient(): SupabaseClient {
        if (!this.supabaseAdminClient) {
            throw new Error('Supabase admin client not initialized');
        }
        return this.supabaseAdminClient;
    }
}
