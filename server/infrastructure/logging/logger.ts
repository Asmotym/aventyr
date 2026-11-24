type LogMethod = (message: string, meta?: Record<string, unknown>) => void;
export interface Logger {
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
    debug: LogMethod;
    success: LogMethod;
    highlight: (value: string) => string;
    errorValue: (value: string) => string;
}
const noopMeta = (meta?: Record<string, unknown>) => (meta ? ` | ${JSON.stringify(meta)}` : '');
function format(scope: string, level: string, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${scope}] [${level}] ${message}${noopMeta(meta)}`;
}
export function createLogger(scope: string): Logger {
    return {
        info(message, meta) {
            console.log(format(scope, 'INFO', message, meta));
        },
        warn(message, meta) {
            console.warn(format(scope, 'WARN', message, meta));
        },
        error(message, meta) {
            console.error(format(scope, 'ERROR', message, meta));
        },
        debug(message, meta) {
            console.debug(format(scope, 'DEBUG', message, meta));
        },
        success(message, meta) {
            console.log(format(scope, 'SUCCESS', message, meta));
        },
        highlight(value: string) {
            return `«${value}»`;
        },
        errorValue(value: string) {
            return `⛔ ${value}`;
        }
    };
}
