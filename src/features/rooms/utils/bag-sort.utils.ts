import { BAG_RARITIES, type BagItem } from 'netlify/core/types/bag.types';
export const BAG_SORT_TYPES = ['created-desc', 'created-asc', 'updated-desc', 'updated-asc', 'name-asc', 'name-desc', 'rarity-desc', 'rarity-asc'] as const;
export type BagSort = typeof BAG_SORT_TYPES[number];
export function validBagSort(value: unknown): value is BagSort { return BAG_SORT_TYPES.includes(value as BagSort); }
export function sortBagItems(items: BagItem[], order: BagSort, locale: string): BagItem[] {
  const [field, direction] = order.split('-');
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const favorites = Number(b.favorite === true) - Number(a.favorite === true);
    if (favorites) return favorites;
    const comparison = field === 'name' ? a.name.localeCompare(b.name, locale, { sensitivity: 'base', numeric: true })
      : field === 'rarity' ? BAG_RARITIES.indexOf(a.rarity) - BAG_RARITIES.indexOf(b.rarity)
      : field === 'updated' ? (a.updatedAt ?? 0) - (b.updatedAt ?? 0) : (a.createdAt ?? 0) - (b.createdAt ?? 0);
    return comparison * sign || a.id.localeCompare(b.id);
  });
}
