import { query } from '../client';
export async function columnExists(table: string, column: string): Promise<boolean> {
    const result = await query<{
        count: number;
    }[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        `, [table, column]);
    const count = Number(result[0]?.count ?? 0);
    return Number.isFinite(count) && count > 0;
}
export async function indexExists(table: string, indexName: string): Promise<boolean> {
    const result = await query<{
        count: number;
    }[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        `, [table, indexName]);
    const count = Number(result[0]?.count ?? 0);
    return Number.isFinite(count) && count > 0;
}
