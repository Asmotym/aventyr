import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { DatabaseUnavailableError } from '../core/database/errors';
import { HttpError } from '../core/errors/http-errors';
import { createLogger } from '../core/utils/logger';
import { sanitizeForSentry } from './sanitize';

const logger = createLogger('Observability');
const SAFE_QUERY_KEYS = new Set(['limit', 'offset', 'since', 'status', 'statuses', 'archived', 'tags']);

export type SafeSentryContext = Record<string, string | number | boolean | null | undefined | string[] | number[]>;

export interface ClassifiedError {
    error: Error;
    status: number;
    publicMessage: string;
    reportToSentry: boolean;
}

function normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(sanitizeForSentry(error));
    return new Error(`Non-Error value thrown (${error === null ? 'null' : typeof error})`);
}

export function classifyServerError(error: unknown): ClassifiedError {
    const normalized = normalizeError(error);
    if (error instanceof DatabaseUnavailableError) {
        return {
            error: normalized,
            status: 503,
            publicMessage: 'Service temporarily unavailable',
            reportToSentry: true
        };
    }
    if (error instanceof HttpError) {
        return {
            error: normalized,
            status: error.status,
            publicMessage: error.message,
            reportToSentry: error.status >= 500
        };
    }
    if (error instanceof SyntaxError && 'body' in error) {
        return {
            error: normalized,
            status: 400,
            publicMessage: 'Invalid JSON payload',
            reportToSentry: false
        };
    }
    return {
        error: normalized,
        status: 500,
        publicMessage: 'Internal server error',
        reportToSentry: true
    };
}

function readSafeQuery(req: Request): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(req.query).filter(([key]) => SAFE_QUERY_KEYS.has(key))
    );
}

function readSafeParams(req: Request): Record<string, string | string[]> {
    return Object.fromEntries(
        Object.entries(req.params).filter(([key]) => key === 'slug' || key.endsWith('Id'))
    );
}

function readDatabaseContext(error: Error): Record<string, unknown> | undefined {
    if (!(error instanceof DatabaseUnavailableError)) return undefined;
    const cause = error.cause;
    if (!cause || typeof cause !== 'object') return { unavailable: true };
    const databaseError = cause as NodeJS.ErrnoException & { sqlState?: unknown; fatal?: unknown };
    return {
        unavailable: true,
        code: databaseError.code,
        sqlState: typeof databaseError.sqlState === 'string' ? databaseError.sqlState : undefined,
        fatal: typeof databaseError.fatal === 'boolean' ? databaseError.fatal : undefined
    };
}

export function requestCorrelationMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const scope = Sentry.getIsolationScope();
    scope.setTag('request_id', requestId);
    scope.setContext('request_correlation', {
        id: requestId,
        method: req.method,
        path: req.path
    });
    next();
}

export function setAuthenticatedUser(res: Response, userId: string): void {
    res.locals.authenticatedUserId = userId;
    Sentry.getIsolationScope().setUser({ id: userId });
    Sentry.addBreadcrumb({
        category: 'auth',
        level: 'info',
        message: 'Request authenticated',
        data: { userId }
    });
}

export function addSafeBreadcrumb(
    category: string,
    message: string,
    data?: SafeSentryContext
): void {
    Sentry.addBreadcrumb({
        category,
        message,
        level: 'info',
        data: data ? sanitizeForSentry(data) : undefined
    });
}

function writeErrorResponse(res: Response, status: number, message: string, code?: string): Response {
    return res.status(status).json({
        success: false,
        error: message,
        ...(code ? { code } : {}),
        requestId: res.locals.requestId as string | undefined
    });
}

export function sendErrorResponse(res: Response, status: number, message: string): Response {
    logger.warn(`http.response: ${sanitizeForSentry(message)}`, {
        requestId: res.locals.requestId as string | undefined,
        operation: 'http.response',
        status,
        method: res.req.method,
        path: res.req.path
    });
    return writeErrorResponse(res, status, message);
}

export function handleServerError(
    req: Request,
    res: Response,
    error: unknown,
    operation: string,
    domainContext: SafeSentryContext = {}
): Response {
    const classified = classifyServerError(error);
    const requestId = res.locals.requestId as string | undefined;
    const userId = res.locals.authenticatedUserId as string | undefined;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const safeContext = sanitizeForSentry(domainContext);
    let sentryEventId: string | undefined;

    if (classified.reportToSentry) {
        Sentry.withScope((scope) => {
            scope.setTag('operation', operation);
            scope.setTag('http.method', req.method);
            scope.setTag('http.status_code', String(classified.status));
            scope.setTag('http.route', route);
            scope.setTag('error.type', classified.error.name);
            if (error instanceof HttpError && error.code) scope.setTag('error.code', error.code);
            if (error instanceof DatabaseUnavailableError) scope.setTag('dependency', 'database');
            if (requestId) scope.setTag('request_id', requestId);
            if (userId) scope.setUser({ id: userId });
            scope.setContext('request_details', sanitizeForSentry({
                requestId,
                route,
                method: req.method,
                params: readSafeParams(req),
                query: readSafeQuery(req)
            }));
            if (Object.keys(safeContext).length > 0) scope.setContext('domain', safeContext);
            const database = readDatabaseContext(classified.error);
            if (database) scope.setContext('database', database);
            sentryEventId = Sentry.captureException(classified.error);
        });
    }

    const meta = {
        requestId,
        operation,
        status: classified.status,
        errorType: classified.error.name,
        errorCode: error instanceof HttpError ? error.code : undefined,
        sentryEventId,
        ...safeContext
    };
    const safeMessage = sanitizeForSentry(classified.error.message);
    if (classified.status >= 500) {
        logger.error(`${operation}: ${safeMessage}`, {
            ...meta,
            stack: sanitizeForSentry(classified.error.stack)
        });
    } else {
        logger.warn(`${operation}: ${safeMessage}`, meta);
    }

    return writeErrorResponse(res, classified.status, classified.publicMessage, error instanceof HttpError ? error.code : undefined);
}
