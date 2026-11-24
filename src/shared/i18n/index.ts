import { createI18n } from 'vue-i18n'
import { getInitialLocale, saveLocale } from '@/shared/preferences/locale.service'
import type { AppLocale } from '@shared/accounts/locale.types'

// Import language files
import en from '@/shared/i18n/locales/en.json'
import es from '@/shared/i18n/locales/es.json'
import fr from '@/shared/i18n/locales/fr.json'
import de from '@/shared/i18n/locales/de.json'

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

// Get current locale
export function getCurrentLocale(): LocaleKey {
  return i18n.global.locale.value as LocaleKey
}

// Get available locales
export function getAvailableLocales() {
  return availableLocales
}

export default i18n 
