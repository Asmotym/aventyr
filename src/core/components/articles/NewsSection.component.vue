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

    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
    <div v-else-if="loading" class="news-grid" aria-hidden="true">
      <v-skeleton-loader v-for="index in 3" :key="index" type="list-item-three-line" class="news-skeleton" :class="{ 'news-card--featured': index === 1 }" />
    </div>
    <div v-else-if="articles.length === 0" class="news-empty">
      <v-icon icon="mdi-book-open-page-variant-outline" size="36" />
      <p>{{ t('home.news.empty') }}</p>
    </div>
    <div v-else class="news-grid">
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
              <span v-for="tag in article.tags" :key="tag.id" class="news-tag">{{ tag.name }}</span>
            </div>
            <span class="news-card__read">{{ t('home.news.openArticle') }}<span class="news-card__arrow"><v-icon icon="mdi-arrow-right" size="18" /></span></span>
          </div>
        </RouterLink>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { articleCategorySegment } from 'core/utils/article-categories';
import { watch, ref } from 'vue';
import { RouterLink } from 'vue-router';
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
.news-section { width: 100%; }
.news-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.news-heading__title { display: flex; align-items: center; gap: 10px; }
.news-heading__title h2 { font-size: 20px; font-weight: 700; letter-spacing: -.025em; }
.news-heading__icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); }
.news-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.news-grid > article { min-width: 0; }
.news-card--featured { grid-column: 1 / -1; }
.news-card { display: flex; flex-direction: column; position: relative; height: 100%; overflow: hidden; padding: 22px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); text-decoration: none; transition: border-color .2s, background-color .2s, box-shadow .2s; }
.news-card--lead { padding: 28px; border-color: rgba(var(--v-theme-primary), .22); background: linear-gradient(135deg, rgba(var(--v-theme-primary), .075), rgba(var(--v-theme-primary), .015)); }
.news-card--lead::before { content: ''; position: absolute; top: 0; left: 28px; right: 28px; height: 3px; border-radius: 0 0 4px 4px; background: linear-gradient(90deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), .08)); }
.news-card:hover { border-color: rgba(var(--v-theme-primary), .5); background-color: rgba(var(--v-theme-primary), .035); box-shadow: 0 6px 20px rgba(0, 0, 0, .06); }
.news-card:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 3px; }
.news-card__meta { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; margin-bottom: 18px; }
.news-card__badge { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: rgba(var(--v-theme-on-surface), .045); color: rgb(var(--v-theme-primary)); }
.news-card--lead .news-card__badge { width: 48px; height: 48px; border-radius: 14px; background: rgba(var(--v-theme-primary), .1); }
.news-card__heading { min-width: 0; }
.news-card__date { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: rgba(var(--v-theme-on-surface), .6); }
.news-card h3 { position: relative; font-size: 18px; font-weight: 700; line-height: 1.4; letter-spacing: -.025em; overflow-wrap: anywhere; margin-bottom: 4px; }
.news-card--lead h3 { font-size: clamp(22px, 2.3vw, 28px); max-width: 640px; }
.news-card__intro { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; color: rgba(var(--v-theme-on-surface), .65); font-size: 13px; line-height: 1.6; margin: 0; }
.news-card--lead .news-card__intro { font-size: 14px; max-width: 680px; }
.news-card__footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.news-card__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.news-card__tags:empty { display: none; }
.news-tag { max-width: 100%; overflow-wrap: anywhere; font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 6px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .065); }
.news-card__read { display: inline-flex; align-items: center; gap: 10px; margin-left: auto; color: rgb(var(--v-theme-primary)); font-size: 12px; font-weight: 700; }
.news-card__arrow { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid rgba(var(--v-theme-primary), .18); border-radius: 50%; transition: background-color .2s, transform .2s; }
.news-card:hover .news-card__arrow { transform: translateX(2px); background: rgba(var(--v-theme-primary), .1); }
.news-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 36px 20px; border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; color: rgba(var(--v-theme-on-surface), .55); text-align: center; font-size: 14px; }
.news-skeleton { min-height: 180px; border-radius: 16px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
@media (max-width: 600px) {
  .news-grid { grid-template-columns: minmax(0, 1fr); }
  .news-card, .news-card--lead { padding: 20px; }
  .news-card--lead::before { left: 20px; right: 20px; }
  .news-card__meta { gap: 10px; }
}
@media (prefers-reduced-motion: reduce) { .news-card, .news-card__arrow { transition: none; } .news-card:hover .news-card__arrow { transform: none; } }
</style>
