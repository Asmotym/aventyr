<template>
  <v-app-bar class="app-header">
    <template #prepend>
      <v-app-bar-title class="header-brand ml-2">
        <div class="main-title">
          <img
            src="/aventyr-d100.svg"
            :alt="t('common.logoAlt')"
            class="header-logo"
          />
          <span>{{ t('common.title') }}</span>
        </div>
      </v-app-bar-title>
    </template>

    <v-container class="desktop-navigation d-none d-md-flex justify-center align-center gap-3">
      <v-btn variant="text" :to="{ name: HomeRoutes.Base }">
        <span>{{ t('navigation.home') }}</span>
      </v-btn>
      <v-btn variant="text" :to="{ name: HomeRoutes.Articles }">
        <span>{{ t('navigation.articles') }}</span>
      </v-btn>
      <v-btn
        v-if="canAccessAdmin"
        variant="text"
        :to="{ name: HomeRoutes.AdminUsers }"
      >
        <span>{{ t('navigation.administration') }}</span>
      </v-btn>
      <v-btn
        v-if="activeRoomName && activeRoomId"
        color="primary"
        variant="tonal"
        :to="{ name: HomeRoutes.Room, params: { roomId: activeRoomId } }"
      >
        <v-icon icon="mdi-dice-multiple-outline" size="18" class="mr-2" />
        <span>{{ activeRoomName }}</span>
      </v-btn>
    </v-container>

    <template #append>
      <div class="desktop-actions d-none d-md-flex align-center">
        <ThemeSwitcher />
        <LanguageSwitcher />
        <v-btn
          icon
          :href="STATUS_LINK"
          target="_blank"
          rel="noreferrer"
          :title="t('common.openStatusPage')"
          variant="text"
          color="primary"
        >
          <v-icon icon="mdi-monitor-dashboard" size="20" />
        </v-btn>
        <v-btn
          icon
          :href="BUG_REPORT_LINK"
          target="_blank"
          rel="noreferrer"
          :title="t('common.reportIssue')"
          variant="text"
          color="error"
          class="mr-2"
        >
          <v-icon icon="mdi-bug-outline" size="20" />
        </v-btn>
        <DiscordAuth />
      </div>

      <div class="mobile-actions d-flex d-md-none align-center">
        <DiscordAuth />
        <v-menu
          v-model="mobileMenuOpen"
          location="bottom end"
          :close-on-content-click="false"
        >
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="text"
              class="mobile-menu-button"
              :title="t('common.openNavigationMenu')"
              :aria-label="t('common.openNavigationMenu')"
            >
              <v-icon :icon="mobileMenuOpen ? 'mdi-close' : 'mdi-menu'" />
            </v-btn>
          </template>

          <v-card class="mobile-menu-card">
            <v-list nav>
              <v-list-item
                prepend-icon="mdi-home-outline"
                :title="t('navigation.home')"
                :to="{ name: HomeRoutes.Base }"
                @click="closeMobileMenu"
              />
              <v-list-item
                prepend-icon="mdi-newspaper-variant-outline"
                :title="t('navigation.articles')"
                :to="{ name: HomeRoutes.Articles }"
                @click="closeMobileMenu"
              />
              <v-list-item
                v-if="canAccessAdmin"
                prepend-icon="mdi-shield-account-outline"
                :title="t('navigation.administration')"
                :to="{ name: HomeRoutes.AdminUsers }"
                @click="closeMobileMenu"
              />
              <v-list-item
                v-if="activeRoomName && activeRoomId"
                prepend-icon="mdi-dice-multiple-outline"
                :title="activeRoomName"
                :to="{ name: HomeRoutes.Room, params: { roomId: activeRoomId } }"
                color="primary"
                @click="closeMobileMenu"
              />
            </v-list>

            <v-divider />

            <div class="mobile-utility-actions">
              <ThemeSwitcher />
              <LanguageSwitcher />
              <v-btn
                icon
                :href="STATUS_LINK"
                target="_blank"
                rel="noreferrer"
                :title="t('common.openStatusPage')"
                variant="text"
                color="primary"
              >
                <v-icon icon="mdi-monitor-dashboard" size="20" />
              </v-btn>
              <v-btn
                icon
                :href="BUG_REPORT_LINK"
                target="_blank"
                rel="noreferrer"
                :title="t('common.reportIssue')"
                variant="text"
                color="error"
              >
                <v-icon icon="mdi-bug-outline" size="20" />
              </v-btn>
            </div>
          </v-card>
        </v-menu>
      </div>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from 'core/routes';
import { useRoomsStore } from 'core/stores/rooms.store';
import ThemeSwitcher from 'core/components/ThemeSwitcher.vue';
import LanguageSwitcher from 'modules/language-switcher/components/LanguageSwitcher.vue';
import DiscordAuth from 'modules/discord-auth/components/DiscordAuth.vue';
import { useCurrentUserRole } from 'core/composables/useCurrentUserRole';

const STATUS_LINK = 'https://uptime.asmotym.fr/status/all';
// Keep this legacy permalink until the external Notion page is renamed.
const BUG_REPORT_LINK = 'https://asmotym.notion.site/Rolz-Issues-Reporting-2c31392001c0804f84cefb9726da1bdf';

const { t } = useI18n();
const roomsStore = useRoomsStore();
const { canAccessAdmin, user } = useCurrentUserRole();
const shortcutRoom = computed(() => {
  if (!user.value) return null;
  if (roomsStore.selectedRoomUserId === user.value.id && roomsStore.selectedRoom) return roomsStore.selectedRoom;
  if (roomsStore.lastAccessedRoomUserId !== user.value.id) return null;
  return roomsStore.rooms.find(room => room.id === roomsStore.lastAccessedRoomId && !room.isArchived) ?? null;
});
const activeRoomName = computed(() => shortcutRoom.value?.name ?? null);
const activeRoomId = computed(() => shortcutRoom.value?.id ?? null);
const mobileMenuOpen = ref(false);

function closeMobileMenu() {
  mobileMenuOpen.value = false;
}
</script>

<style scoped>
.header-logo {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.35);
}

.main-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.desktop-navigation {
  min-width: 0;
}

.mobile-menu-card {
  width: min(320px, calc(100vw - 24px));
}

.mobile-utility-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 8px;
}

@media (max-width: 959px) {
  .app-header :deep(.v-toolbar__prepend) {
    margin-inline-start: 8px;
  }

  .app-header :deep(.v-toolbar__append) {
    margin-inline-end: 4px;
  }

  .header-brand {
    margin-left: 0 !important;
  }

  .mobile-actions {
    gap: 2px;
  }

  .mobile-menu-button {
    margin-inline: 2px;
  }
}

@media (max-width: 359px) {
  .main-title span {
    display: none;
  }
}
</style>
