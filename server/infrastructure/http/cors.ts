import type { NextFunction, Request, Response } from "express";
import { isTrustedFrontendHost } from "./origins";
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-API-Key', 'sentry-trace', 'baggage'];
export function cors(request: Request, response: Response, next: NextFunction) {
    const origin = request.headers.origin || '';
    if (origin && isTrustedFrontendHost(origin)) {
        response.header('Access-Control-Allow-Origin', origin);
    }
    else {
        response.header('Access-Control-Allow-Origin', '*');
    }
    response.header('Vary', 'Origin');
    response.header('Access-Control-Allow-Credentials', 'true');
    response.header('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    response.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    if (request.method === 'OPTIONS') {
        response.sendStatus(200);
    }
    else {
        next();
    }
}
