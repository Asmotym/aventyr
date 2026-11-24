import * as Sentry from '@sentry/node';
import type { Express } from 'express';
import { createServer } from 'node:http';
import { roomRealtimeHub } from '../features/rooms/realtime/room-realtime.server';
import { pool } from '../infrastructure/database/client';
import { createLogger } from '../infrastructure/logging/logger';
import { startBackgroundJobs } from './background-jobs';
import { createApp } from './create-app';
import { ensureDatabaseSetup } from './schema';
export async function startServer(options: {
    app?: Express;
    port?: number;
    host?: string;
} = {}) {
    const logger = createLogger('Server');
    const server = createServer(options.app ?? createApp());
    const port = options.port ?? Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 8888);
    const host = options.host ?? process.env.HOST ?? '0.0.0.0';
    let stopJobs: (() => Promise<void>) | undefined;
    let stopping: Promise<void> | undefined;
    async function dispose() {
        const force = setTimeout(() => server.closeAllConnections(), 10000);
        force.unref();
        try {
            const outcomes = await Promise.allSettled([
                stopJobs?.(),
                roomRealtimeHub.shutdown(),
                new Promise<void>((resolve, reject) => {
                    if (!server.listening)
                        return resolve();
                    server.close(error => error ? reject(error) : resolve());
                    server.closeIdleConnections();
                }),
            ]);
            await pool.end();
            await Sentry.flush(2000);
            const failures = outcomes.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
            if (failures.length)
                throw new AggregateError(failures.map(result => result.reason), 'Server shutdown failed');
        }
        finally {
            clearTimeout(force);
        }
    }
    function stop() {
        return stopping ??= dispose();
    }
    try {
        await ensureDatabaseSetup();
        roomRealtimeHub.attach(server);
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, host, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        stopJobs = startBackgroundJobs();
        logger.success(`API server listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
        return { server, stop };
    }
    catch (error) {
        await stop().catch(cleanupError => logger.warn('Startup cleanup failed', { error: String(cleanupError) }));
        throw error;
    }
}
