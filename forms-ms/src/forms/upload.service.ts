import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class UploadService {
    private supabase: SupabaseClient;
    private bucketName = 'form-attachments';

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!,
        );
    }

    async uploadFile(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
    ): Promise<{ url: string; path: string }> {
        // Generate unique file name to avoid collisions
        const timestamp = Date.now();
        const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `submissions/${timestamp}_${sanitizedName}`;

        console.log(`📤 Uploading file: ${filePath}`);

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (error) {
            console.error('❌ Upload error:', error);
            throw new Error(`Failed to upload file: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(filePath);

        console.log(`✅ File uploaded: ${urlData.publicUrl}`);

        return {
            url: urlData.publicUrl,
            path: filePath,
        };
    }

    async deleteFile(filePath: string): Promise<void> {
        const { error } = await this.supabase.storage
            .from(this.bucketName)
            .remove([filePath]);

        if (error) {
            console.error('❌ Delete error:', error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }
}
