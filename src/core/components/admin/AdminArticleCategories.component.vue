<template>
  <div>
    <div class="category-heading"><div><h2 class="text-h5">{{ t('articleCategories.manage') }}</h2><p>{{ t('articleCategories.hint') }}</p></div><v-btn color="primary" prepend-icon="mdi-plus" :disabled="busy" @click="edit()">{{ t('articleCategories.add') }}</v-btn></div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}<v-btn variant="text" @click="load">{{ t('articleBrowse.retry') }}</v-btn></v-alert>
    <v-progress-linear v-if="busy" indeterminate />
    <p v-if="!busy && !categories.length">{{ t('articleCategories.empty') }}</p>
    <div class="category-list">
      <div v-for="category in options" :key="category.id" class="category-row" :style="{ marginInlineStart: `${Math.min(category.depth, 6) * 20}px` }" :draggable="!busy" @dragstart="startDrag($event, category)" @dragover="dragOver($event, category)" @drop="drop($event, category)" @dragend="dragId = null">
        <v-icon icon="mdi-drag" aria-hidden="true" />
        <div class="category-label"><strong>{{ category.name }}</strong><small>{{ category.label }}</small><p v-if="category.description">{{ category.description }}</p></div>
        <div class="category-actions">
          <v-btn icon="mdi-arrow-up" size="small" variant="text" :aria-label="t('articleCategories.moveUp', { name: category.name })" :disabled="busy || siblingIndex(category) === 0" @click="move(category, -1)" />
          <v-btn icon="mdi-arrow-down" size="small" variant="text" :aria-label="t('articleCategories.moveDown', { name: category.name })" :disabled="busy || siblingIndex(category) === siblings(category).length - 1" @click="move(category, 1)" />
          <v-btn icon="mdi-pencil-outline" size="small" variant="tonal" :aria-label="t('articleCategories.editNamed', { name: category.name })" :disabled="busy" @click="edit(category)" />
          <v-btn icon="mdi-trash-can-outline" color="error" size="small" variant="text" :aria-label="t('articleCategories.deleteNamed', { name: category.name })" :disabled="busy" @click="removeTarget = category; replacementId = null; error = ''" />
        </div>
      </div>
    </div>
    <v-dialog v-model="formOpen" max-width="560" :persistent="busy" :aria-label="editingId ? t('articleCategories.edit') : t('articleCategories.add')">
      <v-card class="category-dialog"><v-card-title>{{ editingId ? t('articleCategories.edit') : t('articleCategories.add') }}</v-card-title>
        <form @submit.prevent="save"><v-card-text>
          <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
          <v-text-field v-model="name" :label="t('articleCategories.name')" required maxlength="80" autofocus :disabled="busy" />
          <v-textarea v-model="description" :label="t('articleCategories.description')" maxlength="2000" :disabled="busy" rows="3" />
          <v-select class="category-parent" v-model="parentId" :items="parentOptions" item-title="label" item-value="id" :label="t('articleCategories.parent')" clearable :disabled="busy" />
        </v-card-text><v-card-actions><v-spacer /><v-btn :disabled="busy" @click="formOpen = false">{{ t('common.cancel') }}</v-btn><v-btn type="submit" color="primary" :loading="busy" :disabled="!name.trim()">{{ t('common.save') }}</v-btn></v-card-actions></form>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!removeTarget" max-width="560" :persistent="busy" :aria-label="t('articleCategories.delete')" @update:model-value="!$event && (removeTarget = null)">
      <v-card v-if="removeTarget"><v-card-title>{{ t('articleCategories.delete') }}</v-card-title><v-card-text>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <p class="mb-4">{{ t('articleCategories.confirmDelete', { name: removeTarget.name }) }}</p>
        <p>{{ t('articleCategories.liftChildren') }}</p>
        <template v-if="hasAssignments"><p class="my-4">{{ t('articleCategories.migrate', { articles: removeTarget.articleCount ?? 0, drafts: removeTarget.draftCount ?? 0 }) }}</p>
          <v-select class="category-replacement" v-model="replacementId" :items="options.filter(item => item.id !== removeTarget?.id)" item-title="label" item-value="id" :label="t('articleCategories.replacement')" :disabled="busy" />
          <v-alert v-if="categories.length < 2" type="warning">{{ t('articleCategories.lastCategory') }}</v-alert>
        </template>
      </v-card-text><v-card-actions><v-spacer /><v-btn :disabled="busy" @click="removeTarget = null">{{ t('common.cancel') }}</v-btn><v-btn color="error" :loading="busy" :disabled="hasAssignments && !replacementId" @click="remove">{{ t('articleCategories.delete') }}</v-btn></v-card-actions></v-card>
    </v-dialog>
    <span role="status" class="sr-only">{{ status }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleCategory } from 'netlify/core/types/data.types';
