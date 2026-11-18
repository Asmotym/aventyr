import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCategoryTranslations } from '../core/articles/category-translations';

test('category translations require English and validate every included language', () => {
    for (const value of [null, [], {}, { fr: { name: 'Manuels' } }, { en: { name: ' ' } }, { en: { name: 'x'.repeat(81) } }, { en: { name: ' Default ' } }, { en: { name: 'Guides' }, fr: { name: '' } }, { en: { name: 'Guides' }, it: { name: 'Guide' } }, { en: { name: 'Guides', description: 'x'.repeat(2001) } }, { en: { name: 'Guides', description: false } }]) {
        assert.throws(() => normalizeCategoryTranslations(value), { status: 400 });
    }
    assert.deepEqual(normalizeCategoryTranslations({ en: { name: ' Guides ', description: 'English' }, fr: { name: ' Manuels ', description: null }, de: { name: 'Handbuch', description: '' } }), {
        en: { name: 'Guides', description: 'English' }, fr: { name: 'Manuels', description: null }, de: { name: 'Handbuch', description: '' }
    });
    assert.deepEqual(normalizeCategoryTranslations({ en: { name: 'Guides' } }), { en: { name: 'Guides', description: null } });
});
