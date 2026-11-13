<template>
  <section class="news-section">
    <div class="d-flex align-center justify-space-between mb-3">
      <h2 class="text-h5">{{ t('home.news.title') }}</h2>
      <v-btn variant="tonal" color="primary" :to="{ name: HomeRoutes.Articles }">
        {{ t('home.news.seeMore') }}
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">
      {{ error }}
    </v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />

    <div v-if="!loading && articles.length === 0" class="text-medium-emphasis">
      {{ t('home.news.empty') }}
    </div>

    <v-row v-else dense>
      <v-col v-for="article in articles" :key="article.id" cols="12">
        <v-card variant="tonal" :lang="article.resolvedLocale" class="news-card"
        :title="article.title"
        :subtitle="formatDate(article.publishedAt ?? article.createdAt)"
        prepend-icon="mdi-newspaper"
        >
          <v-card-text class="pb-0">
            <div class="news-preview">
              <p>{{ article.introduction }}</p>
            </div>
          </v-card-text>
          <v-card-actions class="justify-space-between pt-0">
            <div class="d-flex flex-wrap ga-2 mt-3">
              <v-chip v-for="tag in article.tags" :key="tag.id" size="small" variant="outlined">
                {{ tag.name }}
              </v-chip>
            </div>
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
  </section>
</template>

<script setup lang="ts">
import { watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleSummary } from 'netlify/core/types/data.types';
import { ArticlesService } from 'core/services/articles.service';
import { HomeRoutes } from 'core/routes';

const props = withDefaults(defineProps<{ limit?: number }>(), {
  limit: 3,
});

const { t, locale } = useI18n();
const articles = ref<ArticleSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

function formatDate(value?: string | null): string {
  if (!value) return t('common.unknownDate');
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value));
}

let requestId = 0;
watch([locale, () => props.limit], async () => {
  const request = ++requestId;
  articles.value = [];
  loading.value = true;
  error.value = null;
  try {
    const next = await ArticlesService.listNews(props.limit, locale.value);
    if (request === requestId) articles.value = next;
  } catch (caught) {
    if (request === requestId) error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    if (request === requestId) loading.value = false;
  }
}, { immediate: true });
</script>

<style scoped>
.news-section {
  width: 100%;
}

.news-card {
  border-radius: 8px;
}

.news-preview {
  position: relative;
  max-height: 92px;
  overflow: hidden;
}

</style>
