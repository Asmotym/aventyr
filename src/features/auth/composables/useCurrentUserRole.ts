import { computed } from 'vue';
import { DiscordService } from '@/features/auth/services/discord.service';

export function useCurrentUserRole() {
  const discordService = DiscordService.getInstance();
  const user = computed(() => discordService.user.value);
  const role = computed(() => user.value?.role ?? 'user');
  const isOwner = computed(() => role.value === 'owner');
  const isAdmin = computed(() => role.value === 'owner' || role.value === 'admin');

  return {
    user,
    role,
    isOwner,
    isAdmin,
    canAccessAdmin: isAdmin,
  };
}
