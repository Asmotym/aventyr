import { BadRequestError } from '../../infrastructure/http/errors';
export const ABOUT_ME_MAX_LENGTH = 500;
export function normalizeAboutMe(value: unknown): string {
    if (typeof value !== 'string') {
        throw new BadRequestError('About Me must be a string');
    }
    const normalized = value.trim();
    if (normalized.length > ABOUT_ME_MAX_LENGTH) {
        throw new BadRequestError(`About Me is too long (max ${ABOUT_ME_MAX_LENGTH} characters)`);
    }
    return normalized;
}
