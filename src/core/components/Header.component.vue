<template>
  <v-app-bar class="app-header" height="72" :elevation="0">
    <template #prepend>
      <v-app-bar-title class="header-brand">
        <RouterLink class="main-title" :to="{ name: HomeRoutes.Base }">
          <span class="header-brand__mark"><img
            src="/aventyr-d100.svg"
            :alt="t('common.logoAlt')"
            class="header-logo"
          /></span>
          <span>{{ t('common.title') }}</span>
        </RouterLink>
      </v-app-bar-title>
    </template>

    <v-container tag="nav" class="desktop-navigation d-none d-md-flex align-center">
      <v-btn variant="text" prepend-icon="mdi-home-outline" :active="route.name === HomeRoutes.Base" :to="{ name: HomeRoutes.Base }">
        <span>{{ t('navigation.home') }}</span>
      </v-btn>
      <v-btn variant="text" prepend-icon="mdi-newspaper-variant-outline" :active="route.path.startsWith('/articles') || route.path.startsWith('/article/')" :to="{ name: HomeRoutes.Articles }">
        <span>{{ t('navigation.articles') }}</span>
      </v-btn>
      <v-btn
        v-if="canAccessAdmin"
        variant="text"
        prepend-icon="mdi-shield-account-outline"
        :active="route.path.startsWith('/admin')"
        :to="{ name: HomeRoutes.AdminUsers }"
      >
        <span>{{ t('navigation.administration') }}</span>
      </v-btn>
      <v-btn
        v-if="activeRoomName && activeRoomId"
        class="header-room-shortcut"
        :title="activeRoomName"
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
        <div class="header-tools">
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
        </div>
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
            <div class="mobile-menu-brand"><v-icon icon="mdi-compass-rose" size="22" /><span>{{ t('common.title') }}</span></div>
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
import { RouterLink, useRoute } from 'vue-router';
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
const route = useRoute();
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
.app-header { border-bottom: 1px solid rgba(var(--v-theme-primary), .14) !important; background: rgb(var(--v-theme-surface)) !important; background-image: radial-gradient(ellipse at top left, rgba(var(--v-theme-primary), .07), transparent 55%) !important; }
.app-header :deep(.v-toolbar__prepend) { margin-inline: 20px 12px; }
.app-header :deep(.v-toolbar__append) { margin-inline: 12px 20px; }
.header-brand { margin: 0; overflow: visible; }
.main-title { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 800; letter-spacing: -.045em; color: inherit; text-decoration: none; border-radius: 14px; }
.main-title:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 5px; }
.header-brand__mark { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 1px solid rgba(var(--v-theme-primary), .17); border-radius: 14px; background: rgba(var(--v-theme-primary), .08); transform: rotate(-6deg); }
.header-logo { width: 32px; height: 32px; transform: rotate(6deg); }
.desktop-navigation { display: flex; justify-content: center; gap: 4px; width: auto; min-width: 0; padding: 5px; border: 1px solid rgba(var(--v-border-color), .07); border-radius: 14px; background: rgba(var(--v-theme-on-surface), .025); }
.desktop-navigation > .v-btn { height: 38px; min-width: 0; padding-inline: 14px; border-radius: 10px; font-size: 12px; font-weight: 650; letter-spacing: 0; text-transform: none; color: rgba(var(--v-theme-on-surface), .65); }
.desktop-navigation > .v-btn--active { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); }
.desktop-navigation > .v-btn :deep(.v-btn__prepend) { margin-inline-end: 7px; }
.desktop-navigation > .v-btn :deep(.v-icon) { font-size: 18px; }
.desktop-navigation .header-room-shortcut { max-width: 190px; margin-inline-start: 5px; border: 1px solid rgba(var(--v-theme-primary), .18); color: rgb(var(--v-theme-primary)); }
.header-room-shortcut :deep(.v-btn__content) { min-width: 0; max-width: 100%; }
.header-room-shortcut span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.header-room-shortcut .v-icon { flex-shrink: 0; }
.desktop-actions { gap: 12px; }
.header-tools { display: flex; align-items: center; gap: 2px; padding-inline-end: 12px; border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.header-tools :deep(.v-btn) { height: 36px; min-width: 36px; border-radius: 10px; margin: 0 !important; font-size: 11px; }
.header-tools :deep(.v-btn--icon) { width: 36px; }
.header-tools :deep(.language-switcher) { padding-inline: 8px; }
.header-tools :deep(.language-switcher .v-icon) { font-size: 18px; }
.desktop-actions :deep(.user-section), .mobile-actions :deep(.user-section) { padding: 0; }
.desktop-actions :deep(.user-section > .v-row), .mobile-actions :deep(.user-section > .v-row) { margin: 0; }
.desktop-actions :deep(.user-section .v-btn), .mobile-actions :deep(.user-section .v-btn) { width: 42px; height: 42px; border: 1px solid rgba(var(--v-theme-primary), .25); border-radius: 14px; background: rgba(var(--v-theme-primary), .045); }
.desktop-actions :deep(.user-section .v-avatar), .mobile-actions :deep(.user-section .v-avatar) { width: 32px; height: 32px; border-radius: 10px; }
.mobile-actions { gap: 10px; }
.mobile-menu-button { width: 42px; height: 42px; border-radius: 12px; border: 1px solid rgba(var(--v-theme-primary), .16); color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .06); }
.mobile-menu-card { width: min(340px, calc(100vw - 24px)); margin-top: 10px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 18px !important; box-shadow: 0 12px 40px rgba(0, 0, 0, .14) !important; }
.mobile-menu-brand { display: flex; align-items: center; gap: 10px; padding: 18px 20px; font-size: 15px; font-weight: 750; color: rgb(var(--v-theme-primary)); border-bottom: 1px solid rgba(var(--v-theme-primary), .12); background: linear-gradient(120deg, rgba(var(--v-theme-primary), .09), transparent); }
.mobile-menu-card :deep(.v-list) { padding: 10px; background: transparent; }
.mobile-menu-card :deep(.v-list-item) { border-radius: 10px; margin-bottom: 4px; font-size: 13px; }
.mobile-menu-card :deep(.v-list-item--active) { color: rgb(var(--v-theme-primary)); }
.mobile-menu-card :deep(.v-list-item__prepend .v-icon) { margin-inline-end: 16px; }
.mobile-utility-actions { display: flex; align-items: center; justify-content: space-around; padding: 12px; background: rgba(var(--v-theme-on-surface), .02); }
.mobile-utility-actions :deep(.v-btn) { border-radius: 10px; margin: 0 !important; }
@media (min-width: 960px) and (max-width: 1199px) {
  .app-header :deep(.v-toolbar__prepend) { margin-inline: 14px 8px; }
  .app-header :deep(.v-toolbar__append) { margin-inline: 8px 14px; }
  .main-title { font-size: 19px; gap: 8px; }
  .desktop-navigation > .v-btn { font-size: 11px; padding-inline: 9px; }
  .desktop-navigation > .v-btn :deep(.v-btn__prepend) { display: none; }
  .desktop-navigation .header-room-shortcut { max-width: 135px; }
  .desktop-actions { gap: 8px; }
  .header-tools { padding-inline-end: 8px; }
}
@media (max-width: 959px) {
  .app-header :deep(.v-toolbar__prepend) { margin-inline: 16px 8px; }
  .app-header :deep(.v-toolbar__append) { margin-inline: 8px 16px; }
  .main-title { font-size: 21px; gap: 10px; }
  .header-brand__mark { width: 40px; height: 40px; border-radius: 12px; }
}
@media (max-width: 359px) {
  .main-title > span:last-child { display: none; }
  .main-title > .header-brand__mark { display: grid; }
}
</style>
