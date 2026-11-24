<template>
  <div>
    <div class="category-heading"><div><h2 class="text-h5">{{ t('articleCategories.manage') }}</h2><p>{{ t('articleCategories.hint') }}</p></div><v-btn color="primary" prepend-icon="mdi-plus" :disabled="busy" @click="edit()">{{ t('articleCategories.add') }}</v-btn></div>
    <div v-if="error" class="error-recovery-actions"><v-btn variant="text" @click="load">{{ t('articleBrowse.retry') }}</v-btn></div>
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

          <v-tabs v-model="activeLocale" class="editor-language-tabs">
            <v-tab v-for="language in locales" :key="language" :value="language">{{ language === 'en' ? 'Default' : languageName(language) }}</v-tab>
            <v-menu v-if="remainingLocales.length"><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" icon="mdi-plus" variant="text" :disabled="busy" :aria-label="t('articles.editor.addLanguage')" /></template>
              <v-list><v-list-item v-for="language in remainingLocales" :key="language" :title="languageName(language)" @click="addLanguage(language)" /></v-list>
            </v-menu>
          </v-tabs>
          <div v-for="language in locales" v-show="activeLocale === language" :key="language">
            <v-btn v-if="language !== 'en'" size="small" variant="text" color="error" :disabled="busy" @click="removeLanguage(language)">{{ t('articles.editor.removeLanguage') }}</v-btn>
            <v-text-field v-model="translations[language]!.name" :label="t('articleCategories.name')" :aria-label="t('articleCategories.name')" maxlength="80" :disabled="busy" />
            <v-textarea v-model="translations[language]!.description" :label="t('articleCategories.description')" :aria-label="t('articleCategories.description')" maxlength="2000" :disabled="busy" rows="3" />
          </div>
          <AppDropdown class="category-parent" v-model="parentId" :items="parentOptions" item-title="label" item-value="id" :label="t('articleCategories.parent')" clearable :disabled="busy" />
        </v-card-text><v-card-actions><v-spacer /><v-btn :disabled="busy" @click="formOpen = false">{{ t('common.cancel') }}</v-btn><v-btn type="submit" color="primary" :loading="busy" :disabled="busy">{{ t('common.save') }}</v-btn></v-card-actions></form>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!removeTarget" max-width="560" :persistent="busy" :aria-label="t('articleCategories.delete')" @update:model-value="!$event && (removeTarget = null)">
      <v-card v-if="removeTarget"><v-card-title>{{ t('articleCategories.delete') }}</v-card-title><v-card-text>

        <p class="mb-4">{{ t('articleCategories.confirmDelete', { name: removeTarget.name }) }}</p>
        <p>{{ t('articleCategories.liftChildren') }}</p>
        <template v-if="hasAssignments"><p class="my-4">{{ t('articleCategories.migrate', { articles: removeTarget.articleCount ?? 0, drafts: removeTarget.draftCount ?? 0 }) }}</p>
          <AppDropdown class="category-replacement" v-model="replacementId" :items="options.filter(item => item.id !== removeTarget?.id)" item-title="label" item-value="id" :label="t('articleCategories.replacement')" :disabled="busy" />
          <v-alert v-if="categories.length < 2" type="warning">{{ t('articleCategories.lastCategory') }}</v-alert>
        </template>
      </v-card-text><v-card-actions><v-spacer /><v-btn :disabled="busy" @click="removeTarget = null">{{ t('common.cancel') }}</v-btn><v-btn color="error" :loading="busy" :disabled="hasAssignments && !replacementId" @click="remove">{{ t('articleCategories.delete') }}</v-btn></v-card-actions></v-card>
    </v-dialog>
    <span role="status" class="sr-only">{{ status }}</span>
  </div>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { APP_LOCALES, type AppLocale } from 'netlify/core/types/locale.types';
