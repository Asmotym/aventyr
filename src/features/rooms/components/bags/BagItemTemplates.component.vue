<template>
  <v-dialog class="bag-item-templates" v-model="open" max-width="960" scrollable>
    <v-card class="bag-item-templates__preset-library">
      <v-card-title class="bag-item-templates__preset-title"><v-icon icon="mdi-cards-outline" color="primary" /><span>{{ t(selecting ? 'bag.itemTemplate' : 'bag.itemTemplates') }}</span><v-spacer /><v-chip size="small" variant="tonal">{{ t('bag.myItemTemplates') }}</v-chip></v-card-title>
      <v-card-text class="bag-item-templates__preset-library-body">
        <p class="bag-item-templates__preset-intro">{{ t(selecting ? 'bag.chooseItemTemplateHint' : 'bag.itemTemplateLibraryHint') }}</p>

        <v-tabs v-if="selecting" v-model="catalog" color="primary"><v-tab value="mine" prepend-icon="mdi-lock-outline">{{ t('bag.myItemTemplates') }}</v-tab><v-tab value="public" prepend-icon="mdi-earth">{{ t('bag.publicItemTemplates') }}</v-tab></v-tabs>
        <v-text-field v-model="search" :label="t('bag.searchItemTemplates')" prepend-inner-icon="mdi-magnify" variant="outlined" density="compact" clearable hide-details class="my-4" />
        <div class="bag-item-templates__preset-section-heading"><h3>{{ t(selecting && catalog === 'public' ? 'bag.publicItemTemplates' : 'bag.myItemTemplates') }}</h3><v-chip size="x-small" variant="tonal">{{ filtered.length }}</v-chip></div>
        <div class="bag-item-templates__preset-list" :class="{ 'bag-item-templates__preset-list--grid': selecting }">
          <article class="bag-item-templates__preset-entry" v-for="preset in filtered" :key="preset.id">
            <div class="bag-item-templates__preset-entry-heading">
              <v-avatar color="primary" variant="tonal" :size="selecting ? 48 : 42"><BagImage :room-id="roomId" :image-id="preset.imageId" :icon="preset.icon || 'mdi-cards-outline'" :icon-size="selecting ? 28 : 24" class="bag-item-templates__preset-thumbnail" /></v-avatar>
              <div class="bag-item-templates__preset-entry-copy"><BagItemPreview :item="preview(preset)" :room-id="roomId" /><small>{{ selecting && catalog === 'public' ? memberName(preset.ownerId) + ' · ' : '' }}{{ t(preset.public ? 'bag.publicField' : 'bag.privateField') }}</small></div>
              <div v-if="!selecting" class="bag-item-templates__preset-entry-actions"><v-btn :disabled="busy" :aria-label="t('bag.edit') + ': ' + preset.name" icon="mdi-pencil-outline" size="small" variant="text" @click="edit(preset)" /><v-btn :disabled="busy" :aria-label="t('bag.remove') + ': ' + preset.name" icon="mdi-delete-outline" size="small" variant="text" color="error" @click="deleting = preset" /></div>
            </div>
            <div class="bag-item-templates__preset-entry-meta"><v-chip size="x-small" variant="tonal">{{ t('bag.rarities.' + preset.rarity) }}</v-chip><v-chip v-for="field in preset.fields.slice(0, 3)" :key="field.name" size="x-small" variant="outlined">{{ field.name }}</v-chip><span v-if="preset.fields.length > 3" class="text-caption">+{{ preset.fields.length - 3 }}</span></div>
            <div v-if="selecting" class="bag-item-templates__preset-selection-actions"><v-btn v-if="preset.ownerId !== userId" :disabled="busy" size="small" variant="text" prepend-icon="mdi-content-copy" @click="importPreset(preset)">{{ t('bag.importItemTemplate') }}</v-btn><v-btn :disabled="busy" color="primary" size="small" variant="tonal" prepend-icon="mdi-check" @click="emit('apply', preset)">{{ t('bag.useItemTemplate') }}</v-btn></div>
          </article>
          <div v-if="!filtered.length" class="bag-item-templates__preset-empty"><v-icon icon="mdi-cards-outline" size="40" color="primary" /><h3>{{ t('bag.noItemTemplates') }}</h3><p>{{ t(selecting ? 'bag.chooseItemTemplateHint' : 'bag.itemTemplateLibraryHint') }}</p></div>
        </div>
        <v-btn v-if="!selecting" class="bag-item-templates__preset-new" :disabled="busy" prepend-icon="mdi-plus" variant="outlined" block @click="edit()">{{ t('bag.newItemTemplate') }}</v-btn>
      </v-card-text>
      <v-card-actions class="bag-item-templates__preset-footer"><v-spacer /><v-btn @click="open = false">{{ t('common.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="!!editing" class="bag-item-template-editor-dialog bag-editor__dialog" max-width="1200" persistent>
    <v-card v-if="editing" class="bag-editor">
      <v-card-title class="bag-editor__title">{{ t(editing.id ? 'bag.editItemTemplate' : 'bag.newItemTemplate') }}</v-card-title>
      <v-form class="bag-item-templates__preset-editor-shell" @submit.prevent="save">
        <div class="bag-editor__layout">
          <section class="bag-editor__form" :aria-label="t('bag.itemTemplate')">

            <v-defaults-provider :defaults="{ VTextField: { disabled: busy, density: 'compact', hideDetails: 'auto' }, VTextarea: { disabled: busy, density: 'compact', hideDetails: 'auto' }, VSelect: { disabled: busy, density: 'compact', hideDetails: 'auto' }, VSwitch: { disabled: busy, density: 'compact', hideDetails: true }, VBtn: { size: 'small' } }">
              <v-expansion-panels class="bag-editor__panels" v-model="panels" multiple variant="accordion">
                <v-expansion-panel value="general"><v-expansion-panel-title>{{ t('bag.general') }}</v-expansion-panel-title><v-expansion-panel-text eager><div class="bag-editor__section">
          <v-text-field v-model="editing.name" :label="t('bag.name')" :aria-label="t('bag.name')" maxlength="120" :rules="[value => !!value?.trim()]" @blur="!editing.name.trim() && notifications.error(t('bag.required'))" />
          <div class="bag-editor-image-picker">
            <input ref="imageInput" type="file" hidden accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectImage" />
            <v-btn prepend-icon="mdi-image-plus-outline" variant="tonal" :disabled="busy" :loading="busy" :aria-describedby="imageHintId" @click="imageInput?.click()">{{ t('bag.selectImage') }}</v-btn>
            <p :id="imageHintId" class="bag-editor__image-hint">{{ t('bag.imageHint') }}</p>
          </div>
          <BagIconPicker v-model="editing.icon" :label="t('bag.selectIcon')" />
          <div v-if="editing.imageId" class="d-flex align-center ga-2"><BagImage class="bag-editor__image" :room-id="roomId" :image-id="editing.imageId" :icon="editing.icon" :icon-size="48"  /><v-btn size="small" @click="editing.imageId = null">{{ t('bag.removeImage') }}</v-btn></div>
          <v-textarea v-model="editing.description" :label="t('bag.description')" :aria-label="t('bag.description')" maxlength="10000" rows="2" auto-grow no-resize />
          <BagRaritySelect v-model="editing.rarity" />
          <v-switch v-model="editing.public" :label="t('bag.makePublic')" color="primary" hide-details />

                </div></v-expansion-panel-text></v-expansion-panel>
                <v-expansion-panel value="fields"><v-expansion-panel-title>{{ t('bag.fields') }}</v-expansion-panel-title><v-expansion-panel-text eager><div class="bag-editor__section">
<div class="bag-editor__fields-heading"><div><h3>{{ t('bag.itemFieldsTitle') }}</h3><p>{{ t('bag.itemFieldsHint') }}</p></div><v-chip size="small" variant="tonal">{{ editing.fields.length }}/50</v-chip></div>
          <div v-for="(field, index) in editing.fields" :key="index" class="bag-editor__field-card">
            <div class="bag-editor__field-card-heading"><v-avatar color="primary" size="30" variant="tonal"><v-icon icon="mdi-text-box-outline" size="18" /></v-avatar><span class="text-caption font-weight-bold">{{ t('bag.types.' + field.type) }}</span><v-spacer /><v-btn icon="mdi-delete-outline" :aria-label="t('bag.remove')" @click="editing.fields.splice(index, 1)" /></div>
            <div class="bag-editor__field-card-inputs">
            <v-text-field v-model="field.name" :label="t('bag.name')" maxlength="120" variant="outlined" /><AppDropdown v-model="field.type" :items="fieldTypes" :label="t('bag.type')" variant="outlined" @update:model-value="resetValue(field)" />
            <v-textarea v-if="field.type === 'select' || field.type === 'multi-select'" :model-value="field.options.join('\n')" :label="t('bag.options')" :hint="t('bag.optionsHint')" rows="2" @update:model-value="field.options = $event.split('\n').map((s: string) => s.trim()).filter(Boolean); resetValue(field)" />
            <v-textarea v-if="field.type === 'string'" :model-value="String(field.value)" @update:model-value="field.value = $event" :label="t('bag.value')" maxlength="4000" rows="1" auto-grow variant="outlined" />
            <v-text-field v-else-if="field.type === 'integer'" v-model.number="field.value" :label="t('bag.value')" type="number" step="1" variant="outlined" />
            <AppDropdown v-else :model-value="field.value as string | string[]" @update:model-value="field.value = $event" :items="field.options" :multiple="field.type === 'multi-select'" :chips="field.type === 'multi-select'" :label="t('bag.value')" />
            </div>
          </div>
          <v-btn class="bag-editor__add-field" block variant="outlined" :disabled="editing.fields.length >= 50" prepend-icon="mdi-plus" @click="fieldPickerOpen = true">{{ t('bag.addField') }}</v-btn>

                </div></v-expansion-panel-text></v-expansion-panel>
              </v-expansion-panels>
            </v-defaults-provider>
          </section>
          <aside class="bag-editor__preview" :aria-label="t('bag.preview')" tabindex="0"><div class="bag-editor__preview-content"><BagItemPreview :item="preview(editing)" :room-id="roomId" inline /></div></aside>
        </div>
        <v-card-actions class="bag-editor__actions"><v-btn v-if="editing.id" :disabled="busy" size="small" @click="reload">{{ t('bag.reloadDraft') }}</v-btn><v-spacer /><v-btn :disabled="busy" @click="editing = null">{{ t('common.cancel') }}</v-btn><v-btn type="submit" color="primary" :loading="busy" :disabled="busy || !editing.name.trim()">{{ t('common.save') }}</v-btn></v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
  <BagFieldPicker v-model="fieldPickerOpen" :templates="bag?.templates" :public-templates="bag?.publicTemplates" :excluded-names="editing?.fields.map(f => f.name) || []" :disabled="busy || !editing || editing.fields.length >= 50" can-manage :member-name="memberName" @select="addField" @manage="emit('manageFields')" />
  <v-dialog :model-value="!!deleting" max-width="420" @update:model-value="deleting = null"><v-card><v-card-text>{{ t('bag.deleteItemTemplateConfirm') }}</v-card-text><v-card-actions><v-btn @click="deleting = null">{{ t('common.cancel') }}</v-btn><v-spacer /><v-btn color="error" :disabled="busy" @click="remove">{{ t('bag.remove') }}</v-btn></v-card-actions></v-card></v-dialog>
</template>
<script setup lang="ts">
import { notifications } from '@/shared/services/notifications.service';
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { defineAsyncComponent } from 'vue';
import { computed, ref, watch, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { type BagAction, type BagActionName, type BagField, type BagItem, type BagItemTemplate, type BagSnapshot, type BagTemplate } from '@shared/rooms/bag.types';
import BagItemPreview from '@/features/rooms/components/bags/BagItemPreview.component.vue';
import BagImage from '@/features/rooms/components/bags/BagImage.component.vue';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import BagFieldPicker from '@/features/rooms/components/bags/BagFieldPicker.component.vue';
import BagRaritySelect from '@/features/rooms/components/bags/BagRaritySelect.component.vue';
const BagIconPicker = defineAsyncComponent(() => import('@/features/rooms/components/bags/BagIconPicker.component.vue'));
const open = defineModel<boolean>({ default: false });
const props = defineProps<{ selecting: boolean; bag?: BagSnapshot | null; roomId: string; userId: string; busy: boolean; error: string; memberName: (id: string) => string; mutate: (action: BagActionName, extra?: Partial<BagAction['payload']>) => Promise<unknown>; uploadImage: (file: File) => Promise<string | null> }>();
const emit = defineEmits<{ apply: [preset: BagItemTemplate]; manageFields: [] }>();
const { t } = useI18n();
const imageInput = ref<HTMLInputElement>();
const imageHintId = useId();
function selectImage(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (file) void upload(file); }
const fieldPickerOpen = ref(false);
const panels = ref<string[]>(['general']);
const catalog = ref('mine'), search = ref<string | null>(''), editing = ref<BagItemTemplate | null>(null), deleting = ref<BagItemTemplate | null>(null);
watch(() => !!editing.value, value => { if (!value) fieldPickerOpen.value = false; });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const filtered = computed(() => (!props.selecting || catalog.value === 'mine' ? props.bag?.itemTemplates : props.bag?.publicItemTemplates)?.filter(p => p.name.toLocaleLowerCase().includes((search.value || '').trim().toLocaleLowerCase())) || []);
const fieldTypes = computed(() => ['string', 'integer', 'select', 'multi-select'].map(value => ({ title: t('bag.types.' + value), value })));
function preview(p: BagItemTemplate): BagItem { return { ...p, fields: p.fields.map(f => ({ ...f, value: f.type === 'string' && !f.value ? t('bag.value') : f.value })), creatorId: p.ownerId, sectionId: null }; }
function edit(p?: BagItemTemplate) { panels.value = ['general']; editing.value = p ? clone(p) : { id: '', revision: 0, ownerId: props.userId, public: false, name: '', description: '', displayDescription: false, rarity: 'Common', imageId: null, icon: null, fields: [] }; }
function resetValue(f: BagField) { f.value = f.type === 'integer' ? 0 : f.type === 'multi-select' ? [] : f.type === 'select' ? f.options[0] || '' : ''; }
function addField(value: 'string' | 'integer' | BagTemplate) {
  if (!editing.value || editing.value.fields.length >= 50) return;
  const source = typeof value === 'object' ? value : null;
  const field: BagField = { name: source?.name || '', type: source?.type || value as 'string' | 'integer', options: source ? [...source.options] : [], value: '', display: false };
  resetValue(field);
  editing.value.fields.push(field);
}
async function save() { const p = editing.value; if (p && await props.mutate(p.id ? 'updateBagItemTemplate' : 'createBagItemTemplate', { id: p.id, revision: p.revision, data: p })) editing.value = null; }
async function importPreset(p: BagItemTemplate) { if (await props.mutate('importBagItemTemplate', { id: p.id, revision: p.revision })) catalog.value = 'mine'; }
async function remove() { const p = deleting.value; if (p && await props.mutate('deleteBagItemTemplate', { id: p.id, revision: p.revision })) { if (editing.value?.id === p.id) editing.value = null; deleting.value = null; } }
function reload() { const latest = props.bag?.itemTemplates?.find(p => p.id === editing.value?.id); if (latest) edit(latest); }
async function upload(input: File | File[] | null) { const file = Array.isArray(input) ? input[0] : input; const target = editing.value; if (!file || !target) return; const imageId = await props.uploadImage(file); if (imageId && editing.value === target) target.imageId = imageId; }
watch(open, value => { if (value) { catalog.value = 'mine'; search.value = ''; } else { editing.value = null; deleting.value = null; } });

useErrorNotifications(
  () => props.error,
);
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/bags/bag-item-templates.scss"></style>
<style scoped lang="scss" src="@/assets/styles/features/rooms/bags/bag-editor.scss"></style>
