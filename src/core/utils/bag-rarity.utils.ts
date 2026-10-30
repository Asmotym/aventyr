import type { BagRarity } from 'netlify/core/types/bag.types';

// Keep inventory previews and rarity selection on the same palette.
export const BAG_RARITY_COLORS: Record<BagRarity, string> = {
  Common: '#aeb4bd',
  Uncommon: '#63d471',
  Fine: '#64b5f6',
  Rare: '#ffe066',
  Exotic: '#ffac49',
  Heroic: '#ff8717',
  Unique: '#ff6060',
  Legendary: '#bf83ff',
  Mythic: '#ff8cda',
  Celestial: '#f4faff',
  Divine: '#fff7de',
  Ethernal: '#fff',
};
