import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import { DiscordService } from 'modules/discord-auth/services/discord.service'
import {
  detectPreferredLocale,
  getInitialLocale,
  getStoredLocale,
  saveLocale,
} from 'core/services/locale.service'
import {
  saveUserPreferences,
} from 'core/services/preferences.service'
import { createLocaleSync } from 'core/services/locale-sync.service'
import { notifications } from 'core/services/notifications.service'
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

const localeSync = createLocaleSync({
  getUserId: () => DiscordService.getInstance().user.value?.id,
  getStoredLocale,
  detectLocale: detectPreferredLocale,
  applyLocale,
  saveLocale: (userId, locale) => saveUserPreferences(userId, { locale }),
  updateUser: (locale) => DiscordService.getInstance().updateStoredUserPreferences({ locale }),
})

export const localeChoiceState = localeSync.state

export async function confirmLocale(locale: LocaleKey): Promise<void> {
  await localeSync.select(locale, true)
}

export async function setLocale(locale: LocaleKey): Promise<void> {
  try {
    await localeSync.select(locale)
  } catch (error) {
    notifications.error(i18n.global.t('language.changeError'))
    throw error
  }
}

let initialized = false
export function initializeLocaleSync(): void {
  if (initialized) return
  initialized = true
  const discordService = DiscordService.getInstance()
  applyLocale(getInitialLocale())

  watch(() => discordService.user.value?.id, () => localeSync.reset(), { flush: 'sync' })
  watch(
    () => discordService.freshUser.value,
    (user) => {
      if (!user) { localeSync.reset(); return }
      void localeSync.reconcile(user.id, user.locale ?? null)
    },
    { immediate: true, flush: 'sync' }
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
