import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { randomUUID } from 'node:crypto';

// Uses a throwaway database, never the application's configured database.
test('Locale MySQL: migration, unset profiles, preference updates and Discord creation', {
    skip: process.env.LOCALE_INTEGRATION !== '1',
}, async () => {
    const { config } = await import('dotenv');
    config();
    const mysql = await import('mysql2/promise');
    const database = `aventyr_locale_test_${randomUUID().replaceAll('-', '')}`;
    const port = Number(process.env.MYSQL_PORT || 3306);
    const admin = await mysql.createConnection({
        host: '127.0.0.1', port, user: 'root', password: process.env.MYSQL_ROOT_PASSWORD || 'root',
    });
    let db: typeof import('../core/database/client') | undefined;
    try {
        await admin.query(`CREATE DATABASE \`${database}\``);
        const url = new URL(`mysql://root@127.0.0.1:${port}/${database}`);
        url.password = process.env.MYSQL_ROOT_PASSWORD || 'root';
        process.env.DATABASE_URL = url.toString();
        process.env.DATABASE_SSL = 'false';
        db = await import('../core/database/client');
        const { ensureDatabaseSetup } = await import('../core/database/schema');
        const users = await import('../core/database/tables/users.table');
        await ensureDatabaseSetup();
        await users.insertUser({ discord_user_id: 'fresh', username: 'Fresh', avatar: '' });
        assert.equal((await users.getUser('fresh'))?.locale, null);
        assert.equal((await users.updateUserPreferences('fresh', { theme: 'light' }))?.locale, null);
        assert.equal((await users.updateUserPreferences('fresh', { locale: 'fr' }))?.locale, 'fr');

        await db.query("ALTER TABLE users MODIFY COLUMN locale VARCHAR(8) NOT NULL DEFAULT 'en'");
        await users.insertUser({ discord_user_id: 'legacy-en', username: 'English', avatar: '', locale: 'en' });
        await users.insertUser({ discord_user_id: 'legacy-de', username: 'German', avatar: '', locale: 'de' });
        await ensureDatabaseSetup();
        await ensureDatabaseSetup();
        assert.equal((await users.getUser('legacy-en'))?.locale, 'en');
        assert.equal((await users.getUser('legacy-de'))?.locale, 'de');
        assert.equal((await users.getUser('fresh'))?.locale, 'fr');

        const { DiscordClient } = await import('../core/discord/client');
        const discordUser = { id: 'discord-new', username: 'Discord User', avatar: '' };
        const discordMock = mock.method(DiscordClient.prototype, 'getUserInfo', async () => discordUser);
        try {
            const { handleDiscordQuery } = await import('../core/discord/discord-handler.core');
            const auth = { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test', locale: 'es' as const };
            assert.equal((await handleDiscordQuery(auth)).locale, null);
            await users.updateUserPreferences(discordUser.id, { locale: 'en' });
            assert.equal((await handleDiscordQuery(auth)).locale, 'en');
        } finally { discordMock.mock.restore(); }

        await db.query('ALTER TABLE users DROP COLUMN locale');
        await ensureDatabaseSetup();
        assert.equal((await users.getUser('legacy-en'))?.locale, null);
        await ensureDatabaseSetup();
        assert.equal((await users.getUser('legacy-de'))?.locale, null);
    } finally {
        if (db) await db.pool.end();
        await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
        await admin.end();
    }
});
