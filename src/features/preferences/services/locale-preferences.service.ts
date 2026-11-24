import { watch } from 'vue'
import { DiscordService } from '@/features/auth'
import { detectPreferredLocale, getInitialLocale, getStoredLocale } from '@/shared/preferences/locale.service'
import { saveUserPreferences } from './preferences.service'
import { createLocaleSync } from './locale-sync.service'
import { notifications } from '@/shared/services/notifications.service'
import i18n, { applyLocale, type LocaleKey } from '@/shared/i18n'
export { availableLocales, getAvailableLocales, getCurrentLocale, type LocaleKey } from '@/shared/i18n'

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

