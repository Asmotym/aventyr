<template>
  <nav :aria-label="t('articleCategories.title')" class="article-filters">
    <button type="button" class="article-filters__category-link" :class="{ 'article-filters__category-link--selected': !categoryId }" :aria-current="!categoryId ? 'true' : undefined" @click="emit('update:categoryId', '')"><v-icon icon="mdi-view-grid-outline" size="18" />{{ t('articleBrowse.all') }}</button>
    <button v-for="category in options" :key="category.id" type="button" class="article-filters__category-link" :class="{ 'article-filters__category-link--selected': category.id === categoryId }" :style="{ '--article-filters-category-link-padding-inline-start': `${12 + Math.min(category.depth, 8) * 14}px` }" :title="category.label" :aria-label="category.label" :aria-current="category.id === categoryId ? 'true' : undefined" @click="emit('update:categoryId', category.id)"><v-icon icon="mdi-folder-outline" size="18" /><span>{{ category.name }}</span></button>
  </nav>
  <v-divider class="my-5" />
  <AppDropdown class="article-filters__tag-filter" :model-value="tags" :items="availableTags" item-title="name" item-value="slug" :label="t('articles.filterTags')"
    :menu-props="{ contentClass: 'article-filters__filter-tag-menu', maxHeight: 340, offset: 8 }"
    multiple chips closable-chips clearable variant="outlined" density="comfortable" prepend-inner-icon="mdi-tag-multiple-outline" hide-details
    @update:model-value="emit('update:tags', $event)">
    <template #prepend-item><div class="article-filters__filter-tags-heading"><span>{{ t('articles.fields.tags') }}</span><span class="article-filters__filter-tags-count">{{ t('articles.editor.selectedTags', { count: tags.length }) }}</span></div></template>
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" role="option" :aria-selected="tags.includes(item.value)" class="article-filters__filter-tag-option" :class="{ 'article-filters__filter-tag-option--selected': tags.includes(item.value) }">
        <template #prepend><span class="article-filters__filter-tag-symbol"><v-icon icon="mdi-pound" size="17" aria-hidden="true" /></span></template>
        <template #append><v-icon :icon="tags.includes(item.value) ? 'mdi-check-circle' : 'mdi-circle-outline'" class="article-filters__filter-tag-check" size="19" aria-hidden="true" /></template>
      </v-list-item>
    </template>
    <template #chip="{ props: chipProps, item }"><v-chip v-bind="chipProps" class="article-filters__filter-tag-chip" color="primary" variant="tonal" size="small" prepend-icon="mdi-pound" :text="item.title" /></template>
    <template #no-data><div class="article-filters__filter-tags-empty"><v-icon icon="mdi-tag-outline" size="28" /><span>{{ t('articles.editor.noTagsAvailable') }}</span></div></template>
  </AppDropdown>
</template>
<script setup lang="ts">
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleCategory, ArticleTag } from '@shared/articles/articles.types';
import { categoryOptions } from '@/features/articles/utils/article-categories';
const props = defineProps<{ categories: ArticleCategory[]; categoryId: string; tags: string[]; availableTags: ArticleTag[] }>();
const emit = defineEmits<{ 'update:categoryId': [id: string]; 'update:tags': [tags: string[]] }>();
const { t } = useI18n();
const options = computed(() => categoryOptions(props.categories));
</script>
<style scoped lang="scss" src="@/assets/styles/features/articles/article-filters.scss"></style>
<style lang="scss" src="@/assets/styles/features/articles/article-filters.global.scss"></style>
