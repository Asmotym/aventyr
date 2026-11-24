<template>
  <section v-for="kind in kinds" :key="kind" class="bonus-configuration-editor">
    <header class="bonus-configuration-editor__config-heading"><div><h3><v-icon :icon="kind === 'trigger' ? 'mdi-lightning-bolt-outline' : kind === 'condition' ? 'mdi-filter-check-outline' : 'mdi-auto-fix'" size="22" />{{ t(`roomRework.${kind}s`) }}<span class="bonus-configuration-editor__config-count" aria-hidden="true">{{ entries(kind).length }}</span></h3><p class="text-body-2 text-medium-emphasis">{{ t(`roomRework.${kind}Help`) }}</p></div><v-btn variant="tonal" prepend-icon="mdi-plus" :disabled="busy" @click="start(kind)">{{ t('roomRework.add') }}</v-btn></header>

    <p v-if="!entries(kind).length" class="text-medium-emphasis py-3">{{ t('roomRework.empty') }}</p>
    <article v-for="(entry, index) in entries(kind)" :key="entry.id" class="bonus-configuration-editor__config-entry">
      <div class="bonus-configuration-editor__config-heading"><strong>{{ entry.name }}</strong><div class="bonus-configuration-editor__config-actions">
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
    <v-card class="bonus-configuration-editor__config-popup">
      <AppDialogHeading class="bonus-configuration-editor__popup-heading"><span class="bonus-configuration-editor__popup-icon"><v-icon :icon="activeKind === 'trigger' ? 'mdi-lightning-bolt-outline' : activeKind === 'condition' ? 'mdi-filter-check-outline' : 'mdi-auto-fix'" size="32" /></span><div><div class="bonus-configuration-editor__popup-eyebrow">{{ t('bonusPoints.title') }} · {{ t(draft?.id ? 'bag.edit' : 'roomRework.add') }}</div><h2>{{ t(`roomRework.${activeKind}s`) }}</h2></div><AppCloseButton :disabled="busy" @click="closeEditor" /></AppDialogHeading>
      <v-divider />
      <v-card-text class="bonus-configuration-editor__popup-body"><p class="text-body-2 text-medium-emphasis mb-5">{{ t(`roomRework.${activeKind}Help`) }}</p>
    <v-form v-if="draft" class="bonus-configuration-editor__config-form" @submit.prevent="save">

      <v-text-field v-if="activeKind !== 'condition'" v-model="draft.name" :label="t('bag.name')" maxlength="100" variant="outlined" density="comfortable" :disabled="busy" />
      <template v-if="activeKind !== 'effect' && 'groups' in draft">
        <template v-for="(group, groupIndex) in draft.groups" :key="groupIndex">
          <div v-if="groupIndex" class="bonus-configuration-editor__logic-divider">{{ t('roomRework.or') }}</div>
          <section class="bonus-configuration-editor__condition-group">
            <div v-for="(condition, index) in group" :key="index" class="bonus-configuration-editor__condition-row">
              <span v-if="index" class="bonus-configuration-editor__logic-label">{{ t('roomRework.and') }}</span>
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
        <div v-for="(action, index) in draft.actions" :key="index" class="bonus-configuration-editor__action-row">
          <div class="bonus-configuration-editor__config-heading"><strong>{{ index + 1 }}. {{ t(action.type === 'adjust' ? 'roomRework.adjust' : action.type === 'notification' ? 'roomRework.notification' : 'roomRework.message') }}</strong><div>
            <v-btn icon="mdi-arrow-up" size="small" variant="text" :aria-label="t('roomRework.earlier')" :disabled="busy || index === 0" @click="moveAction(index, -1)" />
            <v-btn icon="mdi-arrow-down" size="small" variant="text" :aria-label="t('roomRework.later')" :disabled="busy || index === draft.actions.length - 1" @click="moveAction(index, 1)" />
            <v-btn icon="mdi-delete-outline" size="small" variant="text" :aria-label="t('bag.remove')" :disabled="busy" @click="draft.actions.splice(index, 1)" />
          </div></div>
          <div v-if="action.type === 'adjust'" class="bonus-configuration-editor__adjustment-row"><AppDropdown v-model="action.sign" :items="['+', '-']" :label="t('bonusPoints.form.adjustmentSign')" variant="outlined" density="comfortable" :disabled="busy" /><v-text-field v-model.number="action.amount" type="number" min="1" step="1" :label="t('bonusPoints.form.adjustmentAmount')" variant="outlined" density="comfortable" :disabled="busy" /></div>
          <v-textarea v-else v-model="action.text" :label="t(action.type === 'notification' ? 'roomRework.notification' : 'roomRework.message')" maxlength="2000" variant="outlined" rows="2" :disabled="busy" />
          <details v-if="action.type === 'notification'" class="bonus-configuration-editor__notification-options"><summary>{{ t('roomRework.notificationOptions') }}</summary><div class="bonus-configuration-editor__notification-options-grid">
            <div class="bonus-configuration-editor__notification-option-field"><label :for="`${notificationFieldId}-severity-${index}`">{{ t('roomRework.severity') }}</label><AppDropdown :id="`${notificationFieldId}-severity-${index}`" :model-value="action.severity ?? 'info'" :items="severityOptions" :aria-label="t('roomRework.severity')" variant="outlined" density="compact" hide-details="auto" :disabled="busy" @update:model-value="action.severity = $event" /></div>
            <div class="bonus-configuration-editor__notification-option-field"><label :for="`${notificationFieldId}-duration-${index}`">{{ t('roomRework.duration') }}</label><v-text-field :id="`${notificationFieldId}-duration-${index}`" :model-value="action.timeout === -1 ? '' : (action.timeout ?? 3500)" type="number" min="1000" max="60000" step="500" :aria-label="t('roomRework.duration')" variant="outlined" density="compact" hide-details="auto" :disabled="busy || action.timeout === -1" @update:model-value="action.timeout = $event === '' || $event === null ? undefined : Number($event)" /></div>
          </div><v-switch :model-value="action.timeout === -1" :label="t('roomRework.stayVisible')" color="primary" inset :disabled="busy" @update:model-value="action.timeout = $event ? -1 : undefined" /></details>
        </div>
        <div class="my-3"><v-btn variant="tonal" prepend-icon="mdi-plus" :disabled="busy" @click="chooserOpen = true">{{ t('roomRework.addEffect') }}</v-btn></div>
      </template>
    </v-form>
      <div v-if="draft" class="bonus-configuration-editor__live-summary"><v-icon :icon="activeKind === 'trigger' ? 'mdi-source-branch' : 'mdi-play-outline'" size="20" /><p>{{ summary(draft) }}</p></div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="bonus-configuration-editor__popup-footer"><v-spacer /><v-btn variant="text" :disabled="busy" @click="closeEditor">{{ t('common.cancel') }}</v-btn><v-btn variant="flat" color="primary" prepend-icon="mdi-check" :loading="busy" :disabled="busy" @click="save">{{ t('common.save') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="chooserOpen" max-width="520" :aria-label="t('roomRework.addEffect')">
    <v-card class="bonus-configuration-editor__effect-chooser"><v-card-title class="d-flex align-center">{{ t('roomRework.addEffect') }}<v-spacer /><AppCloseButton @click="chooserOpen = false" /></v-card-title><v-card-text><button v-for="option in actionOptions" :key="option.type" type="button" class="bonus-configuration-editor__effect-choice" @click="addAction(option.type)"><span class="bonus-configuration-editor__effect-choice-icon"><v-icon :icon="option.icon" size="26" /></span><span><strong>{{ t(option.title) }}</strong><span class="bonus-configuration-editor__effect-choice-description">{{ t(option.description) }}</span></span><v-icon icon="mdi-chevron-right" size="20" /></button></v-card-text></v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppDialogHeading from '@/shared/ui/AppDialogHeading.vue';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, ref, useId, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointTrigger, RoomBonusPointEffect } from '@shared/rooms/rooms.types';
import { parseBonusNotation, validateBonusEntry } from '@shared/rooms/bonus-point-config';
import { RoomsService } from '@/features/rooms/services/rooms.service';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
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

useErrorNotifications(
  () => error.value,
);
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/bonus-configuration-editor.scss"></style>
