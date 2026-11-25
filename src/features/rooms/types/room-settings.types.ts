import type { RoomDetails } from '@shared/rooms/rooms.types';
import type { DiscordUser } from '@shared/accounts/discord.types';

export type SettingsTab = 'transfer' | 'talents' | 'bag' | 'administration' | 'room' | 'dices' | 'criticals' | 'rollAwards' | 'bonusPoints';
export interface RoomSettingsProps { room: RoomDetails | null; currentUser: DiscordUser | null; initialTab?: SettingsTab; }
export type SettingsFeedback = (type: 'success' | 'error' | 'info', message: string) => void;
