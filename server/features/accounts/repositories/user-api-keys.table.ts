import { execute, query } from '../../../infrastructure/database/client';
import type { DatabaseUserApiKey } from '../../../infrastructure/database/records';
export async function getApiKeyForUser(userId: string): Promise<DatabaseUserApiKey | undefined> {
    const result = await query<DatabaseUserApiKey[]>(`SELECT user_id, api_key_hash, api_key_encrypted, created_at, updated_at, last_used_at
         FROM user_api_keys
         WHERE user_id = ?
         LIMIT 1`, [userId]);
    return result[0];
}
export async function getApiKeyByHash(hash: string): Promise<DatabaseUserApiKey | undefined> {
    const result = await query<DatabaseUserApiKey[]>(`SELECT user_id, api_key_hash, api_key_encrypted, created_at, updated_at, last_used_at
         FROM user_api_keys
         WHERE api_key_hash = ?
         LIMIT 1`, [hash]);
    return result[0];
}
export async function upsertApiKey(record: {
    user_id: string;
    api_key_hash: string;
    api_key_encrypted: string;
}): Promise<void> {
    await execute(`INSERT INTO user_api_keys (user_id, api_key_hash, api_key_encrypted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
            api_key_hash = VALUES(api_key_hash),
            api_key_encrypted = VALUES(api_key_encrypted),
            updated_at = CURRENT_TIMESTAMP`, [record.user_id, record.api_key_hash, record.api_key_encrypted]);
}
export async function updateApiKeyUsage(userId: string): Promise<void> {
    await execute(`UPDATE user_api_keys
         SET last_used_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`, [userId]);
}
export async function deleteUserApiKey(userId: string): Promise<void> {
    await execute(`DELETE FROM user_api_keys
         WHERE user_id = ?`, [userId]);
}
