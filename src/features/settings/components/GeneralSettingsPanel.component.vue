<template>
  <section class="general-settings-panel">
    <v-alert
      v-if="(feedback) && feedback.type !== 'error'"
      :type="feedback.type"
      variant="tonal"
      class="general-feedback"
      closable
      @click:close="feedback = null"
    >
      {{ feedback.message }}
    </v-alert>

    <v-card variant="flat" class="profile-card settings-section">
      <v-card-title class="section-heading"><span class="section-heading__icon"><v-icon icon="mdi-account-outline" size="21" /></span>
        {{ t('settings.general.profileTitle') }}
      </v-card-title>
      <v-card-text v-if="currentUser" class="profile-content">
        <UserProfileAvatar
          :user-id="currentUser.id"
          :avatar="currentUser.avatar"
          :display-name="currentUser.username"
          :size="80"
          color="primary"
          class="profile-avatar"
        />

        <div class="profile-details">
          <div class="mb-4">
            <div class="text-caption text-medium-emphasis">
              {{ t('settings.general.usernameLabel') }}
            </div>
            <div class="text-h5 font-weight-medium">
              {{ currentUser.username }}
            </div>
          </div>

          <v-text-field
            :model-value="currentUser.id"
            :type="showDiscordId ? 'text' : 'password'"
            :label="t('settings.general.discordIdLabel')"
            variant="outlined"
            density="comfortable"
            readonly
            hide-details="auto"
            autocomplete="off"
          >
            <template #append-inner>
              <v-btn
                variant="text"
                :icon="showDiscordId ? 'mdi-eye-off' : 'mdi-eye'"
                :title="showDiscordId
                  ? t('settings.general.hideDiscordId')
                  : t('settings.general.showDiscordId')"
                :aria-label="showDiscordId
                  ? t('settings.general.hideDiscordId')
                  : t('settings.general.showDiscordId')"
                size="small"
                @click="showDiscordId = !showDiscordId"
              />
              <v-btn
                variant="text"
                icon="mdi-content-copy"
                color="primary"
                :title="t('settings.general.copyDiscordId')"
                :aria-label="t('settings.general.copyDiscordId')"
                :loading="copying"
                size="small"
                @click="copyDiscordId"
              />
            </template>
          </v-text-field>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="flat" class="about-card settings-section">
      <v-card-title class="section-heading"><span class="section-heading__icon"><v-icon icon="mdi-text-box-edit-outline" size="21" /></span>
        {{ t('settings.general.aboutTitle') }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t('settings.general.aboutDescription') }}
        </p>
        <v-textarea
          v-model="aboutMeDraft"
          :label="t('settings.general.aboutLabel')"
          :maxlength="ABOUT_ME_MAX_LENGTH"
          :counter="ABOUT_ME_MAX_LENGTH"
          rows="5"
          auto-grow
          variant="outlined"
          :disabled="!currentUser || savingAboutMe"
        />
        <div class="d-flex justify-end">
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-check"
            :loading="savingAboutMe"
            :disabled="!currentUser || savingAboutMe || !aboutMeDirty"
            @click="saveAboutMeChanges"
          >
            {{ t('settings.general.aboutSave') }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="flat" class="theme-card settings-section">
      <v-card-title class="section-heading"><span class="section-heading__icon"><v-icon icon="mdi-palette-outline" size="21" /></span>
        {{ t('settings.general.themeTitle') }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t('settings.general.themeDescription') }}
        </p>
        <AppDropdown
          class="theme-select"
          :model-value="currentThemeStyle"
          :items="themeOptions"
          :label="t('settings.general.themeLabel')"
          :loading="savingTheme"
          item-title="title"
          item-value="value"
          hide-details="auto"
          @update:model-value="changeThemeStyle"
        >
          <template #selection="{ item }">
            <span class="theme-selection-label">{{ item.title }}</span>
            <div class="theme-color-preview theme-color-preview--selection" aria-hidden="true">
              <span
                v-for="(color, index) in item.raw.colors"
                :key="index"
                class="theme-color-preview__stripe"
                :style="{ backgroundColor: color }"
              />
            </div>
          </template>

          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" role="option" :aria-selected="currentThemeStyle === item.value" class="theme-option">
              <div class="theme-color-preview theme-color-preview--option" aria-hidden="true">
                <span
                  v-for="(color, index) in item.raw.colors"
                  :key="index"
                  class="theme-color-preview__stripe"
                  :style="{ backgroundColor: color }"
                />
              </div>
            </v-list-item>
          </template>
        </AppDropdown>
        <div class="appearance-preview" aria-hidden="true">
          <div class="appearance-preview__bar"><span /><span /><span /><i /></div>
          <div class="appearance-preview__body">
            <div class="appearance-preview__sidebar"><span /><span /><span /></div>
            <div class="appearance-preview__content"><div class="appearance-preview__line" /><div class="appearance-preview__message"><span /><span /></div><div class="appearance-preview__roll"><v-icon icon="mdi-dice-d20-outline" size="28" /><strong>20</strong><span /></div></div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </section>
