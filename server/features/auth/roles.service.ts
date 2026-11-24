import type { UserRole } from '../../../shared/accounts/accounts.types';
import { ForbiddenError, NotFoundError } from '../../infrastructure/http/errors';
import { getUser } from '../accounts/repositories/users.table';
const ROLE_WEIGHT: Record<UserRole, number> = {
    user: 1,
    admin: 2,
    owner: 3
};
export function canAccessAdmin(role?: UserRole | null): boolean {
    return role === 'owner' || role === 'admin';
}
export function canManageRole(actorRole: UserRole, targetRole: UserRole, newRole: UserRole): boolean {
    if (newRole === 'owner')
        return false;
    if (actorRole !== 'owner')
        return false;
    if (ROLE_WEIGHT[targetRole] >= ROLE_WEIGHT[actorRole])
        return false;
    return ROLE_WEIGHT[newRole] < ROLE_WEIGHT[actorRole];
}
export async function requireKnownUser(userId: string) {
    if (!userId)
        throw new ForbiddenError('User id is required');
    const user = await getUser(userId);
    if (!user?.discord_user_id)
        throw new NotFoundError('User not found');
    return { ...user, role: (user.role ?? 'user') as UserRole };
}
export async function requireAdmin(userId: string) {
    const user = await requireKnownUser(userId);
    if (!canAccessAdmin(user.role)) {
        throw new ForbiddenError('Admin access is required');
    }
    return user;
}
export async function requireOwner(userId: string) {
    const user = await requireKnownUser(userId);
    if (user.role !== 'owner') {
        throw new ForbiddenError('Owner access is required');
    }
    return user;
}
