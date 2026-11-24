import { ensureArticleSchema } from '../features/articles/articles.schema';
import { ensureBagSchema } from '../features/rooms/bags/bags.schema';
import { ensureBonusConfigurationSchema } from '../features/rooms/bonus-points/bonus-points.schema';
import { ensureSessionBagSchema } from '../features/rooms/sessions/sessions.schema';
import { ensureTalentSchema } from '../features/rooms/talents/talents.schema';
import { createTables } from '../infrastructure/database/schema/base-tables';
import { ensureAllColumnsCreated } from '../infrastructure/database/schema/compatibility';
import { ensureContraintsCreated, ensureIndexesCreated } from '../infrastructure/database/schema/constraints';
import { createLogger } from '../infrastructure/logging/logger';
const logger = createLogger('DatabaseSchema');
export async function ensureDatabaseSetup(): Promise<void> {
    logger.info('Ensuring database setup...');
    await createTables();
    await ensureTalentSchema();
    await ensureAllColumnsCreated();
    await ensureBagSchema();
    await ensureSessionBagSchema();
    await ensureArticleSchema();
    await ensureBonusConfigurationSchema();
    await ensureIndexesCreated();
    await ensureContraintsCreated();
    logger.success('Database schema ready');
}
