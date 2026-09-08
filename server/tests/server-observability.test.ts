import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test, { after } from 'node:test';
import express, { type NextFunction } from 'express';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { DatabaseUnavailableError } from '../core/database/errors';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../core/errors/http-errors';
import {
    classifyServerError,
    handleServerError,
    requestCorrelationMiddleware,
    setAuthenticatedUser
} from '../observability/server-observability';
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent } from '../observability/sanitize';

type CapturedEvent = {
    tags?: Record<string, string>;
    contexts?: Record<string, Record<string, unknown>>;
    user?: { id?: string };
    request?: { data?: unknown; headers?: Record<string, string> };
};

const capturedEvents: CapturedEvent[] = [];

Sentry.init({
    dsn: 'https://public@example.com/1',
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    transport: () => ({
        send(envelope) {
            for (const item of envelope[1]) {
                if (item[0].type === 'event') capturedEvents.push(item[1] as CapturedEvent);
            }
            return Promise.resolve({});
        },
        flush() {
            return Promise.resolve(true);
        }
    })
});

after(async () => {
    await Sentry.close(1_000);
});

function fakeRequest(overrides: Partial<Request> = {}): Request {
    return {
        method: 'POST',
        path: '/api/rooms',
        baseUrl: '',
        route: { path: '/api/rooms' },
        params: {},
        query: {},
        headers: {},
        ...overrides
    } as Request;
}

function fakeResponse(req: Request): Response & { body?: unknown; headers: Record<string, string> } {
    const response = {
        req,
        locals: {},
        statusCode: 200,
        body: undefined as unknown,
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
            this.headers[name] = value;
            return this;
        },
        status(status: number) {
            this.statusCode = status;
            return this;
        },
        json(body: unknown) {
            this.body = body;
            return this;
        }
    };
    return response as unknown as Response & { body?: unknown; headers: Record<string, string> };
}

test('error classification uses typed 4xx, dependency 503, and unknown 500', () => {
    const badRequest = new BadRequestError();
    assert.equal(classifyServerError(badRequest).status, 400);
    assert.equal(badRequest.code, 'bad_request');
    assert.equal(classifyServerError(new ForbiddenError()).status, 403);
    assert.equal(classifyServerError(new NotFoundError()).status, 404);
    assert.equal(classifyServerError(new ConflictError()).status, 409);

    const dependency = classifyServerError(
        new DatabaseUnavailableError('offline', { cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }) })
    );
    assert.equal(dependency.status, 503);
    assert.equal(dependency.reportToSentry, true);
    assert.equal(dependency.publicMessage, 'Service temporarily unavailable');

    const unknown = classifyServerError({ unexpected: true });
    assert.equal(unknown.status, 500);
    assert.equal(unknown.reportToSentry, true);
    assert.match(unknown.error.message, /Non-Error value thrown/);
});

test('request middleware creates unique response correlation IDs', () => {
    const firstRequest = fakeRequest();
    const first = fakeResponse(firstRequest);
    const secondRequest = fakeRequest();
    const second = fakeResponse(secondRequest);

    requestCorrelationMiddleware(firstRequest, first, () => undefined);
    requestCorrelationMiddleware(secondRequest, second, () => undefined);

    assert.match(first.headers['X-Request-ID'], /^[0-9a-f-]{36}$/);
    assert.match(second.headers['X-Request-ID'], /^[0-9a-f-]{36}$/);
    assert.notEqual(first.headers['X-Request-ID'], second.headers['X-Request-ID']);
});

test('expected 4xx response is correlated but not captured', async () => {
    capturedEvents.length = 0;
    const req = fakeRequest();
    const res = fakeResponse(req);
    requestCorrelationMiddleware(req, res, () => undefined);

    handleServerError(req, res, new BadRequestError('Invalid action'), 'room.action.invalid', {
        action: 'invalid'
    });
    await Sentry.flush(1_000);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        success: false,
        error: 'Invalid action',
        code: 'bad_request',
        requestId: res.locals.requestId
    });
    assert.equal(capturedEvents.length, 0);
});

