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

    /**
     * Create a Supabase client authenticated with a user's access token.
     * This is used for operations that require user context (like password update).
     */
    getClientWithToken(accessToken: string): SupabaseClient {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase configuration is missing');
        }

        return createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        });
    }

    /**
     * Upload a profile picture to Supabase Storage
     * @param userId - User ID (used for filename)
     * @param fileBuffer - Image file as Buffer
     * @param mimeType - MIME type (e.g., 'image/jpeg')
     * @returns Public URL of the uploaded image
     */
    async uploadProfilePicture(
        userId: string,
        fileBuffer: Buffer,
        mimeType: string = 'image/jpeg'
    ): Promise<string> {
        const client = this.getAdminClient();
        const bucket = 'avatars';
        const extension = mimeType.split('/')[1] || 'jpg';
        const fileName = `${userId}.${extension}`;

        // Upload file (upsert: true will overwrite if exists)
        const { data, error } = await client.storage
            .from(bucket)
            .upload(fileName, fileBuffer, {
                contentType: mimeType,
                upsert: true,
            });

        if (error) {
            this.logger.error(`Failed to upload avatar for ${userId}:`, error);
            throw new Error(`Failed to upload avatar: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = client.storage
            .from(bucket)
            .getPublicUrl(fileName);

        this.logger.log(`Avatar uploaded for user ${userId}: ${urlData.publicUrl}`);
        return urlData.publicUrl;
    }

    /**
     * Delete a profile picture from Supabase Storage
     */
    async deleteProfilePicture(userId: string): Promise<void> {
        const client = this.getAdminClient();
        const bucket = 'avatars';

        // Try both common extensions
        const { error } = await client.storage
            .from(bucket)
            .remove([`${userId}.jpg`, `${userId}.jpeg`, `${userId}.png`]);

        if (error) {
            this.logger.warn(`Failed to delete avatar for ${userId}:`, error);
        }
    }
}
