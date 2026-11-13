<template>
  <HeaderComponent />
  <v-container class="py-6 article-page">
    <nav class="reader-navigation" :aria-label="t('articles.title')">
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" :to="{ name: HomeRoutes.Articles }">{{ t('admin.writer.back') }}</v-btn>
      <span class="reader-eyebrow">{{ t('articleBrowse.eyebrow') }}</span>
    </nav>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" :aria-label="t('articleBrowse.loading')" />

    <article v-if="article" :lang="article.resolvedLocale" class="article-card" aria-labelledby="article-title">
      <header class="reader-header">
        <div v-if="article.categories?.length" class="reader-categories">
          <v-chip v-for="category in article.categories" :key="category.id" size="small" color="primary" variant="tonal" :to="categoryPath(categoryCatalog, category.id)" prepend-icon="mdi-folder-outline">{{ category.name }}</v-chip>
        </div>
        <h1 id="article-title">{{ article.title }}</h1>
        <p v-if="article.introduction" class="reader-introduction">{{ article.introduction }}</p>
        <div class="reader-metadata">
          <span><v-icon icon="mdi-calendar-outline" size="17" aria-hidden="true" /><time :datetime="article.publishedAt ?? article.createdAt">{{ formatDate(article.publishedAt ?? article.createdAt) }}</time></span>
          <span v-if="article.authorName"><v-icon icon="mdi-account-circle-outline" size="18" aria-hidden="true" />{{ article.authorName }}</span>
        </div>
      </header>
      <div class="reader-body">
        <v-alert v-if="article.requestedLocale !== article.resolvedLocale" type="info" variant="tonal" class="mb-6">{{ t('articles.languageFallback') }}</v-alert>
        <RenderedArticle :html="article.sanitizedHtml" class="reader-content" />
      </div>
      <footer v-if="article.tags.length" class="reader-footer" :aria-label="t('articles.fields.tags')">
        <span class="reader-tags-label"><v-icon icon="mdi-tag-multiple-outline" size="17" aria-hidden="true" />{{ t('articles.fields.tags') }}</span>
        <div class="reader-tags"><v-chip v-for="tag in article.tags" :key="tag.id" size="small" color="primary" variant="tonal" prepend-icon="mdi-pound">{{ tag.name }}</v-chip></div>
      </footer>
    </article>
  </v-container>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { ArticleDetails } from 'netlify/core/types/data.types';
import HeaderComponent from 'core/components/Header.component.vue';
import RenderedArticle from 'core/components/articles/RenderedArticle.component.vue';
import { ArticlesService } from 'core/services/articles.service';
import { categoryPath, articleCategorySegment } from 'core/utils/article-categories';
import { HomeRoutes } from 'core/routes';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const categoryCatalog = ref<import('netlify/core/types/data.types').ArticleCategory[]>([]);
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
      article.value = next;
      categoryCatalog.value = (await ArticlesService.listCategories()) ?? [];
      const canonical = articleCategorySegment(next);
      if (route.params.category !== canonical) void router.replace({ name: HomeRoutes.ArticleDetails, params: { category: canonical, slug: next.slug } });
    }
  } catch (caught) {
    if (request === requestId) error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    if (request === requestId) loading.value = false;
  }
}, { immediate: true });
</script>

<style scoped>
.article-page { max-width:1060px; padding-bottom:100px !important; }
.reader-navigation { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:24px; }
.reader-navigation :deep(.v-btn) { border-radius:10px; text-transform:none; letter-spacing:0; }
.reader-eyebrow { color:rgb(var(--v-theme-primary)); font-size:.68rem; font-weight:650; letter-spacing:.1em; text-transform:uppercase; }
.article-card { overflow:hidden; border:1px solid rgba(var(--v-theme-primary),.16); border-radius:22px; background:rgb(var(--v-theme-surface)); box-shadow:0 10px 36px #00000008; }
.reader-header { padding:clamp(20px, 3vw, 32px); border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); background:radial-gradient(ellipse at top left, rgba(var(--v-theme-primary),.1), transparent 75%); }
.reader-categories { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
.reader-header h1 { max-width:24ch; margin:0; font-size:clamp(1.9rem, 4.5vw, 3.1rem); font-weight:750; line-height:1.18; letter-spacing:-.035em; overflow-wrap:anywhere; }
.reader-introduction { max-width:70ch; margin-top:14px; font-size:clamp(1rem, 1.6vw, 1.15rem); line-height:1.85; color:rgba(var(--v-theme-on-surface),.75); overflow-wrap:anywhere; }
.reader-metadata { display:flex; align-items:center; flex-wrap:wrap; gap:12px 24px; margin-top:16px; font-size:.8rem; color:rgba(var(--v-theme-on-surface),.6); }
.reader-metadata > span { display:inline-flex; align-items:center; gap:8px; }
.reader-body { padding:clamp(24px, 5vw, 56px); }
.reader-content { max-width:76ch; margin-inline:auto; min-width:0; overflow-x:auto; font-size:1rem; line-height:1.9; }
.reader-content :deep(h1), .reader-content :deep(h2), .reader-content :deep(h3), .reader-content :deep(h4), .reader-content :deep(h5), .reader-content :deep(h6) { margin-block:1.7em .65em; line-height:1.35; letter-spacing:-.02em; }
.reader-content :deep(h2) { font-size:1.65em; }
.reader-content :deep(h3) { font-size:1.3em; }
.reader-content :deep(> :first-child) { margin-top:0; }
.reader-content :deep(p), .reader-content :deep(ul), .reader-content :deep(ol) { margin-bottom:1.3em; }
.reader-content :deep(a) { color:rgb(var(--v-theme-primary)); text-underline-offset:4px; text-decoration-thickness:1px; }
.reader-content :deep(a:focus-visible) { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:3px; border-radius:2px; }
.reader-content :deep(blockquote) { margin-block:24px; padding:18px 22px; border-inline-start:3px solid rgb(var(--v-theme-primary)); border-radius:0 12px 12px 0; }
.reader-content :deep(img) { margin-block:24px; border-radius:12px; }
.reader-content :deep(pre) { margin-block:24px; border-radius:12px; }
.reader-content :deep(hr) { margin-block:32px; border:0; border-top:1px solid rgba(var(--v-theme-on-surface),.14); }
.reader-content :deep(p:last-child) { margin-bottom:0; }
.reader-footer { display:flex; align-items:center; flex-wrap:wrap; gap:14px; padding:24px clamp(24px, 5vw, 56px); border-top:1px solid rgba(var(--v-theme-on-surface),.08); background:rgba(var(--v-theme-primary),.025); }
.reader-tags-label { display:inline-flex; align-items:center; gap:8px; font-size:.75rem; color:rgba(var(--v-theme-on-surface),.6); }
.reader-tags { display:flex; flex-wrap:wrap; gap:8px; min-width:0; }
.reader-tags :deep(.v-chip), .reader-categories :deep(.v-chip) { max-width:100%; }
.reader-tags :deep(.v-chip__content), .reader-categories :deep(.v-chip__content) { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@media(max-width:599px) { .reader-navigation { margin-bottom:18px; } .reader-eyebrow { display:none; } .article-card { border-radius:16px; } .reader-metadata { gap:12px; } .reader-content { font-size:.95rem; line-height:1.85; } }
</style>
