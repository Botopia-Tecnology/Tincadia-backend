import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService optional values', () => {
    let service: EncryptionService;

    beforeEach(() => {
        const config = {
            get: jest.fn().mockReturnValue('c'.repeat(64)),
        } as unknown as ConfigService;

        service = new EncryptionService(config);
    });

    it('encrypts and decrypts optional reply fields', () => {
        const encrypted = service.encryptIfNeeded('mensaje privado');

        expect(encrypted).not.toBe('mensaje privado');
        expect(service.decryptOrOriginal(encrypted)).toBe('mensaje privado');
    });

    it('keeps nullish optional values as null', () => {
        expect(service.encryptIfNeeded(null)).toBeNull();
        expect(service.encryptIfNeeded(undefined)).toBeNull();
        expect(service.decryptOrOriginal(null)).toBeNull();
        expect(service.decryptOrOriginal(undefined)).toBeNull();
    });

    it('keeps legacy plaintext values readable', () => {
        expect(service.decryptOrOriginal('legacy reply')).toBe('legacy reply');
    });
});
