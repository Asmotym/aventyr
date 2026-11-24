<template>
  <v-app-bar class="app-header" height="72" :elevation="0">
    <template #prepend>
      <v-app-bar-title class="header-brand">
        <RouterLink class="app-header__main-title" :to="{ name: HomeRoutes.Base }">
          <span class="header-brand__mark"><img
            src="/aventyr-d100.svg"
            :alt="t('common.logoAlt')"
            class="app-header__logo"
          /></span>
          <span>{{ t('common.title') }}</span>
        </RouterLink>
      </v-app-bar-title>
    </template>

    <v-container tag="nav" class="app-header__desktop-navigation d-none d-md-flex align-center">
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
        class="app-header__room-shortcut"
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
      <div class="app-header__desktop-actions d-none d-md-flex align-center">
        <div class="app-header__tools">
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

      <div class="app-header__mobile-actions d-flex d-md-none align-center">
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
              class="app-header__mobile-menu-button"
              :title="t('common.openNavigationMenu')"
              :aria-label="t('common.openNavigationMenu')"
            >
              <v-icon :icon="mobileMenuOpen ? 'mdi-close' : 'mdi-menu'" />
            </v-btn>
          </template>

          <v-card class="app-header__mobile-menu-card">
            <div class="app-header__mobile-menu-brand"><v-icon icon="mdi-compass-rose" size="22" /><span>{{ t('common.title') }}</span></div>
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

            <div class="app-header__mobile-utility-actions">
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
        <DiscordAuth />
      </div>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from '@/shared/navigation/routes';
import { useRoomsStore } from '@/features/rooms';
import ThemeSwitcher from '@/features/preferences/components/ThemeSwitcher.vue';
import LanguageSwitcher from '@/features/preferences/components/LanguageSwitcher.vue';
import DiscordAuth from '@/features/auth/components/DiscordAuth.vue';
import { useCurrentUserRole } from '@/features/auth';

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

<style scoped lang="scss" src="@/assets/styles/app/app-header.scss"></style>
