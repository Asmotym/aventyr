export const BAG_RARITIES = ['Common', 'Uncommon', 'Fine', 'Rare', 'Exotic', 'Heroic', 'Unique', 'Legendary', 'Mythic', 'Celestial', 'Divine', 'Ethernal'] as const;
export type BagRarity = typeof BAG_RARITIES[number];
export type BagScope = 'team' | 'personal';
export type BagFieldType = 'string' | 'integer' | 'select' | 'multi-select';
export interface BagFieldDefinition { name: string; type: BagFieldType; options: string[] }
export interface BagField extends BagFieldDefinition { templateId?: string; value: string | number | string[]; display: boolean }
export interface BagTemplate extends BagFieldDefinition { id: string; revision: number; ownerId?: string; public?: boolean }
export interface BagSection { id: string; name: string; color?: string | null; icon?: string | null; revision: number }
export interface BagItem {
 id: string; creatorId: string; sectionId: string | null; name: string; description: string;
 displayDescription: boolean; rarity: BagRarity; imageId: string | null; icon?: string | null; fields: BagField[]; revision: number; favorite?: boolean; createdAt?: number; updatedAt?: number;
}
export interface BagGiftNotification { userId: string; senderId: string; itemId: string; itemName: string }
export interface BagGift { item: BagItem; senderId: string }
export interface BagSnapshot { incomingGifts?: BagGift[]; targetUserId?: string; id: string; scope: BagScope; revision: number; tabOrder?: string[]; uncategorized?: BagSection; sections: BagSection[]; templates: BagTemplate[]; publicTemplates?: BagTemplate[]; items: BagItem[] }
export interface BagPresence { userId: string; scope: BagScope; state: 'viewing' | 'adding' | 'editing'; sectionId: string | null; itemId: string | null; target?: 'bag' | 'item' | 'section' | 'template'; templateId?: string | null; expiresAt: number }
export const BAG_ACTIONS = ['bag', 'setBagEnabled', 'reorderBagSections', 'createBagSection', 'updateBagSection', 'updateBagUncategorized', 'deleteBagSection', 'createBagTemplate', 'updateBagTemplate', 'deleteBagTemplate', 'createBagItem', 'updateBagItem', 'deleteBagItem', 'giveBagItem', 'acceptBagItem', 'rejectBagItem', 'moveBagItem', 'setBagItemFavorite', 'shareBagItem'] as const;
export type BagActionName = typeof BAG_ACTIONS[number];
export interface BagAction { action: BagActionName; payload: { roomId: string; userId: string; scope?: BagScope; id?: string; revision?: number; sectionIds?: string[]; enabled?: boolean; favorite?: boolean; targetUserId?: string; destinationScope?: BagScope; destinationSectionId?: string | null; data?: unknown } }

export interface BagSubscriptionFrame { type: 'bag.subscribe'; scope: BagScope; targetUserId?: string; requestId?: string }
export interface BagUnsubscribeFrame { type: 'bag.unsubscribe' }
export interface BagPresenceFrame {
 type: 'bag.presence'; scope?: BagScope; state: BagPresence['state'] | 'closed';
 sectionId?: string | null; itemId?: string | null; target?: BagPresence['target']; templateId?: string | null;
}
