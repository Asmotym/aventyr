import type { DiscordAuth } from 'netlify/core/types/discord.types';

const EXPIRY_SAFETY_WINDOW_MS = 30_000;

export interface DiscordTokenResponse {
    token_type: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
}

export function createDiscordAuth(
    params: URLSearchParams,
    now = Date.now()
): DiscordAuth | null {
    const tokenType = params.get('token_type');
    const accessToken = params.get('access_token');
    const expiresIn = Number(params.get('expires_in'));
    const scope = params.get('scope') ?? '';
    const state = params.get('state') ?? '';

    if (
        tokenType?.toLowerCase() !== 'bearer'
        || !accessToken
        || !Number.isFinite(expiresIn)
        || expiresIn <= 0
        || !state
    ) {
        return null;
    }

    return {
        tokenType: 'Bearer',
        accessToken,
        expiresIn,
        expiresAt: now + expiresIn * 1_000,
        scope,
        state
    };
}

export function createDiscordAuthFromTokenResponse(
    token: DiscordTokenResponse,
    state: string,
    now = Date.now()
): DiscordAuth | null {
    if (
        token.token_type?.toLowerCase() !== 'bearer'
        || !token.access_token
        || !token.refresh_token
        || !Number.isFinite(token.expires_in)
        || token.expires_in <= 0
        || !state
    ) {
        return null;
    }

    return {
        tokenType: 'Bearer',
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in,
        expiresAt: now + token.expires_in * 1_000,
        scope: token.scope ?? '',
        state
    };
}

export function isDiscordAuthExpired(auth: DiscordAuth, now = Date.now()): boolean {
    return auth.expiresAt <= now + EXPIRY_SAFETY_WINDOW_MS;
}
