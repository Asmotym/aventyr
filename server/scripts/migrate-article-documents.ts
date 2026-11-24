import { ensureDatabaseSetup } from '../app/schema';
import 'dotenv/config';
import { migrateArticleDocuments } from '../features/articles/documents/migration';
import { pool } from '../infrastructure/database/client';
ensureDatabaseSetup().then(() => migrateArticleDocuments()).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
