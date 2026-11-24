import * as Sentry from '@sentry/node';
import { startServer } from './app/start-server';
import { createLogger } from './infrastructure/logging/logger';
import './infrastructure/observability/sentry';
const logger = createLogger('Server');
void startServer().then(({ stop }) => {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => {
            void stop().catch(error => {
                logger.error('Server shutdown failed', { error: String(error) });
                process.exitCode = 1;
            });
        });
    }
}).catch(async (error) => {
    const sentryEventId = Sentry.captureException(error, {
        tags: { operation: 'server.startup' },
        contexts: { runtime: {
                environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV,
                release: process.env.SENTRY_RELEASE,
            } },
    });
    logger.error('Failed to start server', {
        message: error instanceof Error ? error.message : 'Unknown error during startup',
        sentryEventId,
    });
    await Sentry.flush(2000);
    process.exitCode = 1;
});
