import type { Express } from 'express';
import { requireRequesterId, respondWithServiceError } from '../../infrastructure/http/request-helpers';
import { listAdminUsers, updateUserRole } from './admin.service';
const services = { listAdminUsers, updateUserRole };
export function registerAdminRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { listAdminUsers, updateUserRole } = { ...services, ...overrides };
    app.get('/api/admin/users', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const users = await listAdminUsers(userId);
            res.json({ success: true, data: { users } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'admin_user.list');
        }
    });
    app.patch('/api/admin/users/:targetUserId/role', async (req, res) => {
        const userId = await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const user = await updateUserRole(userId, req.params.targetUserId, (req.body as {
                role?: unknown;
            }).role);
            res.json({ success: true, data: { user } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'admin_user.update_role');
        }
    });
}
