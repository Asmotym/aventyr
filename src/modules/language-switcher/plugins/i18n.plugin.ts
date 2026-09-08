import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import { DiscordService } from 'modules/discord-auth/services/discord.service'
import {
  getInitialLocale,
  getStoredLocale,
  saveLocale,
} from 'core/services/locale.service'
import {
  fetchUserPreferences,
  saveUserPreferences,
} from 'core/services/preferences.service'
import type { AppLocale } from 'netlify/core/types/locale.types'

// Import language files
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import de from '../locales/de.json'

// Define available locales
export const availableLocales = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch'
} as const

export type LocaleKey = AppLocale

// Create i18n instance
const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    es,
    fr,
    de
  },
  globalInjection: true, // Automatically inject $t into components
  silentTranslationWarn: import.meta.env?.PROD,
  missingWarn: !import.meta.env?.PROD,
  fallbackWarn: !import.meta.env?.PROD
})

// Language switcher utility
export function applyLocale(locale: LocaleKey, persistLocally = true): void {
  if (!availableLocales[locale]) {
    console.warn(`Locale ${locale} is not available`)
    return
  }
  
  i18n.global.locale.value = locale
  if (persistLocally) saveLocale(locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

export async function setLocale(locale: LocaleKey): Promise<void> {
  applyLocale(locale)

  const discordService = DiscordService.getInstance()
  const user = discordService.user.value
  if (!user) return

  const saved = await saveUserPreferences(user.id, { locale })
  discordService.updateStoredUserPreferences({ locale: saved.locale })
}

export function initializeLocaleSync(): void {
  const discordService = DiscordService.getInstance()
  applyLocale(getInitialLocale(), false)

  watch(
    () => [
      discordService.user.value?.id,
      discordService.user.value?.locale,
    ] as const,
    async ([userId, databaseLocale]) => {
      if (!userId) return

      const localLocale = getStoredLocale()
      if (localLocale) {
        applyLocale(localLocale, false)
        if (databaseLocale !== localLocale) {
          try {
            const saved = await saveUserPreferences(userId, { locale: localLocale })
            discordService.updateStoredUserPreferences({ locale: saved.locale })
          } catch (error) {
            console.error('Unable to save locale preference.', error)
          }
        }
        return
      }

      try {
        const databasePreferences = await fetchUserPreferences(userId)
        const latestLocalLocale = getStoredLocale()
        applyLocale(latestLocalLocale ?? databasePreferences.locale)
      } catch (error) {
        console.error('Unable to load locale preference.', error)
      }
    },
    { immediate: true }
  )
}

// Get current locale
export function getCurrentLocale(): LocaleKey {
  return i18n.global.locale.value as LocaleKey
}

// Get available locales
export function getAvailableLocales() {
  return availableLocales
}

export default i18n 
