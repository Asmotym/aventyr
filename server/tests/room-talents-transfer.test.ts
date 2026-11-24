import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyConditions, newTalentTree } from '../core/types/talents.types';
import { parseTalentExport, prepareTalentImport, talentImportSummary, duplicateTalentName, type TalentTreeExport } from '../core/utils/talent-transfer';
function fixture(): TalentTreeExport {
    const tree = newTalentTree('original', 'free'); tree.name = 'Circuit'; tree.currency = 'both'; tree.description = 'Complete definition'; tree.parentTreeId = 'parent'; tree.accessMode = 'restricted'; tree.imageId = 'art';
    tree.options = { ...tree.options, iconsOnly: false, connectionStyle: 'square', connectionArrow: 'diamond', selectSubtree: true };
    tree.subtrees = [{ id: 'branch', name: 'Branch', description: 'Description', icon: 'mdi-star', imageId: 'art', x: 0, y: 0, width: 500, height: 500, maxPoints: 7, boundsMode: 'manual' }];
    tree.nodes = ['first', 'second'].map((id, index) => ({ id, name: id, description: 'Node description', autoUnlock: index === 0, category: 'active', color: 'teal', cost: 3, linkedTreeId: 'linked', subtreeId: 'branch', x: 100, y: 100 + index * 150, icon: 'mdi-star', imageId: 'art', parentMode: 'any', conditions: emptyConditions(), hide: emptyConditions(), levels: [{ id: 'rank-1', name: 'First rank', description: 'Rank text', conditions: emptyConditions() }, { id: 'rank-2', cost: 0, conditions: { mode: 'all', items: [{ type: 'node', nodeId: 'first', amount: 1 }] } }] }));
    tree.edges = [{ parent: 'first', child: 'second', parentSide: 'bottom', childSide: 'top', style: 'straight', arrow: 'chevron' }];
    tree.decorations = [{ id: 'shape', shape: 'diamond', text: 'Note', color: 'indigo', fontSize: 24, bold: true, italic: true, underline: true, strikethrough: false, x: -200, y: -200, width: 180, height: 120 }];
    return { format: 'aventyr-talent-tree', version: 1, tree, images: { art: { type: 'image/webp', data: 'YWJjZA==' } } };
}
test('Tree export round-trip retains every setting and internal reference in a separate tree', () => {
    const data = fixture(), parsed = parseTalentExport(JSON.stringify(data)); assert.deepEqual(parsed, data);
    const parent = newTalentTree('parent', 'classic'), linked = newTalentTree('linked', 'classic'); parent.name = 'Parent'; linked.name = 'Linked';
    const result = prepareTalentImport(parsed, [data.tree, parent, linked], 'new-tree');
    assert.deepEqual(result.tree, { ...data.tree, id: 'new-tree' }); assert.equal(result.missingParentId, null); assert.equal(result.disconnected, 0); assert.equal(result.missingImages, 0);
    assert.deepEqual(talentImportSummary(result.tree), { nodes: 2, ranks: 4, connections: 1, subtrees: 1, shapes: 1, images: 1 });
    assert.equal(data.tree.id, 'original'); assert.throws(() => prepareTalentImport(parsed, [data.tree], 'original'), /new identity/);
});
test('Unavailable external tree references are reported without dropping nodes or internal connections', () => {
    const data = fixture(), result = prepareTalentImport(data, [], 'new-tree');
    assert.equal(result.missingParentId, 'parent'); assert.equal(result.disconnected, 2); assert.equal(result.tree.parentTreeId, null); assert.ok(result.tree.nodes.every(node => node.linkedTreeId === null));
    assert.deepEqual(result.tree.edges, data.tree.edges); assert.deepEqual(result.tree.nodes[1]!.levels, data.tree.nodes[1]!.levels); assert.equal(result.tree.imageId, 'art');
});
test('Legacy plain tree JSON retains room images or reports their absence for review', () => {
    const data = fixture(), parsed = parseTalentExport(JSON.stringify(data.tree));
    assert.deepEqual(parsed.tree, data.tree); const absent = prepareTalentImport(parsed, [], 'imported'); assert.equal(absent.missingImages, 1); assert.equal(absent.tree.imageId, null); assert.ok(absent.tree.nodes.every(node => node.imageId === null));
    const sameRoom = prepareTalentImport(parsed, [data.tree], 'imported'); assert.equal(sameRoom.missingImages, 0); assert.equal(sameRoom.tree.imageId, 'art');
});
test('Invalid files and malformed embedded images are rejected before any import', () => {
    assert.throws(() => parseTalentExport('{'), /invalidJSON/); assert.throws(() => parseTalentExport('null'), /invalidJSON/);
    const data = fixture(); assert.throws(() => parseTalentExport(JSON.stringify({ ...data, version: 99 })), /unsupportedVersion/);
    assert.throws(() => parseTalentExport(JSON.stringify({ ...data, images: {} })), /missingImages/);
    for (const image of [{ type: 'image/svg+xml', data: 'YWJjZA==' }, { type: 'image/webp', data: 'https://example.com/art' }, { type: 'image/webp', data: '====' }]) assert.throws(() => parseTalentExport(JSON.stringify({ ...data, images: { art: image } })), /invalidImages/);
    data.tree.edges.push({ parent: 'second', child: 'first' }); assert.throws(() => parseTalentExport(JSON.stringify(data)), /cycle/);
});
test('Duplicate names ignore case, repeated whitespace and Unicode presentation', () => {
    const tree = newTalentTree('existing', 'classic'); tree.name = 'Talent Tree';
    for (const name of ['talent tree', ' TALENT   Tree ', 'Ｔａｌｅｎｔ Tree']) assert.equal(duplicateTalentName(name, [tree]), true);
    assert.equal(duplicateTalentName('Talent Tree (2)', [tree]), false);
});

test('Importing an archived export creates an active copy without changing its source archive', () => {
    const data = fixture(); data.tree.archived = true;
    const parsed = parseTalentExport(JSON.stringify(data)); assert.equal(parsed.tree.archived, true);
    const imported = prepareTalentImport(parsed, [], 'restored-copy'); assert.equal(imported.tree.archived, false); assert.equal(data.tree.archived, true);
});
