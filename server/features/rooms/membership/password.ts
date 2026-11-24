import { createHash, randomBytes } from 'crypto';
export interface PasswordHash {
    hash: string;
    salt: string;
}
export function hashPassword(raw: string): PasswordHash {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(`${salt}:${raw}`).digest('hex');
    return { hash, salt };
}
export function verifyPassword(raw: string, hash?: string | null, salt?: string | null): boolean {
    if (!hash || !salt)
        return false;
    const attempt = createHash('sha256').update(`${salt}:${raw}`).digest('hex');
    return attempt === hash;
}
