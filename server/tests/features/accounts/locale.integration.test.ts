import assert from 'node:assert/strict';
import test,{ mock } from 'node:test';
import { createTestDatabase } from '../../support/database';

// Uses a throwaway database, never the application's configured database.
test('Locale MySQL: migration, unset profiles, preference updates and Discord creation', {
    skip: process.env.LOCALE_INTEGRATION !== '1',
}, async () => {
    const { admin, database } = await createTestDatabase('accounts');
    let db: typeof import('../../../infrastructure/database/client') | undefined;
    try {

        db = await import('../../../infrastructure/database/client');
        const { ensureDatabaseSetup } = await import('../../../app/schema');
        const users = await import('../../../features/accounts/repositories/users.table');
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

        const { DiscordClient } = await import('../../../features/auth/discord/client');
        const discordUser = { id: 'discord-new', username: 'Discord User', avatar: '' };
        const discordMock = mock.method(DiscordClient.prototype, 'getUserInfo', async () => discordUser);
        try {
            const { handleDiscordQuery } = await import('../../../features/auth/discord/discord-handler.core');
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
