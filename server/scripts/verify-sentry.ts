import * as Sentry from '@sentry/node';
import '../infrastructure/observability/sentry';
async function verifySentry(): Promise<void> {
    if (!process.env.SENTRY_DSN?.trim()) {
        throw new Error('SENTRY_DSN is required to run the Sentry verification check');
    }
    if (!process.env.SENTRY_RELEASE?.trim()) {
        throw new Error('SENTRY_RELEASE is required to verify release and source-map attribution');
    }
    const eventId = Sentry.captureException(new Error('Synthetic server-side Sentry verification error'), {
        tags: {
            operation: 'sentry.verify',
            verification: 'true'
        },
        contexts: {
            verification: {
                release: process.env.SENTRY_RELEASE,
                expectedSourceFile: 'server/scripts/verify-sentry.ts'
            }
        }
    });
    const flushed = await Sentry.flush(5000);
    if (!flushed) {
        throw new Error(`Sentry did not flush verification event ${eventId}`);
    }
    console.log(`Sentry verification event sent: ${eventId}`);
}
void verifySentry().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
