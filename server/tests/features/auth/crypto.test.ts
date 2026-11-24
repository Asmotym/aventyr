import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Crypto captures configuration on import. Separate processes prove precedence without module-cache tricks.
test('configured API-key secret takes precedence over the legacy environment variable and development defaults', () => {
    const module = new URL('../../../features/auth/api-key.ts', import.meta.url).href;
    const program = `
        import assert from 'node:assert/strict';
        import { createCipheriv, createHash, randomBytes } from 'node:crypto';
        import { encryptApiKey, decryptApiKey } from ${JSON.stringify(module)};
        function encrypted(secret) {
            const iv = randomBytes(12);
            const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
            const data = Buffer.concat([cipher.update('key', 'utf8'), cipher.final()]);
            return [iv, data, cipher.getAuthTag()].map(value => value.toString('base64')).join('.');
        }
        assert.equal(decryptApiKey(encryptApiKey('key')), 'key');
        assert.equal(decryptApiKey(encrypted('primary-test-secret')), 'key');
        for (const secret of ['legacy-test-secret', 'aventyr-dev-api-key-secret-change-me-now', 'rolz-dev-api-key-secret-change-me-now']) {
            assert.throws(() => decryptApiKey(encrypted(secret)));
        }
        assert.throws(() => decryptApiKey('malformed'));
    `;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', program], {
        encoding: 'utf8',
        env: { ...process.env, API_KEY_ENCRYPTION_SECRET: 'primary-test-secret', API_KEY_SECRET: 'legacy-test-secret' },
    });
    assert.equal(result.status, 0, result.stderr);
});
