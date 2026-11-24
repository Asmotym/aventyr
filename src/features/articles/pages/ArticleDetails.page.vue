<template>
  <HeaderComponent />
  <v-container class="py-6 article-details__page">
    <nav class="article-details__reader-navigation" :aria-label="t('articles.title')">
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" :to="{ name: HomeRoutes.Articles }">{{ t('admin.writer.back') }}</v-btn>
      <span class="article-details__reader-eyebrow">{{ t('articleBrowse.eyebrow') }}</span>
    </nav>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" :aria-label="t('articleBrowse.loading')" />

    <article v-if="article" :lang="article.resolvedLocale" class="article-details__card" aria-labelledby="article-title">
      <header class="article-details__reader-header">
        <div v-if="article.categories?.length" class="article-details__reader-categories">
          <v-chip v-for="category in article.categories" :key="category.id" size="small" color="primary" variant="tonal" :to="categoryPath(categoryCatalog, category.id)" prepend-icon="mdi-folder-outline">{{ category.name }}</v-chip>
        </div>
        <h1 id="article-title">{{ article.title }}</h1>
        <p v-if="article.introduction" class="article-details__reader-introduction">{{ article.introduction }}</p>
        <div class="article-details__reader-metadata">
          <span><v-icon icon="mdi-calendar-outline" size="17" aria-hidden="true" /><time :datetime="article.publishedAt ?? article.createdAt">{{ formatDate(article.publishedAt ?? article.createdAt) }}</time></span>
          <span v-if="article.authorName"><v-icon icon="mdi-account-circle-outline" size="18" aria-hidden="true" />{{ article.authorName }}</span>
        </div>
      </header>
      <div class="article-details__reader-body">
        <v-alert v-if="article.requestedLocale !== article.resolvedLocale" type="info" variant="tonal" class="mb-6">{{ t('articles.languageFallback') }}</v-alert>
        <RenderedArticle :html="article.sanitizedHtml" class="article-details__reader-content" />
      </div>
      <footer v-if="article.tags.length" class="article-details__reader-footer" :aria-label="t('articles.fields.tags')">
        <span class="article-details__reader-tags-label"><v-icon icon="mdi-tag-multiple-outline" size="17" aria-hidden="true" />{{ t('articles.fields.tags') }}</span>
        <div class="article-details__reader-tags"><v-chip v-for="tag in article.tags" :key="tag.id" size="small" color="primary" variant="tonal" prepend-icon="mdi-pound">{{ tag.name }}</v-chip></div>
      </footer>
    </article>
  </v-container>
</template>

<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { computed, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { ArticleDetails } from '@shared/articles/articles.types';
import HeaderComponent from '@/app/components/Header.component.vue';
import RenderedArticle from '@/features/articles/components/RenderedArticle.component.vue';
import { ArticlesService } from '@/features/articles/services/articles.service';
import { categoryPath, articleCategorySegment } from '@/features/articles/utils/article-categories';
import { HomeRoutes } from '@/shared/navigation/routes';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const categoryCatalog = ref<import('../../../../shared/articles/articles.types').ArticleCategory[]>([]);
const article = ref<ArticleDetails | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const slug = computed(() => {
  const value = route.params.slug;
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
});

function formatDate(value?: string | null): string {
  if (!value) return t('common.unknownDate');
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value));
}

let requestId = 0;
watch([slug, () => route.params.category, locale], async () => {
  const request = ++requestId;
  article.value = null;
  loading.value = true;
  error.value = null;
  try {
    const next = await ArticlesService.getArticle(slug.value, locale.value);
    if (request === requestId) {
      const catalog = await ArticlesService.listCategories(locale.value);
      if (request !== requestId) return;
      article.value = next;
      categoryCatalog.value = catalog;
      const canonical = articleCategorySegment(next);
      if (route.params.category !== canonical) void router.replace({ name: HomeRoutes.ArticleDetails, params: { category: canonical, slug: next.slug } });
    }
  } catch (caught) {
    if (request === requestId) error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    if (request === requestId) loading.value = false;
  }
}, { immediate: true });

useErrorNotifications(
  () => error.value,
);
</script>

<style scoped lang="scss" src="@/assets/styles/features/articles/article-details.scss"></style>
