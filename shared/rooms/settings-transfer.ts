import { validateTalentTree } from './talents';
import { parseTalentExport, TalentTransferError, talentImageIds } from './talent-transfer';
import type { TalentTreeExport } from './talent-transfer';

export const SETTINGS_TRANSFER_LIMIT = 50 * 1024 * 1024;
export const TRANSFER_SECTIONS = ['room', 'dices', 'rollAwards', 'criticals', 'bonusPoints', 'talents', 'bag'] as const;
export type TransferSectionKey = typeof TRANSFER_SECTIONS[number];
export type TransferValue = string | number | boolean;
export type TransferEntry = Record<string, unknown>;
export interface TransferSection { values: Record<string, TransferValue>; lists: Record<string, TransferEntry[]>; }
export interface RoomSettingsPackage {
    format: 'aventyr-room-settings';
    version: 1;
    sections: Partial<Record<TransferSectionKey, TransferSection>>;
    images: TalentTreeExport['images'];
}
export interface SettingsTransferPayload {
    roomId: string; userId: string; package?: RoomSettingsPackage; mode?: 'add' | 'replace'; token?: string;
}
export interface SettingsTransferPreview {
    token: string;
    changes: Array<{ section: TransferSectionKey; added: TransferEntry[]; removed: TransferEntry[]; archived: TransferEntry[]; values: Record<string, { before: TransferValue | null; after: TransferValue }> }>;
}
export const TRANSFER_FIELDS: Record<TransferSectionKey, { values: readonly string[]; lists: readonly string[] }> = {
    room: { values: ['name', 'sessionInactivityMinutes'], lists: [] },
    dices: { values: [], lists: ['categories', 'dices'] },
    rollAwards: { values: ['enabled', 'allowNonLeaders'], lists: ['awards'] },
    criticals: { values: [], lists: ['rules'] },
    bonusPoints: { values: ['enabled', 'maxPointsPerUser', 'allowExtremeSpend'], lists: ['triggers', 'conditions', 'effects'] },
    talents: { values: ['enabled', 'globalEnabled', 'maxGlobal'], lists: ['trees'] },
    bag: { values: ['enabled'], lists: [] },
};
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function emptySettingsPackage(): RoomSettingsPackage { return { format: 'aventyr-room-settings', version: 1, sections: {}, images: {} }; }
export function parseSettingsPackage(text: string): RoomSettingsPackage {
    if (new TextEncoder().encode(text).length > SETTINGS_TRANSFER_LIMIT) throw new Error('Settings file exceeds 50 MB');
    let raw: unknown;
    try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('Invalid JSON'); }
    if (object(raw) && raw.format === 'aventyr-talent-tree') {
        const data = readTalentPackage(text), result = emptySettingsPackage();
        result.sections.talents = { values: {}, lists: { trees: [data.tree as unknown as TransferEntry] } }; result.images = data.images;
        return result;
    }
    // Roll Awards previously exported a plain array.
    if (Array.isArray(raw)) raw = { ...emptySettingsPackage(), sections: { rollAwards: { values: {}, lists: { awards: raw } } } };
    if (!object(raw) || raw.format !== 'aventyr-room-settings' || raw.version !== 1) throw new Error('Unsupported settings format or version');
    if (!object(raw.sections) || !object(raw.images)) throw new Error('Invalid settings package');
    const result = emptySettingsPackage();
    for (const [key, section] of Object.entries(raw.sections)) {
        if (!TRANSFER_SECTIONS.includes(key as TransferSectionKey) || !object(section) || !object(section.values) || !object(section.lists)) throw new Error('Invalid settings section');
        const fields = TRANSFER_FIELDS[key as TransferSectionKey];
        if (Object.entries(section.values).some(([name, value]) => !fields.values.includes(name) || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)))) throw new Error('Invalid setting value');
        if (Object.entries(section.lists).some(([name, list]) => !fields.lists.includes(name) || !Array.isArray(list) || list.length > 2000 || list.some(entry => !object(entry)))) throw new Error('Invalid settings list');
        result.sections[key as TransferSectionKey] = structuredClone(section) as unknown as TransferSection;
    }
    const trees = result.sections.talents?.lists.trees ?? [];
    const used = new Set<string>();
    for (const tree of trees) {
        validateTalentTree(tree);
        const ids = talentImageIds(tree as unknown as TalentTreeExport['tree']); ids.forEach(id => used.add(id));
        const images = Object.fromEntries(ids.filter(id => Object.prototype.hasOwnProperty.call(raw.images, id)).map(id => [id, (raw.images as Record<string, unknown>)[id]]));
        const parsed = readTalentPackage(JSON.stringify({ format: 'aventyr-talent-tree', version: 1, tree, images }));
        Object.assign(result.images, parsed.images);
    }
    if (Object.keys(raw.images).some(id => !used.has(id))) throw new Error('Unreferenced talent images');
    validateTransferDependencies(result);
    return result;
}
export function validateTransferDependencies(data: RoomSettingsPackage) {
    const dice = data.sections.dices;
    if (dice) {
        const ids = new Set((dice.lists.categories ?? []).map(entry => entry.id));
        if ((dice.lists.dices ?? []).some(entry => entry.categoryId && !ids.has(entry.categoryId))) throw new Error('Select the categories required by the selected dice');
    }
    const trees = data.sections.talents?.lists.trees ?? [], ids = new Set(trees.map(tree => tree.id));
    for (const tree of trees) {
        if (tree.parentTreeId && !ids.has(tree.parentTreeId)) throw new Error('Select the parent talent tree');
        if (!Array.isArray(tree.nodes)) throw new Error('Invalid talent tree');
        if ((tree.nodes as TransferEntry[]).some(node => node.linkedTreeId && !ids.has(node.linkedTreeId))) throw new Error('Select linked talent trees');
    }
}
/** Keep only assets referenced by selected trees. */
export function pruneTransferImages(data: RoomSettingsPackage): RoomSettingsPackage {
    const result = JSON.parse(JSON.stringify(data)) as RoomSettingsPackage;
    const ids = new Set((result.sections.talents?.lists.trees ?? []).flatMap(tree => talentImageIds(tree as unknown as TalentTreeExport['tree'])));
    result.images = Object.fromEntries(Object.entries(result.images).filter(([id]) => ids.has(id)));
    return result;
}

function readTalentPackage(text: string): TalentTreeExport {
    try { return parseTalentExport(text); }
    catch (error) {
        if (!(error instanceof TalentTransferError)) throw error;
        const messages = { tooLarge: 'Talent package exceeds 50 MB', invalidJSON: 'Invalid talent JSON', unsupportedVersion: 'Unsupported talent format or version', invalidImages: 'Talent images contain invalid data', missingImages: 'Talent images are missing. Export the tree again with its images.' };
        throw new Error(messages[error.code]);
    }
}
