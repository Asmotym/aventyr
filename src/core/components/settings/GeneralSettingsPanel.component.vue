<template>
  <section class="general-settings-panel pa-6">
    <v-alert
      v-if="feedback"
      :type="feedback.type"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="feedback = null"
    >
      {{ feedback.message }}
    </v-alert>

    <v-card variant="tonal" class="profile-card mb-6">
      <v-card-title class="text-h6">
        {{ t('settings.general.profileTitle') }}
      </v-card-title>
      <v-card-text v-if="currentUser" class="profile-content">
        <UserProfileAvatar
          :user-id="currentUser.id"
          :avatar="currentUser.avatar"
          :display-name="currentUser.username"
          :size="112"
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

    <v-card variant="tonal" class="about-card mb-6">
      <v-card-title class="text-h6">
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
          rows="4"
          auto-grow
          variant="outlined"
          :disabled="!currentUser || savingAboutMe"
        />
        <div class="d-flex justify-end">
          <v-btn
            color="primary"
            :loading="savingAboutMe"
            :disabled="!currentUser || savingAboutMe || !aboutMeDirty"
            @click="saveAboutMeChanges"
          >
            {{ t('settings.general.aboutSave') }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="tonal" class="theme-card">
      <v-card-title class="text-h6">
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
      </v-card-text>
    </v-card>
  </section>
</template>

<script setup lang="ts">
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppTheme } from 'core/composables/useAppTheme';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { APP_THEME_STYLES, type AppThemeStyle } from 'netlify/core/types/theme.types';
import type { ThemeDefinition } from 'vuetify';
import UserProfileAvatar from 'core/components/UserProfileAvatar.component.vue';
import { saveAboutMe } from 'core/services/user-profiles.service';
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
} from '../../../themes';

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
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(discordId);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = discordId;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      try {
        textarea.select();
        if (!document.execCommand('copy')) {
          throw new Error('Copy command was rejected');
        }
      } finally {
        document.body.removeChild(textarea);
      }
    }
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
</script>

<style scoped>
.general-settings-panel {
  width: 100%;
}

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
  .general-settings-panel {
    padding: 16px !important;
  }

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
