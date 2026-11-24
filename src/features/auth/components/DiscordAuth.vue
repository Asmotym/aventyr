<template>
  <div class="discord-auth">
    <!-- Login section -->
    <div v-if="!user" class="discord-auth__login-section">
      <button @click="discordService.login()" class="discord-auth__btn">
        <svg class="discord-auth__icon" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
        <span v-if="showLoginText === true">{{ t('discord.login_text') }}</span>
      </button>
    </div>

    <!-- Connected section -->
    <v-container v-else fluid class="app-header__user-section">
      <v-row justify="center">
        <v-menu min-width="200px">
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-avatar size="large">
                <v-img :src="user.avatar" :alt="user.username" />
              </v-avatar>
            </v-btn>
          </template>
          <v-card>
            <v-card-text>
              <div class="mx-auto text-center">
                <v-avatar size="large">
                  <v-img :src="user.avatar" :alt="user.username" />
                </v-avatar>
                <h3>{{ user.username }}</h3>
                <v-divider class="my-3"></v-divider>
                <v-btn
                  variant="text"
                  color="primary"
                  rounded
                  block
                  class="mb-2"
                  :to="{ name: HomeRoutes.Settings }"
                >
                  <v-icon icon="mdi-cog-outline" start size="18" />
                  {{ t('navigation.settings') }}
                </v-btn>
                <v-btn variant="text" color="red" rounded @click="logout()">
                  {{ t('common.disconnect') }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-menu>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import type { DiscordUser } from '@shared/accounts/discord.types';
import { computed, onMounted } from 'vue'
import { DiscordService } from '@/features/auth/services/discord.service';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from '@/shared/navigation/routes';

defineProps<{
  showLoginText?: Boolean
}>();

const { t } = useI18n();

const router = useRouter();
const discordService = DiscordService.getInstance();
const user = computed<DiscordUser | null>(() => discordService.user.value)

function logout() {
  discordService.logout();
  router.push({ name: HomeRoutes.Base });
}

onMounted(async () => {
  await discordService.handleLogin();
})
</script>

<style scoped lang="scss" src="@/assets/styles/features/auth/discord-auth.scss"></style>
