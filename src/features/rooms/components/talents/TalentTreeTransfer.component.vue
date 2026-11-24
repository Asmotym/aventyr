<template>
  <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="readFile" />
  <v-snackbar v-model="noticeOpen" :timeout="5000">{{ notice }}<template #actions><v-btn variant="text" @click="noticeOpen = false">{{ t('common.close') }}</v-btn></template></v-snackbar>
  <v-dialog v-model="pasteOpen" max-width="680" scrollable :persistent="busy" :aria-label="t('talents.transfer.clipboardImport')">
    <v-card class="talents-ui talent-popup"><v-card-title class="talent-popup-heading"><span class="talent-popup-icon"><v-icon icon="mdi-clipboard-text-outline" size="28" /></span><h2>{{ t('talents.transfer.clipboardImport') }}</h2><AppCloseButton @click="pasteOpen = false" /></v-card-title><v-card-text class="talent-popup-body"><p class="transfer-hint">{{ t('talents.transfer.pasteHint') }}</p><v-textarea v-model="pasteText" :label="t('talents.transfer.jsonText')" variant="outlined" rows="10" class="transfer-json" /></v-card-text><v-card-actions class="talent-popup-footer"><v-btn variant="text" @click="pasteOpen = false">{{ t('common.cancel') }}</v-btn><v-spacer /><v-btn variant="flat" color="primary" :disabled="!pasteText.trim()" @click="review(pasteText)">{{ t('talents.transfer.review') }}</v-btn></v-card-actions></v-card>
  </v-dialog>
  <v-dialog :model-value="!!plan" max-width="680" scrollable :persistent="busy" :aria-label="t(step === 'name' ? 'talents.transfer.chooseName' : 'talents.transfer.review')" @update:model-value="!$event && !busy && (plan = null)">
    <v-card v-if="plan" class="talents-ui talent-popup"><v-card-title class="talent-popup-heading"><span class="talent-popup-icon"><v-icon icon="mdi-file-import-outline" size="28" /></span><h2>{{ t(step === 'name' ? 'talents.transfer.chooseName' : 'talents.transfer.review') }}</h2><AppCloseButton :disabled="busy" @click="plan = null" /></v-card-title><v-divider /><v-card-text class="talent-popup-body">

      <template v-if="step === 'preview'"><h3 class="transfer-title">{{ plan.tree.name }}</h3><p class="transfer-hint">{{ t('talents.layouts.' + plan.tree.layout) }} · {{ t('talents.transfer.completeSettings') }}</p><div class="transfer-summary"><div v-for="(count, key) in summary" :key="key"><v-icon :icon="summaryIcons[key]" size="22" /><strong>{{ count }}</strong><span>{{ t('talents.transfer.counts.' + key) }}</span></div></div><p v-if="plan.tree.description" class="transfer-description">{{ plan.tree.description }}</p><section v-if="plan.missingParentId" class="transfer-parent"><v-alert type="info" variant="tonal" class="mt-4">{{ t('talents.transfer.missingParent') }}</v-alert><AppDropdown v-model="parentChoice" :items="parentChoices" :label="t('talents.transfer.importParent')" variant="outlined" :disabled="busy" hide-details class="mt-4" /></section><v-alert v-if="plan.disconnected" type="warning" variant="tonal" class="mt-4">{{ t('talents.transfer.disconnected', { count: plan.disconnected }) }}</v-alert><v-alert v-if="plan.missingImages" type="warning" variant="tonal" class="mt-4">{{ t('talents.transfer.unavailableImages', { count: plan.missingImages }) }}</v-alert><v-alert v-if="catalog.length >= 50" type="warning" variant="tonal" class="mt-4">{{ t('talents.transfer.treeLimit') }}</v-alert></template>
      <template v-else><v-alert type="info" variant="tonal" class="mb-5">{{ t('talents.transfer.duplicate', { name: plan.tree.name }) }}</v-alert><v-text-field v-model="importName" :label="t('talents.name')" :maxlength="200" variant="outlined" :disabled="busy" :error="!!(nameDuplicate)" /><p class="transfer-hint">{{ t('talents.transfer.keepHint') }}</p></template>
    </v-card-text><v-card-actions class="talent-popup-footer transfer-footer"><v-btn variant="text" :disabled="busy" @click="plan = null">{{ t('common.cancel') }}</v-btn><v-spacer /><v-btn v-if="step === 'name'" variant="text" :disabled="busy || service.state.busy || catalog.length >= 50 || !parentResolved" @click="finish(plan.tree.name)">{{ t('talents.transfer.keepName') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-file-import-outline" :loading="busy" :disabled="service.state.busy || catalog.length >= 50 || !parentResolved || (step === 'name' && (!importName.trim() || nameDuplicate))" @click="confirmImport">{{ t('talents.transfer.importTree') }}</v-btn></v-card-actions></v-card>
  </v-dialog>
  <v-dialog v-model="copyOpen" max-width="680" scrollable :aria-label="t('talents.transfer.copyJSON')"><v-card class="talents-ui talent-popup"><v-card-title class="talent-popup-heading"><h2>{{ t('talents.transfer.copyJSON') }}</h2></v-card-title><v-card-text class="talent-popup-body"><p class="transfer-hint">{{ t('talents.transfer.copyManually') }}</p><v-textarea :model-value="copyText" :label="t('talents.transfer.jsonText')" readonly variant="outlined" rows="12" class="transfer-json" @focus="($event.target as HTMLTextAreaElement).select()" /></v-card-text><v-card-actions class="talent-popup-footer"><v-spacer /><v-btn @click="copyOpen = false">{{ t('common.close') }}</v-btn></v-card-actions></v-card></v-dialog>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { unref } from 'vue';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TalentTree } from '@shared/rooms/talents.types';
import { validateTalentTree, validateTalentCatalog } from '@shared/rooms/talents';
import { TALENT_TRANSFER_LIMIT, TalentTransferError, parseTalentExport, prepareTalentImport, duplicateTalentName, talentImageIds, talentImportSummary, type TalentTreeExport } from '@shared/rooms/talent-transfer';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { talentRoom, talentImageRequest } from '@/features/rooms/services/talents.service';
const props = defineProps<{ roomId: string; userId: string }>();
const emit = defineEmits<{ imported: [] }>();
const { t } = useI18n(), service = talentRoom(props.roomId, props.userId);
const catalog = computed(() => service.state.snapshot?.trees ?? []);
const fileInput = ref<HTMLInputElement>(), busy = ref(false), pasteOpen = ref(false), pasteText = ref(''), error = ref(''), copyOpen = ref(false), copyText = ref('');
const notice = ref(''), noticeOpen = ref(false), step = ref<'preview' | 'name'>('preview'), importName = ref('');
const plan = ref<(ReturnType<typeof prepareTalentImport> & { data: TalentTreeExport }) | null>(null);
const parentChoice = ref<string | null>(null);
const parentChoices = computed(() => [{ title: t('talents.transfer.noParent'), value: 'none', icon: 'mdi-file-tree-outline' }, ...catalog.value.map(tree => ({ title: tree.name, value: 'tree:' + tree.id, icon: tree.icon || 'mdi-file-tree-outline' }))]);
const parentResolved = computed(() => !plan.value?.missingParentId || parentChoice.value === 'none' || catalog.value.some(tree => parentChoice.value === 'tree:' + tree.id));
const uploadedImages = new Map<string, string>();
const summary = computed(() => plan.value ? talentImportSummary(plan.value.tree) : null);
const nameDuplicate = computed(() => duplicateTalentName(importName.value, catalog.value));
const summaryIcons = { nodes: 'mdi-star-four-points-outline', ranks: 'mdi-stairs-up', connections: 'mdi-vector-polyline', subtrees: 'mdi-layers-outline', shapes: 'mdi-shape-outline', images: 'mdi-image-outline' };
function notify(message: string) { notice.value = message; noticeOpen.value = true; }
function message(cause: unknown) { return cause instanceof TalentTransferError ? t('talents.transfer.' + cause.code) : cause instanceof Error ? cause.message : t('talents.transfer.invalidJSON'); }
function openFile() { if (!busy.value) fileInput.value?.click(); }
async function readFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
  if (!file) return;
  try { if (file.size > TALENT_TRANSFER_LIMIT) throw new TalentTransferError('tooLarge'); review(await file.text()); } catch (cause) { notify(message(cause)); }
}
async function openClipboard() {
  if (busy.value) return;
  pasteText.value = ''; error.value = ''; pasteOpen.value = true;
  try { const text = await navigator.clipboard.readText(); if (pasteOpen.value && !pasteText.value) pasteText.value = text; } catch { /* Manual paste remains available when clipboard permission is denied. */ }
}
function review(text: string) {
  error.value = '';
  try { const data = parseTalentExport(text); const prepared = prepareTalentImport(data, catalog.value, crypto.randomUUID()); validateTalentCatalog([...catalog.value, prepared.tree]); plan.value = { ...prepared, data }; uploadedImages.clear(); parentChoice.value = null; step.value = 'preview'; pasteOpen.value = false; }
  catch (cause) { if (pasteOpen.value) error.value = message(cause); else notify(message(cause)); }
}
function confirmImport() {
  if (!plan.value || busy.value || !parentResolved.value) return;
  if (step.value === 'preview' && duplicateTalentName(plan.value.tree.name, catalog.value)) {
    step.value = 'name'; let suffix = 2; const base = plan.value.tree.name.slice(0, 190); do { importName.value = `${base} (${suffix++})`; } while (duplicateTalentName(importName.value, catalog.value)); return;
  }
  void finish(step.value === 'name' ? importName.value.trim() : plan.value.tree.name);
}
async function finish(name: string) {
  if (!plan.value || busy.value || service.state.busy || catalog.value.length >= 50 || !parentResolved.value) return;
  busy.value = true; error.value = '';
  try {
    const tree = JSON.parse(JSON.stringify(plan.value.tree)) as TalentTree; tree.name = name.trim();
    if (plan.value.missingParentId) tree.parentTreeId = parentChoice.value === 'none' ? null : parentChoice.value!.slice(5);
    validateTalentTree(tree); validateTalentCatalog([...catalog.value, tree]);
    for (const id of talentImageIds(tree)) if (Object.prototype.hasOwnProperty.call(plan.value.data.images, id) && !uploadedImages.has(id)) {
      const image = plan.value.data.images[id]!; const bytes = Uint8Array.from(atob(image.data), character => character.charCodeAt(0));
      const response = await talentImageRequest(props.roomId, undefined, new File([bytes], 'talent-image', { type: image.type })); uploadedImages.set(id, (await response.json()).data.id);
    }
    for (const target of [tree, ...tree.nodes, ...tree.subtrees]) if (target.imageId && uploadedImages.has(target.imageId)) target.imageId = uploadedImages.get(target.imageId)!;
    const result = await service.mutate({ op: 'save', tree });
    if (result && !result.resetRequired) { plan.value = null; emit('imported'); notify(t('talents.transfer.imported', { name: tree.name })); }
  } catch (cause) { error.value = message(cause); }
  finally { busy.value = false; }
}
async function exportTree(tree: TalentTree, action: 'download' | 'clipboard') {
  if (busy.value) return;
  busy.value = true;
  try {
    const data: TalentTreeExport = { format: 'aventyr-talent-tree', version: 1, tree: JSON.parse(JSON.stringify(tree)), images: {} };
    for (const id of talentImageIds(tree)) {
      const response = await talentImageRequest(props.roomId, id), bytes = new Uint8Array(await response.arrayBuffer());
      let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      data.images[id] = { type: 'image/webp', data: btoa(binary) };
    }
    const text = JSON.stringify(data, null, 2); if (new TextEncoder().encode(text).length > TALENT_TRANSFER_LIMIT) throw new TalentTransferError('tooLarge');
    if (action === 'download') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
      link.href = url; link.download = `${tree.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 120) || 'talent-tree'}.json`; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); notify(t('talents.transfer.downloaded'));
    } else {
      try { await navigator.clipboard.writeText(text); notify(t('talents.transfer.copied')); }
      catch { copyText.value = text; copyOpen.value = true; }
    }
  } catch (cause) { notify(message(cause)); }
  finally { busy.value = false; }
}
defineExpose({ exportTree, openFile, openClipboard, busy });

useErrorNotifications(
  () => error.value,
  () => nameDuplicate.value ? unref(t)('talents.transfer.nameTaken') : [],
);
</script>
<style scoped>
.talent-popup-heading > h2 { flex:1; min-width:0; }
.transfer-hint { color:var(--talent-muted); font-size:12px; line-height:1.7; margin-bottom:18px; }.transfer-title { font-size:20px; overflow-wrap:anywhere; margin-bottom:8px; }.transfer-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }.transfer-summary > div { display:flex; flex-direction:column; align-items:center; gap:6px; padding:18px 8px; border:1px solid var(--talent-border); border-radius:12px; background:var(--talent-tint); }.transfer-summary .v-icon { color:rgb(var(--v-theme-primary)); }.transfer-summary strong { font-size:23px; font-variant-numeric:tabular-nums; }.transfer-summary span { font-size:11px; color:var(--talent-muted); }.transfer-description { white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; line-height:1.7; margin-top:18px; max-height:140px; overflow:auto; }.transfer-json :deep(textarea) { font-family:monospace; font-size:12px; }.transfer-footer { flex-wrap:wrap; }
@media(max-width:500px) { .transfer-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }.transfer-footer .v-btn { font-size:11px; } }
</style>
