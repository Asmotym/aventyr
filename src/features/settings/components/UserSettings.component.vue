<template>
  <div class="user-settings">
    <header class="settings-hero">
      <span class="settings-hero__emblem"><v-icon icon="mdi-tune-variant" size="32" /></span>
      <div class="settings-hero__copy"><span class="user-settings__eyebrow">{{ t('common.title') }}</span><h1>{{ t('navigation.settings') }}</h1><p>{{ t('settings.design.intro') }}</p></div>
      <div v-if="user" class="user-settings__identity"><v-avatar :image="user.avatar" size="32" /><span>{{ user.username }}</span></div>
    </header>
    <div class="user-settings__workspace">
      <aside class="user-settings__navigation">
        <v-tabs v-model="activeTab" :direction="smAndDown ? 'horizontal' : 'vertical'" color="primary" hide-slider show-arrows>
          <v-tab value="general" prepend-icon="mdi-account-cog-outline">{{ t('settings.tabs.general') }}</v-tab>
          <v-tab value="rooms" prepend-icon="mdi-dice-multiple-outline">{{ t('settings.tabs.rooms') }}</v-tab>
          <v-tab value="api" prepend-icon="mdi-code-braces">{{ t('settings.tabs.api') }}</v-tab>
        </v-tabs>
      </aside>
      <v-window v-model="activeTab" class="user-settings__content">
        <v-window-item value="general"><GeneralSettingsPanel /></v-window-item>
        <v-window-item value="rooms"><RoomsSettingsPanel /></v-window-item>
        <v-window-item value="api"><ApiSettingsPanel /></v-window-item>
      </v-window>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { useCurrentUserRole } from '@/features/auth';
import GeneralSettingsPanel from '@/features/settings/components/GeneralSettingsPanel.component.vue';
import RoomsSettingsPanel from '@/features/settings/components/RoomsSettingsPanel.component.vue';
import ApiSettingsPanel from '@/features/settings/components/ApiSettingsPanel.component.vue';
const { t } = useI18n();
const { smAndDown } = useDisplay();
const { user } = useCurrentUserRole();
const activeTab = ref<'general' | 'rooms' | 'api'>('general');
</script>

<style scoped lang="scss" src="@/assets/styles/features/settings/user-settings.scss"></style>
