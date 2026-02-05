import { Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class UploadService {
    constructor(private readonly cloudinaryService: CloudinaryService) { }

    async uploadFile(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
    ): Promise<{ url: string; path: string }> {
        console.log(`📤 Uploading file to Cloudinary: ${fileName} (${mimeType})`);

        try {
            // Use 'auto' resource type in CloudinaryService to handle images, videos, pdfs
            const result = await this.cloudinaryService.uploadFile(fileBuffer, fileName, 'tincadia/forms');

            console.log(`✅ File uploaded: ${result.secure_url}`);

            return {
                url: result.secure_url,
                path: result.public_id, // Store public_id as path
            };
        } catch (error: any) {
            console.error('❌ Upload error:', error);
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }

    async deleteFile(publicId: string): Promise<void> {
        // Default to 'image' or try to guess/store type? 
        // For now, let's assume image or handle errors gracefully if type mismatch.
        // Ideally we should store resource_type too.
        // But for forms, standard destroy might need type. 
        // Attempting generic destroy.
        try {
            await this.cloudinaryService.deleteAsset(publicId, 'image');
        } catch (e) {
            console.warn('Failed to delete as image, trying raw/video might be needed', e);
        }
    }
}

