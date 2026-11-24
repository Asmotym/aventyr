import type { RoomRole } from 'netlify/core/utils/room-permissions';

export const ROOM_ROLE_ICONS: Record<RoomRole, string> = {
  creator: 'mdi-crown',
  admin: 'mdi-shield-account',
  dm: 'mdi-wizard-hat',
  player: 'mdi-account',
};
