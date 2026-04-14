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
        // Sanitize filename to avoid issues with special characters in URLs
        const sanitizedName = fileName
            .replace(/\.[^/.]+$/, "") // Remove extension
            .replace(/[^a-zA-Z0-9_\-]/g, '_'); // Replace non-alphanumeric with underscore

        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'auto', // Auto-detect (image, video, raw/pdf)
                    folder: folder,
                    public_id: `${Date.now()}_${sanitizedName}`,
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result!);
                },
            ).end(buffer);
        });
    }

    async deleteAsset(publicId: string, resourceType: 'video' | 'image' | 'raw' = 'image'): Promise<void> {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }

    /**
     * Generar URL(s) firmada(s) para descargar un ZIP con los recursos seleccionados.
     * Retorna hasta dos URLs: una para resource_type=image y otra para resource_type=raw (PDFs).
     * Cloudinary asigna el resource_type automáticamente al subir ('auto'), por lo que
     * los PDFs pueden quedar como 'raw' y las imágenes como 'image'.
     */
    generateArchiveUrls(options: { publicIds?: string[], prefix?: string }): { imageUrl: string; rawUrl: string } {
        const base: any = {
            allow_missing: true,
            target_format: 'zip',
        };

        const paramsImage: any = { ...base, resource_type: 'image' };
        const paramsRaw: any   = { ...base, resource_type: 'raw' };

        if (options.publicIds && options.publicIds.length > 0) {
            paramsImage.public_ids = options.publicIds;
            paramsRaw.public_ids   = options.publicIds;
        } else if (options.prefix) {
            paramsImage.prefix = options.prefix;
            paramsRaw.prefix   = options.prefix;
        }

        return {
            imageUrl: cloudinary.utils.download_archive_url(paramsImage),
            rawUrl:   cloudinary.utils.download_archive_url(paramsRaw),
        };
    }

    /** @deprecated — usar generateArchiveUrls */
    generateArchiveUrl(options: { publicIds?: string[], prefix?: string, pageOneOnly?: boolean }): string {
        return this.generateArchiveUrls(options).imageUrl;
    }
}
