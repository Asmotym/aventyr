import assert from 'node:assert/strict';
import { createCipheriv,createHash,randomBytes } from 'node:crypto';
import test from 'node:test';
import { decryptApiKey,generateApiKey,hashApiKey } from '../../../features/auth/api-key';
import { isTrustedFrontendHost } from '../../../infrastructure/http/origins';

function encryptWithLegacyDevelopmentSecret(value: string): string {
    const key = createHash('sha256')
        .update('rolz-dev-api-key-secret-change-me-now')
        .digest()
        .subarray(0, 32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

    return [
        iv.toString('base64'),
        encrypted.toString('base64'),
        cipher.getAuthTag().toString('base64'),
    ].join('.');
}

test('Aventyr and localhost are trusted without retaining old production hosts', () => {
    assert.equal(isTrustedFrontendHost('https://aventyr.io/rooms'), true);
    assert.equal(isTrustedFrontendHost('http://localhost:5173'), true);
    assert.equal(isTrustedFrontendHost('https://rolz.asmotym.fr'), false);
    assert.equal(isTrustedFrontendHost('https://staging.rolz.asmotym.fr'), false);
});

test('new API keys use the Aventyr prefix while legacy key hashes remain usable', () => {
    const newKey = generateApiKey();
    const legacyKey = 'rolz_existing-key-value';

    assert.match(newKey, /^aventyr_/);
    assert.equal(hashApiKey(legacyKey), createHash('sha256').update(legacyKey).digest('hex'));
});

test('API keys encrypted with the legacy development default remain readable', () => {
    const legacyKey = 'rolz_existing-key-value';
    assert.equal(decryptApiKey(encryptWithLegacyDevelopmentSecret(legacyKey)), legacyKey);
});
