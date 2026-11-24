import 'dotenv/config';
import { ensureDatabaseSetup } from '../app/schema';
import { getDatabaseConnectionLabel, pool } from '../infrastructure/database/client';
import { createLogger } from '../infrastructure/logging/logger';
const logger = createLogger('SchemaUpdate');
async function main() {
    const label = getDatabaseConnectionLabel() ?? 'database';
    logger.info(`Updating schema for ${label}...`);
    await ensureDatabaseSetup();
    logger.success(`Schema up to date for ${label}.`);
}
main()
    .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Schema update failed: ${message}`);
    process.exit(1);
})
    .finally(async () => {
    await pool.end();
});
