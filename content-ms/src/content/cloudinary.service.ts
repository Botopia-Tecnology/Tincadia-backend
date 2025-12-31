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

    // Upload video for lessons
    async uploadVideo(buffer: Buffer, fileName: string, folder: string = 'tincadia/lessons'): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
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

    // Upload image for thumbnails
    async uploadImage(buffer: Buffer, fileName: string, folder: string = 'tincadia/thumbnails'): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    folder: folder,
                    public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
                    transformation: [{ width: 800, height: 450, crop: 'fill' }],
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

    /**
     * Upload secure file (Image, Video, Audio) for Chat
     * Access mode: authenticated (requires signed URL to view)
     */
    async uploadSecureFile(
        buffer: Buffer,
        fileName: string,
        folder: string = 'tincadia/chat-media',
        resourceType: 'image' | 'video' | 'raw' = 'image'
    ): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    folder: folder,
                    public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
                    type: 'authenticated', // Make it private!
                    access_mode: 'authenticated',
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result!);
                },
            ).end(buffer);
        });
    }

    /**
     * Generate a signed URL for a private asset
     * Valid for 1 hour (3600 seconds) by default
     */
    generateSignedUrl(publicId: string, resourceType: string = 'image', expirySeconds: number = 3600): string {
        const url = cloudinary.url(publicId, {
            resource_type: resourceType,
            type: 'authenticated',
            sign_url: true,
            secure: true,
            expires_at: Math.floor(Date.now() / 1000) + expirySeconds,
        });
        return url;
    }
}
