<template>
  <section v-for="kind in kinds" :key="kind" class="config-section">
    <header class="config-heading"><div><h3><v-icon :icon="kind === 'trigger' ? 'mdi-lightning-bolt-outline' : kind === 'condition' ? 'mdi-filter-check-outline' : 'mdi-auto-fix'" size="22" />{{ t(`roomRework.${kind}s`) }}<span class="config-count" aria-hidden="true">{{ entries(kind).length }}</span></h3><p class="text-body-2 text-medium-emphasis">{{ t(`roomRework.${kind}Help`) }}</p></div><v-btn variant="tonal" prepend-icon="mdi-plus" :disabled="busy" @click="start(kind)">{{ t('roomRework.add') }}</v-btn></header>
    <v-alert v-if="error && !draft && activeKind === kind" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
    <p v-if="!entries(kind).length" class="text-medium-emphasis py-3">{{ t('roomRework.empty') }}</p>
    <article v-for="(entry, index) in entries(kind)" :key="entry.id" class="config-entry">
      <div class="config-heading"><strong>{{ entry.name }}</strong><div class="config-actions">
        <v-btn icon="mdi-arrow-up" size="small" variant="text" :aria-label="t('roomRework.earlier')" :disabled="busy || index === 0" @click="reorder(kind, index, -1)" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" :aria-label="t('roomRework.later')" :disabled="busy || index === entries(kind).length - 1" @click="reorder(kind, index, 1)" />
        <v-btn icon="mdi-pencil" size="small" variant="text" :aria-label="t('bag.edit')" :disabled="busy" @click="start(kind, entry)" />
        <v-btn icon="mdi-delete-outline" color="error" size="small" variant="text" :aria-label="t('bag.remove')" :disabled="busy" @click="remove(kind, entry.id)" />
      </div></div>
      <p class="text-body-2">{{ summary(entry) }}</p>
      <v-chip v-if="'legacyRule' in entry && entry.legacyRule || 'legacy' in entry && entry.legacy" size="small" variant="tonal" class="mt-2">{{ t('roomRework.legacy') }}</v-chip>
      <v-alert v-if="kind === 'effect' && duplicate(entry as RoomBonusPointEffect)" type="info" variant="tonal" density="compact" class="mt-2">{{ t('roomRework.stacking') }}</v-alert>
    </article>

  </section>
  <v-dialog :model-value="draft !== null" :fullscreen="smAndDown" max-width="820" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="t(`roomRework.${activeKind}s`)" @update:model-value="closeEditor">
    <v-card class="bonus-config-popup">
      <v-card-title class="bonus-popup-heading"><span class="bonus-popup-icon"><v-icon :icon="activeKind === 'trigger' ? 'mdi-lightning-bolt-outline' : activeKind === 'condition' ? 'mdi-filter-check-outline' : 'mdi-auto-fix'" size="32" /></span><div><div class="bonus-popup-eyebrow">{{ t('bonusPoints.title') }} · {{ t(draft?.id ? 'bag.edit' : 'roomRework.add') }}</div><h2>{{ t(`roomRework.${activeKind}s`) }}</h2></div><v-btn icon="mdi-close" variant="text" :aria-label="t('common.close')" :disabled="busy" @click="closeEditor" /></v-card-title>
      <v-divider />
      <v-card-text class="bonus-popup-body"><p class="text-body-2 text-medium-emphasis mb-5">{{ t(`roomRework.${activeKind}Help`) }}</p><v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-form v-if="draft" class="config-form" @submit.prevent="save">

      <v-text-field v-if="activeKind !== 'condition'" v-model="draft.name" :label="t('bag.name')" maxlength="100" variant="outlined" density="comfortable" :disabled="busy" />
      <template v-if="activeKind !== 'effect' && 'groups' in draft">
        <template v-for="(group, groupIndex) in draft.groups" :key="groupIndex">
          <div v-if="groupIndex" class="logic-divider">{{ t('roomRework.or') }}</div>
          <section class="condition-group">
            <div v-for="(condition, index) in group" :key="index" class="condition-row">
              <span v-if="index" class="logic-label">{{ t('roomRework.and') }}</span>
              <v-text-field v-model="condition.diceNotation" :label="t('dice.fields.notation')" variant="outlined" density="comfortable" :disabled="busy" />
              <AppDropdown v-model="condition.operator" :items="operators" :label="t('bonusPoints.form.comparison')" variant="outlined" density="comfortable" :disabled="busy" />
              <v-text-field v-model.number="condition.threshold" type="number" :label="t('bonusPoints.form.number')" variant="outlined" density="comfortable" :disabled="busy" />
              <v-btn icon="mdi-delete-outline" variant="text" :aria-label="t('bag.remove')" :disabled="busy" @click="group.splice(index, 1)" />
            </div>
            <v-btn size="small" variant="text" :disabled="busy" @click="group.push(condition())">{{ t('roomRework.addAnd') }}</v-btn>
            <v-btn size="small" variant="text" :disabled="busy" @click="draft && 'groups' in draft && draft.groups.splice(groupIndex, 1)">{{ t('roomRework.removeGroup') }}</v-btn>
          </section>
        </template>
        <v-btn class="my-3" variant="tonal" :disabled="busy" @click="draft.groups.push([condition()])">{{ t('roomRework.addOr') }}</v-btn>
      </template>
      <template v-if="activeKind === 'effect' && 'actions' in draft">
        <v-text-field v-model="draft.diceNotation" :label="t('dice.fields.notation')" placeholder="2d10" variant="outlined" density="comfortable" :disabled="busy" />
        <div v-for="(action, index) in draft.actions" :key="index" class="action-row">
          <div class="config-heading"><strong>{{ index + 1 }}. {{ t(action.type === 'adjust' ? 'roomRework.adjust' : action.type === 'notification' ? 'roomRework.notification' : 'roomRework.message') }}</strong><div>
            <v-btn icon="mdi-arrow-up" size="small" variant="text" :aria-label="t('roomRework.earlier')" :disabled="busy || index === 0" @click="moveAction(index, -1)" />
            <v-btn icon="mdi-arrow-down" size="small" variant="text" :aria-label="t('roomRework.later')" :disabled="busy || index === draft.actions.length - 1" @click="moveAction(index, 1)" />
            <v-btn icon="mdi-delete-outline" size="small" variant="text" :aria-label="t('bag.remove')" :disabled="busy" @click="draft.actions.splice(index, 1)" />
          </div></div>
          <div v-if="action.type === 'adjust'" class="adjustment-row"><AppDropdown v-model="action.sign" :items="['+', '-']" :label="t('bonusPoints.form.adjustmentSign')" variant="outlined" density="comfortable" :disabled="busy" /><v-text-field v-model.number="action.amount" type="number" min="1" step="1" :label="t('bonusPoints.form.adjustmentAmount')" variant="outlined" density="comfortable" :disabled="busy" /></div>
          <v-textarea v-else v-model="action.text" :label="t(action.type === 'notification' ? 'roomRework.notification' : 'roomRework.message')" maxlength="2000" variant="outlined" rows="2" :disabled="busy" />
          <details v-if="action.type === 'notification'" class="notification-options"><summary>{{ t('roomRework.notificationOptions') }}</summary><div class="notification-options-grid">
            <div class="notification-option-field"><label :for="`${notificationFieldId}-severity-${index}`">{{ t('roomRework.severity') }}</label><AppDropdown :id="`${notificationFieldId}-severity-${index}`" :model-value="action.severity ?? 'info'" :items="severityOptions" :aria-label="t('roomRework.severity')" variant="outlined" density="compact" hide-details="auto" :disabled="busy" @update:model-value="action.severity = $event" /></div>
            <div class="notification-option-field"><label :for="`${notificationFieldId}-duration-${index}`">{{ t('roomRework.duration') }}</label><v-text-field :id="`${notificationFieldId}-duration-${index}`" :model-value="action.timeout === -1 ? '' : (action.timeout ?? 3500)" type="number" min="1000" max="60000" step="500" :aria-label="t('roomRework.duration')" variant="outlined" density="compact" hide-details="auto" :disabled="busy || action.timeout === -1" @update:model-value="action.timeout = $event === '' || $event === null ? undefined : Number($event)" /></div>
          </div><v-switch :model-value="action.timeout === -1" :label="t('roomRework.stayVisible')" color="primary" inset :disabled="busy" @update:model-value="action.timeout = $event ? -1 : undefined" /></details>
        </div>
        <div class="my-3"><v-btn variant="tonal" prepend-icon="mdi-plus" :disabled="busy" @click="chooserOpen = true">{{ t('roomRework.addEffect') }}</v-btn></div>
      </template>
    </v-form>
      <div v-if="draft" class="bonus-live-summary"><v-icon :icon="activeKind === 'trigger' ? 'mdi-source-branch' : 'mdi-play-outline'" size="20" /><p>{{ summary(draft) }}</p></div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="bonus-popup-footer"><v-spacer /><v-btn variant="text" :disabled="busy" @click="closeEditor">{{ t('common.cancel') }}</v-btn><v-btn variant="flat" color="primary" prepend-icon="mdi-check" :loading="busy" :disabled="busy" @click="save">{{ t('common.save') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="chooserOpen" max-width="520" :aria-label="t('roomRework.addEffect')">
    <v-card class="effect-chooser"><v-card-title class="d-flex align-center">{{ t('roomRework.addEffect') }}<v-spacer /><v-btn icon="mdi-close" variant="text" :aria-label="t('common.close')" @click="chooserOpen = false" /></v-card-title><v-card-text><button v-for="option in actionOptions" :key="option.type" type="button" class="effect-choice" @click="addAction(option.type)"><span class="effect-choice-icon"><v-icon :icon="option.icon" size="26" /></span><span><strong>{{ t(option.title) }}</strong><span class="effect-choice-description">{{ t(option.description) }}</span></span><v-icon icon="mdi-chevron-right" size="20" /></button></v-card-text></v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointTrigger, RoomBonusPointEffect } from 'netlify/core/types/data.types';
import { parseBonusNotation, validateBonusEntry } from 'netlify/core/utils/bonus-point-config';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
const props = defineProps<{ roomId: string; userId: string }>();
const emit = defineEmits<{ dirty: [value: boolean] }>();
const { smAndDown } = useDisplay();
const { t } = useI18n(), store = useRoomsStore();
type Kind = 'trigger' | 'condition' | 'effect';
type Entry = RoomBonusPointTrigger | RoomBonusPointEffect;
const notificationFieldId = useId();
const chooserOpen = ref(false);
const actionOptions = [
 { type: 'adjust', icon: 'mdi-dice-multiple-outline', title: 'roomRework.adjust', description: 'roomRework.adjustHelp' },
 { type: 'message', icon: 'mdi-message-text-outline', title: 'roomRework.message', description: 'roomRework.messageHelp' },
 { type: 'notification', icon: 'mdi-bell-outline', title: 'roomRework.notification', description: 'roomRework.notificationHelp' },
] as const;
function addAction(type: 'adjust' | 'message' | 'notification') { if (!draft.value || !('actions' in draft.value) || busy.value) return; draft.value.actions.push(type === 'adjust' ? { type, sign: '+', amount: 1 } : { type, text: '' }); chooserOpen.value = false; }
const kinds = ['trigger', 'condition', 'effect'] as const;
const activeKind = ref<Kind>('trigger'), draft = ref<Entry | null>(null), initial = ref(''), busy = ref(false), error = ref('');
const severityOptions = computed(() => ['info', 'success', 'warning', 'error'].map(value => ({ value, title: t(`roomRework.notificationSeverity.${value}`) })));
const operators = computed(() => ['lessThan','moreThan'].map(value => ({ value, title: t(`bonusPoints.operators.${value}`) })));
const condition = () => ({ diceNotation: 'd100', operator: 'moreThan' as const, threshold: 90 });
function entries(kind: Kind): Entry[] { return kind === 'trigger' ? store.bonusPointTriggers : kind === 'condition' ? store.bonusPointConditions : store.bonusPointEffects; }
function cancel() { chooserOpen.value = false; draft.value = null; error.value = ''; }
function closeEditor() { if (!busy.value && canDiscard()) cancel(); }
function canDiscard() { return !draft.value || JSON.stringify(draft.value) === initial.value || window.confirm(t('roomRework.discard')); }
function start(kind: Kind, entry?: Entry) {
  if (!canDiscard()) return;
  activeKind.value = kind; error.value = '';
  draft.value = entry ? JSON.parse(JSON.stringify(entry)) : kind !== 'effect' ? { id: '', roomId: props.roomId, name: kind === 'condition' ? t('roomRework.conditions') : '', groups: [[condition()]] } : { id: '', roomId: props.roomId, name: '', diceNotation: 'd100', actions: [{ type: 'adjust', sign: '+', amount: 1 }] };
  initial.value = JSON.stringify(draft.value);
}
function summary(entry: Entry): string {
  if ('groups' in entry) return entry.groups.map(group => '(' + group.map(c => `${c.diceNotation} ${c.operator === 'moreThan' ? '>' : '<'} ${c.threshold}`).join(` ${t('roomRework.and')} `) + ')').join(` ${t('roomRework.or')} `);
  return `${entry.diceNotation}: ${entry.actions.map(a => a.type === 'adjust' ? `${a.sign}${a.amount}` : t(a.type === 'notification' ? 'roomRework.notification' : 'roomRework.message')).join(' → ')}`;
}
function duplicate(entry: RoomBonusPointEffect) {
  try { return store.bonusPointEffects.filter(e => parseBonusNotation(e.diceNotation).notation === parseBonusNotation(entry.diceNotation).notation).length > 1; } catch { return false; }
}
async function mutate(kind: Kind, operation: 'save' | 'delete' | 'reorder', extra: { entry?: Entry; id?: string; ids?: string[] }) {
  busy.value = true; error.value = ''; activeKind.value = kind;
  try {
    const result = await RoomsService.mutateBonusConfiguration({ roomId: props.roomId, userId: props.userId, kind, operation, ...extra });
    if (store.selectedRoomId === props.roomId) { store.bonusPointTriggers = result.triggers ?? []; store.bonusPointConditions = result.conditions ?? []; store.bonusPointEffects = result.effects ?? []; }
    return true;
  } catch (e) { error.value = (e as Error).message; return false; } finally { busy.value = false; }
}
async function save() {
  if (!draft.value) return;
  try { validateBonusEntry(activeKind.value, draft.value); } catch (e) { error.value = (e as Error).message; return; }
  if (await mutate(activeKind.value, 'save', { entry: draft.value })) cancel();
}
async function remove(kind: Kind, id: string) { if (window.confirm(t('bag.deleteConfirm'))) await mutate(kind, 'delete', { id }); }
async function reorder(kind: Kind, index: number, delta: number) { const ids = entries(kind).map(e => e.id); [ids[index], ids[index + delta]] = [ids[index + delta]!, ids[index]!]; await mutate(kind, 'reorder', { ids }); }
function moveAction(index: number, delta: number) { if (!draft.value || !('actions' in draft.value)) return; const actions = draft.value.actions; [actions[index], actions[index + delta]] = [actions[index + delta]!, actions[index]!]; }
watch(() => props.roomId, cancel);
watch(() => draft.value !== null && JSON.stringify(draft.value) !== initial.value, value => emit('dirty', value), { immediate: true });
</script>
<style scoped>
.config-section { margin-block: 24px; }
.config-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.config-entry, .config-form, .condition-group, .action-row { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; padding: 16px; margin-top: 12px; }
.config-form { background: rgba(var(--v-theme-primary), .03); }
.config-actions { display: flex; flex-wrap: wrap; }
.condition-row { display: flex; align-items: start; gap: 8px; flex-wrap: wrap; }
.condition-row > .v-input { flex: 1 1 140px; min-width: 0; }
.logic-divider, .logic-label { padding: 8px; font-weight: 600; }
.adjustment-row { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 12px; }
</style>

<style scoped>
.config-section { padding: 22px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 14px; background: rgba(var(--v-theme-primary), .015); }
.config-heading h3 { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 17px; }
.config-heading h3 .v-icon { color: rgb(var(--v-theme-primary)); }
.config-count { padding: 2px 8px; border-radius: 6px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); font-size: 12px; }
.config-entry { border-left: 3px solid rgba(var(--v-theme-primary), .45); background: rgb(var(--v-theme-surface)); }
.config-entry > p { padding: 12px; border-radius: 8px; background: rgba(var(--v-theme-on-surface), .03); font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
.config-form { background: rgb(var(--v-theme-surface)); border-color: rgba(var(--v-theme-primary), .3); }
.condition-group, .action-row { background: rgba(var(--v-theme-primary), .025); }
.config-section .v-btn { border-radius: 10px; }
@media (max-width: 600px) { .config-section { padding: 16px; } }
</style>

<style scoped>
.bonus-config-popup { border-radius: 18px !important; }
.bonus-popup-heading { display: flex; align-items: center; gap: 16px; padding: 24px; white-space: normal; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); }
.bonus-popup-heading > div { flex: 1; min-width: 0; }
.bonus-popup-heading h2 { font-size: 22px; line-height: 1.4; letter-spacing: -.025em; }
.bonus-popup-icon { display: grid; place-items: center; flex-shrink: 0; width: 58px; height: 58px; border-radius: 16px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); }
.bonus-popup-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; color: rgb(var(--v-theme-primary)); margin-bottom: 4px; }
.bonus-popup-body { padding: 24px; }
.bonus-popup-body .config-form { padding: 0; margin: 0; border: 0; background: transparent; }
.bonus-live-summary { display: flex; align-items: start; gap: 12px; padding: 16px; border: 1px solid rgba(var(--v-theme-primary), .15); border-radius: 12px; background: rgba(var(--v-theme-primary), .04); margin-top: 20px; color: rgb(var(--v-theme-primary)); }
.bonus-live-summary p { font-family: ui-monospace, monospace; font-size: 13px; overflow-wrap: anywhere; }
.bonus-popup-footer { padding: 16px 24px; }
.bonus-config-popup .logic-divider { text-align: center; font-size: 12px; letter-spacing: .1em; color: rgb(var(--v-theme-primary)); }
.bonus-config-popup .v-btn { border-radius: 10px; }
@media (max-width: 600px) { .bonus-config-popup { border-radius: 0 !important; } .bonus-popup-heading { padding: 18px 16px; gap: 12px; } .bonus-popup-body { padding: 20px 16px; } .bonus-popup-heading h2 { font-size: 19px; } .bonus-popup-footer { padding: 12px 16px; } .condition-group, .action-row { padding: 12px; } }
</style>

