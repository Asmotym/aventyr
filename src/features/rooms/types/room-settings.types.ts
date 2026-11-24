import type { RoomDetails } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';

export type SettingsTab = 'talents' | 'bag' | 'administration' | 'room' | 'dices' | 'criticals' | 'rollAwards' | 'bonusPoints';
export interface RoomSettingsProps { room: RoomDetails | null; currentUser: DiscordUser | null; initialTab?: SettingsTab; }
export type SettingsFeedback = (type: 'success' | 'error' | 'info', message: string) => void;
