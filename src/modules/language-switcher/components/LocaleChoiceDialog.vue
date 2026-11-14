<template>
  <v-dialog :model-value="!!state.choice" persistent max-width="480" aria-labelledby="locale-choice-title">
    <v-card v-if="state.choice">
      <v-card-title id="locale-choice-title">{{ t('language.choiceTitle') }}</v-card-title>
      <v-card-text>
        <p>{{ t('language.choiceDescription') }}</p>
        <v-alert v-if="state.error" type="error" variant="tonal" class="mt-4" role="alert">
          {{ t('language.choiceSaveError') }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="flex-column align-stretch pa-4 ga-2">
        <v-btn :disabled="state.saving" :loading="state.saving" variant="outlined"
          @click="confirmLocale(state.choice.current)">
          {{ t('language.keepCurrent', { language: availableLocales[state.choice.current] }) }}
        </v-btn>
        <v-btn v-if="state.choice.current !== state.choice.detected" :disabled="state.saving"
          color="primary" variant="flat" @click="confirmLocale(state.choice.detected)">
          {{ t('language.useDetected', { language: availableLocales[state.choice.detected] }) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { availableLocales, confirmLocale, localeChoiceState as state } from '../plugins/i18n.plugin';
const { t } = useI18n();
</script>
