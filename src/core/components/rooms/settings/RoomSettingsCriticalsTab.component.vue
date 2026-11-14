<template>
  <v-window-item eager value="criticals" class="feature-settings">
    <section class="mb-6">
      <header class="feature-hero"><div class="feature-hero__icon"><v-icon icon="mdi-lightning-bolt-outline" size="38" /></div><div class="feature-hero__copy"><h2>{{ context.t('criticals.title') }}</h2><p>{{ context.t('criticals.description') }}</p></div><span class="feature-count">{{ context.roomCriticals.value.length }}</span></header>
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
      <div class="critical-gallery">
          <article
            v-for="(critical, index) in context.roomCriticals.value"
            :key="`${critical.operator}-${critical.threshold}-${critical.color}-${index}`"
            class="critical-rule-item" :style="{ '--critical-accent': critical.color }"
          >
            <div class="critical-card-heading">
              <div class="critical-symbol" :style="context.getCriticalColorChipStyle(critical.color)">{{ critical.operator === 'moreThan' ? '>' : '<' }} <strong>{{ critical.threshold }}</strong></div>
              <div class="d-flex align-center gap-2">
                <v-chip
                  size="small"
                  variant="flat"
                  :style="context.getCriticalColorChipStyle(critical.color)"
                >
                  {{ critical.color.toUpperCase() }}
                </v-chip>
                <v-btn icon="mdi-pencil" :aria-label="context.t('criticals.editRule')" :title="context.t('criticals.editRule')" variant="text" color="primary" size="small" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" @click="editRule(index)" />
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
            <h3 class="critical-card-title">{{ context.formatCriticalRule(critical) }}</h3>
            <div class="text-caption text-medium-emphasis">
              {{ context.t('criticals.ruleDescription', { operator: context.getCriticalOperatorText(critical.operator), threshold: critical.threshold }) }}
            </div>
          </article>
          <button v-if="context.canManageCriticals.value" type="button" class="critical-add-tile" :disabled="context.criticalsSaving.value || context.roomCriticals.value.length >= context.ROOM_CRITICALS_MAX_ITEMS" @click="openEditor"><span class="critical-add-icon"><v-icon icon="mdi-plus" size="30" /></span><strong>{{ context.t('criticals.addRule') }}</strong><span>{{ context.t('criticals.preview') }} · <v-icon icon="mdi-palette-outline" size="16" /></span></button>
      </div>
      <p v-if="!context.roomCriticals.value.length" class="text-caption text-medium-emphasis mt-4">
        {{ context.t('criticals.empty') }}
      </p>
    </section>
    <v-alert v-if="context.criticalsError.value && !editorOpen" type="error" variant="tonal" class="mt-4">{{ context.criticalsError.value }}</v-alert>
    <v-dialog :model-value="editorOpen" :fullscreen="smAndDown" max-width="680" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="context.t(editIndex === undefined ? 'criticals.addRule' : 'criticals.editRule')" @update:model-value="closeEditor">
      <v-card class="critical-popup">
        <v-card-title class="critical-popup-heading"><span class="critical-popup-icon"><v-icon icon="mdi-lightning-bolt-outline" size="34" /></span><div><div class="critical-eyebrow">{{ context.t('criticals.title') }}</div><h2>{{ context.t(editIndex === undefined ? 'criticals.addRule' : 'criticals.editRule') }}</h2></div><v-btn icon="mdi-close" variant="text" :aria-label="context.t('common.close')" :disabled="context.criticalsSaving.value" @click="closeEditor" /></v-card-title>
        <v-divider />
        <v-card-text class="critical-popup-body">
      <div class="critical-rule-form">
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
        <fieldset class="critical-colors"><legend>{{ context.t('criticals.colorSource') }}</legend><div class="critical-swatches">
          <button v-for="preset in context.CRITICAL_PRESET_COLORS.value" :key="preset.value" type="button" class="critical-swatch" :style="context.getCriticalColorChipStyle(preset.value)" :aria-label="preset.title" :title="preset.title" :aria-pressed="context.newCriticalColorMode.value === 'preset' && context.newCriticalPresetColor.value === preset.value" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" @click="context.newCriticalColorMode.value = 'preset'; context.newCriticalPresetColor.value = preset.value"><v-icon v-if="context.newCriticalColorMode.value === 'preset' && context.newCriticalPresetColor.value === preset.value" icon="mdi-check" size="22" /></button>
          <AppColorPicker :model-value="context.newCriticalCustomColor.value" :label="context.t('criticals.customColor')" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" @update:model-value="value => { context.newCriticalCustomColor.value = value; context.newCriticalColorMode.value = 'custom'; }" />
        </div></fieldset>

        <div class="critical-preview d-flex align-center flex-wrap gap-2 mb-4">
          <span class="text-caption text-medium-emphasis">{{ context.t('criticals.preview') }}</span>
          <v-chip
            size="small"
            variant="flat"
            :style="context.getCriticalColorChipStyle(context.selectedCriticalColor.value)"
          >
            {{ context.formatCriticalRule({ operator: context.newCriticalOperator.value, threshold: Number(context.newCriticalThreshold.value), color: context.selectedCriticalColor.value }) }}
          </v-chip>
        </div>

        <v-alert
          v-if="context.criticalsError.value"
          type="error"
          density="comfortable"
          variant="tonal"
          class="mb-4"
        >
          {{ context.criticalsError.value }}
        </v-alert>

      </div>

        </v-card-text>
        <v-divider />
        <v-card-actions class="critical-popup-footer"><v-btn variant="text" :disabled="context.criticalsSaving.value" @click="context.resetCriticalForm">{{ context.t('common.clear') }}</v-btn><v-spacer /><v-btn variant="text" :disabled="context.criticalsSaving.value" @click="closeEditor">{{ context.t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="!context.canManageCriticals.value || context.criticalsSaving.value" :loading="context.criticalsSaving.value" @click="saveRule">{{ context.t(editIndex === undefined ? 'criticals.addRule' : 'criticals.editRule') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-window-item>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { RoomSettingsContext } from '../RoomSettingsDialog.component.vue';
import AppColorPicker from 'core/components/common/AppColorPicker.component.vue';
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
const props = defineProps<{
  context: RoomSettingsContext;
}>();
const { smAndDown } = useDisplay();
const editorOpen = ref(false), baseline = ref('');
const editIndex = ref<number | undefined>(), originalRule = ref('');

function editRule(index: number) { const c = props.context, rule = c.roomCriticals.value[index]; if (!rule) return; c.resetCriticalForm(); c.criticalsError.value = null; editIndex.value = index; originalRule.value = JSON.stringify(rule); c.newCriticalThreshold.value = rule.threshold; c.newCriticalOperator.value = rule.operator; const preset = c.CRITICAL_PRESET_COLORS.value.find(p => p.value.toLowerCase() === rule.color.toLowerCase()); c.newCriticalColorMode.value = preset ? 'preset' : 'custom'; if (preset) c.newCriticalPresetColor.value = preset.value; else c.newCriticalCustomColor.value = rule.color; baseline.value = snapshot(); editorOpen.value = true; }
function snapshot() { const c = props.context; return JSON.stringify([c.newCriticalThreshold.value, c.newCriticalOperator.value, c.newCriticalColorMode.value, c.newCriticalPresetColor.value, c.newCriticalCustomColor.value]); }
function openEditor() { editIndex.value = undefined; props.context.resetCriticalForm(); props.context.criticalsError.value = null; baseline.value = snapshot(); editorOpen.value = true; }
function closeEditor() { if (props.context.criticalsSaving.value) return; if (snapshot() !== baseline.value && !window.confirm(props.context.t('roomRework.discard'))) return; props.context.resetCriticalForm(); editorOpen.value = false; }
async function saveRule() { if (editIndex.value !== undefined && JSON.stringify(props.context.roomCriticals.value[editIndex.value]) !== originalRule.value) { props.context.criticalsError.value = props.context.t('criticals.errors.save'); return; } await props.context.addCriticalRule(editIndex.value); if (!props.context.criticalsError.value) editorOpen.value = false; }
watch(() => props.context.room?.id, () => { editorOpen.value = false; });
</script>

<style scoped>
.feature-hero { display: flex; align-items: center; gap: 18px; padding: 24px; margin: -4px -4px 24px; border: 1px solid rgba(var(--v-theme-primary), .18); border-radius: 14px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .14), rgba(var(--v-theme-primary), .02)); }
.feature-hero__icon { display: grid; place-items: center; width: 72px; height: 72px; flex-shrink: 0; border-radius: 20px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .1); transform: rotate(-7deg); }
.feature-hero__copy { flex: 1; min-width: 0; }
.feature-hero h2 { font-size: 22px; letter-spacing: -.025em; margin-bottom: 6px; }
.feature-hero p { font-size: 13px; line-height: 1.6; color: rgba(var(--v-theme-on-surface), .65); }
.feature-count { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgb(var(--v-theme-primary)); }
@media (max-width: 600px) { .feature-hero { padding: 16px; gap: 12px; } .feature-hero__icon { width: 48px; height: 56px; border-radius: 14px; } .feature-hero h2 { font-size: 19px; } .feature-count { font-size: 24px; } }

.critical-rule-form {
  border: 1px solid rgba(var(--v-theme-outline), 0.18);
  border-radius: 12px;
  padding: 16px;
}

.critical-rule-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.critical-rule-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.critical-rule-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.critical-color-input {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  height: 42px;
  padding: 0;
  width: 72px;
}

.critical-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 640px) {
  .critical-rule-form__row {
    grid-template-columns: 1fr;
  }
}
</style>

