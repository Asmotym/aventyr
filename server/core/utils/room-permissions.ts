export const ROOM_ROLES = ['creator', 'admin', 'player', 'dm'] as const;
export type RoomRole = typeof ROOM_ROLES[number];
export const ROOM_PERMISSIONS = ['editNickname', 'manageDice', 'manageDiceCategories', 'viewRollAwards', 'manageRollAwards', 'copyRollAwards', 'manageCriticals', 'manageBonusPoints', 'assignRollAwards', 'manageSessions', 'editRoom', 'archiveRoom'] as const;
export type RoomPermission = typeof ROOM_PERMISSIONS[number];
export type RoomRights = Record<RoomPermission, boolean>;
export type RoomPermissionOverrides = Partial<RoomRights>;
export function roleDefaults(role: RoomRole): RoomRights {
    return Object.fromEntries(ROOM_PERMISSIONS.map(key => [key, role === 'creator' || role === 'admin' || ['editNickname', 'manageDice', 'manageDiceCategories', 'viewRollAwards'].includes(key) || (role === 'dm' && key === 'assignRollAwards')])) as RoomRights;
}
export function resolveRoomRights(role: RoomRole, overrides: RoomPermissionOverrides = {}): RoomRights {
    return role === 'creator' ? roleDefaults(role) : { ...roleDefaults(role), ...overrides };
}
export function normalizeRoomOverrides(role: RoomRole, rights: RoomPermissionOverrides): RoomPermissionOverrides {
    const defaults = roleDefaults(role);
    return Object.fromEntries(ROOM_PERMISSIONS.filter(key => typeof rights[key] === 'boolean' && rights[key] !== defaults[key]).map(key => [key, rights[key]]));
}
export function parseRoomOverrides(value: unknown): RoomPermissionOverrides {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(ROOM_PERMISSIONS.filter(key => typeof parsed[key] === 'boolean').map(key => [key, parsed[key]]));
    } catch { return {}; }
}
export function memberAccess(member: { role?: RoomRole; permissionOverrides?: RoomPermissionOverrides } | undefined) {
    const role = member?.role ?? 'player';
    return { role, rights: resolveRoomRights(role, member?.permissionOverrides), administration: role === 'creator' || role === 'admin' };
}