<style scoped>
.effect-chooser { border-radius: 18px !important; }
.effect-chooser > .v-card-title { padding: 20px 24px; font-weight: 600; }
.effect-choice { display: flex; align-items: center; text-align: left; gap: 14px; width: 100%; padding: 18px; margin-bottom: 12px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 14px; background: rgba(var(--v-theme-primary), .025); }
.effect-choice:hover, .effect-choice:focus-visible { border-color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); }
.effect-choice > span:nth-child(2) { flex: 1; min-width: 0; }
.effect-choice-icon { display: grid; place-items: center; width: 48px; height: 48px; flex-shrink: 0; border-radius: 14px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .1); }
.effect-choice-description { display: block; font-size: 12px; line-height: 1.6; margin-top: 5px; color: rgba(var(--v-theme-on-surface), .65); }
</style>

<style scoped>
.notification-options { border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding-top: 12px; }
.notification-options summary { cursor: pointer; font-size: 13px; font-weight: 600; color: rgb(var(--v-theme-primary)); }
.notification-options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 12px; margin-top: 18px; }
</style>

<style scoped>
.notification-options-grid { align-items: start; }
.notification-options-grid :deep(.v-field) { border: 1px solid rgba(var(--v-theme-on-surface), .35); border-radius: 8px; background: rgba(var(--v-theme-on-surface), .025); }
.notification-options-grid :deep(.v-field__outline) { display: none; }
.notification-options-grid :deep(.v-field--focused) { background: rgba(var(--v-theme-primary), .035); box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), .06); }
.notification-options-grid :deep(.v-field__input) { min-height: 40px; padding-top: 8px; padding-bottom: 8px; }
.notification-option-field > label { display: block; margin-bottom: 7px; font-size: 12px; color: rgba(var(--v-theme-on-surface), .7); }
.notification-options-grid :deep(.v-field--focused) { border-color: rgb(var(--v-theme-primary)); }
.notification-options-grid :deep(.v-field--error) { border-color: rgb(var(--v-theme-error)); }
</style>