<style scoped>
.critical-rule-form { background: rgba(var(--v-theme-primary), .025); }
.critical-preview { padding: 16px; border-radius: 10px; background: rgba(var(--v-theme-on-surface), .035); gap: 12px; }
.feature-settings :deep(.v-list) { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; background: transparent; }
.critical-rule-item, .critical-rule-item:last-of-type { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-left: 4px solid var(--critical-accent); border-radius: 12px; padding: 18px; margin: 0; }
.critical-rule-item :deep(.v-list-item-title) { white-space: normal; gap: 12px; margin-bottom: 10px; font-weight: 650; }
.critical-rule-item :deep(.v-list-item__content) { overflow-wrap: anywhere; }
.critical-color-input { border-radius: 8px; }
.feature-settings .v-btn { border-radius: 10px; }
</style>

<style scoped>
.critical-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 14px; margin-top: 20px; }
.critical-gallery .critical-rule-item { position: relative; overflow: hidden; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-top: 4px solid var(--critical-accent); border-radius: 14px; padding: 20px; background: rgb(var(--v-theme-surface)); }
.critical-card-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.critical-symbol { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 12px; font-family: ui-monospace, monospace; font-size: 22px; }
.critical-symbol strong { font-size: 28px; letter-spacing: -.04em; }
.critical-card-title { font-size: 15px; margin-bottom: 8px; }
.critical-add-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 200px; padding: 24px; border: 1px dashed rgba(var(--v-theme-primary), .4); border-top: 4px solid rgba(var(--v-theme-primary), .4); border-radius: 14px; background: rgba(var(--v-theme-primary), .035); color: rgb(var(--v-theme-primary)); cursor: pointer; }
.critical-add-tile:hover, .critical-add-tile:focus-visible { background: rgba(var(--v-theme-primary), .09); }
.critical-add-tile:disabled { opacity: .5; cursor: default; }
.critical-add-tile > span:last-child { font-size: 12px; color: rgba(var(--v-theme-on-surface), .6); }
.critical-add-icon, .critical-popup-icon { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border-radius: 16px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); }
.critical-popup { border-radius: 18px !important; }
.critical-popup-heading { display: flex; align-items: center; gap: 16px; padding: 24px; white-space: normal; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); }
.critical-popup-heading > div { flex: 1; min-width: 0; }
.critical-popup-heading h2 { font-size: 20px; line-height: 1.4; }
.critical-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: rgb(var(--v-theme-primary)); margin-bottom: 4px; }
.critical-popup-body { padding: 24px; }
.critical-popup-body .critical-rule-form { padding: 0; border: 0; background: transparent; }
.critical-popup-footer { padding: 16px 24px; }
@media (max-width: 600px) { .critical-popup { border-radius: 0 !important; } .critical-popup-heading { padding: 18px 16px; gap: 12px; } .critical-popup-heading h2 { font-size: 18px; } .critical-popup-body { padding: 20px 16px; } .critical-popup-footer { padding: 12px 16px; flex-wrap: wrap; } }
</style>

<style scoped>
.critical-colors { border: 0; padding: 0; margin: 8px 0 24px; min-width: 0; }
.critical-colors legend { font-size: 13px; margin-bottom: 12px; color: rgba(var(--v-theme-on-surface), .7); }
.critical-swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.critical-swatch, .critical-custom-swatch { display: grid; place-items: center; position: relative; width: 44px; height: 44px; border-radius: 12px; cursor: pointer; border: 2px solid transparent; }
.critical-swatch[aria-pressed="true"], .critical-custom-swatch.is-selected { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 3px; }
.critical-custom-swatch { background: rgba(var(--v-theme-primary), .08); color: rgb(var(--v-theme-primary)); border: 1px dashed rgba(var(--v-theme-primary), .5); }
.critical-custom-swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.critical-custom-swatch:focus-within { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 3px; }
.critical-swatch:disabled { opacity: .5; cursor: default; }
</style>
