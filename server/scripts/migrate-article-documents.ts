import 'dotenv/config';
import { pool } from '../core/database/client';
import { migrateArticleDocuments } from '../core/articles/migration';
migrateArticleDocuments().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
