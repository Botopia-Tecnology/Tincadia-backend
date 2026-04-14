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
     * Listar todos los recursos en una carpeta usando el Admin API
     */
    async listResourcesInFolder(prefix: string): Promise<{ publicId: string; resourceType: string }[]> {
        const resources: { publicId: string; resourceType: string }[] = [];
        let nextCursor: string | undefined = undefined;

        try {
            do {
                const result = await cloudinary.api.resources({
                    type: 'upload',
                    prefix: prefix,
                    max_results: 500,
                    next_cursor: nextCursor,
                });

                result.resources.forEach((res: any) => {
                    resources.push({
                        publicId: res.public_id,
                        resourceType: res.resource_type,
                    });
                });

                nextCursor = result.next_cursor;
            } while (nextCursor);

            return resources;
        } catch (error) {
            console.error(`Error listing resources in folder ${prefix}:`, error);
            return [];
        }
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
            // El SDK de Cloudinary espera `prefixes` (array), no `prefix`
            paramsImage.prefixes = [options.prefix];
            paramsRaw.prefixes = [options.prefix];
        }

        return {
            imageUrl: cloudinary.utils.download_archive_url(paramsImage),
            rawUrl:   cloudinary.utils.download_archive_url(paramsRaw),
        };
    }

    /**
     * Varios ZIPs por lote: la URL firmada incluye todos los public_ids en la query y
     * supera el límite práctico (~50 o menos según longitud) → 414 o ZIP incompleto.
     */
    generateArchiveUrlBatches(publicIds: string[], chunkSize = 20): { imageUrl: string; rawUrl: string }[] {
        const unique = [...new Set(publicIds.filter(Boolean))];
        if (unique.length === 0) return [];
        const batches: { imageUrl: string; rawUrl: string }[] = [];
        for (let i = 0; i < unique.length; i += chunkSize) {
            batches.push(this.generateArchiveUrls({ publicIds: unique.slice(i, i + chunkSize) }));
        }
        return batches;
    }

    /** @deprecated — usar generateArchiveUrls */
    generateArchiveUrl(options: { publicIds?: string[], prefix?: string, pageOneOnly?: boolean }): string {
        return this.generateArchiveUrls(options).imageUrl;
    }
}
