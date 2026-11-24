import * as Sentry from '@sentry/node';
import 'dotenv/config';
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent } from './sanitize';
if (process.env.SENTRY_DSN?.trim()) {
    const environment = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
    const configuredSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE?.trim()
        ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
        : Number.NaN;
    const tracesSampleRate = Number.isFinite(configuredSampleRate) && configuredSampleRate >= 0 && configuredSampleRate <= 1
        ? configuredSampleRate
        : environment === 'production' ? 0.1 : 1;
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        sendDefaultPii: false,
        environment,
        release: process.env.SENTRY_RELEASE,
        includeLocalVariables: false,
        tracesSampler(samplingContext) {
            const name = samplingContext.name ?? '';
            return /(?:^|\s)(?:\/health|\/ready)(?:\?|$)/.test(name)
                ? 0
                : samplingContext.inheritOrSampleWith(tracesSampleRate);
        },
        beforeSend: sanitizeSentryEvent,
        beforeBreadcrumb: sanitizeSentryBreadcrumb
    });
}
