import { randomUUID } from 'node:crypto';
import { BadRequestError, ConflictError } from '../errors/http-errors';
import { BAG_RARITIES, type BagFieldDefinition, type BagField, type BagItem } from '../types/bag.types';
export function bagText(value: unknown, max = 120): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestError(`Text must contain 1–${max} characters`);
    return value.trim();
}
export function bagDefinition(input: unknown): BagFieldDefinition {
    const data = object(input);
    if (!['string', 'integer', 'select', 'multi-select'].includes(String(data.type))) throw new BadRequestError('Invalid field type');
    const type = data.type as BagFieldDefinition['type'];
    const options = ['select', 'multi-select'].includes(type) ? data.options : [];
    if (!Array.isArray(options) || options.length > 100) throw new BadRequestError('Invalid field options');
    const normalized = options.map(o => bagText(o));
    if (new Set(normalized).size !== normalized.length || (['select', 'multi-select'].includes(type) && !normalized.length)) throw new BadRequestError('Select options must be nonempty and unique');
    return { name: bagText(data.name), type, options: normalized };
}
export function object(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestError('Object required');
    return input as Record<string, unknown>;
}
export function bagItemData(input: unknown): Omit<BagItem, 'id' | 'revision' | 'creatorId'> {
    const data = object(input);
    const rarity = data.rarity ?? 'Common';
    if (!BAG_RARITIES.includes(rarity as BagItem['rarity'])) throw new BadRequestError('Invalid rarity');
    const fields = data.fields ?? [];
    if (!Array.isArray(fields) || fields.length > 50) throw new BadRequestError('At most 50 fields allowed');
    const parsedFields: BagField[] = fields.map(f => {
        const field = object(f), definition = bagDefinition(field), value = field.value;
        if (definition.type === 'string' && (typeof value !== 'string' || value.length > 4000)) throw new BadRequestError('Invalid text field');
        if (definition.type === 'integer' && !Number.isSafeInteger(value)) throw new BadRequestError('Invalid integer field');
        if (definition.type === 'select' && !definition.options.includes(value as string)) throw new BadRequestError('Invalid select value');
        if (definition.type === 'multi-select' && (!Array.isArray(value) || value.some(v => !definition.options.includes(v)) || new Set(value).size !== value.length)) throw new BadRequestError('Invalid multi-select value');
        if (typeof field.display !== 'undefined' && typeof field.display !== 'boolean') throw new BadRequestError('Invalid display flag');
        return { ...definition, ...(typeof field.templateId === 'string' ? { templateId: bagText(field.templateId, 36) } : {}), value: value as BagField['value'], display: field.display === true };
    });
    if (data.description !== undefined && (typeof data.description !== 'string' || data.description.length > 10000)) throw new BadRequestError('Invalid description');
    if (data.displayDescription !== undefined && typeof data.displayDescription !== 'boolean') throw new BadRequestError('Invalid description display flag');
    return { name: bagText(data.name), description: data.description as string || '', rarity: rarity as BagItem['rarity'], displayDescription: data.displayDescription === true,
        imageId: data.imageId == null ? null : bagText(data.imageId, 36), sectionId: data.sectionId == null ? null : bagText(data.sectionId, 36), fields: parsedFields };
}
export function requireBagRevision(actual: number, expected: unknown): void {
    if (!Number.isSafeInteger(expected) || actual !== expected) throw new ConflictError('This entry changed. Reload to review the latest version; your draft has been preserved.');
}
export const newBagId = () => randomUUID();
