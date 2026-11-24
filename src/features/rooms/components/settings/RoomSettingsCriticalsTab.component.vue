<template>
  <v-window-item eager value="criticals" class="room-settings-criticals-tab">
    <section class="mb-6">
      <header class="feature-hero"><div class="feature-hero__icon"><v-icon icon="mdi-lightning-bolt-outline" size="38" /></div><div class="feature-hero__copy"><h2>{{ context.t('criticals.title') }}</h2><p>{{ context.t('criticals.description') }}</p></div><span class="feature-hero__count">{{ context.roomCriticals.value.length }}</span></header>
      <v-alert
        v-if="!context.canManageCriticals.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.t('criticals.creatorOnly') }}
      </v-alert>
    </section>

    <section>
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-2">{{ context.t('criticals.savedRules') }}</div>
        <v-chip size="small">{{ context.roomCriticals.value.length }}/{{ context.ROOM_CRITICALS_MAX_ITEMS }}</v-chip>
      </div>
      <div class="room-settings-criticals-tab__critical-gallery">
          <article
            v-for="(critical, index) in context.roomCriticals.value"
            :key="`${critical.operator}-${critical.threshold}-${critical.color}-${index}`"
            class="room-settings-criticals-tab__critical-rule-item" :style="{ '--critical-accent': critical.color }"
          >
            <div class="room-settings-criticals-tab__critical-card-heading">
              <div class="room-settings-criticals-tab__critical-symbol" :style="context.getCriticalColorChipStyle(critical.color)">{{ critical.operator === 'moreThan' ? '>' : '<' }} <strong>{{ critical.threshold }}</strong></div>
              <div class="d-flex align-center app-spacing--gap-2 app-spacing">
                <v-chip
                  size="small"
                  variant="flat"
                  :style="context.getCriticalColorChipStyle(critical.color)"
                >
                  {{ critical.color.toUpperCase() }}
                </v-chip>
                <v-btn class="ml-2" icon="mdi-pencil" :aria-label="context.t('criticals.editRule')" :title="context.t('criticals.editRule')" variant="text" color="primary" size="small" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" @click="editRule(index)" />
                <v-btn :icon="critical.enabled === false ? 'mdi-play' : 'mdi-pause'" :aria-label="context.t(critical.enabled === false ? 'criticals.enableRule' : 'criticals.disableRule')" :title="context.t(critical.enabled === false ? 'criticals.enableRule' : 'criticals.disableRule')" variant="text" size="small" :disabled="!critical.diceType || !context.canManageCriticals.value || context.criticalsSaving.value" @click="context.toggleCriticalRule(index)" />
                <v-btn
                  icon="mdi-delete"
                  :aria-label="context.t('bag.remove')"
                  variant="text"
                  color="error"
                  size="small"
                  :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
                  @click="context.removeCriticalRule(index)"
                />
              </div>
            </div>
            <v-alert v-if="!critical.diceType" type="warning" variant="tonal" density="compact" class="mb-3">{{ context.t('criticals.unboundWarning') }}</v-alert>
            <v-chip v-else-if="critical.enabled === false" size="small" class="mb-3">{{ context.t('criticals.disabled') }}</v-chip>
            <h3 class="room-settings-criticals-tab__critical-card-title">{{ context.formatCriticalRule(critical) }}</h3>
            <div class="text-caption text-medium-emphasis">
              {{ context.t('criticals.ruleDescription', { operator: context.getCriticalOperatorText(critical.operator), threshold: critical.threshold }) }}
            </div>
          </article>
          <button v-if="context.canManageCriticals.value" type="button" class="room-settings-criticals-tab__critical-add-tile" :disabled="context.criticalsSaving.value || context.roomCriticals.value.length >= context.ROOM_CRITICALS_MAX_ITEMS" @click="openEditor"><span class="room-settings-criticals-tab__critical-add-icon"><v-icon icon="mdi-plus" size="30" /></span><strong>{{ context.t('criticals.addRule') }}</strong><span>{{ context.t('criticals.preview') }} · <v-icon icon="mdi-palette-outline" size="16" /></span></button>
      </div>
      <p v-if="!context.roomCriticals.value.length" class="text-caption text-medium-emphasis mt-4">
        {{ context.t('criticals.empty') }}
      </p>
    </section>

    <v-dialog :model-value="editorOpen" :fullscreen="smAndDown" max-width="680" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="context.t(editIndex === undefined ? 'criticals.addRule' : 'criticals.editRule')" @update:model-value="closeEditor">
      <v-card class="room-settings-criticals-tab__critical-popup">
        <AppDialogHeading class="room-settings-criticals-tab__critical-popup-heading"><span class="room-settings-criticals-tab__critical-popup-icon"><v-icon icon="mdi-lightning-bolt-outline" size="34" /></span><div><div class="room-settings-criticals-tab__critical-eyebrow">{{ context.t('criticals.title') }}</div><h2>{{ context.t(editIndex === undefined ? 'criticals.addRule' : 'criticals.editRule') }}</h2></div><v-btn icon="mdi-close" variant="text" :aria-label="context.t('common.close')" :disabled="context.criticalsSaving.value" @click="closeEditor" /></AppDialogHeading>
        <v-divider />
        <v-card-text class="room-settings-criticals-tab__critical-popup-body">
      <div class="critical-rule-form">
        <v-text-field v-model="context.newCriticalDiceType.value" :label="context.t('criticals.diceType')" placeholder="d20" variant="outlined" density="comfortable" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" />
        <div class="critical-rule-form__row">
          <v-text-field
            v-model="context.newCriticalThreshold.value"
            type="number"
            :label="context.t('criticals.number')"
            variant="outlined"
            density="comfortable"
            :placeholder="context.t('criticals.numberPlaceholder')"
            :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
          />
          <AppDropdown
            v-model="context.newCriticalOperator.value"
            :items="context.CRITICAL_OPERATOR_OPTIONS.value"
            item-title="title"
            item-value="value"
            :label="context.t('criticals.comparison')"
            variant="outlined"
            density="comfortable"
            :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
          />
        </div>
        <fieldset class="room-settings-criticals-tab__critical-colors"><legend>{{ context.t('criticals.colorSource') }}</legend><div class="room-settings-criticals-tab__critical-swatches">
          <button v-for="preset in context.CRITICAL_PRESET_COLORS.value" :key="preset.value" type="button" class="room-settings-criticals-tab__critical-swatch" :style="context.getCriticalColorChipStyle(preset.value)" :aria-label="preset.title" :title="preset.title" :aria-pressed="context.newCriticalColorMode.value === 'preset' && context.newCriticalPresetColor.value === preset.value" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" @click="context.newCriticalColorMode.value = 'preset'; context.newCriticalPresetColor.value = preset.value"><v-icon v-if="context.newCriticalColorMode.value === 'preset' && context.newCriticalPresetColor.value === preset.value" icon="mdi-check" size="22" /></button>
          <AppColorPicker :model-value="context.newCriticalCustomColor.value" :label="context.t('criticals.customColor')" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" @update:model-value="value => { context.newCriticalCustomColor.value = value; context.newCriticalColorMode.value = 'custom'; }" />
        </div></fieldset>

        <div class="room-settings-criticals-tab__critical-preview d-flex align-center flex-wrap app-spacing--gap-2 mb-4 app-spacing">
          <span class="text-caption text-medium-emphasis">{{ context.t('criticals.preview') }}</span>
          <v-chip
            size="small"
            variant="flat"
            :style="context.getCriticalColorChipStyle(context.selectedCriticalColor.value)"
          >
            {{ context.formatCriticalRule({ diceType: context.newCriticalDiceType.value, operator: context.newCriticalOperator.value, threshold: Number(context.newCriticalThreshold.value), color: context.selectedCriticalColor.value }) }}
          </v-chip>
        </div>



      </div>

        </v-card-text>
        <v-divider />
        <v-card-actions class="room-settings-criticals-tab__critical-popup-footer"><v-btn variant="text" :disabled="context.criticalsSaving.value" @click="context.resetCriticalForm">{{ context.t('common.clear') }}</v-btn><v-spacer /><v-btn variant="text" :disabled="context.criticalsSaving.value" @click="closeEditor">{{ context.t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" :loading="context.criticalsSaving.value" @click="saveRule">{{ context.t(editIndex === undefined ? 'criticals.addRule' : 'criticals.editRule') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-window-item>
</template>

<script setup lang="ts">
import AppDialogHeading from '@/shared/ui/AppDialogHeading.vue';
import { ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { RoomSettingsContext } from '@/features/rooms/composables/useRoomSettings';
import AppColorPicker from '@/shared/ui/AppColorPicker.component.vue';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
const props = defineProps<{
  context: RoomSettingsContext;
}>();
const { smAndDown } = useDisplay();
const editorOpen = ref(false), baseline = ref('');
const editIndex = ref<number | undefined>(), originalRule = ref('');

function editRule(index: number) { const c = props.context, rule = c.roomCriticals.value[index]; if (!rule) return; c.resetCriticalForm(); c.criticalsError.value = null; editIndex.value = index; originalRule.value = JSON.stringify(rule); c.newCriticalDiceType.value = rule.diceType ?? ''; c.newCriticalThreshold.value = rule.threshold; c.newCriticalOperator.value = rule.operator; const preset = c.CRITICAL_PRESET_COLORS.value.find(p => p.value.toLowerCase() === rule.color.toLowerCase()); c.newCriticalColorMode.value = preset ? 'preset' : 'custom'; if (preset) c.newCriticalPresetColor.value = preset.value; else c.newCriticalCustomColor.value = rule.color; baseline.value = snapshot(); editorOpen.value = true; }
function snapshot() { const c = props.context; return JSON.stringify([c.newCriticalDiceType.value, c.newCriticalThreshold.value, c.newCriticalOperator.value, c.newCriticalColorMode.value, c.newCriticalPresetColor.value, c.newCriticalCustomColor.value]); }
function openEditor() { editIndex.value = undefined; props.context.resetCriticalForm(); props.context.criticalsError.value = null; baseline.value = snapshot(); editorOpen.value = true; }
function closeEditor() { if (props.context.criticalsSaving.value) return; if (snapshot() !== baseline.value && !window.confirm(props.context.t('roomRework.discard'))) return; props.context.resetCriticalForm(); editorOpen.value = false; }
async function saveRule() { if (editIndex.value !== undefined && JSON.stringify(props.context.roomCriticals.value[editIndex.value]) !== originalRule.value) { props.context.criticalsError.value = props.context.t('criticals.errors.save'); return; } await props.context.addCriticalRule(editIndex.value); if (!props.context.criticalsError.value) editorOpen.value = false; }
watch(() => props.context.room?.id, () => { editorOpen.value = false; });
</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-criticals-tab.scss"></style>
