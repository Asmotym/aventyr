<template>
  <section v-for="(section, key) in data.sections" :key="key" class="settings-transfer-checklist__section">
    <header class="settings-transfer-checklist__heading">
      <v-icon :icon="sectionIcons[key]" size="20" aria-hidden="true" />
      <v-checkbox v-model="selection" :value="String(key)" :label="sectionLabel(String(key))" :disabled="disabled" hide-details density="compact" />
    </header>
    <div v-if="selection.includes(String(key)) && section" class="settings-transfer-checklist__body">
      <v-checkbox v-for="(value, field) in section.values" :key="field" v-model="selection" :value="`${key}.value.${field}`" :label="`${fieldLabel(String(field))}: ${typeof value === 'boolean' ? t(value ? 'settingsTransfer.yes' : 'settingsTransfer.no') : value}`" :disabled="disabled" hide-details density="compact" />
      <section v-for="(items, list) in section.lists" :key="list" class="settings-transfer-checklist__list">
        <h4>{{ fieldLabel(String(list)) }}</h4>
        <p v-if="!items.length" class="settings-transfer-checklist__empty">{{ t('settingsTransfer.emptyList') }}</p>
        <div v-for="(item, index) in items" :key="index" class="settings-transfer-checklist__entry">
          <v-checkbox v-model="selection" :value="`${key}.${list}.${index}`" :label="String(item.name || item.notation || `${fieldLabel(String(list))} ${index + 1}`)" :disabled="disabled" hide-details density="compact" />
          <details class="settings-transfer-checklist__details"><summary>{{ t('settingsTransfer.details') }}</summary><SettingsTransferDetails :value="item" /></details>
        </div>
      </section>
    </div>
  </section>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RoomSettingsPackage } from '@shared/rooms/settings-transfer';
import SettingsTransferDetails from './SettingsTransferDetails.component.vue';
defineProps<{ data: RoomSettingsPackage; disabled?: boolean }>();
const selection = defineModel<string[]>({ required: true });
const { t, te } = useI18n();
const sectionIcons = { room: 'mdi-home-edit-outline', dices: 'mdi-dice-multiple-outline', rollAwards: 'mdi-trophy-outline', criticals: 'mdi-palette-outline', bonusPoints: 'mdi-star-four-points-outline', talents: 'mdi-file-tree', bag: 'mdi-bag-personal-outline' };
function sectionLabel(key: string) { return t(key === 'talents' ? 'talents.title' : key === 'bag' ? 'bag.title' : 'roomSettings.tabs.' + key); }
function fieldLabel(key: string) { return te('settingsTransfer.fields.' + key) ? t('settingsTransfer.fields.' + key) : key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()); }
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/settings-transfer-checklist.scss"></style>
