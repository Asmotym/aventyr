<template>
  <section v-for="kind in kinds" :key="kind" class="config-section">
    <header class="config-heading"><div><h3>{{ t(`roomRework.${kind}s`) }}</h3><p class="text-body-2 text-medium-emphasis">{{ t(`roomRework.${kind}Help`) }}</p></div><v-btn variant="tonal" prepend-icon="mdi-plus" :disabled="busy" @click="start(kind)">{{ t('roomRework.add') }}</v-btn></header>
    <v-alert v-if="error && activeKind === kind" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
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
    <v-form v-if="draft && activeKind === kind" class="config-form" @submit.prevent="save">
      <h4 class="mb-4">{{ t(draft.id ? 'bag.edit' : 'roomRework.add') }} · {{ t(`roomRework.${kind}s`) }}</h4>
      <v-text-field v-model="draft.name" :label="t('bag.name')" maxlength="100" variant="outlined" density="comfortable" :disabled="busy" />
      <template v-if="kind === 'trigger' && 'groups' in draft">
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
      <template v-if="kind === 'effect' && 'actions' in draft">
        <v-text-field v-model="draft.diceNotation" :label="t('dice.fields.notation')" placeholder="2d10" variant="outlined" density="comfortable" :disabled="busy" />
        <div v-for="(action, index) in draft.actions" :key="index" class="action-row">
          <div class="config-heading"><strong>{{ index + 1 }}. {{ t(action.type === 'adjust' ? 'roomRework.adjust' : 'roomRework.message') }}</strong><div>
            <v-btn icon="mdi-arrow-up" size="small" variant="text" :aria-label="t('roomRework.earlier')" :disabled="busy || index === 0" @click="moveAction(index, -1)" />
            <v-btn icon="mdi-arrow-down" size="small" variant="text" :aria-label="t('roomRework.later')" :disabled="busy || index === draft.actions.length - 1" @click="moveAction(index, 1)" />
            <v-btn icon="mdi-delete-outline" size="small" variant="text" :aria-label="t('bag.remove')" :disabled="busy" @click="draft.actions.splice(index, 1)" />
          </div></div>
          <div v-if="action.type === 'adjust'" class="adjustment-row"><AppDropdown v-model="action.sign" :items="['+', '-']" :label="t('bonusPoints.form.adjustmentSign')" variant="outlined" density="comfortable" :disabled="busy" /><v-text-field v-model.number="action.amount" type="number" min="1" step="1" :label="t('bonusPoints.form.adjustmentAmount')" variant="outlined" density="comfortable" :disabled="busy" /></div>
          <v-textarea v-else v-model="action.text" :label="t('roomRework.message')" maxlength="2000" variant="outlined" rows="2" :disabled="busy" />
        </div>
        <div class="d-flex ga-2 flex-wrap my-3"><v-btn variant="tonal" :disabled="busy" @click="draft.actions.push({ type: 'adjust', sign: '+', amount: 1 })">{{ t('roomRework.adjust') }}</v-btn><v-btn variant="tonal" :disabled="busy" @click="draft.actions.push({ type: 'message', text: '' })">{{ t('roomRework.message') }}</v-btn></div>
      </template>
      <p class="text-body-2 mb-4">{{ summary(draft) }}</p>
      <v-btn type="submit" color="primary" :loading="busy">{{ t('common.save') }}</v-btn><v-btn variant="text" :disabled="busy" @click="cancel">{{ t('common.cancel') }}</v-btn>
    </v-form>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointTrigger, RoomBonusPointEffect } from 'netlify/core/types/data.types';
import { parseBonusNotation, validateBonusEntry } from 'netlify/core/utils/bonus-point-config';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
const props = defineProps<{ roomId: string; userId: string }>();
const emit = defineEmits<{ dirty: [value: boolean] }>();
const { t } = useI18n(), store = useRoomsStore();
type Kind = 'trigger' | 'effect';
type Entry = RoomBonusPointTrigger | RoomBonusPointEffect;
const kinds = ['trigger', 'effect'] as const;
const activeKind = ref<Kind>('trigger'), draft = ref<Entry | null>(null), initial = ref(''), busy = ref(false), error = ref('');
const operators = computed(() => ['lessThan','moreThan'].map(value => ({ value, title: t(`bonusPoints.operators.${value}`) })));
const condition = () => ({ diceNotation: 'd100', operator: 'moreThan' as const, threshold: 90 });
function entries(kind: Kind): Entry[] { return kind === 'trigger' ? store.bonusPointTriggers : store.bonusPointEffects; }
function cancel() { draft.value = null; error.value = ''; }
function canDiscard() { return !draft.value || JSON.stringify(draft.value) === initial.value || window.confirm(t('roomRework.discard')); }
function start(kind: Kind, entry?: Entry) {
  if (!canDiscard()) return;
  activeKind.value = kind; error.value = '';
  draft.value = entry ? JSON.parse(JSON.stringify(entry)) : kind === 'trigger' ? { id: '', roomId: props.roomId, name: '', groups: [[condition()]] } : { id: '', roomId: props.roomId, name: '', diceNotation: 'd100', actions: [{ type: 'adjust', sign: '+', amount: 1 }] };
  initial.value = JSON.stringify(draft.value);
}
function summary(entry: Entry): string {
  if ('groups' in entry) return entry.groups.map(group => '(' + group.map(c => `${c.diceNotation} ${c.operator === 'moreThan' ? '>' : '<'} ${c.threshold}`).join(` ${t('roomRework.and')} `) + ')').join(` ${t('roomRework.or')} `);
  return `${entry.diceNotation}: ${entry.actions.map(a => a.type === 'adjust' ? `${a.sign}${a.amount}` : t('roomRework.message')).join(' → ')}`;
}
function duplicate(entry: RoomBonusPointEffect) {
  try { return store.bonusPointEffects.filter(e => parseBonusNotation(e.diceNotation).notation === parseBonusNotation(entry.diceNotation).notation).length > 1; } catch { return false; }
}
async function mutate(kind: Kind, operation: 'save' | 'delete' | 'reorder', extra: { entry?: Entry; id?: string; ids?: string[] }) {
  busy.value = true; error.value = ''; activeKind.value = kind;
  try {
    const result = await RoomsService.mutateBonusConfiguration({ roomId: props.roomId, userId: props.userId, kind, operation, ...extra });
    if (store.selectedRoomId === props.roomId) { store.bonusPointTriggers = result.triggers ?? []; store.bonusPointEffects = result.effects ?? []; }
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
