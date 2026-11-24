export class DatabaseUnavailableError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    }) {
        super(message);
        this.name = 'DatabaseUnavailableError';
        if (options?.cause !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this as any).cause = options.cause;
        }
    }
}
export function isDatabaseConnectionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const nodeError = error as NodeJS.ErrnoException;
    const code = nodeError.code;
    if (typeof code === 'string') {
        const transientCodes = new Set([
            'ECONNREFUSED',
            'ECONNRESET',
            'EPIPE',
            'PROTOCOL_CONNECTION_LOST',
            'ER_ACCESS_DENIED_ERROR',
            'ER_BAD_DB_ERROR',
            'ER_CON_COUNT_ERROR',
            'ETIMEDOUT',
            'EHOSTUNREACH',
            'ENOTFOUND'
        ]);
        if (transientCodes.has(code)) {
            return true;
        }
    }
    const sqlState = (error as {
        sqlState?: string;
    }).sqlState;
    if (typeof sqlState === 'string' && sqlState.startsWith('08')) {
        // 08xxx SQL states map to connection issues.
        return true;
    }
    const fatal = (error as {
        fatal?: boolean;
    }).fatal;
    return Boolean(fatal && (code === undefined || code === null));
}
