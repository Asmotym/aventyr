<template>
  <section class="news-section" :aria-label="t('home.news.title')" :aria-busy="loading">
    <header class="news-heading">
      <div class="news-heading__title">
        <span class="news-heading__icon"><v-icon icon="mdi-newspaper-variant-outline" size="22" /></span>
        <h2>{{ t('home.news.title') }}</h2>
      </div>
      <v-btn variant="text" color="primary" size="small" append-icon="mdi-arrow-top-right" :to="{ name: HomeRoutes.Articles }">
        {{ t('home.news.seeMore') }}
      </v-btn>
    </header>

    <template v-if="error"></template>
    <div v-else-if="loading" class="news-section__grid" aria-hidden="true">
      <v-skeleton-loader v-for="index in 3" :key="index" type="list-item-three-line" class="news-section__skeleton" :class="{ 'news-card--featured': index === 1 }" />
    </div>
    <div v-else-if="articles.length === 0" class="news-section__empty">
      <v-icon icon="mdi-book-open-page-variant-outline" size="36" />
      <p>{{ t('home.news.empty') }}</p>
    </div>
    <div v-else class="news-section__grid">
      <article v-for="(article, index) in articles" :key="article.id" :lang="article.resolvedLocale" :class="{ 'news-card--featured': index === 0 }">
        <RouterLink
          class="news-card"
          :class="{ 'news-card--lead': index === 0 }"
          :to="{ name: HomeRoutes.ArticleDetails, params: { category: articleCategorySegment(article), slug: article.slug } }"
          :aria-label="article.title"
        >
          <div class="news-card__meta">
            <span class="news-card__badge"><v-icon :icon="index === 0 ? 'mdi-feather' : 'mdi-text-box-outline'" :size="index === 0 ? 26 : 20" /></span>
            <div class="news-card__heading">
              <h3>{{ article.title }}</h3>
              <p class="news-card__intro">{{ article.introduction }}</p>
            </div>
            <span class="news-card__date"><v-icon icon="mdi-calendar-blank-outline" size="14" />{{ formatDate(article.publishedAt ?? article.createdAt) }}</span>
          </div>
          <div class="news-card__footer">
            <div class="news-card__tags">
              <span v-for="tag in article.tags" :key="tag.id" class="news-section__tag">{{ tag.name }}</span>
            </div>
            <span class="news-card__read">{{ t('home.news.openArticle') }}<span class="news-card__arrow"><v-icon icon="mdi-arrow-right" size="18" /></span></span>
          </div>
        </RouterLink>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { articleCategorySegment } from '@/features/articles/utils/article-categories';
import { watch, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { ArticleSummary } from '@shared/articles/articles.types';
import { ArticlesService } from '@/features/articles/services/articles.service';
import { HomeRoutes } from '@/shared/navigation/routes';

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

useErrorNotifications(
  () => error.value,
);
</script>

<style scoped lang="scss" src="@/assets/styles/features/articles/news-section.scss"></style>
