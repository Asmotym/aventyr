<template>
  <section class="general-settings-panel">
    <v-alert
      v-if="(feedback) && feedback.type !== 'error'"
      :type="feedback.type"
      variant="tonal"
      class="general-settings-panel__feedback"
      closable
      @click:close="feedback = null"
    >
      {{ feedback.message }}
    </v-alert>

    <v-card variant="flat" class="general-settings-panel__profile-card general-settings-panel__section">
      <v-card-title class="section-heading"><span class="section-heading__icon"><v-icon icon="mdi-account-outline" size="21" /></span>
        {{ t('settings.general.profileTitle') }}
      </v-card-title>
      <v-card-text v-if="currentUser" class="general-settings-panel__profile-content">
        <UserProfileAvatar
          :user-id="currentUser.id"
          :avatar="currentUser.avatar"
          :display-name="currentUser.username"
          :size="80"
          color="primary"
          class="general-settings-panel__profile-avatar"
        />

        <div class="general-settings-panel__profile-details">
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

    <v-card variant="flat" class="general-settings-panel__about-card general-settings-panel__section">
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

    <v-card variant="flat" class="theme-card general-settings-panel__section">
      <v-card-title class="section-heading"><span class="section-heading__icon"><v-icon icon="mdi-palette-outline" size="21" /></span>
        {{ t('settings.general.themeTitle') }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t('settings.general.themeDescription') }}
        </p>
        <AppDropdown
          class="general-settings-panel__theme-select"
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
            <span class="general-settings-panel__theme-selection-label">{{ item.title }}</span>
            <div class="theme-color-preview theme-color-preview--selection" aria-hidden="true">
              <span
                v-for="(color, index) in item.raw.colors"
                :key="index"
                class="theme-color-preview__stripe"
                :style="{ '--theme-color-preview-stripe-background-color': color }"
              />
            </div>
          </template>

          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" role="option" :aria-selected="currentThemeStyle === item.value" class="general-settings-panel__theme-option">
              <div class="theme-color-preview theme-color-preview--option" aria-hidden="true">
                <span
                  v-for="(color, index) in item.raw.colors"
                  :key="index"
                  class="theme-color-preview__stripe"
                  :style="{ '--theme-color-preview-stripe-background-color': color }"
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
import { APP_THEME_STYLES, type AppThemeStyle } from '@shared/accounts/theme.types';
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

<style scoped lang="scss" src="@/assets/styles/features/settings/general-settings-panel.scss"></style>
