import type { UserRole, UserSummary } from 'netlify/core/types/data.types';
import { apiRequest } from '@/shared/services/api.service';

export class AdminService {
  static async listUsers(): Promise<UserSummary[]> {
    const data = await apiRequest<{ users: UserSummary[] }>('/admin/users');
    return data.users;
  }

  static async updateUserRole(userId: string, role: Exclude<UserRole, 'owner'>): Promise<UserSummary> {
    const data = await apiRequest<{ user: UserSummary }>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    return data.user;
  }
}
