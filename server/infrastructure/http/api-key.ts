import type { NextFunction, Request, Response } from 'express';
import { addSafeBreadcrumb, sendErrorResponse, setAuthenticatedUser } from '../observability/server-observability';
import { isTrustedFrontendHost } from './origins';
function isRequestFromTrustedOrigin(req: Request): boolean {
    const origin = req.headers.origin as string | undefined;
    const referer = req.headers.referer as string | undefined;
    return isTrustedFrontendHost(origin) || isTrustedFrontendHost(referer);
}
function readApiKey(req: Request): string | null {
    const headerKey = req.header('x-api-key');
    if (headerKey)
        return headerKey.trim();
    const authHeader = req.header('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }
    if (typeof req.query.apiKey === 'string') {
        return req.query.apiKey;
    }
    return null;
}
export interface ApiKeyDependencies {
    verifyApiKey: (key: string) => Promise<{
        userId: string;
    } | null>;
    recordApiKeyUsage: (userId: string) => Promise<void>;
}
export function createApiKeyMiddleware(dependencies: ApiKeyDependencies) {
    return async function requireApiKey(req: Request, res: Response, next: NextFunction) {
        if (req.method === 'OPTIONS') {
            return next();
        }
        if (isRequestFromTrustedOrigin(req)) {
            return next();
        }
        const apiKey = readApiKey(req);
        if (!apiKey) {
            return sendErrorResponse(res, 401, 'API key required for external requests');
        }
        try {
            const match = await dependencies.verifyApiKey(apiKey);
            if (!match) {
                addSafeBreadcrumb('auth', 'API key rejected');
                return sendErrorResponse(res, 403, 'Invalid API key');
            }
            res.locals.apiKeyUserId = match.userId;
            setAuthenticatedUser(res, match.userId);
            await dependencies.recordApiKeyUsage(match.userId);
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
