import type { Express } from 'express';
import { respondWithServiceError } from '../../infrastructure/http/request-helpers';
import { addSafeBreadcrumb, sendErrorResponse } from '../../infrastructure/observability/server-observability';
import { handleDiscordQuery, type DiscordQueryPayload } from './discord/discord-handler.core';
const services = { handleDiscordQuery };
export function registerAuthRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { handleDiscordQuery } = { ...services, ...overrides };
    app.post('/api/discord/oauth/token', async (req, res) => {
        const clientId = (process.env.DISCORD_CLIENT_ID
            ?? process.env.VITE_DISCORD_CLIENT_ID)?.trim();
        const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
        const configuredRedirectUri = (process.env.DISCORD_REDIRECT_URI
            ?? process.env.VITE_DISCORD_REDIRECT_URI)?.trim();
        const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
            grantType?: unknown;
            code?: unknown;
            refreshToken?: unknown;
            redirectUri?: unknown;
        };
        if (!clientId || !clientSecret) {
            return sendErrorResponse(res, 503, 'Discord OAuth is not configured');
        }
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret
        });
        if (body.grantType === 'authorization_code') {
            if (typeof body.code !== 'string'
                || !body.code
                || typeof body.redirectUri !== 'string'
                || !body.redirectUri
                || (configuredRedirectUri && body.redirectUri !== configuredRedirectUri)) {
                return sendErrorResponse(res, 400, 'Invalid Discord authorization request');
            }
            params.set('grant_type', 'authorization_code');
            params.set('code', body.code);
            params.set('redirect_uri', body.redirectUri);
        }
        else if (body.grantType === 'refresh_token') {
            if (typeof body.refreshToken !== 'string' || !body.refreshToken) {
                return sendErrorResponse(res, 400, 'A Discord refresh token is required');
            }
            params.set('grant_type', 'refresh_token');
            params.set('refresh_token', body.refreshToken);
        }
        else {
            return sendErrorResponse(res, 400, 'Unsupported Discord OAuth grant');
        }
        try {
            const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });
            const token = await tokenResponse.json() as {
                token_type?: unknown;
                access_token?: unknown;
                refresh_token?: unknown;
                expires_in?: unknown;
                scope?: unknown;
            };
            if (!tokenResponse.ok
                || typeof token.token_type !== 'string'
                || typeof token.access_token !== 'string'
                || typeof token.refresh_token !== 'string'
                || typeof token.expires_in !== 'number') {
                addSafeBreadcrumb('http.client', 'Discord token exchange failed', {
                    provider: 'discord',
                    status: tokenResponse.status,
                    grantType: body.grantType
                });
                return sendErrorResponse(res, 401, 'Discord authentication could not be refreshed');
            }
            res.setHeader('Cache-Control', 'no-store');
            return res.json({
                success: true,
                data: {
                    token_type: token.token_type,
                    access_token: token.access_token,
                    refresh_token: token.refresh_token,
                    expires_in: token.expires_in,
                    scope: typeof token.scope === 'string' ? token.scope : ''
                }
            });
        }
        catch (error) {
            return respondWithServiceError(res, error, 'discord.oauth.token', {
                grantType: typeof body.grantType === 'string' ? body.grantType : undefined
            });
        }
    });
    app.post('/api/discord', async (req, res) => {
        if (!req.body || typeof req.body !== 'object') {
            return sendErrorResponse(res, 400, 'Request body is required');
        }
        const body = req.body as DiscordQueryPayload;
        const queryType = body.queryType ?? 'user';
        try {
            addSafeBreadcrumb('discord', 'Discord query selected', { queryType });
            const data = await handleDiscordQuery({ ...body, queryType });
            res.json({ success: true, data, queryType });
        }
        catch (error) {
            respondWithServiceError(res, error, 'discord.query', { queryType });
        }
    });
}
