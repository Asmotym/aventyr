<template>
  <div class="article-editor-workspace">
    <div class="editor-workspace-heading"><span class="editor-workspace-eyebrow">{{ t('articles.editor.workspace') }}</span><v-btn variant="tonal" size="small" prepend-icon="mdi-image-multiple-outline" :aria-label="t('articles.editor.imageLibrary')" @click="libraryOpen = true; loadImages()">{{ t('articles.editor.imageLibrary') }}<span class="image-count ml-2">{{ images.length }}</span></v-btn></div>
    <v-tabs v-model="activeLocale" class="editor-language-tabs">
      <v-tab v-for="locale in locales" :key="locale" :value="locale">{{ locale === 'en' ? 'Default' : languageName(locale) }}</v-tab>
      <v-menu v-if="remainingLocales.length"><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" icon="mdi-plus" variant="text" :aria-label="t('articles.editor.addLanguage')" /></template>
        <v-list><v-list-item v-for="locale in remainingLocales" :key="locale" :title="languageName(locale)" @click="addLanguage(locale)" /></v-list>
      </v-menu>
    </v-tabs>
    <v-row class="editor-workspace-grid">
      <v-col cols="12">
        <div v-for="locale in locales" v-show="activeLocale === locale" :key="locale" class="editor-document">
          <div v-if="locale !== 'en'" class="translation-actions"><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-content-copy" :disabled="!canCopyDefault(locale)" @click="copyDefaultBlocks(locale)">{{ t('articles.editor.copyDefaultBlocks') }}</v-btn><v-btn size="small" variant="text" color="error" @click="removeLanguage(locale)">{{ t('articles.editor.removeLanguage') }}</v-btn></div>
          <v-text-field class="editor-title" variant="outlined" :model-value="translations[locale]?.title" :label="t('articles.fields.title')" maxlength="191" @update:model-value="update(locale, 'title', String($event ?? ''))" />
          <v-tooltip :text="t('articles.editor.introductionHint')" location="top" max-width="340"><template #activator="{ props: helpProps }"><v-textarea v-bind="helpProps" class="editor-introduction" variant="outlined" :model-value="translations[locale]?.introduction" :label="t('articles.fields.introduction')" rows="2" maxlength="1200" auto-grow @update:model-value="update(locale, 'introduction', String($event ?? ''))" /></template></v-tooltip>
          <ArticleBlockEditor :ref="value => setEditor(locale, value)" :model-value="translations[locale]!.document" :session-key="sessionKey" :article-id="articleId" :draft-id="draftId" :prepare-draft="prepareDraft" @update:model-value="update(locale, 'document', $event)" @uploaded="loadImages" />
        </div>
      </v-col>
    </v-row>
    <v-dialog v-model="libraryOpen" class="image-library-dialog" width="360" scrollable :scrim="false" :retain-focus="false" scroll-strategy="none" transition="slide-x-reverse-transition" :aria-label="t('articles.editor.imageLibrary')" aria-modal="false">
      <v-card class="image-library-panel"><v-card-title class="image-panel-heading"><h2>{{ t('articles.editor.imageLibrary') }}</h2><v-btn icon="mdi-close" size="small" variant="text" :aria-label="t('common.close')" @click="libraryOpen = false" /></v-card-title><v-divider /><v-card-text>
        <aside class="image-library">
          <p class="image-library-hint">{{ t('articles.editor.imagesHint') }}</p>
          <v-file-input accept="image/jpeg,image/png,image/webp" :label="t('articles.editor.upload')" :loading="uploading" variant="outlined" density="compact" hide-details class="image-upload" @update:model-value="upload" />
          <v-alert v-if="imageError" type="error" density="compact">{{ imageError }}</v-alert>
          <div v-if="images.length === 0" class="image-library-empty"><v-icon icon="mdi-image-plus-outline" size="32" /><span>{{ t('articles.editor.emptyLibrary') }}</span></div>
          <div v-for="image in images" :key="image.id" class="library-image">
            <button class="library-image-insert" draggable="true" :title="t('articles.editor.insertImage')" :aria-label="t('articles.editor.insertImage')" @dragstart="$event.dataTransfer?.setData('application/x-aventyr-image', image.url)" @click="insertLibraryImage(image.url)">
              <img v-if="previews[image.id]" :src="previews[image.id]" alt=""><span v-else>{{ t('articles.editor.image') }}</span>
            </button>
            <div v-if="image.canDelete !== false" class="library-image-overlay">
              <v-btn icon="mdi-delete" size="small" color="error" :title="t('articles.editor.deleteImage')" :aria-label="t('articles.editor.deleteImage')" :loading="deletingImage === image.id" :disabled="deletingImage !== null" @click.stop="deleteImage(image)" />
            </div>
          </div>
        </aside>
      </v-card-text></v-card>
    </v-dialog>
    <AppDropdown autocomplete v-model:search="tagSearch" v-model:menu="tagMenu" clear-on-select class="editor-tags" variant="outlined" density="comfortable" :model-value="tagIds" :items="tags" item-title="name" item-value="id" :label="t('articles.filterTags')" :placeholder="tagIds.length ? undefined : t('articles.editor.searchTags')" :menu-props="{ contentClass: 'article-tag-selector-menu', maxHeight: 320, offset: 8 }" multiple chips closable-chips prepend-inner-icon="mdi-tag-multiple-outline" hide-details="auto" @update:model-value="emit('update:tagIds', $event)">
      <template #prepend-item><div class="tag-selector-header"><div class="tag-selector-heading"><span>{{ t('articles.fields.tags') }}</span><span class="tag-selector-count">{{ t('articles.editor.selectedTags', { count: tagIds.length }) }}</span></div></div></template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-selected="tagIds.includes(item.value)" class="tag-selector-option" :class="{ 'tag-selector-option-selected': tagIds.includes(item.value) }" :title="item.title">
          <template #prepend><span class="tag-selector-symbol"><v-icon icon="mdi-pound" size="17" /></span></template>
          <template #append><v-icon :icon="tagIds.includes(item.value) ? 'mdi-check-circle' : 'mdi-circle-outline'" size="19" class="tag-selector-check" /></template>
        </v-list-item>
      </template>
      <template #chip="{ props: chipProps, item }"><v-chip v-bind="chipProps" class="editor-tag-chip" color="primary" variant="tonal" size="small" prepend-icon="mdi-pound" :text="item.title" /></template>
      <template #no-data><div class="tag-selector-empty"><v-icon icon="mdi-tag-search-outline" size="28" /><span>{{ tags.length ? t('articles.editor.noMatchingTags') : t('articles.editor.noTagsAvailable') }}</span></div></template>
    </AppDropdown>
    <AppDropdown autocomplete
      v-model:search="categorySearch" v-model:menu="categoryMenu" clear-on-select
      class="editor-categories" :model-value="categoryIds ?? []" :items="categoryItems"
      item-title="label" item-value="id" :label="t('articleCategories.title')"
      :placeholder="categoryIds?.length ? undefined : t('articleCategories.search')"
      :menu-props="{ contentClass: 'article-tag-selector-menu article-category-selector-menu', maxHeight: 360, offset: 8 }"
      prepend-inner-icon="mdi-folder-outline" multiple chips closable-chips clearable
      variant="outlined" density="comfortable" hide-details="auto" @update:model-value="emit('update:categoryIds', $event)"
    >
      <template #prepend-item>
        <div class="tag-selector-header"><div class="tag-selector-heading"><span>{{ t('articleCategories.title') }}</span><span class="tag-selector-count">{{ t('articleCategories.selected', { count: categoryIds?.length ?? 0 }) }}</span></div></div>
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-label="item.title" :aria-selected="categoryIds?.includes(item.value) ?? false"
          class="tag-selector-option category-selector-option" :class="{ 'tag-selector-option-selected': categoryIds?.includes(item.value) }"
          :style="{ marginInlineStart: `${Math.min(item.raw.depth, 4) * 10 + 3}px` }" :title="item.raw.name">
          <template #prepend><span class="tag-selector-symbol"><v-icon :icon="item.raw.parentId ? 'mdi-folder-outline' : 'mdi-folder-multiple-outline'" size="17" /></span></template>
          <template #subtitle>
            <span v-if="item.raw.parentLabel" class="category-selector-path">{{ item.raw.parentLabel }}</span>
            <span v-if="item.raw.description" class="category-selector-description">{{ item.raw.description }}</span>
          </template>
          <template #append><v-icon :icon="categoryIds?.includes(item.value) ? 'mdi-check-circle' : 'mdi-circle-outline'" size="19" class="tag-selector-check" /></template>
        </v-list-item>
      </template>
      <template #chip="{ props: chipProps, item }"><v-chip v-bind="chipProps" class="editor-category-chip" color="primary" variant="tonal" size="small" prepend-icon="mdi-folder-outline" :text="item.title" :title="item.title" /></template>
      <template #no-data><div class="tag-selector-empty"><v-icon icon="mdi-folder-search-outline" size="28" /><span>{{ categoryItems.length ? t('articleCategories.noMatching') : t('articleCategories.noneAvailable') }}</span></div></template>
    </AppDropdown>
  </div>