</template>

<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { copyText } from '@/shared/utils/clipboard';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppTheme } from '@/features/preferences';
import { DiscordService } from '@/features/auth';
import { APP_THEME_STYLES, type AppThemeStyle } from 'netlify/core/types/theme.types';
import type { ThemeDefinition } from 'vuetify';
import UserProfileAvatar from '@/features/profiles/components/UserProfileAvatar.component.vue';
import { saveAboutMe } from '@/features/profiles';
import {
  aventyrDark,
  aventyrLight,
  arcaneDark,
  arcaneLight,
  explorerDark,
  explorerLight,
  kingdomDark,
  kingdomLight,
  campfireDark,
  campfireLight,
} from '@/shared/themes';

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const { currentTheme, currentThemeStyle, setThemeStyle } = useAppTheme();

const currentUser = computed(() => discordService.user.value);
const showDiscordId = ref(false);
const copying = ref(false);
const savingTheme = ref(false);
const feedback = ref<FeedbackState>(null);
const ABOUT_ME_MAX_LENGTH = 500;
const aboutMeDraft = ref('');
const savingAboutMe = ref(false);
const aboutMeDirty = computed(() => aboutMeDraft.value.trim() !== (currentUser.value?.aboutMe ?? ''));
const themeDefinitions: Record<AppThemeStyle, { dark: ThemeDefinition; light: ThemeDefinition }> = {
  aventyr: { dark: aventyrDark, light: aventyrLight },
  arcane: { dark: arcaneDark, light: arcaneLight },
  explorer: { dark: explorerDark, light: explorerLight },
  kingdom: { dark: kingdomDark, light: kingdomLight },
  campfire: { dark: campfireDark, light: campfireLight },
};
const themeOptions = computed(() => APP_THEME_STYLES.map((value) => {
  const colors = themeDefinitions[value][currentTheme.value].colors!;
  return {
    title: value.charAt(0).toUpperCase() + value.slice(1),
    value,
    colors: [colors.primary, colors.secondary, colors.accent],
  };
}));

async function copyDiscordId() {
  const discordId = currentUser.value?.id;
  if (!discordId) return;

  copying.value = true;
  feedback.value = null;
  try {
    await copyText(discordId);
    feedback.value = {
      type: 'success',
      message: t('settings.general.copySuccess'),
    };
  } catch {
    feedback.value = {
      type: 'error',
      message: t('settings.general.copyError'),
    };
  } finally {
    copying.value = false;
  }
}

async function changeThemeStyle(themeStyle: AppThemeStyle) {
  savingTheme.value = true;
  try {
    await setThemeStyle(themeStyle);
  } finally {
    savingTheme.value = false;
  }
}

async function saveAboutMeChanges() {
  const user = currentUser.value;
  if (!user || savingAboutMe.value) return;
  savingAboutMe.value = true;
  feedback.value = null;
  try {
    const profile = await saveAboutMe(user.id, aboutMeDraft.value);
    aboutMeDraft.value = profile.aboutMe;
    discordService.updateStoredUserProfile({ aboutMe: profile.aboutMe });
    feedback.value = { type: 'success', message: t('settings.general.aboutSaveSuccess') };
  } catch {
    feedback.value = { type: 'error', message: t('settings.general.aboutSaveError') };
  } finally {
    savingAboutMe.value = false;
  }
}

watch(
  () => currentUser.value?.id,
  () => {
    showDiscordId.value = false;
    feedback.value = null;
    aboutMeDraft.value = currentUser.value?.aboutMe ?? '';
  },
  { immediate: true },
);

useErrorNotifications(
  () => feedback.value && feedback.value.type === 'error' ? feedback.value.message : null,
);
</script>

