import type { Breadcrumb, ErrorEvent } from '@sentry/node';
const MAX_DEPTH = 5;
const MAX_KEYS = 40;
const MAX_ARRAY_ITEMS = 40;
const MAX_STRING_LENGTH = 500;
const REDACTED = '[Filtered]';
const SENSITIVE_KEY = /(?:^|[_-])(authorization|cookie|set[_-]?cookie|api[_-]?key|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|database[_-]?url|dsn)(?:$|[_-])/i;
const SENSITIVE_VALUE_PATTERNS = [
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    /\b(?:Basic)\s+[A-Za-z0-9+/=]+/gi,
    /\b(?:mysql|mariadb):\/\/[^\s]+/gi
];
function sanitizeString(value: string): string {
    let sanitized = value;
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
        sanitized = sanitized.replace(pattern, REDACTED);
    }
    return sanitized.length > MAX_STRING_LENGTH
        ? `${sanitized.slice(0, MAX_STRING_LENGTH)}…`
        : sanitized;
}
function sanitizeUnknown(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (typeof value === 'string')
        return sanitizeString(value);
    if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'bigint')
        return value.toString();
    if (depth >= MAX_DEPTH)
        return '[Truncated]';
    if (typeof value !== 'object')
        return String(value);
    if (seen.has(value))
        return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) {
        return value
            .slice(0, MAX_ARRAY_ITEMS)
            .map((item) => sanitizeUnknown(item, depth + 1, seen));
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value).slice(0, MAX_KEYS)) {
        sanitized[key] = SENSITIVE_KEY.test(key)
            ? REDACTED
            : sanitizeUnknown(child, depth + 1, seen);
    }
    return sanitized;
}
export function sanitizeForSentry<T>(value: T): T {
    return sanitizeUnknown(value, 0, new WeakSet<object>()) as T;
}
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
    if (event.request) {
        event.request.headers = sanitizeForSentry(event.request.headers);
        event.request.cookies = undefined;
        event.request.data = undefined;
        // Query values are attached separately through an explicit allowlist.
        event.request.query_string = undefined;
        if (event.request.url)
            event.request.url = event.request.url.split(/[?#]/, 1)[0];
        event.request.env = sanitizeForSentry(event.request.env);
    }
    if (event.user) {
        event.user = event.user.id === undefined ? undefined : { id: event.user.id };
    }
    if (event.message)
        event.message = sanitizeString(event.message);
    if (event.exception?.values) {
        event.exception.values = event.exception.values.map((exception) => ({
            ...exception,
            value: exception.value ? sanitizeString(exception.value) : exception.value
        }));
    }
    event.contexts = sanitizeForSentry(event.contexts);
    event.extra = sanitizeForSentry(event.extra);
    if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(sanitizeSentryBreadcrumb);
    }
    return event;
}
export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
    return {
        ...breadcrumb,
        message: breadcrumb.message ? sanitizeString(breadcrumb.message) : breadcrumb.message,
        data: breadcrumb.data ? sanitizeForSentry(breadcrumb.data) : breadcrumb.data
    };
}
