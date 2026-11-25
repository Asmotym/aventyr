<template>
  <section class="room-settings-transfer">
    <header class="feature-hero">
      <span class="feature-hero__icon" aria-hidden="true"><v-icon icon="mdi-swap-vertical" size="36" /></span>
      <div class="feature-hero__copy"><h2>{{ t('settingsTransfer.title') }}</h2><p>{{ t('settingsTransfer.description') }}</p></div>
    </header>
    <div class="room-settings-transfer__cards">
      <section v-for="kind in (['import', 'export'] as const)" :key="kind" class="room-settings-transfer__card">
        <span class="room-settings-transfer__icon" aria-hidden="true"><v-icon :icon="kind === 'import' ? 'mdi-file-import-outline' : 'mdi-file-export-outline'" size="26" /></span>
        <h3>{{ t('settingsTransfer.' + kind) }}</h3>
        <p>{{ t('settingsTransfer.' + kind + 'Description') }}</p>
        <v-btn color="primary" :variant="kind === 'import' ? 'flat' : 'tonal'" :prepend-icon="kind === 'import' ? 'mdi-import' : 'mdi-export'" @click="open(kind)">{{ t('settingsTransfer.' + kind) }}</v-btn>
      </section>
    </div>
    <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="readFile" />
    <v-dialog :model-value="!!dialog" max-width="840" scrollable :persistent="busy" :aria-label="t('settingsTransfer.' + (dialog || 'title'))" @update:model-value="!$event && !busy && (dialog = null)">
      <v-card class="room-settings-transfer__popup">
        <AppDialogHeading>
          <span class="room-settings-transfer__icon" aria-hidden="true"><v-icon :icon="dialog === 'import' ? 'mdi-file-import-outline' : 'mdi-file-export-outline'" size="26" /></span>
          <div class="room-settings-transfer__heading-copy"><h2>{{ t('settingsTransfer.' + (dialog || 'title')) }}</h2></div>
          <AppCloseButton :disabled="busy" @click="dialog = null" />
        </AppDialogHeading>
        <v-card-text class="room-settings-transfer__body">
          <v-progress-linear v-if="busy" indeterminate class="mb-4" />
          <div v-if="dialog === 'import'" class="room-settings-transfer__sources">
            <v-btn color="primary" variant="tonal" :disabled="busy" prepend-icon="mdi-file-upload-outline" @click="fileInput?.click()">{{ t('settingsTransfer.fromFile') }}</v-btn>
            <v-btn color="primary" variant="outlined" :disabled="busy" prepend-icon="mdi-clipboard-text-outline" @click="readClipboard">{{ t('settingsTransfer.fromClipboard') }}</v-btn>
          </div>
          <section v-if="manualClipboard" class="room-settings-transfer__paste">
            <p>{{ t('settingsTransfer.clipboardHint') }}</p>
            <v-textarea v-model="clipboardText" :label="t('settingsTransfer.json')" :disabled="busy" />
            <v-btn color="primary" variant="tonal" :disabled="busy || !clipboardText.trim()" @click="readManual">{{ t('settingsTransfer.review') }}</v-btn>
          </section>
          <template v-if="data">
            <p class="room-settings-transfer__hint">{{ t('settingsTransfer.selectionHint') }}</p>
            <SettingsTransferChecklist v-model="selection" :data="data" :disabled="busy" />
            <template v-if="dialog === 'import'">
              <v-radio-group v-model="mode" :label="t('settingsTransfer.mode')" :disabled="busy" hide-details class="room-settings-transfer__mode">
                <div class="room-settings-transfer__mode-options">
                  <div v-for="choice in (['add', 'replace'] as const)" :key="choice" class="room-settings-transfer__mode-option" :class="{ 'room-settings-transfer__mode-option--selected': mode === choice }">
                    <v-radio :value="choice" :label="t('settingsTransfer.' + choice)" />
                    <p>{{ t('settingsTransfer.' + choice + 'Hint') }}</p>
                  </div>
                </div>
              </v-radio-group>
            </template>
          </template>
        </v-card-text>
        <v-card-actions class="room-settings-transfer__footer">
          <template v-if="dialog === 'import' && data"><v-btn :disabled="busy" @click="reset">{{ t('common.cancel') }}</v-btn><v-spacer /><v-btn color="primary" variant="flat" :disabled="busy || !canImport" @click="review">{{ t('settingsTransfer.import') }}</v-btn></template>
          <template v-else-if="dialog === 'export'"><v-btn color="primary" variant="flat" prepend-icon="mdi-download-outline" :disabled="busy || !data" @click="exportTo('file')">{{ t('settingsTransfer.toFile') }}</v-btn><v-btn color="primary" variant="tonal" prepend-icon="mdi-content-copy" :disabled="busy || !data" @click="exportTo('clipboard')">{{ t('settingsTransfer.toClipboard') }}</v-btn></template>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!preview" max-width="840" scrollable :persistent="busy" :aria-label="t('settingsTransfer.confirm')" @update:model-value="!$event && !busy && (preview = null)">
      <v-card v-if="preview" class="room-settings-transfer__popup">
        <AppDialogHeading>
          <span class="room-settings-transfer__icon" aria-hidden="true"><v-icon icon="mdi-clipboard-check-outline" size="26" /></span>
          <div class="room-settings-transfer__heading-copy"><h2>{{ t('settingsTransfer.confirm') }}</h2></div>
          <AppCloseButton :disabled="busy" @click="preview = null" />
        </AppDialogHeading>
        <v-card-text class="room-settings-transfer__body">
          <section v-for="change in preview.changes" :key="change.section" class="room-settings-transfer__change">
            <h3>{{ sectionLabel(change.section) }}</h3>
            <p class="room-settings-transfer__hint">{{ t('settingsTransfer.counts', { added: change.added.length, removed: change.removed.length, archived: change.archived.length, changed: Object.keys(change.values).length }) }}</p>
            <div v-for="kind in (['added', 'removed', 'archived', 'values'] as const)" :key="kind">
              <template v-if="Object.keys(change[kind]).length"><h4>{{ t('settingsTransfer.' + kind) }}</h4><SettingsTransferDetails :value="change[kind]" /></template>
            </div>
          </section>
        </v-card-text>
        <v-card-actions class="room-settings-transfer__footer"><v-btn :disabled="busy" @click="preview = null">{{ t('common.cancel') }}</v-btn><v-spacer /><v-btn color="primary" variant="flat" :disabled="busy" :loading="busy" @click="apply">{{ t('settingsTransfer.confirmImport') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppDialogHeading from '@/shared/ui/AppDialogHeading.vue';
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { notifications } from '@/shared/services/notifications.service';
import { watch } from 'vue';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import SettingsTransferChecklist from './SettingsTransferChecklist.component.vue';
import SettingsTransferDetails from './SettingsTransferDetails.component.vue';
import { useSettingsTransfer } from '../../composables/useSettingsTransfer';
const props = defineProps<{ roomId: string; userId: string; roomName: string }>();
const emit = defineEmits<{ imported: [sections: string[]] }>();
const { t } = useI18n();
const { dialog, data, selection, mode, busy, error, notice, preview, fileInput, manualClipboard, clipboardText, reset, open, readFile, readClipboard, readManual, canImport, review, apply, exportTo } = useSettingsTransfer(props, sections => emit('imported', sections));
useErrorNotifications(() => error.value);
watch(notice, message => { if (message) notifications.success(message); });
function sectionLabel(key: string) { return t(key === 'talents' ? 'talents.title' : key === 'bag' ? 'bag.title' : 'roomSettings.tabs.' + key); }
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-transfer.scss"></style>