import type { ArticleCategory, ArticleCategoryTranslations } from 'netlify/core/types/data.types';
import { AdminArticlesService } from '@/features/articles/services/articles.service';
import { categoryOptions } from '@/features/articles/utils/article-categories';
const { t, locale } = useI18n();
const categories = ref<ArticleCategory[]>([]);
const options = computed(() => categoryOptions(categories.value));
const error = ref('');
const busy = ref(false);
const status = ref('');
const formOpen = ref(false);
const editingId = ref<string>();
const translations = ref<ArticleCategoryTranslations>({ en: { name: '', description: null } });
const activeLocale = ref<AppLocale>('en');
const locales = computed(() => APP_LOCALES.filter(language => translations.value[language]));
const remainingLocales = computed(() => APP_LOCALES.filter(language => !translations.value[language]));
const languageName = (language: AppLocale) => `${({ en: 'English', fr: 'French', es: 'Spanish', de: 'German' })[language]} (${language})`;
function addLanguage(language: AppLocale) { translations.value[language] = { name: '', description: null }; activeLocale.value = language; }
function removeLanguage(language: AppLocale) {
  if (language === 'en' || !window.confirm(t('articles.editor.confirmRemoveLanguage'))) return;
  delete translations.value[language]; activeLocale.value = 'en';
}
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
async function load() { await action(async () => { await loadCatalog(); }); }
function edit(category?: ArticleCategory) {
  editingId.value = category?.id;
  translations.value = JSON.parse(JSON.stringify(category?.translations ?? { en: { name: category?.name ?? '', description: category?.description ?? null } }));
  activeLocale.value = 'en';
  parentId.value = category?.parentId ?? null; error.value = ''; formOpen.value = true;
}
async function save() {
  for (const language of locales.value) {
    const text = translations.value[language]!;
    if (!text.name.trim() || text.name.trim().length > 80 || (text.description?.length ?? 0) > 2000 || (language === 'en' && text.name.trim().toLowerCase() === 'default')) {
      activeLocale.value = language; error.value = t('articleCategories.invalidTranslation'); return;
    }
  }
  await action(async () => {
    await AdminArticlesService.saveCategory({ translations: translations.value, parentId: parentId.value }, editingId.value);
    await loadCatalog(); formOpen.value = false;
  });
}
async function remove() {
  if (!removeTarget.value) return;
  const id = removeTarget.value.id;
  await action(async () => {
    try { await AdminArticlesService.deleteCategory(id, replacementId.value ?? undefined); }
    catch (caught) {
      // Assignment counts may change while the confirmation dialog is open.
      try { await loadCatalog(); removeTarget.value = categories.value.find(item => item.id === id) ?? null; } catch { /* Keep the original deletion error. */ }
      throw caught;
    }
    await loadCatalog(); removeTarget.value = null;
  });
}
function siblings(category: ArticleCategory) { return options.value.filter(item => item.parentId === category.parentId); }
function siblingIndex(category: ArticleCategory) { return siblings(category).findIndex(item => item.id === category.id); }
async function reorder(category: ArticleCategory, target: number) {
  const ids = siblings(category).map(item => item.id);
  const current = ids.indexOf(category.id);
  if (target < 0 || target >= ids.length || target === current) return;
  ids.splice(current, 1); ids.splice(target, 0, category.id);
  await action(async () => { await AdminArticlesService.reorderCategories(category.parentId, ids); await loadCatalog(); status.value = t('articleCategories.reordered'); });
}
function move(category: ArticleCategory, delta: number) { return reorder(category, siblingIndex(category) + delta); }
function startDrag(event: DragEvent, category: ArticleCategory) { dragId.value = category.id; event.dataTransfer?.setData('text/plain', category.id); }
function dragOver(event: DragEvent, category: ArticleCategory) { if (categories.value.find(item => item.id === dragId.value)?.parentId === category.parentId) event.preventDefault(); }
function drop(event: DragEvent, category: ArticleCategory) {
  event.preventDefault(); const source = categories.value.find(item => item.id === dragId.value); dragId.value = null;
  if (source && source.parentId === category.parentId) void reorder(source, siblingIndex(category));
}
let localeRequest = 0;
async function loadCatalog() {
  const request = ++localeRequest;
  const next = await AdminArticlesService.listCategories(locale.value);
  if (request !== localeRequest) return;
  categories.value = next;
  if (removeTarget.value) removeTarget.value = next.find(item => item.id === removeTarget.value?.id) ?? null;
}
watch(locale, async () => {
  try { await loadCatalog(); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : t('articleCategories.error'); }
});
onMounted(load);

useErrorNotifications(
  () => error.value,
);
</script>
<style scoped>
.editor-language-tabs { margin-bottom: 20px; border-bottom: 1px solid rgba(var(--v-theme-on-surface), .09); }
.editor-language-tabs :deep(.v-slide-group__content) { gap: 6px; padding: 0 0 12px; }
.editor-language-tabs :deep(.v-tab) { min-width: 0; border-radius: 10px 10px 0 0; font-size: .8rem; letter-spacing: .02em; text-transform: none; }
.editor-language-tabs :deep(.v-tab--selected) { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .13); }
.editor-language-tabs :deep(.v-tab__slider) { display: none; }

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