</template>
<script setup lang="ts">
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleTag, ArticleCategory } from 'netlify/core/types/data.types';
import { APP_LOCALES, type AppLocale } from 'netlify/core/types/locale.types';
import { articleImageIds, emptyDocument, type ArticleDocument, type ArticleTranslations, type ArticleTranslation } from 'netlify/core/articles/document';
import { AdminArticleImagesService, type ArticleImage } from 'core/services/article-images.service';
import { categoryOptions } from 'core/utils/article-categories';
import ArticleBlockEditor from './ArticleBlockEditor.component.vue';
const props = defineProps<{ translations: ArticleTranslations; tagIds: string[]; tags: ArticleTag[]; categories?: ArticleCategory[]; categoryIds?: string[]; articleId?: string; draftId?: string; prepareDraft?: () => Promise<void>; sessionKey?: number }>();
const emit = defineEmits<{ 'update:translations': [value: ArticleTranslations]; 'update:tagIds': [value: string[]]; 'update:categoryIds': [value: string[]] }>();
const { t } = useI18n();
const activeLocale = ref<AppLocale>('en');
const categoryItems = computed(() => {
  const options = categoryOptions(props.categories ?? []);
  const labels = new Map(options.map(item => [item.id, item.label]));
  return options.map(item => ({ ...item, parentLabel: item.parentId ? labels.get(item.parentId) : undefined }));
});
const categorySearch = ref('');
const categoryMenu = ref(false);
const tagSearch = ref('');
const tagMenu = ref(false);
const libraryOpen = ref(false);
function insertLibraryImage(url: string) { editors[activeLocale.value]?.insertImage(url); libraryOpen.value = false; }
const locales = computed(() => APP_LOCALES.filter(locale => props.translations[locale]));
const remainingLocales = computed(() => APP_LOCALES.filter(locale => !props.translations[locale]));
watch(locales, value => { if (!value.includes(activeLocale.value)) activeLocale.value = 'en'; });
const languageName = (locale: AppLocale) => `${({ en: 'English', fr: 'French', es: 'Spanish', de: 'German' })[locale]} (${locale})`;
const editors: Partial<Record<AppLocale, InstanceType<typeof ArticleBlockEditor>>> = {};
function setEditor(locale: AppLocale, value: unknown) { if (value) editors[locale] = value as InstanceType<typeof ArticleBlockEditor>; else delete editors[locale]; }
function addLanguage(locale: AppLocale) { emit('update:translations', { ...props.translations, [locale]: { title: '', introduction: '', document: emptyDocument() } }); activeLocale.value = locale; }
function removeLanguage(locale: AppLocale) { if (!window.confirm(t('articles.editor.confirmRemoveLanguage'))) return; const next = { ...props.translations }; delete next[locale]; activeLocale.value = 'en'; emit('update:translations', next); }
function hasBlocks(document?: ArticleDocument): boolean {
  return Boolean(document?.content.content?.some(node => node.type !== 'paragraph' || node.content?.length || Object.values(node.attrs ?? {}).some(Boolean)));
}
function canCopyDefault(locale: AppLocale): boolean {
  return hasBlocks(props.translations.en?.document) && JSON.stringify(props.translations.en?.document) !== JSON.stringify(props.translations[locale]?.document);
}
function copyDefaultBlocks(locale: AppLocale) {
  if (locale === 'en' || !props.translations[locale] || !canCopyDefault(locale)) return;
  if (hasBlocks(props.translations[locale]?.document) && !window.confirm(t('articles.editor.confirmCopyDefaultBlocks'))) return;
  const document = JSON.parse(JSON.stringify(props.translations.en!.document)) as ArticleDocument;
  update(locale, 'document', document);
}
function update<K extends keyof ArticleTranslation>(locale: AppLocale, key: K, value: ArticleTranslation[K]) { emit('update:translations', { ...props.translations, [locale]: { ...props.translations[locale]!, [key]: value } }); }
const images = ref<ArticleImage[]>([]);
const previews = ref<Record<string, string>>({});
const imageError = ref('');
const uploading = ref(false);
const deletingImage = ref<string | null>(null);
let imageRequest = 0;
async function loadImages() {
  const request = ++imageRequest;
  try {
    const list = await AdminArticleImagesService.list();
    if (request !== imageRequest) return;
    images.value = list;
    const results = await Promise.all(list.map(async image => [image.id, await AdminArticleImagesService.preview(image.id)] as const));
    if (request === imageRequest) previews.value = Object.fromEntries(results);
  } catch (error) { if (request === imageRequest) imageError.value = error instanceof Error ? error.message : t('articles.editor.uploadError'); }
}
async function deleteImage(image: ArticleImage) {
  imageError.value = '';
  if (articleImageIds(props.translations).includes(image.id)) {
    imageError.value = t('articles.editor.imageInUse');
    return;
  }
  deletingImage.value = image.id;
  const scope = [props.articleId, props.draftId];
  try {
    await AdminArticleImagesService.remove(image.id);
    if (scope[0] !== props.articleId || scope[1] !== props.draftId) return;
    await loadImages();
  } catch (error) { imageError.value = error instanceof Error ? error.message : t('articles.editor.deleteImageError'); }
  finally { deletingImage.value = null; }
}
async function upload(value: File | File[] | null) {
  const file = Array.isArray(value) ? value[0] : value;
  if (!file) return;
  uploading.value = true; imageError.value = '';
  try { await AdminArticleImagesService.upload(file, undefined, undefined, true); await loadImages(); }
  catch (error) { imageError.value = error instanceof Error ? error.message : t('articles.editor.uploadError'); }
  finally { uploading.value = false; }
}
watch(() => [props.articleId, props.draftId], loadImages, { immediate: true });
</script>
<style scoped>
.editor-workspace-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px; }
.editor-workspace-eyebrow { color:rgba(var(--v-theme-on-surface),.5); font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; }
.image-library-dialog { align-items:stretch; justify-content:flex-end; }
.image-library-dialog :deep(.v-overlay__content) { margin:0; height:100%; max-height:100%; max-width:100vw; }
.image-library-panel { height:100%; border-radius:0 !important; border-left:1px solid rgba(var(--v-theme-primary),.18); }
.image-panel-heading { display:flex; justify-content:space-between; align-items:center; padding:18px 20px; }
.image-panel-heading h2 { font-size:1.1rem; }
.article-editor-workspace {
  padding: 16px;
  border: 1px solid rgba(var(--v-theme-primary), .2);
  border-radius: 20px;
  background: radial-gradient(ellipse at top left, rgba(var(--v-theme-primary), .09), transparent 60%), rgb(var(--v-theme-surface));
  box-shadow: inset 0 1px 0 rgba(var(--v-theme-on-surface), .05);
}
.editor-language-tabs { margin-bottom: 20px; border-bottom: 1px solid rgba(var(--v-theme-on-surface), .09); }
.editor-language-tabs :deep(.v-slide-group__content) { gap: 6px; padding: 0 0 12px; }
.editor-language-tabs :deep(.v-tab) { min-width: 0; border-radius: 10px 10px 0 0; font-size: .8rem; letter-spacing: .02em; text-transform: none; }
.editor-language-tabs :deep(.v-tab--selected) { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .13); }
.editor-language-tabs :deep(.v-tab__slider) { display: none; }
.editor-workspace-grid { align-items: flex-start; }
.editor-document { min-width: 0; }
.translation-actions { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
.editor-title { margin-bottom: 12px; }
.editor-title :deep(.v-field) { border-radius: 12px; background: rgba(var(--v-theme-primary), .07); }
.editor-title :deep(.v-field__outline) { color: rgba(var(--v-theme-primary), .65); }
.editor-title :deep(input) { font-size: clamp(1.4rem, 2vw, 1.9rem); font-weight: 700; letter-spacing: -.035em; line-height: 1.3; }

.editor-introduction :deep(.v-field) { border-radius: 12px; background: rgba(var(--v-theme-on-surface), .025); }
.editor-introduction :deep(textarea) { font-size: .9rem; line-height: 1.7; }
.editor-tags, .editor-categories { margin-top: 24px; }
:is(.editor-tags, .editor-categories) :deep(.v-field) { border-radius:12px; background:rgba(var(--v-theme-on-surface),.025); transition:background .15s, box-shadow .15s; }
:is(.editor-tags, .editor-categories) :deep(.v-field--focused) { background:rgba(var(--v-theme-primary),.035); box-shadow:0 0 0 3px rgba(var(--v-theme-primary),.06); }
.editor-tags :deep(.v-field__prepend-inner > .v-icon) { color:rgb(var(--v-theme-primary)); opacity:.65; }
.editor-tags :deep(.editor-tag-chip) { border:1px solid rgba(var(--v-theme-primary),.2); border-radius:7px; font-size:.75rem; font-weight:550; }
.editor-tags :deep(.editor-tag-chip .v-chip__prepend .v-icon) { font-size:14px; opacity:.65; }
.editor-categories :deep(.v-field__prepend-inner > .v-icon) { color:rgb(var(--v-theme-primary)); opacity:.65; }
.editor-categories :deep(.editor-category-chip) { max-width:100%; border:1px solid rgba(var(--v-theme-primary),.2); border-radius:7px; font-size:.75rem; font-weight:550; }
.editor-categories :deep(.editor-category-chip .v-chip__content) { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.editor-categories :deep(.editor-category-chip .v-chip__prepend .v-icon) { font-size:14px; opacity:.65; }
.image-library { padding: 0; }
.image-library-heading { display: flex; align-items: center; gap: 8px; color: rgb(var(--v-theme-primary)); }
.image-library-heading h3 { flex: 1; color: rgb(var(--v-theme-on-surface)); font-size: .85rem; font-weight: 650; }
.image-count { min-width: 22px; padding: 2px 6px; border-radius: 6px; background: rgba(var(--v-theme-primary), .12); font-size: .7rem; text-align: center; font-variant-numeric: tabular-nums; }
.image-library-hint { margin: 10px 0 16px; color: rgba(var(--v-theme-on-surface), .6); font-size: .75rem; line-height: 1.6; }
.image-upload { margin-bottom: 16px; }
.image-upload :deep(.v-field) { border-radius: 10px; }
.image-library-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 12px; border: 1px dashed rgba(var(--v-theme-on-surface), .18); border-radius: 12px; color: rgba(var(--v-theme-on-surface), .5); font-size: .75rem; text-align: center; }
.library-image { position: relative; display: block; width: 100%; border: 1px solid rgba(var(--v-theme-on-surface), .12); border-radius: 12px; padding: 6px; margin-bottom: 10px; overflow: hidden; background: rgba(var(--v-theme-on-surface), .04); transition: border-color .15s, box-shadow .15s; }
.library-image:hover, .library-image:focus-within { border-color: rgba(var(--v-theme-primary), .6); box-shadow: 0 4px 14px #0002; }
.library-image-insert { display: block; width: 100%; cursor: grab; }
.library-image-overlay { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: flex-end; padding: 8px; background: linear-gradient(#0007, transparent 65%); opacity: 0; pointer-events: none; transition: opacity .15s; }
.library-image-overlay .v-btn { pointer-events: auto; visibility: hidden; }
.library-image:hover .library-image-overlay, .library-image:focus-within .library-image-overlay { opacity: 1; }
.library-image:hover .library-image-overlay .v-btn, .library-image:focus-within .library-image-overlay .v-btn { visibility: visible; }
.library-image img { display: block; width: 100%; max-height: 180px; border-radius: 7px; object-fit: contain; }
@media (hover: none) { .library-image-overlay { opacity: 1; } .library-image-overlay .v-btn { visibility: visible; } }
@media (max-width: 1279px) { .library-image { display: inline-block; width: 120px; margin-right: 8px; vertical-align: top; } .image-library-empty { padding: 16px; } }
@media (max-width: 600px) { .article-editor-workspace { padding: 10px; border-radius: 14px; } .image-library { padding: 12px; } }
@media (prefers-reduced-motion: reduce) { .library-image, .library-image-overlay { transition: none; } }
</style>

<style>
.article-tag-selector-menu { border:1px solid rgba(var(--v-theme-primary),.2); border-radius:14px !important; box-shadow:0 12px 32px #0004 !important; }
.article-tag-selector-menu > .v-list { padding:6px; background:rgb(var(--v-theme-surface)); }
.article-tag-selector-menu .tag-selector-header { position:sticky; top:-6px; z-index:2; padding:0 6px 10px; margin-bottom:5px; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); background:rgb(var(--v-theme-surface)); }
.article-tag-selector-menu .tag-selector-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 10px 13px; margin-bottom:5px; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); background:rgb(var(--v-theme-surface)); color:rgba(var(--v-theme-on-surface),.55); font-size:.68rem; font-weight:600; letter-spacing:.04em; }
.article-tag-selector-menu .tag-selector-count { padding:3px 7px; border-radius:6px; color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.09); font-size:.65rem; letter-spacing:0; font-weight:500; }
.article-tag-selector-menu .tag-selector-option { min-height:48px; padding:6px 12px; margin:3px 0; border:1px solid transparent; border-radius:10px; transition:background .15s, border-color .15s; }
.article-tag-selector-menu .tag-selector-option .v-list-item-title { font-size:.85rem; font-weight:500; }
.article-tag-selector-menu .tag-selector-symbol { display:grid; place-items:center; width:29px; height:29px; margin-right:12px; border-radius:8px; color:rgba(var(--v-theme-on-surface),.5); background:rgba(var(--v-theme-on-surface),.05); }
.article-tag-selector-menu .tag-selector-check { margin-left:16px; color:rgba(var(--v-theme-on-surface),.23); }
.article-tag-selector-menu .tag-selector-option-selected { color:rgb(var(--v-theme-primary)); border-color:rgba(var(--v-theme-primary),.18); background:rgba(var(--v-theme-primary),.08); }
.article-tag-selector-menu .tag-selector-option-selected .tag-selector-symbol { color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.12); }
.article-tag-selector-menu .tag-selector-option-selected .tag-selector-check { color:rgb(var(--v-theme-primary)); }
.article-tag-selector-menu .tag-selector-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:26px 16px; color:rgba(var(--v-theme-on-surface),.45); font-size:.8rem; text-align:center; }
.article-category-selector-menu .category-selector-option { min-height:54px; }
.article-category-selector-menu .category-selector-option .v-list-item-title { white-space:normal; overflow-wrap:anywhere; }
.article-category-selector-menu .category-selector-option .v-list-item-subtitle { opacity:1; -webkit-line-clamp:unset; }
.article-category-selector-menu .category-selector-path { display:block; margin-top:3px; font-size:.7rem; color:rgba(var(--v-theme-on-surface),.5); overflow-wrap:anywhere; }
.article-category-selector-menu .category-selector-description { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:4px; font-size:.75rem; color:rgba(var(--v-theme-on-surface),.6); }
</style>
