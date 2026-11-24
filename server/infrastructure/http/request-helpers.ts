import type { Request, Response } from 'express';
import { addSafeBreadcrumb, handleServerError, sendErrorResponse, setAuthenticatedUser, type SafeSentryContext } from '../observability/server-observability';
export function respondWithServiceError(res: Response, error: unknown, operation: string, domainContext: SafeSentryContext = {}) {
    return handleServerError(res.req, res, error, operation, domainContext);
}
export function ensureSameUser(res: Response, userId: string): boolean {
    const apiKeyUserId = res.locals.apiKeyUserId as string | undefined;
    if (apiKeyUserId && apiKeyUserId !== userId) {
        sendErrorResponse(res, 403, 'API key does not belong to this user');
        return false;
    }
    return true;
}
export async function readDiscordRequesterId(req: Request): Promise<string | null> {
    const authHeader = req.header('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return null;
    }
    addSafeBreadcrumb('http.client', 'Discord requester verification started', {
        provider: 'discord',
        endpoint: '/users/@me'
    });
    const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: authHeader }
    });
    if (!response.ok) {
        addSafeBreadcrumb('http.client', 'Discord requester verification failed', {
            provider: 'discord',
            status: response.status
        });
        return null;
    }
    const user = await response.json() as {
        id?: unknown;
    };
    return typeof user.id === 'string' ? user.id : null;
}
export async function requireRequesterId(req: Request, res: Response): Promise<string | null> {
    const userId = await readDiscordRequesterId(req);
    if (!userId) {
        sendErrorResponse(res, 401, 'Discord authentication is required');
        return null;
    }
    setAuthenticatedUser(res, userId);
    return userId;
}
export async function ensureAuthenticatedSameUser(req: Request, res: Response, userId: string): Promise<boolean> {
    const apiKeyUserId = res.locals.apiKeyUserId as string | undefined;
    if (apiKeyUserId) {
        return ensureSameUser(res, userId);
    }
    const requesterId = await requireRequesterId(req, res);
    if (!requesterId)
        return false;
    if (requesterId !== userId) {
        sendErrorResponse(res, 403, 'Cannot access another user\'s preferences');
        return false;
    }
    return true;
}