import { AdminArticlesService } from 'core/services/articles.service';
import { categoryOptions } from 'core/utils/article-categories';
const { t } = useI18n();
const categories = ref<ArticleCategory[]>([]);
const options = computed(() => categoryOptions(categories.value));
const error = ref('');
const busy = ref(false);
const status = ref('');
const formOpen = ref(false);
const editingId = ref<string>();
const name = ref('');
const description = ref('');
const parentId = ref<string | null>(null);
const removeTarget = ref<ArticleCategory | null>(null);
const replacementId = ref<string | null>(null);
const dragId = ref<string | null>(null);
const hasAssignments = computed(() => Number(removeTarget.value?.articleCount ?? 0) + Number(removeTarget.value?.draftCount ?? 0) > 0);
const parentOptions = computed(() => {
  const excluded = new Set(editingId.value ? [editingId.value] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of categories.value) if (item.parentId && excluded.has(item.parentId) && !excluded.has(item.id)) { excluded.add(item.id); changed = true; }
  }
  return options.value.filter(item => !excluded.has(item.id));
});
async function action(operation: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true; error.value = ''; status.value = '';
  try { await operation(); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : t('articleCategories.error'); }
  finally { busy.value = false; }
}
async function load() { await action(async () => { categories.value = await AdminArticlesService.listCategories(); }); }
function edit(category?: ArticleCategory) {
  editingId.value = category?.id; name.value = category?.name ?? ''; description.value = category?.description ?? '';
  parentId.value = category?.parentId ?? null; error.value = ''; formOpen.value = true;
}
async function save() {
  await action(async () => {
    await AdminArticlesService.saveCategory({ name: name.value, description: description.value || null, parentId: parentId.value }, editingId.value);
    categories.value = await AdminArticlesService.listCategories(); formOpen.value = false;
  });
}
async function remove() {
  if (!removeTarget.value) return;
  const id = removeTarget.value.id;
  await action(async () => {
    try { await AdminArticlesService.deleteCategory(id, replacementId.value ?? undefined); }
    catch (caught) {
      // Assignment counts may change while the confirmation dialog is open.
      try { categories.value = await AdminArticlesService.listCategories(); removeTarget.value = categories.value.find(item => item.id === id) ?? null; } catch { /* Keep the original deletion error. */ }
      throw caught;
    }
    categories.value = await AdminArticlesService.listCategories(); removeTarget.value = null;
  });
}
function siblings(category: ArticleCategory) { return options.value.filter(item => item.parentId === category.parentId); }
function siblingIndex(category: ArticleCategory) { return siblings(category).findIndex(item => item.id === category.id); }
async function reorder(category: ArticleCategory, target: number) {
  const ids = siblings(category).map(item => item.id);
  const current = ids.indexOf(category.id);
  if (target < 0 || target >= ids.length || target === current) return;
  ids.splice(current, 1); ids.splice(target, 0, category.id);
  await action(async () => { await AdminArticlesService.reorderCategories(category.parentId, ids); categories.value = await AdminArticlesService.listCategories(); status.value = t('articleCategories.reordered'); });
}
function move(category: ArticleCategory, delta: number) { return reorder(category, siblingIndex(category) + delta); }
function startDrag(event: DragEvent, category: ArticleCategory) { dragId.value = category.id; event.dataTransfer?.setData('text/plain', category.id); }
function dragOver(event: DragEvent, category: ArticleCategory) { if (categories.value.find(item => item.id === dragId.value)?.parentId === category.parentId) event.preventDefault(); }
function drop(event: DragEvent, category: ArticleCategory) {
  event.preventDefault(); const source = categories.value.find(item => item.id === dragId.value); dragId.value = null;
  if (source && source.parentId === category.parentId) void reorder(source, siblingIndex(category));
}
onMounted(load);
</script>
<style scoped>
.category-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
.category-heading p { margin-top:8px; opacity:.65; font-size:.85rem; }
.category-list { display:grid; gap:10px; }
.category-row { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid rgba(var(--v-theme-primary),.16); border-radius:12px; background:rgb(var(--v-theme-surface)); }
.category-label { min-width:0; flex:1; overflow-wrap:anywhere; }
.category-label small { display:block; opacity:.55; }
.category-label p { font-size:.8rem; margin-top:6px; opacity:.7; }
.category-actions { display:flex; gap:4px; flex-wrap:wrap; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
@media(max-width:599px) { .category-row { flex-wrap:wrap; } .category-actions { width:100%; justify-content:flex-end; } }
</style>
