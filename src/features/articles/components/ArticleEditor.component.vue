<template>
  <div class="article-editor">
    <div class="article-editor__workspace-heading"><span class="article-editor__workspace-eyebrow">{{ t('articles.editor.workspace') }}</span><v-btn variant="tonal" size="small" prepend-icon="mdi-image-multiple-outline" :aria-label="t('articles.editor.imageLibrary')" @click="libraryOpen = true; loadImages()">{{ t('articles.editor.imageLibrary') }}<span class="article-editor__image-count ml-2">{{ images.length }}</span></v-btn></div>
    <v-tabs v-model="activeLocale" class="article-language-tabs">
      <v-tab v-for="locale in locales" :key="locale" :value="locale">{{ locale === 'en' ? 'Default' : languageName(locale) }}</v-tab>
      <v-menu v-if="remainingLocales.length"><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" icon="mdi-plus" variant="text" :aria-label="t('articles.editor.addLanguage')" /></template>
        <v-list><v-list-item v-for="locale in remainingLocales" :key="locale" :title="languageName(locale)" @click="addLanguage(locale)" /></v-list>
      </v-menu>
    </v-tabs>
    <v-row class="article-editor__workspace-grid">
      <v-col cols="12">
        <div v-for="locale in locales" v-show="activeLocale === locale" :key="locale" class="article-editor__document">
          <div v-if="locale !== 'en'" class="article-editor__translation-actions"><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-content-copy" :disabled="!canCopyDefault(locale)" @click="copyDefaultBlocks(locale)">{{ t('articles.editor.copyDefaultBlocks') }}</v-btn><v-btn size="small" variant="text" color="error" @click="removeLanguage(locale)">{{ t('articles.editor.removeLanguage') }}</v-btn></div>
          <v-text-field class="article-editor__title" variant="outlined" :model-value="translations[locale]?.title" :label="t('articles.fields.title')" maxlength="191" @update:model-value="update(locale, 'title', String($event ?? ''))" />
          <v-tooltip :text="t('articles.editor.introductionHint')" location="top" max-width="340"><template #activator="{ props: helpProps }"><v-textarea v-bind="helpProps" class="article-editor__introduction" variant="outlined" :model-value="translations[locale]?.introduction" :label="t('articles.fields.introduction')" rows="2" maxlength="1200" auto-grow @update:model-value="update(locale, 'introduction', String($event ?? ''))" /></template></v-tooltip>
          <ArticleBlockEditor :active="activeLocale === locale" :ref="value => setEditor(locale, value)" :model-value="translations[locale]!.document" :session-key="sessionKey" :article-id="articleId" :draft-id="draftId" :prepare-draft="prepareDraft" @update:model-value="update(locale, 'document', $event)" @uploaded="loadImages" />
        </div>
      </v-col>
    </v-row>
    <v-dialog v-model="libraryOpen" class="article-editor__image-library-dialog" width="360" scrollable :scrim="false" :retain-focus="false" scroll-strategy="none" transition="slide-x-reverse-transition" :aria-label="t('articles.editor.imageLibrary')" aria-modal="false">
      <v-card class="article-editor__image-library-panel"><v-card-title class="article-editor__image-panel-heading"><h2>{{ t('articles.editor.imageLibrary') }}</h2><AppCloseButton size="small" @click="libraryOpen = false" /></v-card-title><v-divider /><v-card-text>
        <aside class="article-editor__image-library">
          <p class="article-editor__image-library-hint">{{ t('articles.editor.imagesHint') }}</p>
          <v-file-input accept="image/jpeg,image/png,image/webp" :label="t('articles.editor.upload')" :loading="uploading" variant="outlined" density="compact" hide-details class="article-editor__image-upload" @update:model-value="upload" />

          <div v-if="images.length === 0" class="article-editor__image-library-empty"><v-icon icon="mdi-image-plus-outline" size="32" /><span>{{ t('articles.editor.emptyLibrary') }}</span></div>
          <div v-for="image in images" :key="image.id" class="article-editor__library-image">
            <button class="article-editor__library-image-insert" draggable="true" :title="t('articles.editor.insertImage')" :aria-label="t('articles.editor.insertImage')" @dragstart="$event.dataTransfer?.setData('application/x-aventyr-image', image.url)" @click="insertLibraryImage(image.url)">
              <img v-if="previews[image.id]" :src="previews[image.id]" alt=""><span v-else>{{ t('articles.editor.image') }}</span>
            </button>
            <div v-if="image.canDelete !== false" class="article-editor__library-image-overlay">
              <v-btn icon="mdi-delete" size="small" color="error" :title="t('articles.editor.deleteImage')" :aria-label="t('articles.editor.deleteImage')" :loading="deletingImage === image.id" :disabled="deletingImage !== null" @click.stop="deleteImage(image)" />
            </div>
          </div>
        </aside>
      </v-card-text></v-card>
    </v-dialog>
    <AppDropdown autocomplete v-model:search="tagSearch" v-model:menu="tagMenu" clear-on-select class="article-editor__tags" variant="outlined" density="comfortable" :model-value="tagIds" :items="tags" item-title="name" item-value="id" :label="t('articles.filterTags')" :placeholder="tagIds.length ? undefined : t('articles.editor.searchTags')" :menu-props="{ contentClass: 'article-editor__tag-selector-menu', maxHeight: 320, offset: 8 }" multiple chips closable-chips prepend-inner-icon="mdi-tag-multiple-outline" hide-details="auto" @update:model-value="emit('update:tagIds', $event)">
      <template #prepend-item><div class="article-editor__tag-selector-header"><div class="article-editor__tag-selector-heading"><span>{{ t('articles.fields.tags') }}</span><span class="article-editor__tag-selector-count">{{ t('articles.editor.selectedTags', { count: tagIds.length }) }}</span></div></div></template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-selected="tagIds.includes(item.value)" class="article-editor__tag-selector-option" :class="{ 'article-editor__tag-selector-option--selected': tagIds.includes(item.value) }" :title="item.title">
          <template #prepend><span class="article-editor__tag-selector-symbol"><v-icon icon="mdi-pound" size="17" /></span></template>
          <template #append><v-icon :icon="tagIds.includes(item.value) ? 'mdi-check-circle' : 'mdi-circle-outline'" size="19" class="article-editor__tag-selector-check" /></template>
        </v-list-item>
      </template>
      <template #chip="{ props: chipProps, item }"><v-chip v-bind="chipProps" class="article-editor__tag-chip" color="primary" variant="tonal" size="small" prepend-icon="mdi-pound" :text="item.title" /></template>
      <template #no-data><div class="article-editor__tag-selector-empty"><v-icon icon="mdi-tag-search-outline" size="28" /><span>{{ tags.length ? t('articles.editor.noMatchingTags') : t('articles.editor.noTagsAvailable') }}</span></div></template>
    </AppDropdown>
    <AppDropdown autocomplete
      v-model:search="categorySearch" v-model:menu="categoryMenu" clear-on-select
      class="article-editor__categories" :model-value="categoryIds ?? []" :items="categoryItems"
      item-title="label" item-value="id" :label="t('articleCategories.title')"
      :placeholder="categoryIds?.length ? undefined : t('articleCategories.search')"
      :menu-props="{ contentClass: 'article-editor__tag-selector-menu   article-editor__category-selector-menu', maxHeight: 360, offset: 8 }"
      prepend-inner-icon="mdi-folder-outline" multiple chips closable-chips clearable
      variant="outlined" density="comfortable" hide-details="auto" @update:model-value="emit('update:categoryIds', $event)"
    >
      <template #prepend-item>
        <div class="article-editor__tag-selector-header"><div class="article-editor__tag-selector-heading"><span>{{ t('articleCategories.title') }}</span><span class="article-editor__tag-selector-count">{{ t('articleCategories.selected', { count: categoryIds?.length ?? 0 }) }}</span></div></div>
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-label="item.title" :aria-selected="categoryIds?.includes(item.value) ?? false"
          class="article-editor__tag-selector-option article-editor__category-selector-option" :class="{ 'article-editor__tag-selector-option--selected': categoryIds?.includes(item.value) }"
          :style="{ marginInlineStart: `${Math.min(item.raw.depth, 4) * 10 + 3}px` }" :title="item.raw.name">
          <template #prepend><span class="article-editor__tag-selector-symbol"><v-icon :icon="item.raw.parentId ? 'mdi-folder-outline' : 'mdi-folder-multiple-outline'" size="17" /></span></template>
          <template #subtitle>
            <span v-if="item.raw.parentLabel" class="article-editor__category-selector-path">{{ item.raw.parentLabel }}</span>
            <span v-if="item.raw.description" class="article-editor__category-selector-description">{{ item.raw.description }}</span>
          </template>
          <template #append><v-icon :icon="categoryIds?.includes(item.value) ? 'mdi-check-circle' : 'mdi-circle-outline'" size="19" class="article-editor__tag-selector-check" /></template>
        </v-list-item>
      </template>
      <template #chip="{ props: chipProps, item }"><v-chip v-bind="chipProps" class="article-editor__category-chip" color="primary" variant="tonal" size="small" prepend-icon="mdi-folder-outline" :text="item.title" :title="item.title" /></template>
      <template #no-data><div class="article-editor__tag-selector-empty"><v-icon icon="mdi-folder-search-outline" size="28" /><span>{{ categoryItems.length ? t('articleCategories.noMatching') : t('articleCategories.noneAvailable') }}</span></div></template>
    </AppDropdown>
  </div>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleTag, ArticleCategory } from '@shared/articles/articles.types';
import { APP_LOCALES, type AppLocale } from '@shared/accounts/locale.types';
import { articleImageIds, emptyDocument, type ArticleDocument, type ArticleTranslations, type ArticleTranslation } from '@shared/articles/document';
import { AdminArticleImagesService, type ArticleImage } from '@/features/articles/services/article-images.service';
import { categoryOptions } from '@/features/articles/utils/article-categories';
import ArticleBlockEditor from '@/features/articles/components/ArticleBlockEditor.component.vue';
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

useErrorNotifications(
  () => imageError.value,
);
</script>
<style scoped lang="scss" src="@/assets/styles/features/articles/article-editor.scss"></style>

<style lang="scss" src="@/assets/styles/features/articles/article-editor.global.scss"></style>
