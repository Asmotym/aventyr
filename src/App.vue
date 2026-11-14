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
import { useAppTheme } from 'core/composables/useAppTheme';
import AppNotifications from 'core/components/AppNotifications.component.vue';
import AppFooter from 'core/components/AppFooter.component.vue';
import LocaleChoiceDialog from 'modules/language-switcher/components/LocaleChoiceDialog.vue';
import { initializeLocaleSync } from 'modules/language-switcher/plugins/i18n.plugin';

const { initializeThemeSync } = useAppTheme();
initializeThemeSync();
initializeLocaleSync();
</script>
