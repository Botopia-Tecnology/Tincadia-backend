import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
        });
    }

    // Upload image for profile pictures
    async uploadImage(buffer: Buffer, fileName: string, folder: string = 'tincadia/avatars'): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    folder: folder,
                    public_id: `${fileName.replace(/\.[^/.]+$/, "")}_${Date.now()}`,
                    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }], // Optimize for avatars
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
