<template>
  <div class="user-settings">
    <header class="settings-hero">
      <span class="settings-hero__emblem"><v-icon icon="mdi-tune-variant" size="32" /></span>
      <div class="settings-hero__copy"><span class="settings-eyebrow">{{ t('common.title') }}</span><h1>{{ t('navigation.settings') }}</h1><p>{{ t('settings.design.intro') }}</p></div>
      <div v-if="user" class="settings-identity"><v-avatar :image="user.avatar" size="32" /><span>{{ user.username }}</span></div>
    </header>
    <div class="settings-workspace">
      <aside class="settings-navigation">
        <v-tabs v-model="activeTab" :direction="smAndDown ? 'horizontal' : 'vertical'" color="primary" hide-slider show-arrows>
          <v-tab value="general" prepend-icon="mdi-account-cog-outline">{{ t('settings.tabs.general') }}</v-tab>
          <v-tab value="rooms" prepend-icon="mdi-dice-multiple-outline">{{ t('settings.tabs.rooms') }}</v-tab>
          <v-tab value="api" prepend-icon="mdi-code-braces">{{ t('settings.tabs.api') }}</v-tab>
        </v-tabs>
      </aside>
      <v-window v-model="activeTab" class="settings-content">
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

<style scoped>
.user-settings { width: 100%; }
.settings-hero { display: flex; align-items: center; gap: 18px; padding: 22px 26px; margin-bottom: 22px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 18px; background: radial-gradient(ellipse at top right, rgba(var(--v-theme-primary), .12), transparent 65%), rgb(var(--v-theme-surface)); }
.settings-hero__emblem { display: grid; place-items: center; flex-shrink: 0; width: 60px; height: 60px; border-radius: 18px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .09); transform: rotate(-6deg); }
.settings-hero__copy { flex: 1; min-width: 0; }
.settings-eyebrow { font-size: 10px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; color: rgb(var(--v-theme-primary)); }
.settings-hero h1 { font-size: 28px; line-height: 1.25; letter-spacing: -.035em; margin: 3px 0 6px; }
.settings-hero p { color: rgba(var(--v-theme-on-surface), .6); font-size: 13px; line-height: 1.6; }
.settings-identity { display: flex; align-items: center; gap: 10px; max-width: 220px; padding: 8px 14px 8px 8px; border: 1px solid rgba(var(--v-theme-primary), .14); border-radius: 14px; background: rgba(var(--v-theme-primary), .04); }
.settings-identity span { overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 700; }
.settings-workspace { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 22px; align-items: start; }
.settings-navigation { position: sticky; top: calc(var(--v-layout-top) + 20px); padding: 8px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); }
.settings-navigation :deep(.v-tab) { justify-content: flex-start; min-width: 0; height: 48px; border-radius: 10px; text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 650; margin-block: 2px; }
.settings-navigation :deep(.v-tab--selected) { background: rgba(var(--v-theme-primary), .085); }
.settings-content { min-width: 0; }
.settings-content :deep(.v-btn) { border-radius: 10px; text-transform: none; letter-spacing: 0; }
.settings-content :deep(.v-alert) { border-radius: 12px; }
.settings-content :deep(.v-field) { border-radius: 10px; }
@media (max-width: 959px) {
  .settings-workspace { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .settings-navigation { position: static; padding: 5px; }
  .settings-navigation :deep(.v-tab) { justify-content: center; padding-inline: 20px; }
}
@media (max-width: 600px) {
  .settings-hero { padding: 18px; gap: 14px; margin-bottom: 16px; }
  .settings-hero__emblem { width: 48px; height: 48px; border-radius: 14px; }
  .settings-hero h1 { font-size: 24px; }
  .settings-identity { display: none; }
  .settings-navigation :deep(.v-tab) { padding-inline: 14px; font-size: 12px; }
}
</style>
