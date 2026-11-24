<template>
  <v-menu>
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        variant="text"
        class="app-header__language-switcher mr-2"
      :title="t('language.current', { language: currentLanguageName })"
      >
        <v-icon icon="mdi-translate" class="mr-2" />
        <span class="fallback-text">{{ currentLanguageCode }}</span>
      </v-btn>
    </template>
    
    <v-list>
      <v-list-item
        v-for="(name, code) in availableLocales"
        :key="code"
        @click="changeLanguage(code)"
        :active="currentLocale === code"
        class="d-flex flex-row"
      >
        <v-tooltip :text="name">
          <template v-slot:activator="{ props }">
            <v-container v-bind="props" class="d-flex flex-row ma-0 pa-0">
              <v-list-item-title class="mr-2">{{ code.toUpperCase() }}</v-list-item-title>
              <v-icon v-if="currentLocale === code" icon="mdi-check" />
            </v-container>
          </template>
        </v-tooltip>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, getAvailableLocales, type LocaleKey } from '@/features/preferences/services/locale-preferences.service'

const { locale, t } = useI18n()

const availableLocales = getAvailableLocales()
const currentLocale = computed(() => locale.value as LocaleKey)
const currentLanguageName = computed(() => availableLocales[currentLocale.value])
const currentLanguageCode = computed(() => currentLocale.value)

async function changeLanguage(langCode: LocaleKey) {
  try {
    await setLocale(langCode)
  } catch (error) {
    console.error(t('language.changeError'), error)
  }
}
</script>
