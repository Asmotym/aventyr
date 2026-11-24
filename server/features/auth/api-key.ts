import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createLogger } from '../../infrastructure/logging/logger';
const logger = createLogger('ApiKeyUtils');
const DEFAULT_SECRET = 'aventyr-dev-api-key-secret-change-me-now';
const LEGACY_DEFAULT_SECRET = 'rolz-dev-api-key-secret-change-me-now';
const IV_LENGTH = 12;
function deriveEncryptionKey(secret: string): Buffer {
    return createHash('sha256').update(secret).digest().subarray(0, 32);
}
function resolveEncryptionKeys(): Buffer[] {
    const rawSecret = process.env.API_KEY_ENCRYPTION_SECRET
        || process.env.API_KEY_SECRET;
    if (rawSecret) {
        return [deriveEncryptionKey(rawSecret)];
    }
    logger.warn('Using default API key encryption secret. Set API_KEY_ENCRYPTION_SECRET in production.');
    return [DEFAULT_SECRET, LEGACY_DEFAULT_SECRET].map(deriveEncryptionKey);
}
const ENCRYPTION_KEYS = resolveEncryptionKeys();
function toBase64Url(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
export function generateApiKey(): string {
    const randomSegment = toBase64Url(randomBytes(32));
    return `aventyr_${randomSegment}`;
}
export function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}
export function encryptApiKey(key: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEYS[0], iv);
    const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
        iv.toString('base64'),
        encrypted.toString('base64'),
        authTag.toString('base64')
    ].join('.');
}
export function decryptApiKey(payload: string): string {
    const [ivPart, encryptedPart, authTagPart] = payload.split('.');
    if (!ivPart || !encryptedPart || !authTagPart) {
        throw new Error('Invalid encrypted API key payload');
    }
    const iv = Buffer.from(ivPart, 'base64');
    const encrypted = Buffer.from(encryptedPart, 'base64');
    const authTag = Buffer.from(authTagPart, 'base64');
    let lastError: unknown;
    for (const encryptionKey of ENCRYPTION_KEYS) {
        try {
            const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            return decrypted.toString('utf8');
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Unable to decrypt API key');
}
