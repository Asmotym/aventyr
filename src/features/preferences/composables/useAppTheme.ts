import { computed, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { DiscordService } from '@/features/auth';
import {
  applyTheme,
  getAppliedTheme,
  getAppliedThemeStyle,
  getInitialTheme,
  getInitialThemeStyle,
  getStoredTheme,
  getStoredThemeStyle,
  saveTheme,
  saveThemeStyle,
} from '@/shared/preferences/theme.service';
import {
  fetchUserPreferences,
  saveUserPreferences,
} from '@/features/preferences/services/preferences.service';
import type { AppTheme, AppThemeStyle } from 'netlify/core/types/theme.types';

export function useAppTheme() {
  const vuetifyTheme = useTheme();
  const discordService = DiscordService.getInstance();
  const { t } = useI18n();

  const currentTheme = computed(() => getAppliedTheme(vuetifyTheme));
  const currentThemeStyle = computed(() => getAppliedThemeStyle(vuetifyTheme));
  const nextTheme = computed<AppTheme>(() => currentTheme.value === 'dark' ? 'light' : 'dark');
  const switchTitle = computed(() => (
    nextTheme.value === 'dark'
      ? t('theme.switchToDark')
      : t('theme.switchToLight')
  ));

  function setLocalTheme(theme: AppTheme): void {
    applyTheme(vuetifyTheme, theme, currentThemeStyle.value);
    saveTheme(theme);
  }

  function setLocalThemeStyle(themeStyle: AppThemeStyle): void {
    applyTheme(vuetifyTheme, currentTheme.value, themeStyle);
    saveThemeStyle(themeStyle);
  }

  function initializeThemeSync(): void {
    applyTheme(vuetifyTheme, getInitialTheme(), getInitialThemeStyle());

    watch(
      () => [
        discordService.user.value?.id,
        discordService.user.value?.theme,
        discordService.user.value?.themeStyle,
      ] as const,
      async ([userId, databaseTheme, databaseThemeStyle]) => {
        if (!userId) return;

        const localTheme = getStoredTheme();
        const localThemeStyle = getStoredThemeStyle();
        if (localTheme) {
          const resolvedThemeStyle = databaseThemeStyle ?? localThemeStyle ?? getInitialThemeStyle();
          applyTheme(vuetifyTheme, localTheme, resolvedThemeStyle);
          saveThemeStyle(resolvedThemeStyle);
          if (databaseTheme !== localTheme) {
            try {
              const saved = await saveUserPreferences(userId, { theme: localTheme });
              discordService.updateStoredUserPreferences({
                theme: saved.theme,
              });
            } catch (error) {
              console.error(t('theme.saveError'), error);
            }
          }
          return;
        }

        try {
          const databasePreferences = await fetchUserPreferences(userId);
          const latestLocalTheme = getStoredTheme();
          const resolvedTheme = latestLocalTheme ?? databasePreferences.theme;
          const resolvedThemeStyle = databasePreferences.themeStyle;
          applyTheme(vuetifyTheme, resolvedTheme, resolvedThemeStyle);
          saveTheme(resolvedTheme);
          saveThemeStyle(resolvedThemeStyle);
        } catch (error) {
          console.error(t('theme.saveError'), error);
        }
      },
      { immediate: true }
    );
  }

  async function setTheme(theme: AppTheme): Promise<void> {
    setLocalTheme(theme);

    const user = discordService.user.value;
    if (!user) return;

    try {
      const saved = await saveUserPreferences(user.id, { theme });
      discordService.updateStoredUserPreferences({ theme: saved.theme });
    } catch (error) {
      console.error(t('theme.saveError'), error);
    }
  }

  async function setThemeStyle(themeStyle: AppThemeStyle): Promise<void> {
    setLocalThemeStyle(themeStyle);

    const user = discordService.user.value;
    if (!user) return;

    try {
      const saved = await saveUserPreferences(user.id, { themeStyle });
      discordService.updateStoredUserPreferences({ themeStyle: saved.themeStyle });
    } catch (error) {
      console.error(t('theme.saveError'), error);
    }
  }

  async function toggleTheme(): Promise<void> {
    await setTheme(nextTheme.value);
  }

  return {
    currentTheme,
    currentThemeStyle,
    nextTheme,
    switchTitle,
    initializeThemeSync,
    setTheme,
    setThemeStyle,
    toggleTheme,
  };
}
