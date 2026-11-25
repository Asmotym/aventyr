import * as Sentry from '@sentry/node';
import express, { type NextFunction, type Request, type Response } from 'express';
import { registerAccountsRoutes } from '../features/accounts/accounts.routes';
import { recordApiKeyUsage, verifyApiKey } from '../features/accounts/api-keys.service';
import { registerAdminRoutes } from '../features/admin/admin.routes';
import { registerArticlesRoutes } from '../features/articles/articles.routes';
import { registerAuthRoutes } from '../features/auth/auth.routes';
import { registerBagsRoutes } from '../features/rooms/bags/bags.routes';
import { registerRoomsRoutes } from '../features/rooms/rooms.routes';
import { registerTalentsRoutes } from '../features/rooms/talents/talents.routes';
import { query } from '../infrastructure/database/client';
import { createApiKeyMiddleware, type ApiKeyDependencies } from '../infrastructure/http/api-key';
import { cors } from '../infrastructure/http/cors';
import { createLogger } from '../infrastructure/logging/logger';
import { handleServerError, requestCorrelationMiddleware } from '../infrastructure/observability/server-observability';
export interface ApplicationOptions {
    apiKeys?: ApiKeyDependencies;
    readiness?: () => Promise<unknown>;
    accounts?: Parameters<typeof registerAccountsRoutes>[1];
    admin?: Parameters<typeof registerAdminRoutes>[1];
    articles?: Parameters<typeof registerArticlesRoutes>[1];
    auth?: Parameters<typeof registerAuthRoutes>[1];
    rooms?: Parameters<typeof registerRoomsRoutes>[1];
    bags?: Parameters<typeof registerBagsRoutes>[1];
    talents?: Parameters<typeof registerTalentsRoutes>[1];
}
export function createApp(options: ApplicationOptions = {}) {
    const logger = createLogger('Server');
    const app = express();
    app.use(requestCorrelationMiddleware);
    app.use(cors);
    app.use('/api/rooms/settings-transfer', express.json({ limit: '51mb' }));
    app.use(express.json({ limit: '1mb' }));
    function sendHealthResponse(res: Response, statusCode: number, payload: Record<string, unknown>) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(statusCode).json({
            ...payload,
            ...(statusCode >= 400 ? { requestId: res.locals.requestId as string | undefined } : {}),
            timestamp: new Date().toISOString()
        });
    }
    app.get('/health', (_req, res) => {
        return sendHealthResponse(res, 200, { status: 'ok' });
    });
    app.get('/ready', async (_req, res) => {
        try {
            await (options.readiness ?? (() => query('SELECT 1 AS ok')))();
            return sendHealthResponse(res, 200, {
                status: 'ready',
                dependencies: {
                    database: 'ok'
                }
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected database readiness failure';
            const meta = error instanceof Error ? { stack: error.stack } : undefined;
            logger.warn(`Readiness check failed: ${message}`, meta);
            return sendHealthResponse(res, 503, {
                status: 'unavailable',
                dependencies: {
                    database: 'unavailable'
                },
                error: message
            });
        }
    });
    app.use('/api', createApiKeyMiddleware(options.apiKeys ?? { verifyApiKey, recordApiKeyUsage }));
    registerAccountsRoutes(app, options.accounts);
    registerAdminRoutes(app, options.admin);
    registerArticlesRoutes(app, options.articles);
    registerAuthRoutes(app, options.auth);
    registerRoomsRoutes(app, options.rooms);
    registerBagsRoutes(app, options.bags);
    registerTalentsRoutes(app, options.talents);
    Sentry.setupExpressErrorHandler(app, { shouldHandleError: () => false });
    app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => handleServerError(req, res, error, 'http.unhandled'));
    return app;
}
