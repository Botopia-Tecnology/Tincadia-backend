import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor(private configService: ConfigService) {
        const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
        if (!encryptionKey || encryptionKey.length !== 64) {
            throw new Error(
                'ENCRYPTION_KEY must be set in environment and be 64 hex characters (256 bits)',
            );
        }
        this.key = Buffer.from(encryptionKey, 'hex');
    }

    /**
     * Encrypts a plaintext string.
     * Returns format: iv:ciphertext:authTag (all base64)
     */
    encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(12); // 96 bits for GCM
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
    }

    /**
     * Decrypts a string in format: iv:ciphertext:authTag
     * Returns the original plaintext.
     */
    decrypt(encryptedData: string): string {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivBase64, ciphertextBase64, authTagBase64] = parts;
        const iv = Buffer.from(ivBase64, 'base64');
        const ciphertext = Buffer.from(ciphertextBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Checks if a string looks like encrypted data (has the iv:cipher:tag format)
     */
    isEncrypted(data: string): boolean {
        if (!data) return false;
        const parts = data.split(':');
        return parts.length === 3;
    }
}
