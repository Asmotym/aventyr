<template>
  <HeaderComponent />
  <v-container class="py-6 articles-page">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">{{ t('articles.title') }}</h1>
    </div>

    <v-row class="mb-4" dense>
      <v-col cols="12" md="7">
        <v-text-field
          v-model="search"
          :label="t('articles.search')"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          @keyup.enter="reload"
          @click:clear="reload"
        />
      </v-col>
      <v-col cols="12" md="5">
        <v-select
          v-model="selectedTags"
          :items="tags"
          item-title="name"
          item-value="slug"
          :label="t('articles.filterTags')"
          multiple
          chips
          clearable
          hide-details
          @update:model-value="reload"
        />
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-progress-linear v-if="loading && articles.length === 0" indeterminate color="primary" class="mb-4" />

    <div v-if="!loading && articles.length === 0" class="text-medium-emphasis">
      {{ t('articles.empty') }}
    </div>

    <v-row v-else dense>
      <v-col v-for="article in articles" :key="article.id" cols="12">
        <v-card :lang="article.resolvedLocale" class="article-card" variant="tonal">
          <v-card-title>{{ article.title }}</v-card-title>
          <v-card-subtitle>
            {{ formatDate(article.publishedAt ?? article.createdAt) }}
          </v-card-subtitle>
          <v-card-text>
            <div class="article-preview">
              <p>{{ article.introduction }}</p>
            </div>
            <div class="d-flex flex-wrap ga-2 mt-3">
              <v-chip v-for="tag in article.tags" :key="tag.id" size="small" variant="outlined">
                {{ tag.name }}
              </v-chip>
            </div>
          </v-card-text>
          <v-card-actions class="justify-end">
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              :to="{ name: HomeRoutes.ArticleDetails, params: { slug: article.slug } }"
            >
              {{ t('home.news.openArticle') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <div class="d-flex justify-center mt-6">
      <v-btn
        v-if="canLoadMore"
        :loading="loading"
        color="primary"
        variant="tonal"
        @click="loadMore"
      >
        {{ t('articles.loadMore') }}
      </v-btn>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import { ArticlesService } from 'core/services/articles.service';
import { HomeRoutes } from 'core/routes';
import type { ArticleSummary, ArticleTag } from 'netlify/core/types/data.types';

const PAGE_SIZE = 5;

const { t, locale } = useI18n();
const search = ref('');
const selectedTags = ref<string[]>([]);
const tags = ref<ArticleTag[]>([]);
const articles = ref<ArticleSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const reachedEnd = ref(false);
let searchTimer: number | null = null;

const canLoadMore = computed(() => !reachedEnd.value && articles.value.length > 0);

function formatDate(value?: string | null): string {
  if (!value) return t('common.unknownDate');
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value));
}

let requestId = 0;
async function fetchArticles(reset = false) {
  const request = ++requestId;
  loading.value = true;
  error.value = null;
  try {
    const next = await ArticlesService.listPublicArticles({
      locale: locale.value,
      search: search.value,
      tags: selectedTags.value,
      limit: PAGE_SIZE,
      offset: reset ? 0 : articles.value.length,
    });
    if (request !== requestId) return;
    articles.value = reset ? next : [...articles.value, ...next];
    reachedEnd.value = next.length < PAGE_SIZE;
  } catch (caught) {
    if (request === requestId) error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    if (request === requestId) loading.value = false;
  }
}

watch(locale, () => { articles.value = []; reload(); });

function reload() {
  reachedEnd.value = false;
  fetchArticles(true);
}

function loadMore() {
  fetchArticles(false);
}

watch(search, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(reload, 300);
});

onMounted(async () => {
  tags.value = await ArticlesService.listTags();
  await fetchArticles(true);
});
</script>

<style scoped>
.articles-page {
  max-width: 1100px;
}

.article-card {
  border-radius: 8px;
}

.article-preview {
  position: relative;
  max-height: 180px;
  overflow: hidden;
}
</style>
