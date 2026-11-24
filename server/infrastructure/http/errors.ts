export class HttpError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, options?: {
        code?: string;
        cause?: unknown;
    }) {
        super(message, options?.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'HttpError';
        this.status = status;
        this.code = options?.code;
    }
}
export class NotFoundError extends HttpError {
    constructor(message = 'Not found') {
        super(404, message, { code: 'not_found' });
        this.name = 'NotFoundError';
    }
}
export class BadRequestError extends HttpError {
    constructor(message = 'Bad request') {
        super(400, message, { code: 'bad_request' });
        this.name = 'BadRequestError';
    }
}
export class ForbiddenError extends HttpError {
    constructor(message = 'Forbidden') {
        super(403, message, { code: 'forbidden' });
        this.name = 'ForbiddenError';
    }
}
export class ConflictError extends HttpError {
    constructor(message = 'Conflict') {
        super(409, message, { code: 'conflict' });
        this.name = 'ConflictError';
    }
}