<style scoped>
.general-settings-panel { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; width: 100%; }
.general-feedback, .profile-card { grid-column: 1 / -1; }
.settings-section { min-width: 0; height: 100%; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); }
.section-heading { display: flex; align-items: center; gap: 12px; padding: 20px 22px 16px; white-space: normal; font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
.section-heading__icon { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); }
.settings-section > .v-card-text { padding: 0 22px 22px; }
.profile-card { background: linear-gradient(120deg, rgba(var(--v-theme-primary), .045), transparent), rgb(var(--v-theme-surface)); }
.profile-details .text-h5 { font-weight: 750 !important; color: rgb(var(--v-theme-primary)); overflow-wrap: anywhere; }
.about-card :deep(textarea) { line-height: 1.8; }
.appearance-preview { overflow: hidden; border: 1px solid rgba(var(--v-theme-primary), .17); border-radius: 12px; margin-top: 24px; background: rgb(var(--v-theme-background)); }
.appearance-preview__bar { display: flex; align-items: center; gap: 5px; padding: 12px; border-bottom: 1px solid rgba(var(--v-theme-primary), .12); background: rgb(var(--v-theme-surface)); }
.appearance-preview__bar > span { width: 5px; height: 5px; border-radius: 50%; background: rgba(var(--v-theme-primary), .35); }
.appearance-preview__bar i { width: 40px; height: 5px; margin-left: auto; border-radius: 4px; background: rgba(var(--v-theme-primary), .22); }
.appearance-preview__body { display: flex; min-height: 145px; }
.appearance-preview__sidebar { display: flex; flex-direction: column; gap: 10px; width: 24%; padding: 16px 10px; border-right: 1px solid rgba(var(--v-theme-primary), .1); background: rgba(var(--v-theme-primary), .025); }
.appearance-preview__sidebar span { height: 8px; border-radius: 4px; background: rgba(var(--v-theme-primary), .12); }
.appearance-preview__sidebar span:first-child { background: rgba(var(--v-theme-primary), .45); }
.appearance-preview__content { flex: 1; padding: 16px; min-width: 0; }
.appearance-preview__line { width: 50%; height: 6px; border-radius: 4px; background: rgba(var(--v-theme-on-surface), .14); margin-bottom: 14px; }
.appearance-preview__message { padding: 12px; border-radius: 8px; background: rgb(var(--v-theme-surface)); }
.appearance-preview__message span { display: block; height: 4px; width: 90%; border-radius: 3px; margin-block: 5px; background: rgba(var(--v-theme-on-surface), .1); }
.appearance-preview__message span:last-child { width: 60%; }
.appearance-preview__roll { display: flex; align-items: center; gap: 8px; padding: 10px; margin-top: 8px; border: 1px solid rgba(var(--v-theme-primary), .2); border-radius: 8px; background: rgba(var(--v-theme-primary), .09); color: rgb(var(--v-theme-primary)); }
.appearance-preview__roll strong { font-size: 20px; }
.appearance-preview__roll span { width: 32%; height: 4px; border-radius: 3px; background: rgba(var(--v-theme-secondary), .3); margin-left: auto; }

.profile-content {
  display: flex;
  align-items: center;
  gap: 32px;
}

.profile-avatar {
  flex: 0 0 auto;
}

.profile-details {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 640px;
}

.theme-select :deep(.v-field) {
  position: relative;
}

.theme-selection-label {
  position: relative;
  z-index: 1;
}

.theme-color-preview {
  display: flex;
  overflow: hidden;
  pointer-events: none;
  clip-path: polygon(
    14px 0,
    100% 0,
    calc(100% - 14px) 100%,
    0 100%
  );
}

.theme-color-preview__stripe {
  flex: 1 0 42%;
  height: 100%;
  margin-inline: -3%;
  transform: skewX(-15deg);
}

.theme-color-preview--selection {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 40px;
  width: min(34%, 180px);
}

.theme-option {
  position: relative;
  overflow: hidden;
  min-height: 52px;
}

.theme-option :deep(.v-list-item__content) {
  position: static;
  z-index: 1;
  padding-inline-end: min(38%, 190px);
}

.theme-color-preview--option {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 20px;
  width: min(36%, 180px);
}

@media (max-width: 600px) {
  .general-settings-panel { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .section-heading { padding: 18px 18px 14px; }
  .settings-section > .v-card-text { padding-inline: 18px; }

  .profile-content {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }

  .profile-avatar {
    align-self: center;
  }

  .profile-details {
    max-width: none;
  }
}
</style>
