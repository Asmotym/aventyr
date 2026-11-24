import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeForSentry,sanitizeSentryBreadcrumb,sanitizeSentryEvent } from '../../infrastructure/observability/sanitize';

test('sanitizeForSentry redacts credentials, bounds values, and handles circular input', () => {
    const circular: Record<string, unknown> = {
        Authorization: 'Bearer very-secret-token',
        nested: {
            password: 'hunter2',
            database_url: 'mysql://user:pass@db.example/aventyr',
            safeId: 'room-123'
        },
        long: 'x'.repeat(700),
        array: Array.from({ length: 60 }, (_, index) => index)
    };
    circular.self = circular;

    const sanitized = sanitizeForSentry(circular);
    assert.equal(sanitized.Authorization, '[Filtered]');
    assert.deepEqual(sanitized.nested, {
        password: '[Filtered]',
        database_url: '[Filtered]',
        safeId: 'room-123'
    });
    assert.match(String(sanitized.long), /…$/);
    assert.equal((sanitized.array as unknown[]).length, 40);
    assert.equal(sanitized.self, '[Circular]');
});

test('event sanitizer drops body, cookies, and query string while preserving safe context', () => {
    const event = sanitizeSentryEvent({
        type: undefined,
        request: {
            url: 'https://api.example.test/rooms?apiKey=secret',
            headers: {
                'X-API-Key': 'secret',
                Accept: 'application/json'
            },
            cookies: { session: 'secret' },
            query_string: 'limit=10&apiKey=secret',
            data: { message: 'private content' }
        },
        contexts: {
            domain: {
                roomId: 'room-123',
                accessToken: 'secret'
            }
        },
        user: {
            id: 'user-123',
            email: 'private@example.test',
            ip_address: '127.0.0.1'
        }
    });

    assert.deepEqual(event.request?.headers, {
        'X-API-Key': '[Filtered]',
        Accept: 'application/json'
    });
    assert.equal(event.request?.cookies, undefined);
    assert.equal(event.request?.query_string, undefined);
    assert.equal(event.request?.data, undefined);
    assert.equal(event.request?.url, 'https://api.example.test/rooms');
    assert.deepEqual(event.user, { id: 'user-123' });
    assert.deepEqual(event.contexts?.domain, {
        roomId: 'room-123',
        accessToken: '[Filtered]'
    });
});

test('breadcrumb sanitizer removes bearer values and nested tokens', () => {
    const breadcrumb = sanitizeSentryBreadcrumb({
        message: 'Request used Bearer abc.def.ghi',
        data: {
            queryType: 'user',
            refresh_token: 'secret'
        }
    });

    assert.equal(breadcrumb.message, 'Request used [Filtered]');
    assert.deepEqual(breadcrumb.data, {
        queryType: 'user',
        refresh_token: '[Filtered]'
    });
});
