<template>
  <nav :aria-label="t('articleCategories.title')" class="article-category-nav">
    <button type="button" class="category-link" :class="{ selected: !categoryId }" :aria-current="!categoryId ? 'true' : undefined" @click="emit('update:categoryId', '')"><v-icon icon="mdi-view-grid-outline" size="18" />{{ t('articleBrowse.all') }}</button>
    <button v-for="category in options" :key="category.id" type="button" class="category-link" :class="{ selected: category.id === categoryId }" :style="{ paddingInlineStart: `${12 + Math.min(category.depth, 8) * 14}px` }" :title="category.label" :aria-label="category.label" :aria-current="category.id === categoryId ? 'true' : undefined" @click="emit('update:categoryId', category.id)"><v-icon icon="mdi-folder-outline" size="18" /><span>{{ category.name }}</span></button>
  </nav>
  <v-divider class="my-5" />
  <v-select class="article-tag-filter" :model-value="tags" :items="availableTags" item-title="name" item-value="slug" :label="t('articles.filterTags')"
    :menu-props="{ contentClass: 'article-filter-tag-menu', maxHeight: 340, offset: 8 }"
    multiple chips closable-chips clearable variant="outlined" density="comfortable" prepend-inner-icon="mdi-tag-multiple-outline" hide-details
    @update:model-value="emit('update:tags', $event)">
    <template #prepend-item><div class="filter-tags-heading"><span>{{ t('articles.fields.tags') }}</span><span class="filter-tags-count">{{ t('articles.editor.selectedTags', { count: tags.length }) }}</span></div></template>
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" role="option" :aria-selected="tags.includes(item.value)" class="filter-tag-option" :class="{ 'filter-tag-selected': tags.includes(item.value) }">
        <template #prepend><span class="filter-tag-symbol"><v-icon icon="mdi-pound" size="17" aria-hidden="true" /></span></template>
        <template #append><v-icon :icon="tags.includes(item.value) ? 'mdi-check-circle' : 'mdi-circle-outline'" class="filter-tag-check" size="19" aria-hidden="true" /></template>
      </v-list-item>
    </template>
    <template #chip="{ props: chipProps, item }"><v-chip v-bind="chipProps" class="filter-tag-chip" color="primary" variant="tonal" size="small" prepend-icon="mdi-pound" :text="item.title" /></template>
    <template #no-data><div class="filter-tags-empty"><v-icon icon="mdi-tag-outline" size="28" /><span>{{ t('articles.editor.noTagsAvailable') }}</span></div></template>
  </v-select>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleCategory, ArticleTag } from 'netlify/core/types/data.types';
import { categoryOptions } from 'core/utils/article-categories';
const props = defineProps<{ categories: ArticleCategory[]; categoryId: string; tags: string[]; availableTags: ArticleTag[] }>();
const emit = defineEmits<{ 'update:categoryId': [id: string]; 'update:tags': [tags: string[]] }>();
const { t } = useI18n();
const options = computed(() => categoryOptions(props.categories));
</script>
<style scoped>
.article-category-nav { display:grid; gap:5px; }
.category-link { display:flex; align-items:center; gap:10px; padding:12px; text-align:start; border:1px solid transparent; border-radius:10px; font-size:.9rem; overflow-wrap:anywhere; }
.category-link:hover, .category-link:focus-visible { background:rgba(var(--v-theme-primary),.06); }
.category-link.selected { color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.1); border-color:rgba(var(--v-theme-primary),.2); }
.article-tag-filter :deep(.v-field) { border-radius:12px; background:rgba(var(--v-theme-primary),.035); }
.article-tag-filter :deep(.v-field__prepend-inner > .v-icon) { color:rgb(var(--v-theme-primary)); opacity:.7; }
.article-tag-filter :deep(.filter-tag-chip) { max-width:100%; border:1px solid rgba(var(--v-theme-primary),.18); border-radius:7px; font-size:.75rem; }
.article-tag-filter :deep(.filter-tag-chip .v-chip__content) { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
</style>
<style>
.article-filter-tag-menu { border:1px solid rgba(var(--v-theme-primary),.2); border-radius:14px !important; box-shadow:0 12px 32px #0003 !important; }
.article-filter-tag-menu > .v-list { padding:6px; background:rgb(var(--v-theme-surface)); }
.article-filter-tag-menu .filter-tags-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px 14px; margin-bottom:6px; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); font-size:.7rem; font-weight:600; color:rgba(var(--v-theme-on-surface),.6); }
.article-filter-tag-menu .filter-tags-count { padding:3px 7px; border-radius:6px; color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.09); white-space:nowrap; }
.article-filter-tag-menu .filter-tag-option { min-height:48px; margin:3px 0; padding:6px 12px; border:1px solid transparent; border-radius:10px; }
.article-filter-tag-menu .filter-tag-option .v-list-item-title { font-size:.85rem; font-weight:500; white-space:normal; overflow-wrap:anywhere; }
.article-filter-tag-menu .filter-tag-symbol { display:grid; place-items:center; width:29px; height:29px; margin-inline-end:12px; border-radius:8px; color:rgba(var(--v-theme-on-surface),.5); background:rgba(var(--v-theme-on-surface),.05); }
.article-filter-tag-menu .filter-tag-check { margin-inline-start:16px; color:rgba(var(--v-theme-on-surface),.3); }
.article-filter-tag-menu .filter-tag-selected { color:rgb(var(--v-theme-primary)); border-color:rgba(var(--v-theme-primary),.18); background:rgba(var(--v-theme-primary),.08); }
.article-filter-tag-menu .filter-tag-selected .filter-tag-check { color:rgb(var(--v-theme-primary)); }
.article-filter-tag-menu .filter-tags-empty { display:flex; align-items:center; flex-direction:column; gap:10px; padding:26px 16px; color:rgba(var(--v-theme-on-surface),.6); font-size:.8rem; text-align:center; }
</style>
