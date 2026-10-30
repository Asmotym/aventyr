<template>
  <v-dialog v-model="open" max-width="1100" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2"><v-icon>mdi-bag-personal</v-icon>{{ t('bag.title') }}<v-spacer />
        <v-avatar v-for="person in activePresence" :key="person.userId" :color="userColor(person.userId)" size="28" :title="memberName(person.userId) + ' · ' + t('bag.presence.' + person.state)">
          <img v-if="memberAvatar(person.userId)" :src="memberAvatar(person.userId)" :alt="memberName(person.userId)" style="width:100%" /><span v-else>{{ memberName(person.userId).slice(0, 1) }}</span>
        </v-avatar>
        <v-btn icon="mdi-refresh" variant="text" :title="t('bag.reload')" @click="load" />
        <v-btn icon="mdi-close" variant="text" :title="t('common.close')" @click="open = false" />
      </v-card-title>
      <v-card-text>
        <v-alert v-if="error" type="error" closable @click:close="error = ''">{{ error }}<v-btn variant="text" @click="load">{{ t('bag.reload') }}</v-btn></v-alert>
        <v-tabs v-model="scope"><v-tab value="team">{{ t('bag.team') }}</v-tab><v-tab value="personal">{{ t('bag.personal') }}</v-tab></v-tabs>
        <v-progress-linear v-if="loading" indeterminate />
        <div class="d-flex align-center flex-wrap ga-2 my-3">
          <v-tabs v-model="sectionId" show-arrows class="bag-sections">
            <v-tab value="uncategorized">{{ t('bag.uncategorized') }}</v-tab>
            <v-tab tag="div" v-for="section in bag?.sections || []" :key="section.id" :value="section.id" :style="sectionStyle(section.id)">
              <v-btn v-if="canEdit" class="section-edit" size="x-small" icon="mdi-pencil" variant="text" :title="t('bag.rename')" @click.stop="editSection(section)" />{{ section.name }}
            </v-tab>
          </v-tabs>
          <v-btn v-if="canEdit" icon="mdi-plus" size="small" :title="t('bag.addSection')" :disabled="busy" @click="editSection()" />
          <v-btn v-if="canEdit && selectedSection" icon="mdi-delete-outline" size="small" :title="t('bag.deleteSection')" :disabled="busy" @click="confirmDelete('deleteBagSection', selectedSection)" />
          <v-spacer /><v-btn v-if="canEdit" variant="tonal" :disabled="busy" @click="templatesOpen = true">{{ t('bag.customFields') }}</v-btn>
        </div>
        <div class="d-flex ga-2 mb-2"><v-chip v-for="person in activePresence.filter(p => p.state === 'adding')" :key="person.userId" :color="userColor(person.userId)" size="small">{{ memberName(person.userId) }} · {{ t('bag.presence.adding') }}</v-chip></div>
        <v-table><thead><tr><th>{{ t('bag.name') }}</th><th>{{ t('bag.description') }}</th><th>{{ t('bag.fields') }}</th><th>{{ t('bag.actions') }}</th></tr></thead>
          <tbody><tr v-for="item in items" :key="item.id" :style="rowStyle(item.id)">
            <td><BagItemPreview :item="item" :room-id="roomId" /></td>
            <td class="bag-text">{{ item.displayDescription ? item.description : '' }}</td>
            <td class="bag-text"><div v-for="(field, index) in item.fields.filter(f => f.display)" :key="index">{{ field.name }}: {{ Array.isArray(field.value) ? field.value.join(', ') : field.value }}</div></td>
            <td><div class="d-flex">
              <v-btn v-if="canEdit" icon="mdi-pencil" size="small" variant="text" :title="t('bag.edit')" :disabled="busy" @click="editItem(item)" />
              <v-btn v-if="canEdit" icon="mdi-delete-outline" size="small" variant="text" :title="t('bag.remove')" :disabled="busy" @click="confirmDelete('deleteBagItem', item)" />
              <v-btn icon="mdi-share-variant" size="small" variant="text" :title="t('bag.share')" :disabled="busy" @click="share(item)" />
              <v-btn v-if="canEdit && scope === 'personal'" icon="mdi-gift-outline" size="small" variant="text" :title="t('bag.give')" :disabled="busy" @click="giving = item; recipient = null" />
            </div></td>
          </tr><tr v-if="!items.length"><td colspan="4" class="text-center text-medium-emphasis py-6">{{ t('bag.empty') }}</td></tr></tbody>
        </v-table>
        <v-tooltip :text="t('bag.addRow')"><template #activator="{ props: tooltip }"><v-btn v-if="canEdit" v-bind="tooltip" icon="mdi-plus" variant="tonal" class="mt-2" :disabled="busy || !bag" :aria-label="t('bag.addRow')" @click="editItem()" /></template></v-tooltip>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="!!sectionDraft" max-width="420" persistent><v-card v-if="sectionDraft"><v-card-title>{{ t('bag.section') }}</v-card-title><v-card-text>
    <v-alert v-if="error" type="error">{{ error }}<v-btn v-if="sectionDraft.id" @click="reloadSectionDraft">{{ t('bag.reloadDraft') }}</v-btn></v-alert><v-text-field v-model="sectionDraft.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" autofocus @keydown.enter="saveSection" />
    </v-card-text><v-card-actions><v-btn :disabled="busy" @click="sectionDraft = null">{{ t('common.cancel') }}</v-btn><v-btn :disabled="busy || !sectionDraft.name.trim()" :loading="busy" @click="saveSection">{{ t('common.save') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!draft" max-width="1200" class="bag-editor-dialog" persistent>
    <v-card v-if="draft" class="bag-editor">
      <v-card-title class="bag-editor-title">{{ t(draft.id ? 'bag.edit' : 'bag.addRow') }}</v-card-title>
      <div class="bag-editor-layout">
        <section class="bag-editor-form" :aria-label="t('bag.edit')">
          <v-defaults-provider :defaults="editorDefaults">
    <v-alert v-if="error" type="error">{{ error }}<v-btn v-if="draft.id" @click="reloadDraft">{{ t('bag.reloadDraft') }}</v-btn></v-alert>
    <v-expansion-panels v-model="editorPanels" multiple variant="accordion" class="bag-editor-panels">
      <v-expansion-panel value="general">
        <v-expansion-panel-title>{{ t('bag.general') }}</v-expansion-panel-title>
        <v-expansion-panel-text eager>
          <div class="bag-editor-section">
    <v-text-field v-model="draft.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" :rules="[v => !!v?.trim() || t('bag.required')]" />
    <div class="bag-editor-image-picker">
      <input ref="imageInput" type="file" hidden accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectImage" />
      <v-btn prepend-icon="mdi-image-plus-outline" variant="tonal" :disabled="busy" :loading="busy" :aria-describedby="imageHintId" @click="imageInput?.click()">{{ t('bag.selectImage') }}</v-btn>
      <p :id="imageHintId" class="bag-editor-image-hint">{{ t('bag.imageHint') }}</p>
    </div>
    <div v-if="draft.imageId" class="d-flex align-center ga-2"><BagImage :room-id="roomId" :image-id="draft.imageId" style="width:64px;height:64px;object-fit:contain" /><v-btn size="small" @click="draft.imageId = null">{{ t('bag.removeImage') }}</v-btn></div>
    <v-textarea v-model="draft.description" :label="t('bag.description')" :aria-label="t('bag.description')" maxlength="10000" rows="2" auto-grow no-resize /><v-checkbox v-model="draft.displayDescription" :label="t('bag.displayInTable')" :aria-label="t('bag.displayInTable')" density="compact" />
    <v-select v-model="draft.rarity" :label="t('bag.rarity')" :aria-label="t('bag.rarity')" :items="rarities">
      <template #selection="{ item }">
        <span class="bag-rarity-selection" :style="{ background: item.raw.color }">{{ item.title }}</span>
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-selected="draft.rarity === item.value" :class="['bag-rarity-option', 'rarity-' + item.raw.tier]" :style="{ '--rarity': item.raw.color, background: item.raw.color, color: '#141821' }">
          <template #title>
            <div class="bag-card-name">
              <span class="bag-rarity-option-title">{{ item.title }}</span>
              <v-icon v-if="draft.rarity === item.value" class="bag-rarity-option-check" icon="mdi-check" size="18" aria-hidden="true" />
            </div>
          </template>
        </v-list-item>
      </template>
    </v-select>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel value="fields">
        <v-expansion-panel-title>{{ t('bag.fields') }}</v-expansion-panel-title>
        <v-expansion-panel-text eager>
          <div class="bag-editor-section">
    <v-card v-for="(field, i) in draft.fields" :key="i" variant="outlined" class="bag-editor-field pa-2">
      <div class="d-flex ga-2"><v-text-field v-model="field.name" :label="t('bag.name')" :aria-label="t('bag.name')" :readonly="!!field.templateId" maxlength="120" />
        <v-btn icon="mdi-arrow-up" variant="text" :disabled="i === 0" :title="t('bag.moveUp')" @click="moveField(i, -1)" /><v-btn icon="mdi-arrow-down" variant="text" :disabled="i === draft.fields.length - 1" :title="t('bag.moveDown')" @click="moveField(i, 1)" />
        <v-btn icon="mdi-delete-outline" variant="text" :title="t('bag.remove')" @click="draft.fields.splice(i, 1)" /></div>
      <v-text-field v-if="field.type === 'string'" :model-value="String(field.value)" @update:model-value="field.value = $event" :label="t('bag.value')" :aria-label="t('bag.value')" maxlength="4000" />
      <v-text-field v-else-if="field.type === 'integer'" v-model.number="field.value" type="number" step="1" :label="t('bag.value')" :aria-label="t('bag.value')" />
      <v-select v-else :model-value="field.value as string | string[]" @update:model-value="field.value = $event ?? (field.type === 'multi-select' ? [] : '')" :items="field.options" :multiple="field.type === 'multi-select'" :label="t('bag.value')" :aria-label="t('bag.value')" />
      <v-checkbox v-model="field.display" :label="t('bag.displayInTable')" :aria-label="t('bag.displayInTable')" density="compact" />
    </v-card>
    <div class="bag-editor-field-actions"><v-btn prepend-icon="mdi-plus" :disabled="draft.fields.length >= 50" @click="fieldPickerOpen = true">{{ t('bag.addField') }}</v-btn><v-btn @click="templatesOpen = true">{{ t('bag.customFields') }}</v-btn></div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
          </v-defaults-provider>
        </section>
        <aside class="bag-editor-preview" :aria-label="t('bag.preview')" tabindex="0">
          <div class="bag-editor-preview-content">
            <BagItemPreview :item="draft" :room-id="roomId" inline />
          </div>
        </aside>
      </div>
      <v-card-actions class="bag-editor-actions"><v-spacer /><v-btn :disabled="busy" @click="draft = null">{{ t('common.cancel') }}</v-btn><v-btn color="primary" :loading="busy" :disabled="busy || !draft.name.trim() || draft.fields.some(f => !f.name.trim())" @click="saveItem">{{ t('common.save') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog v-model="fieldPickerOpen" max-width="440"><v-card><v-card-title>{{ t('bag.addField') }}</v-card-title><v-card-text>
    <v-btn class="ma-1" @click="addField('string')">{{ t('bag.types.string') }}</v-btn><v-btn class="ma-1" @click="addField('integer')">{{ t('bag.types.integer') }}</v-btn>
    <v-list><v-list-item v-for="template in bag?.templates" :key="template.id" :title="template.name" :subtitle="t('bag.types.' + template.type)" @click="addField(template)" /></v-list>
    </v-card-text><v-card-actions><v-btn @click="fieldPickerOpen = false">{{ t('common.close') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog v-model="templatesOpen" max-width="650" scrollable><v-card><v-card-title>{{ t('bag.customFields') }}</v-card-title><v-card-text>
    <p class="text-body-2 text-medium-emphasis mb-4">{{ t('bag.customFieldsDescription') }}</p>
    <v-alert v-if="error" type="error">{{ error }}<v-btn v-if="templateDraft.id" @click="reloadTemplateDraft">{{ t('bag.reloadDraft') }}</v-btn></v-alert>
    <v-list><v-list-item v-for="template in bag?.templates" :key="template.id" :title="template.name" :subtitle="t('bag.types.' + template.type)"><template #append><v-btn icon="mdi-pencil" variant="text" :disabled="busy" :title="t('bag.edit')" @click="templateDraft = clone(template); optionText = template.options.join('\n')" /><v-btn icon="mdi-delete-outline" variant="text" :disabled="busy" :title="t('bag.remove')" @click="confirmDelete('deleteBagTemplate', template)" /></template></v-list-item></v-list>
    <v-text-field v-model="templateDraft.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" /><v-select v-model="templateDraft.type" :label="t('bag.type')" :aria-label="t('bag.type')" :items="fieldTypes" />
    <v-textarea v-if="['select', 'multi-select'].includes(templateDraft.type)" v-model="optionText" :label="t('bag.options')" :aria-label="t('bag.options')" :hint="t('bag.optionsHint')" persistent-hint />
    <v-btn :disabled="busy || !templateDraft.name.trim()" :loading="busy" @click="saveTemplate">{{ t('common.save') }}</v-btn><v-btn :disabled="busy" @click="resetTemplate">{{ t('bag.newField') }}</v-btn>
    </v-card-text><v-card-actions><v-btn @click="templatesOpen = false">{{ t('common.close') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!giving" max-width="440" persistent><v-card><v-card-title>{{ t('bag.give') }}</v-card-title><v-card-text>
    <v-alert v-if="error" type="error">{{ error }}</v-alert><v-select v-model="recipient" :items="recipients" :label="t('bag.recipient')" :aria-label="t('bag.recipient')" /></v-card-text><v-card-actions><v-btn :disabled="busy" @click="giving = null">{{ t('common.cancel') }}</v-btn><v-btn :disabled="!recipient || busy" :loading="busy" @click="give">{{ t('bag.give') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!deletion" max-width="420" persistent><v-card><v-card-title>{{ t('bag.remove') }}</v-card-title><v-card-text><v-alert v-if="error" type="error">{{ error }}</v-alert>{{ t(deletion?.action === 'deleteBagSection' ? 'bag.deleteSectionHint' : 'bag.deleteConfirm') }}</v-card-text><v-card-actions><v-btn :disabled="busy" @click="deletion = null">{{ t('common.cancel') }}</v-btn><v-btn color="error" :disabled="busy" :loading="busy" @click="remove">{{ t('bag.remove') }}</v-btn></v-card-actions></v-card></v-dialog>
  <v-dialog :model-value="!!sharing" max-width="420"><v-card><v-card-title>{{ t('bag.share') }}</v-card-title><v-card-text>{{ t('bag.sharePersonal') }}</v-card-text><v-card-actions><v-btn @click="sharing = null">{{ t('common.cancel') }}</v-btn><v-btn :loading="busy" :disabled="busy" @click="performShare">{{ t('bag.share') }}</v-btn></v-card-actions></v-card></v-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomsStore } from 'core/stores/rooms.store';
import { useRoomAccess } from 'core/composables/useRoomAccess';
import { bagRequest } from 'core/services/rooms.service';
import { bagImageRequest } from 'core/services/bag-images.service';
import { BAG_RARITIES, type BagActionName, type BagAction, type BagSnapshot, type BagScope, type BagItem, type BagSection, type BagTemplate, type BagPresence } from 'netlify/core/types/bag.types';
import type { RoomRealtimeEvent } from 'netlify/core/types/data.types';
import BagItemPreview from './BagItemPreview.component.vue';
import BagImage from './BagImage.component.vue';
import { BAG_RARITY_COLORS } from 'core/utils/bag-rarity.utils';
const props = defineProps<{ roomId: string; userId: string }>();
const open = defineModel<boolean>({ default: false });
const imageInput = ref<HTMLInputElement | null>(null), imageHintId = useId();
const editorPanels = ref<string[]>(['general']);
const editorDefaults = {
  VTextField: { density: 'compact', hideDetails: 'auto' },
  VTextarea: { density: 'compact', hideDetails: 'auto' },
  VSelect: { density: 'compact', hideDetails: 'auto' },
  VCheckbox: { density: 'compact', hideDetails: true },
  VBtn: { size: 'small' },
};
const { t } = useI18n(), store = useRoomsStore();
const access = useRoomAccess(computed(() => props.userId));
const canEdit = computed(() => access.value.rights.viewBag && access.value.rights.editBag);
const bag = ref<BagSnapshot | null>(null), scope = ref<BagScope>('team'), sectionId = ref('uncategorized');
const error = ref(''), loading = ref(false), busy = ref(false), presence = ref<BagPresence[]>([]);
const draft = ref<BagItem | null>(null), sectionDraft = ref<BagSection | null>(null), giving = ref<BagItem | null>(null), sharing = ref<BagItem | null>(null), recipient = ref<string | null>(null);
const deletion = ref<{ action: BagActionName; id: string; revision: number } | null>(null);
const templatesOpen = ref(false), fieldPickerOpen = ref(false);
const templateDraft = ref<BagTemplate>({ id: '', revision: 0, name: '', type: 'string', options: [] }), optionText = ref('');
const rarities = computed(() => BAG_RARITIES.map((value, tier) => ({ title: t('bag.rarities.' + value), value, tier, color: BAG_RARITY_COLORS[value] })));
const fieldTypes = computed(() => ['string', 'integer', 'select', 'multi-select'].map(value => ({ title: t('bag.types.' + value), value })));
const items = computed(() => bag.value?.items.filter(i => i.sectionId === (sectionId.value === 'uncategorized' ? null : sectionId.value)) ?? []);
const selectedSection = computed(() => bag.value?.sections.find(s => s.id === sectionId.value));
const recipients = computed(() => store.members.filter(m => m.userId !== props.userId).map(m => ({ title: m.nickname || m.username || m.userId, value: m.userId })));
const activePresence = computed(() => presence.value.filter(p => p.scope === scope.value && p.expiresAt > now.value));
const now = ref(Date.now()); let timer: ReturnType<typeof setInterval> | undefined, generation = 0;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function memberName(id: string) { const m = store.members.find(m => m.userId === id); return m?.nickname || m?.username || id; }
function memberAvatar(id: string) { return store.members.find(m => m.userId === id)?.avatar; }
function userColor(id: string) { return `hsl(${[...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 0)} 65% 55%)`; }
function rowStyle(id: string) { const p = activePresence.value.find(p => p.itemId === id && p.state === 'editing'); return p ? { boxShadow: `inset 4px 0 ${userColor(p.userId)}` } : {}; }
function sectionStyle(id: string) { const p = activePresence.value.find(p => p.sectionId === id); return p ? { borderBottom: `3px solid ${userColor(p.userId)}` } : {}; }
function accept(snapshot: BagSnapshot) { if (snapshot.scope === scope.value && (!bag.value || bag.value.id !== snapshot.id || snapshot.revision >= bag.value.revision)) { bag.value = snapshot; if (sectionId.value !== 'uncategorized' && !snapshot.sections.some(s => s.id === sectionId.value)) sectionId.value = 'uncategorized'; } }
async function load() {
  if (!open.value) return;
  const current = ++generation, requestedScope = scope.value;
  loading.value = true;
  try { const result = await bagRequest('bag', { roomId: props.roomId, userId: props.userId, scope: requestedScope }); if (current === generation && result.bag && open.value) accept(result.bag); }
  catch (e) { if (current === generation) error.value = e instanceof Error ? e.message : String(e); }
  finally { if (current === generation) loading.value = false; }
}
async function mutate(action: BagActionName, extra: Partial<BagAction['payload']> = {}) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { const result = await bagRequest(action, { roomId: props.roomId, userId: props.userId, scope: scope.value, ...extra }); if (result.bag && open.value) accept(result.bag); if (result.message) store.appendMessages([result.message]); return result; }
  catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  finally { busy.value = false; }
}
function editSection(section?: BagSection) { error.value = ''; sectionDraft.value = section ? clone(section) : { id: '', revision: 0, name: '' }; }
async function reloadSectionDraft() { await load(); const latest = bag.value?.sections.find(s => s.id === sectionDraft.value?.id); if (latest) { sectionDraft.value = clone(latest); error.value = ''; } }
async function saveSection() { const d = sectionDraft.value; if (!d?.name.trim() || busy.value) return; const result = await mutate(d.id ? 'updateBagSection' : 'createBagSection', { id: d.id, revision: d.revision, data: { name: d.name } }); if (result) { sectionId.value = d.id || result.selectedId || 'uncategorized'; sectionDraft.value = null; } }
function editItem(item?: BagItem) { editorPanels.value = ['general']; error.value = ''; draft.value = item ? clone(item) : { id: '', revision: 0, creatorId: props.userId, sectionId: sectionId.value === 'uncategorized' ? null : sectionId.value, name: '', description: '', displayDescription: false, rarity: 'Common', imageId: null, fields: [] }; }
async function saveItem() { const d = draft.value; if (!d) return; if (await mutate(d.id ? 'updateBagItem' : 'createBagItem', { id: d.id, revision: d.revision, data: d })) draft.value = null; }
async function reloadDraft() { await load(); const item = bag.value?.items.find(i => i.id === draft.value?.id); if (item) { draft.value = clone(item); error.value = ''; } }
function addField(value: 'string' | 'integer' | BagTemplate) { if (!draft.value || draft.value.fields.length >= 50) return; const template = typeof value === 'object' ? value : null; const type = template?.type ?? value as 'string' | 'integer'; draft.value.fields.push({ name: template?.name ?? '', type, options: template ? [...template.options] : [], ...(template ? { templateId: template.id } : {}), value: type === 'integer' ? 0 : type === 'multi-select' ? [] : type === 'select' ? template?.options[0] ?? '' : '', display: false }); fieldPickerOpen.value = false; }
function moveField(index: number, direction: number) { if (!draft.value) return; const fields = draft.value.fields; [fields[index], fields[index + direction]] = [fields[index + direction]!, fields[index]!]; }
async function reloadTemplateDraft() { await load(); const latest = bag.value?.templates.find(t => t.id === templateDraft.value.id); if (latest) { templateDraft.value = clone(latest); optionText.value = latest.options.join('\n'); error.value = ''; } }
function resetTemplate() { templateDraft.value = { id: '', revision: 0, name: '', type: 'string', options: [] }; optionText.value = ''; }
async function saveTemplate() { const d = templateDraft.value; if (await mutate(d.id ? 'updateBagTemplate' : 'createBagTemplate', { id: d.id, revision: d.revision, data: { ...d, options: optionText.value.split('\n').map(s => s.trim()).filter(Boolean) } })) resetTemplate(); }
function confirmDelete(action: BagActionName, entry: { id: string; revision: number }) { error.value = ''; deletion.value = { action, id: entry.id, revision: entry.revision }; }
async function remove() { const d = deletion.value; if (d && await mutate(d.action, { id: d.id, revision: d.revision })) { if (d.action === 'deleteBagTemplate' && templateDraft.value.id === d.id) resetTemplate(); deletion.value = null; } }
async function give() { const d = giving.value; if (d && recipient.value && await mutate('giveBagItem', { id: d.id, revision: d.revision, targetUserId: recipient.value })) giving.value = null; }
async function share(item: BagItem) { if (scope.value === 'personal') sharing.value = item; else await mutate('shareBagItem', { id: item.id }); }
async function performShare() { if (sharing.value && await mutate('shareBagItem', { id: sharing.value.id })) sharing.value = null; }
function selectImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void pickImage(file);
}
async function pickImage(input: File | File[] | null) { const file = Array.isArray(input) ? input[0] : input; if (!file || !draft.value) return; if (file.size > 5 * 1024 * 1024) { error.value = t('bag.imageHint'); return; } busy.value = true; error.value = ''; try { const response = await bagImageRequest(props.roomId, undefined, file, scope.value); const data = await response.json(); if (draft.value) draft.value.imageId = data.data.imageId; } catch (e) { error.value = e instanceof Error ? e.message : String(e); } finally { busy.value = false; } }
function sendPresence() { store.sendBagPresence(open.value ? { scope: scope.value, state: draft.value ? draft.value.id ? 'editing' : 'adding' : 'viewing', sectionId: sectionId.value === 'uncategorized' ? null : sectionId.value, itemId: draft.value?.id || null } : { state: 'closed' }); }
function closeEditors() { draft.value = null; sectionDraft.value = null; deletion.value = null; giving.value = null; sharing.value = null; templatesOpen.value = false; fieldPickerOpen.value = false; resetTemplate(); }
function onEvent(event: Event) { const data = (event as CustomEvent<RoomRealtimeEvent>).detail; if (data.roomId !== props.roomId || !open.value) return; if (data.type === 'bag.changed' && data.scope === scope.value || data.type === 'connection.ready') { void load(); sendPresence(); } if (data.type === 'bag.presence') { presence.value = [...presence.value.filter(p => p.scope !== data.scope), ...data.presence]; } }
watch(open, value => { if (value) { scope.value = 'team'; sectionId.value = 'uncategorized'; void load(); } else { generation++; bag.value = null; closeEditors(); presence.value = []; } sendPresence(); });
watch(scope, () => { generation++; bag.value = null; sectionId.value = 'uncategorized'; closeEditors(); void load(); sendPresence(); });
watch([() => draft.value?.id, () => !!draft.value, sectionId], sendPresence);
watch(canEdit, value => { if (!value) closeEditors(); });
watch(() => access.value.rights.viewBag, value => { if (!value) open.value = false; });
onMounted(() => { window.addEventListener('room-bag-event', onEvent); timer = setInterval(() => { now.value = Date.now(); if (open.value) sendPresence(); }, 10_000); if (open.value) void load(); });
onBeforeUnmount(() => { generation++; if (timer) clearInterval(timer); window.removeEventListener('room-bag-event', onEvent); store.sendBagPresence({ state: 'closed' }); });
</script>
<style scoped>
.bag-editor { height: min(780px, calc(100dvh - 48px)); display: flex; flex-direction: column; overflow: hidden; }
.bag-editor-dialog :deep(.v-overlay__content) { width: calc(100% - 32px); margin: 16px; }
.bag-editor-title, .bag-editor-actions { flex: 0 0 auto; }
.bag-editor-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 420px; grid-template-rows: minmax(0, 1fr); overflow: hidden; }
.bag-editor-form { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 16px 20px; }
.bag-editor-form > :deep(*) { flex-shrink: 0; }
.bag-editor-form :deep(.v-field__input) { font-size: 14px; }
.bag-editor-form :deep(.v-label) { font-size: 13px; }
.bag-editor-section { display: flex; flex-direction: column; gap: 12px; }
.bag-editor-panels :deep(.v-expansion-panel-title) { min-height: 42px; padding: 10px 16px; font-size: 14px; font-weight: 600; }
.bag-editor-panels :deep(.v-expansion-panel-text__wrapper) { padding: 12px; }
.bag-editor-field { display: flex; flex-direction: column; gap: 8px; }
.bag-editor-field-actions { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; padding-bottom: 4px; }
.bag-editor-image-hint { margin: 6px 0 0; font-size: 12px; line-height: 1.4; color: rgba(var(--v-theme-on-surface), .6); }
.bag-editor-preview { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 40px 32px 32px; background: rgba(var(--v-theme-on-surface), .035); border-inline-start: 1px solid rgba(var(--v-theme-on-surface), .12); }
.bag-editor-preview-content { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.bag-editor-preview-content :deep(.bag-item-card--inline) { order: 0; }
.bag-editor-preview-content :deep(.bag-item-link) { order: 1; max-width: 100%; overflow-wrap: anywhere; }
@media (max-width: 759px) {
  .bag-editor-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .bag-editor-form { padding: 16px; }
  .bag-editor-preview { max-height: min(340px, 40dvh); padding: 28px 24px 24px; border-inline-start: 0; border-top: 1px solid rgba(var(--v-theme-on-surface), .12); }
  .bag-editor-preview-content { gap: 10px; }
}

.bag-rarity-selection { display: inline-block; padding: 2px 10px; border-radius: 4px; color: #141821; font-weight: 600; }
.bag-rarity-option { margin: 4px 8px; border-radius: 6px; animation: none; box-shadow: none; }
.bag-rarity-option .bag-card-name { margin: 0; padding: 8px 32px 12px; border: 0; }
.bag-rarity-option .bag-card-name::after { bottom: 4px; min-width: 24px; font-size: 10px; line-height: 12px; }
.bag-rarity-option-title { font-size: 14px; font-weight: 700; letter-spacing: .03em; }
.bag-rarity-option-check { position: absolute; inset-inline-end: 4px; top: 50%; transform: translateY(-50%); }

.bag-text { max-width: 280px; white-space: pre-wrap; overflow-wrap: anywhere; }.bag-sections { max-width: 75%; }.section-edit { opacity: 0; margin-inline-end: 8px; }.v-tab:hover .section-edit,.v-tab:focus-within .section-edit { opacity: 1; } @media (hover: none) { .section-edit { opacity: 1; } } @media (max-width: 600px) { .bag-sections { max-width: 100%; }.bag-text { min-width: 130px; } }
</style>
