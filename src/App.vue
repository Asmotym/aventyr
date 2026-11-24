<template>
  <v-responsive>
    <v-app>
      <v-main class="app">
        <router-view></router-view>
      </v-main>
      <AppFooter />
      <AppNotifications />
      <LocaleChoiceDialog />
    </v-app>
  </v-responsive>
</template>

<script setup lang="ts">
import { useRoomsStore } from '@/features/rooms';
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { useAppTheme } from '@/features/preferences';
import AppNotifications from '@/shared/ui/AppNotifications.component.vue';
import AppFooter from '@/app/components/AppFooter.component.vue';
import LocaleChoiceDialog from '@/features/preferences/components/LocaleChoiceDialog.vue';
import { initializeLocaleSync } from '@/features/preferences/services/locale-preferences.service';

const { initializeThemeSync } = useAppTheme();
initializeThemeSync();
initializeLocaleSync();
const roomsStore = useRoomsStore();
useErrorNotifications(() => roomsStore.errorMessage, () => roomsStore.startError);
</script>