test('unknown failure is captured once with safe request, user, and domain context', async () => {
    capturedEvents.length = 0;
    await Sentry.withIsolationScope(async () => {
        const req = fakeRequest({
            params: { roomId: 'room-123' },
            query: { limit: '10', apiKey: 'must-not-appear' },
            headers: { authorization: 'Bearer must-not-appear' }
        });
        const res = fakeResponse(req);
        requestCorrelationMiddleware(req, res, () => undefined);
        setAuthenticatedUser(res, 'user-123');

        handleServerError(req, res, new globalThis.Error('Database write failed'), 'room.action.join', {
            action: 'join',
            roomId: 'room-123',
            password: 'must-not-appear'
        });
        await Sentry.flush(1_000);

        assert.equal(res.statusCode, 500);
        assert.equal(capturedEvents.length, 1);
        const event = capturedEvents[0];
        assert.equal(event.tags?.operation, 'room.action.join');
        assert.equal(event.tags?.['http.status_code'], '500');
        assert.equal(event.user?.id, 'user-123');
        assert.equal(event.contexts?.domain?.roomId, 'room-123');
        assert.equal(event.contexts?.domain?.password, '[Filtered]');
        assert.deepEqual(event.contexts?.request_details?.query, { limit: '10' });
    });
});

test('database failures attach only safe dependency metadata', async () => {
    capturedEvents.length = 0;
    const req = fakeRequest();
    const res = fakeResponse(req);
    requestCorrelationMiddleware(req, res, () => undefined);
    const cause = Object.assign(new globalThis.Error('connection refused'), {
        code: 'ECONNREFUSED',
        sqlState: '08001',
        fatal: true,
        sql: 'must-not-be-attached'
    });

    handleServerError(
        req,
        res,
        new DatabaseUnavailableError('Database unavailable', { cause }),
        'database.query'
    );
    await Sentry.flush(1_000);

    assert.equal(res.statusCode, 503);
    assert.equal(capturedEvents.length, 1);
    assert.equal(capturedEvents[0].tags?.dependency, 'database');
    assert.deepEqual(capturedEvents[0].contexts?.database, {
        unavailable: true,
        code: 'ECONNREFUSED',
        sqlState: '08001',
        fatal: true
    });
});

test('Express errors return correlated responses and only 5xx reaches Sentry', async () => {
    capturedEvents.length = 0;
    const app = express();
    app.use(requestCorrelationMiddleware);
    app.use(express.json());
    app.get('/expected', () => {
        throw new NotFoundError('Missing test resource');
    });
    app.get('/unexpected', () => {
        throw new globalThis.Error('Synthetic integration failure');
    });
    app.post('/json', (_req, res) => res.json({ success: true }));
    app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => (
        handleServerError(req, res, error, 'test.integration')
    ));

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        const baseUrl = `http://127.0.0.1:${address.port}`;

        const expected = await fetch(`${baseUrl}/expected`);
        const expectedBody = await expected.json() as { requestId: string };
        assert.equal(expected.status, 404);
        assert.equal(expected.headers.get('x-request-id'), expectedBody.requestId);

        const invalidJson = await fetch(`${baseUrl}/json`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{'
        });
        const invalidJsonBody = await invalidJson.json() as { requestId: string };
        assert.equal(invalidJson.status, 400);
        assert.equal(invalidJson.headers.get('x-request-id'), invalidJsonBody.requestId);

        const unexpected = await fetch(`${baseUrl}/unexpected`);
        const unexpectedBody = await unexpected.json() as { requestId: string };
        assert.equal(unexpected.status, 500);
        assert.equal(unexpected.headers.get('x-request-id'), unexpectedBody.requestId);

        await Sentry.flush(1_000);
        assert.equal(capturedEvents.length, 1);
        assert.equal(capturedEvents[0].tags?.operation, 'test.integration');
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});
