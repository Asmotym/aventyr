export const BAG_RARITIES = ['Common', 'Uncommon', 'Fine', 'Rare', 'Exotic', 'Heroic', 'Unique', 'Legendary', 'Mythic', 'Celestial', 'Divine', 'Ethernal'] as const;
export type BagRarity = typeof BAG_RARITIES[number];
export type BagScope = 'team' | 'personal';
export type BagFieldType = 'string' | 'integer' | 'select' | 'multi-select';
export interface BagFieldDefinition { name: string; type: BagFieldType; options: string[] }
export interface BagField extends BagFieldDefinition { templateId?: string; value: string | number | string[]; display: boolean }
export interface BagTemplate extends BagFieldDefinition { id: string; revision: number }
export interface BagSection { id: string; name: string; revision: number }
export interface BagItem {
 id: string; creatorId: string; sectionId: string | null; name: string; description: string;
 displayDescription: boolean; rarity: BagRarity; imageId: string | null; fields: BagField[]; revision: number;
}
export interface BagSnapshot { id: string; scope: BagScope; revision: number; sections: BagSection[]; templates: BagTemplate[]; items: BagItem[] }
export interface BagPresence { userId: string; scope: BagScope; state: 'viewing' | 'adding' | 'editing'; sectionId: string | null; itemId: string | null; expiresAt: number }
export const BAG_ACTIONS = ['bag', 'setBagEnabled', 'createBagSection', 'updateBagSection', 'deleteBagSection', 'createBagTemplate', 'updateBagTemplate', 'deleteBagTemplate', 'createBagItem', 'updateBagItem', 'deleteBagItem', 'giveBagItem', 'shareBagItem'] as const;
export type BagActionName = typeof BAG_ACTIONS[number];
export interface BagAction { action: BagActionName; payload: { roomId: string; userId: string; scope?: BagScope; id?: string; revision?: number; enabled?: boolean; targetUserId?: string; data?: unknown } }
