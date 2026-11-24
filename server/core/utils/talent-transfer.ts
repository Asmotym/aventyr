import { validateTalentTree } from './talents';
import type { TalentTree } from '../types/talents.types';

export const TALENT_TRANSFER_LIMIT = 50 * 1024 * 1024;
export interface TalentTreeExport {
    format: 'aventyr-talent-tree'; version: 1; tree: TalentTree;
    images: Record<string, { type: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }>;
}
export class TalentTransferError extends Error {
    constructor(public code: 'tooLarge' | 'invalidJSON' | 'unsupportedVersion' | 'invalidImages' | 'missingImages') { super(code); }
}
export function talentImageIds(tree: TalentTree): string[] {
    return [...new Set([tree, ...tree.nodes, ...tree.subtrees].flatMap(item => item.imageId ? [item.imageId] : []))];
}
export function parseTalentExport(text: string): TalentTreeExport {
    if (new TextEncoder().encode(text).length > TALENT_TRANSFER_LIMIT) throw new TalentTransferError('tooLarge');
    let value: unknown;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new TalentTransferError('invalidJSON'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TalentTransferError('invalidJSON');
    const wrapped = 'format' in value || 'version' in value || 'tree' in value;
    if (wrapped && (!('format' in value) || value.format !== 'aventyr-talent-tree' || !('version' in value) || value.version !== 1)) throw new TalentTransferError('unsupportedVersion');
    const tree = validateTalentTree(wrapped && 'tree' in value ? value.tree : value);
    const rawImages = wrapped && 'images' in value ? value.images : {};
    if (!rawImages || typeof rawImages !== 'object' || Array.isArray(rawImages)) throw new TalentTransferError('invalidImages');
    const images: TalentTreeExport['images'] = {};
    const ids = talentImageIds(tree);
    for (const [id, image] of Object.entries(rawImages)) {
        if (!ids.includes(id) || !image || typeof image !== 'object' || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type) || typeof image.data !== 'string' || !image.data.length || image.data.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 || image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) throw new TalentTransferError('invalidImages');
        images[id] = { type: image.type, data: image.data };
    }
    if (wrapped && ids.some(id => !Object.prototype.hasOwnProperty.call(images, id))) throw new TalentTransferError('missingImages');
    return { format: 'aventyr-talent-tree', version: 1, tree, images };
}
export function prepareTalentImport(data: TalentTreeExport, catalog: TalentTree[], id: string) {
    if (catalog.some(tree => tree.id === id)) throw new Error('Imported tree must have a new identity');
    const tree = structuredClone(data.tree); tree.id = id;
    if (tree.archived) tree.archived = false;
    let disconnected = 0;
    const missingParentId = tree.parentTreeId && !catalog.some(target => target.id === tree.parentTreeId) ? tree.parentTreeId : null;
    if (missingParentId) tree.parentTreeId = null;
    for (const node of tree.nodes) if (node.linkedTreeId && !catalog.some(target => target.id === node.linkedTreeId)) { node.linkedTreeId = null; disconnected++; }
    const availableImages = new Set(catalog.flatMap(talentImageIds));
    const missingImages = talentImageIds(tree).filter(imageId => !Object.prototype.hasOwnProperty.call(data.images, imageId) && !availableImages.has(imageId));
    for (const item of [tree, ...tree.nodes, ...tree.subtrees]) if (item.imageId && missingImages.includes(item.imageId)) item.imageId = null;
    return { tree, disconnected, missingParentId, missingImages: missingImages.length };
}
export function talentImportSummary(tree: TalentTree) {
    return { nodes: tree.nodes.length, ranks: tree.nodes.reduce((sum, node) => sum + node.levels.length, 0), connections: tree.edges.length, subtrees: tree.subtrees.length, shapes: tree.decorations?.length ?? 0, images: talentImageIds(tree).length };
}
export function duplicateTalentName(name: string, catalog: TalentTree[]): boolean {
    const normalized = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    return catalog.some(tree => normalized(tree.name) === normalized(name));
}
