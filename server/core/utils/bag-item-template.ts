import type { BagField, BagItem, BagItemTemplate } from '../types/bag.types';
export const bagFieldKey = (name: string) => name.trim().toLowerCase();
export function acceptsBagValue(field: BagField, value: BagField['value']): boolean {
    switch (field.type) {
        case 'string': return typeof value === 'string' && value.length <= 4000;
        case 'integer': return Number.isSafeInteger(value);
        case 'select': return typeof value === 'string' && field.options.includes(value);
        case 'multi-select': return Array.isArray(value) && new Set(value).size === value.length && value.every(v => field.options.includes(v));
    }
}
export function applyBagItemTemplate(item: BagItem, preset: BagItemTemplate): BagItem {
    const names = new Set(preset.fields.map(f => bagFieldKey(f.name)));
    const ordinary = item.fields.filter(f => !f.itemTemplateField);
    const remaining = ordinary.filter(f => !names.has(bagFieldKey(f.name)));
    const copied = preset.fields.map(field => {
        const conflict = ordinary.find(f => bagFieldKey(f.name) === bagFieldKey(field.name));
        const { templateId: _source, ...definition } = field;
        const value = conflict && acceptsBagValue(field, conflict.value) ? conflict.value : field.value;
        return { ...definition, options: [...field.options], value: Array.isArray(value) ? [...value] : value, itemTemplateField: true };
    });
    if (remaining.length + copied.length > 50) throw new Error('At most 50 fields allowed');
    return { ...item, description: preset.description, displayDescription: preset.displayDescription, rarity: preset.rarity, imageId: preset.imageId, icon: preset.icon,
        fields: [...remaining, ...copied], itemTemplate: { id: preset.id, name: preset.name, fields: preset.fields.map(({ name, type, options }) => ({ name, type, options: [...options] })) } };
}
