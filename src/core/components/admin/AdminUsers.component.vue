<template>
  <div>
    <h2 class="text-h5 mb-5">{{ t('admin.users.title') }}</h2>
    <v-card variant="flat" class="admin-card">
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
        <v-table>
          <thead>
            <tr>
              <th>{{ t('admin.users.user') }}</th>
              <th>{{ t('admin.users.role') }}</th>
              <th class="text-right">{{ t('admin.users.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <div class="d-flex align-center ga-3">
                  <UserProfileAvatar
                    :user-id="user.id"
                    :avatar="user.avatar"
                    :display-name="user.username"
                    :size="32"
                  />
                  <div>
                    <div>{{ user.username }}</div>
                    <div class="text-caption text-medium-emphasis">{{ user.id }}</div>
                  </div>
                </div>
              </td>
              <td>
                <v-chip size="small" :color="roleColor(user.role)">{{ user.role }}</v-chip>
              </td>
              <td class="text-right">
                <AppDropdown
                  v-if="canEdit(user)"
                  :model-value="user.role"
                  :items="roleItems"
                  density="compact"
                  hide-details
                  class="role-select"
                  @update:model-value="(role) => changeRole(user.id, role)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { UserRole, UserSummary } from 'netlify/core/types/data.types';
import { AdminService } from 'core/services/admin.service';
import { useCurrentUserRole } from 'core/composables/useCurrentUserRole';
import UserProfileAvatar from 'core/components/UserProfileAvatar.component.vue';

const { t } = useI18n();
const { isOwner, user: currentUser } = useCurrentUserRole();
const users = ref<UserSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const roleItems = ['user', 'admin'];

function roleColor(role: UserRole): string {
  if (role === 'owner') return 'purple';
  if (role === 'admin') return 'primary';
  return 'default';
}

function canEdit(user: UserSummary): boolean {
  return isOwner.value && user.role !== 'owner' && user.id !== currentUser.value?.id;
}

async function loadUsers() {
  loading.value = true;
  error.value = null;
  try {
    users.value = await AdminService.listUsers();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('admin.users.loadError');
  } finally {
    loading.value = false;
  }
}

async function changeRole(userId: string, role: string) {
  try {
    const updated = await AdminService.updateUserRole(userId, role as Exclude<UserRole, 'owner'>);
    users.value = users.value.map((user) => user.id === updated.id ? updated : user);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('admin.users.updateError');
  }
}

onMounted(loadUsers);
</script>

<style scoped>
.admin-card {
  border-radius: 8px;
}

.admin-card :deep(td) { padding-block: 16px; }
.admin-card :deep(th) { background: rgba(var(--v-theme-primary), .05); font-weight: 700; }

.role-select {
  display: inline-block;
  width: 150px;
  max-width: 100%;
}
</style>
