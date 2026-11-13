<template>
  <HeaderComponent />
  <v-container class="py-6 article-page">
    <v-btn variant="text" class="mb-4" :to="{ name: HomeRoutes.Articles }">
      {{ t('admin.writer.back') }}
    </v-btn>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-card v-if="article" :lang="article.resolvedLocale" variant="tonal" class="article-card">
      <v-card-title class="text-h4">{{ article.title }}</v-card-title>
      <v-card-subtitle>
        {{ formatDate(article.publishedAt ?? article.createdAt) }}
      </v-card-subtitle>
      <v-card-text>
        <v-alert v-if="article.requestedLocale !== article.resolvedLocale" type="info" variant="tonal" class="mb-4">{{ t('articles.languageFallback') }}</v-alert>
        <RenderedArticle :html="article.sanitizedHtml" />
        <div class="d-flex flex-wrap ga-2 mt-5">
          <v-chip v-for="tag in article.tags" :key="tag.id" size="small" variant="outlined">
            {{ tag.name }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { ArticleDetails } from 'netlify/core/types/data.types';
import HeaderComponent from 'core/components/Header.component.vue';
import RenderedArticle from 'core/components/articles/RenderedArticle.component.vue';
import { ArticlesService } from 'core/services/articles.service';
import { HomeRoutes } from 'core/routes';

const { t, locale } = useI18n();
const route = useRoute();
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
watch([slug, locale], async () => {
  const request = ++requestId;
  article.value = null;
  loading.value = true;
  error.value = null;
  try {
    const next = await ArticlesService.getArticle(slug.value, locale.value);
    if (request === requestId) article.value = next;
  } catch (caught) {
    if (request === requestId) error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    if (request === requestId) loading.value = false;
  }
}, { immediate: true });
</script>

<style scoped>
.article-page {
  max-width: 1100px;
}

.article-card {
  border-radius: 8px;
}
</style>
