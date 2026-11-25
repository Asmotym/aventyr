import assert from 'node:assert/strict';
import test from 'node:test';
import { emptySettingsPackage, parseSettingsPackage, pruneTransferImages, validateTransferDependencies } from '../../../shared/rooms/settings-transfer';
import { newTalentTree } from '../../../shared/rooms/talents.types';

test('settings package supports partial sections and preserves false and zero values', () => {
    const data = emptySettingsPackage();
    data.sections.talents = { values: { enabled: false, maxGlobal: 0 }, lists: { trees: [] } };
    assert.deepEqual(parseSettingsPackage('\uFEFF' + JSON.stringify(data)), data);
});
test('legacy award arrays and talent packages adapt to global sections', () => {
    const awards = [{ name: 'Hero', diceResults: [20], diceNotations: ['d20'] }];
    assert.deepEqual(parseSettingsPackage(JSON.stringify(awards)).sections.rollAwards?.lists.awards, awards);
    const tree = newTalentTree('tree', 'classic'); tree.name = 'Hero';
    const parsed = parseSettingsPackage(JSON.stringify({ format: 'aventyr-talent-tree', version: 1, tree, images: {} }));
    assert.equal(parsed.sections.talents?.lists.trees?.[0]?.id, 'tree');
});
test('rejects invalid versions, scalar values, unknown sections, malformed trees and missing assets', () => {
    const data = emptySettingsPackage();
    assert.throws(() => parseSettingsPackage('{oops'), /Invalid JSON/);
    assert.throws(() => parseSettingsPackage(JSON.stringify({ ...data, version: 2 })), /Unsupported/);
    assert.throws(() => parseSettingsPackage(JSON.stringify({ ...data, sections: { membership: {} } })), /Invalid settings section/);
    assert.throws(() => parseSettingsPackage(JSON.stringify({ ...data, sections: { room: { values: { name: {} }, lists: {} } } })), /Invalid setting/);
    data.sections.talents = { values: {}, lists: { trees: [{ id: 'bad' }] } };
    assert.throws(() => parseSettingsPackage(JSON.stringify(data)));
    const tree = newTalentTree('tree', 'classic'); tree.name = 'Hero'; tree.imageId = 'missing';
    data.sections.talents.lists.trees = [tree as unknown as Record<string, unknown>];
    assert.throws(() => parseSettingsPackage(JSON.stringify(data)), /images are missing/);
});
test('selection cannot leave dangling dice or talent dependencies', () => {
    const data = emptySettingsPackage(); data.sections.dices = { values: {}, lists: { categories: [], dices: [{ categoryId: 'combat', notation: 'd20' }] } };
    assert.throws(() => validateTransferDependencies(data), /categories/);
    data.sections.dices.lists.categories = [{ id: 'combat', name: 'Combat' }];
    validateTransferDependencies(data);
    const tree = newTalentTree('child', 'classic'); tree.name = 'Child'; tree.parentTreeId = 'parent';
    data.sections.talents = { values: {}, lists: { trees: [tree as unknown as Record<string, unknown>] } };
    assert.throws(() => validateTransferDependencies(data), /parent/);
});
test('asset pruning drops images for deselected trees and does not mutate the source', () => {
    const data = emptySettingsPackage(); data.images = { unused: { type: 'image/webp', data: 'YWJjZA==' } };
    assert.deepEqual(pruneTransferImages(data).images, {}); assert.ok(data.images.unused);
});

test('settings files larger than 50 MB are rejected before parsing', () => {
    assert.throws(() => parseSettingsPackage(' '.repeat(50 * 1024 * 1024 + 1)), /exceeds 50 MB/);
});
