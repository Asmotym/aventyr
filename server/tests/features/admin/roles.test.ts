import assert from 'node:assert/strict';
import test from 'node:test';
import type { UserRole } from '../../../../shared/accounts/accounts.types';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/aventyr_roles_unused';
const { canAccessAdmin, canManageRole } = await import('../../../features/auth/roles.service');

test('application role hierarchy allows only an owner to manage lower-ranked users', () => {
    const roles: UserRole[] = ['user', 'admin', 'owner'];
    for (const actor of roles) {
        assert.equal(canAccessAdmin(actor), actor !== 'user');
        for (const target of roles) for (const next of roles) {
            assert.equal(canManageRole(actor, target, next), actor === 'owner' && target !== 'owner' && next !== 'owner');
        }
    }
    assert.equal(canAccessAdmin(null), false);
});
