import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { normalizeImage } from '../../infrastructure/images/normalize-image';

test('image normalization preserves per-feature dimensions, aspect ratio and static WebP output', async () => {
    const bytes = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#888' } }).png().toBuffer();
    for (const policy of [{ maxDimension: 1024, quality: 85 }, { maxDimension: 2560, quality: 90 }]) {
        const image = await normalizeImage(bytes, policy);
        assert.equal(image.info.width, policy.maxDimension);
        assert.equal(image.info.height, policy.maxDimension / 2);
        assert.equal(image.info.format, 'webp');
    }
    const tiny = await sharp({ create: { width: 12, height: 6, channels: 3, background: '#888' } }).png().toBuffer();
    assert.equal((await normalizeImage(tiny, { maxDimension: 1024, quality: 85 })).info.width, 12);
});

test('image normalization rejects empty, malformed, oversized and unsupported images', async () => {
    for (const bytes of [Buffer.alloc(0), Buffer.from('invalid'), Buffer.alloc(5 * 1024 * 1024 + 1), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')]) {
        await assert.rejects(normalizeImage(bytes, { maxDimension: 1024, quality: 85 }), { status: 400 });
    }
});
