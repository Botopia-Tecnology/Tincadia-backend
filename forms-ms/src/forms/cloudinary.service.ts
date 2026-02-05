import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
    constructor(private configService: ConfigService) {
        // Helper to strip quotes if present (fixes Railway/production env issues)
        const clean = (val: string | undefined) => val?.replace(/^"|"$/g, '').trim();

        cloudinary.config({
            cloud_name: clean(this.configService.get<string>('CLOUDINARY_CLOUD_NAME')),
            api_key: clean(this.configService.get<string>('CLOUDINARY_API_KEY')),
            api_secret: clean(this.configService.get<string>('CLOUDINARY_API_SECRET')),
        });
    }

    // Generic upload for form attachments
    async uploadFile(buffer: Buffer, fileName: string, folder: string = 'tincadia/forms'): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'auto', // Auto-detect (image, video, raw/pdf)
                    folder: folder,
                    public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`, // Remove extension for public_id
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result!);
                },
            ).end(buffer);
        });
    }

    // Delete asset
    async deleteAsset(publicId: string, resourceType: 'video' | 'image' | 'raw' = 'image'): Promise<void> {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }
}
