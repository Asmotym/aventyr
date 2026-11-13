import { query, transaction } from '../database/client';
import { ensureDatabaseSetup } from '../database/schema';
import { legacyTranslation, readTranslations, replaceTranslations } from './translations';

// Explicit command: schema setup alone never rewrites legacy articles.
export async function migrateArticleDocuments() {
    await ensureDatabaseSetup();
    let failed = 0;
    for (const [table, draft] of [['articles', false], ['article_drafts', true]] as const) {
        const rows = await query<Array<{ id: string; title: string; introduction: string; markdown_source: string }>>(`SELECT id, title, introduction, markdown_source FROM ${table}`);
        for (const row of rows) {
            try {
                await transaction(async () => {
                    const [locked] = await query<typeof rows>(`SELECT id, title, introduction, markdown_source FROM ${table} WHERE id = ? FOR UPDATE`, [row.id]);
                    if (!locked) return;
                    if ((await readTranslations(row.id, draft)).en) return;
                    await replaceTranslations(row.id, legacyTranslation(locked), draft);
                });
                console.info(`${table}/${row.id}: ready`);
            } catch (error) {
                failed++;
                console.error(`${table}/${row.id}: manual review required: ${error instanceof Error ? error.message : 'Conversion failed'}`);
            }
        }
    }
    if (failed) throw new Error(`${failed} documents require review; original Markdown is unchanged`);
}
