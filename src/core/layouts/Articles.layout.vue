<template>
  <HeaderComponent />
  <v-container class="articles-page py-6">
    <div class="browse-heading"><div><span class="browse-eyebrow">{{ t('articleBrowse.eyebrow') }}</span><h1>{{ t('articles.title') }}</h1></div><v-btn v-if="!mdAndUp" variant="tonal" prepend-icon="mdi-filter-variant" :aria-expanded="drawer" @click="drawer = true">{{ t('articleBrowse.filters') }}</v-btn></div>
    <div class="browse-shell" :class="{ desktop: mdAndUp }">
      <aside v-if="mdAndUp" class="browse-sidebar"><ArticleFilters v-model:category-id="categoryId" v-model:tags="selectedTags" :categories="categories" :available-tags="tags" /></aside>
      <section class="browse-content" :aria-label="t('articles.title')">
        <div class="browse-toolbar">
          <div class="search-area" @focusout="closeOnBlur">
            <div class="search-field"><v-icon icon="mdi-magnify" size="20" aria-hidden="true" /><label for="article-search">{{ t('articles.search') }}</label><input id="article-search" v-model="search" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-controls="article-suggestions" :aria-expanded="showSuggestions" :aria-activedescendant="activeSuggestion >= 0 && showSuggestions ? `article-suggestion-${activeSuggestion}` : undefined" @focus="searchFocused = true; dismissed = false" @keydown="searchKey" /><button v-if="search" type="button" :aria-label="t('articleBrowse.clearSearch')" @click="search = ''; dismissed = true"><v-icon icon="mdi-close" size="18" /></button></div>
            <ul v-if="showSuggestions" id="article-suggestions" class="search-suggestions" role="listbox" :aria-label="t('articleBrowse.suggestions')">
              <li v-for="(article, index) in suggestions" :id="`article-suggestion-${index}`" :key="article.id" role="option" :aria-selected="index === activeSuggestion" :lang="article.resolvedLocale" :class="{ active: index === activeSuggestion }" @mousedown.prevent @mousemove="activeSuggestion = index" @click="openArticle(article)"><strong>{{ article.title }}</strong><p>{{ article.introduction }}</p></li>
              <li v-if="!suggestions.length" role="presentation" class="suggestions-empty">{{ t('articleBrowse.noSuggestions') }}</li>
            </ul>
          </div>
          <AppDropdown
            id="article-sort" v-model="sort" class="sort-field" :items="sortItems"
            item-title="label" item-value="value" :label="t('articleBrowse.sort')"
            variant="outlined" density="default" hide-details
          >
            <template #selection="{ item }">
              <span class="sort-selection"><v-icon :icon="item.raw.icon" size="18" aria-hidden="true" />{{ item.title }}</span>
            </template>
            <template #item="{ props, item }">
              <v-list-item v-bind="props" role="option" :aria-selected="sort === item.value" :prepend-icon="item.raw.icon" />
            </template>
          </AppDropdown>
        </div>
        <p v-if="syncFailed" class="preference-note" role="status">{{ t('articleBrowse.preferenceError') }}</p>
        <div v-if="selectedCategory" class="selected-heading"><h2>{{ selectedCategory.name }}</h2><p v-if="selectedCategory.description">{{ selectedCategory.description }}</p></div>
        <v-alert v-if="metadataError" type="error" variant="tonal" class="mb-4">{{ metadataError }}<v-btn variant="text" @click="loadMetadata">{{ t('articleBrowse.retry') }}</v-btn></v-alert>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}<v-btn variant="text" @click="retry">{{ t('articleBrowse.retry') }}</v-btn></v-alert>
        <v-progress-linear v-if="loading" indeterminate color="primary" :aria-label="t('articleBrowse.loading')" class="mb-4" />
        <div v-if="!loading && !error && !articles.length" class="browse-empty"><v-icon icon="mdi-file-search-outline" size="40" /><p>{{ t('articles.empty') }}</p></div>
        <div class="article-feed" :aria-busy="loading">
          <v-card v-for="article in articles" :key="article.id" :lang="article.resolvedLocale" class="browse-article" variant="flat">
            <v-card-text>
              <div class="article-meta"><v-icon icon="mdi-calendar-outline" size="16" /><time :datetime="article.publishedAt ?? article.createdAt">{{ formatDate(article.publishedAt ?? article.createdAt) }}</time><span v-if="article.authorName">{{ article.authorName }}</span></div>
              <h2><router-link :to="{ name: HomeRoutes.ArticleDetails, params: { category: articleCategorySegment(article), slug: article.slug } }">{{ article.title }}</router-link></h2>
              <p class="article-introduction">{{ article.introduction }}</p>
              <div class="article-footer"><div class="d-flex flex-wrap ga-2"><v-chip v-for="tag in article.tags" :key="tag.id" size="small" variant="tonal" color="primary" prepend-icon="mdi-pound">{{ tag.name }}</v-chip></div><v-btn variant="text" color="primary" append-icon="mdi-arrow-right" :to="{ name: HomeRoutes.ArticleDetails, params: { category: articleCategorySegment(article), slug: article.slug } }">{{ t('home.news.openArticle') }}</v-btn></div>
            </v-card-text>
          </v-card>
        </div>
        <div ref="sentinel" class="feed-sentinel"><v-btn v-if="!reachedEnd && articles.length" :loading="loading" :disabled="loading" variant="tonal" @click="loadMore">{{ t('articles.loadMore') }}</v-btn><p v-if="reachedEnd && articles.length" role="status">{{ t('articleBrowse.end') }}</p></div>
      </section>
    </div>
    <v-dialog v-if="!mdAndUp" v-model="drawer" class="browse-drawer" width="320" :aria-label="t('articleBrowse.filters')" scrollable><v-card><v-card-title class="d-flex align-center">{{ t('articleBrowse.filters') }}<v-spacer /><v-btn icon="mdi-close" variant="text" :aria-label="t('common.close')" @click="drawer = false" /></v-card-title><v-card-text><ArticleFilters v-model:category-id="categoryId" v-model:tags="selectedTags" :categories="categories" :available-tags="tags" /></v-card-text></v-card></v-dialog>
  </v-container>
</template>
<script setup lang="ts">
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
import { categoryPath, articleCategorySegment } from 'core/utils/article-categories';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import HeaderComponent from 'core/components/Header.component.vue';
import ArticleFilters from 'core/components/articles/ArticleFilters.component.vue';
import { ArticlesService } from 'core/services/articles.service';
import { useArticleSort } from 'core/composables/useArticleSort';
import { HomeRoutes } from 'core/routes';
import type { ArticleSummary, ArticleTag, ArticleCategory } from 'netlify/core/types/data.types';
const PAGE_SIZE = 5;
const { t, locale } = useI18n();
const { mdAndUp } = useDisplay();
const router = useRouter();
const route = useRoute();
const catalogReady = ref(false);
const { sort, syncFailed } = useArticleSort();
const sortItems = computed(() => [
  { value: 'newest', icon: 'mdi-sort-calendar-descending' },
  { value: 'oldest', icon: 'mdi-sort-calendar-ascending' },
  { value: 'title-asc', icon: 'mdi-sort-alphabetical-ascending' },
  { value: 'title-desc', icon: 'mdi-sort-alphabetical-descending' },
].map(item => ({ ...item, label: t(`articleBrowse.orders.${item.value}`) })));
const search = ref('');
const categoryId = ref('');
function resolveCategoryRoute() {
  if (!catalogReady.value) return;
  const path = route.path.replace(/\/$/, '');
  if (path === '/articles') { categoryId.value = ''; return; }
  const category = categories.value.find(item => categoryPath(categories.value, item.id) === path);
  if (category) categoryId.value = category.id;
  else void router.replace({ name: HomeRoutes.Articles });
}
watch(() => route.path, resolveCategoryRoute);
watch(categoryId, id => {
  if (!catalogReady.value) return;
  const path = id ? categoryPath(categories.value, id) : '/articles';
  if (route.path !== path) void router.push(path);
});
const selectedTags = ref<string[]>([]);
const tags = ref<ArticleTag[]>([]);
const categories = ref<ArticleCategory[]>([]);
const selectedCategory = computed(() => categories.value.find(item => item.id === categoryId.value));
const drawer = ref(false);
const articles = ref<ArticleSummary[]>([]);
const suggestions = ref<ArticleSummary[]>([]);
const loading = ref(false);
const error = ref('');
const metadataError = ref('');
const reachedEnd = ref(false);
const sentinel = ref<HTMLElement>();
const searchFocused = ref(false);
const dismissed = ref(false);
const activeSuggestion = ref(-1);
const showSuggestions = computed(() => searchFocused.value && !dismissed.value && !!search.value?.trim() && !loading.value && !error.value && !searchTimerPending.value);
const searchTimerPending = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let metadataGeneration = 0;
let offset = 0;
let observer: IntersectionObserver | undefined;
let disposed = false;
function formatDate(value?: string | null): string {
  return value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value)) : t('common.unknownDate');
}
function openArticle(article: ArticleSummary) {
  dismissed.value = true;
  void router.push({ name: HomeRoutes.ArticleDetails, params: { category: articleCategorySegment(article), slug: article.slug } });
}
function searchKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { dismissed.value = true; activeSuggestion.value = -1; return; }
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.value.length) {
    event.preventDefault(); dismissed.value = false;
    activeSuggestion.value = event.key === 'ArrowDown' ? (activeSuggestion.value + 1) % suggestions.value.length : (activeSuggestion.value <= 0 ? suggestions.value.length - 1 : activeSuggestion.value - 1);
    void nextTick(() => document.getElementById(`article-suggestion-${activeSuggestion.value}`)?.scrollIntoView({ block: 'nearest' }));
  }
  if (event.key === 'Enter' && showSuggestions.value && activeSuggestion.value >= 0) { event.preventDefault(); openArticle(suggestions.value[activeSuggestion.value]!); }
}
function closeOnBlur(event: FocusEvent) { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) searchFocused.value = false; }
async function fetchPage() {
  if (disposed || loading.value || reachedEnd.value || searchTimerPending.value) return;
  const request = generation;
  const first = offset === 0;
  loading.value = true; error.value = '';
  try {
    const result = await ArticlesService.listPublicArticles({ locale: locale.value, search: search.value ?? '', tags: selectedTags.value, categoryId: categoryId.value, sort: sort.value, limit: PAGE_SIZE, offset });
    if (request !== generation || disposed) return;
    const existing = new Set(articles.value.map(article => article.id));
    articles.value.push(...result.filter(article => !existing.has(article.id)));
    offset += result.length;
    reachedEnd.value = result.length < PAGE_SIZE;
    if (first) suggestions.value = result;
  } catch (caught) { if (request === generation && !disposed) error.value = caught instanceof Error ? caught.message : t('articles.errors.load'); }
  finally {
    if (request === generation && !disposed) {
      loading.value = false;
      await nextTick();
      // Reobserve after a batch, including when the viewport is taller than the feed.
      if (sentinel.value) { observer?.unobserve(sentinel.value); observer?.observe(sentinel.value); }
    }
  }
}
function reset(debounce = false) {
  generation++; clearTimeout(timer); articles.value = []; suggestions.value = []; offset = 0;
  loading.value = false; reachedEnd.value = false; error.value = ''; activeSuggestion.value = -1;
  searchTimerPending.value = debounce;
  if (debounce) timer = setTimeout(() => { searchTimerPending.value = false; void fetchPage(); }, 300);
  else void fetchPage();
}
function loadMore() { if (!error.value) void fetchPage(); }
async function retry() { await loadMetadata(); error.value = ''; void fetchPage(); }
async function loadMetadata() {
  const request = ++metadataGeneration;
  metadataError.value = '';
  const results = await Promise.allSettled([ArticlesService.listTags(), ArticlesService.listCategories()]);
  if (disposed || request !== metadataGeneration) return;
  if (results[0].status === 'fulfilled') tags.value = results[0].value;
  if (results[1].status === 'fulfilled') {
    categories.value = results[1].value;
    catalogReady.value = true;
    resolveCategoryRoute();
    if (categoryId.value && !categories.value.some(item => item.id === categoryId.value)) categoryId.value = '';
  }
  if (results.some(result => result.status === 'rejected')) metadataError.value = t('articleBrowse.filtersError');
}
watch(search, () => { dismissed.value = false; reset(true); });
watch([locale, selectedTags, categoryId, sort], () => reset(), { deep: true });
watch(mdAndUp, () => { drawer.value = false; });
onMounted(() => {
  if (typeof IntersectionObserver !== 'undefined') observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) loadMore(); });
  if (sentinel.value) observer?.observe(sentinel.value);
  void loadMetadata(); reset();
});
onUnmounted(() => { disposed = true; generation++; metadataGeneration++; clearTimeout(timer); observer?.disconnect(); });
</script>
<style scoped>
.articles-page { max-width:1400px; padding-bottom:96px !important; }
.browse-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:26px; }
.browse-heading h1 { font-size:clamp(2rem, 4vw, 2.8rem); letter-spacing:-.04em; font-weight:750; }
.browse-eyebrow { color:rgb(var(--v-theme-primary)); font-size:.7rem; font-weight:650; letter-spacing:.12em; text-transform:uppercase; }
.browse-shell { display:grid; gap:24px; align-items:start; }
.browse-shell.desktop { grid-template-columns:260px minmax(0, 1fr); }
.browse-sidebar { padding:18px; border-radius:16px; border:1px solid rgba(var(--v-theme-primary),.14); background:rgb(var(--v-theme-surface)); position:sticky; top:88px; max-height:calc(100dvh - 110px); overflow-y:auto; }
.browse-content { min-width:0; }
.browse-toolbar { --browse-control-height:56px; display:grid; grid-template-columns:minmax(0, 1fr) 250px; align-items:start; gap:14px; margin-bottom:24px; }
.search-area { position:relative; min-width:0; flex:1; }
.sort-field { min-width:0; }
.sort-field :deep(.v-field) { height:var(--browse-control-height); min-height:var(--browse-control-height); }
.sort-field :deep(.v-field__input) { min-height:var(--browse-control-height); padding-block:0; align-items:center; }
.sort-selection { display:inline-flex; align-items:center; gap:8px; }
.search-field { position:relative; display:flex; align-items:center; gap:10px; height:var(--browse-control-height); box-sizing:border-box; padding:12px 14px; border:1px solid rgba(var(--v-theme-on-surface),.4); border-radius:12px; background:rgba(var(--v-theme-primary),.035); }
.search-field:focus-within { border-color:rgb(var(--v-theme-primary)); outline:1px solid rgb(var(--v-theme-primary)); }
.search-field label { position:absolute; top:-9px; left:12px; padding:0 5px; font-size:.75rem; color:rgba(var(--v-theme-on-surface),.75); background:rgb(var(--v-theme-background)); }
.search-field input { width:100%; min-width:0; color:inherit; outline:none; }
.search-field button { display:grid; place-items:center; flex-shrink:0; }

.browse-toolbar :deep(.v-field) { border-radius:12px; background:rgba(var(--v-theme-primary),.035); }
.search-suggestions { list-style:none; position:absolute; inset-inline:0; top:calc(100% + 8px); border:1px solid rgba(var(--v-theme-primary),.25); background:rgb(var(--v-theme-surface)); border-radius:14px; padding:6px; z-index:10; box-shadow:0 12px 32px #0004; max-height:380px; overflow-y:auto; }
.search-suggestions li { padding:12px; border-radius:9px; cursor:pointer; }
.search-suggestions li.active { background:rgba(var(--v-theme-primary),.12); }
.search-suggestions p { font-size:.8rem; opacity:.65; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:5px; }
.suggestions-empty { opacity:.6; font-size:.85rem; }
.article-feed { display:grid; gap:18px; }
.browse-article { border:1px solid rgba(var(--v-theme-primary),.14); border-radius:18px; background:radial-gradient(ellipse at top left, rgba(var(--v-theme-primary),.065), transparent 65%), rgb(var(--v-theme-surface)); }
.browse-article :deep(.v-card-text) { padding:26px; }
.article-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:.75rem; opacity:.6; margin-bottom:12px; }
.article-meta span { margin-inline-start:auto; }
.browse-article h2 { font-size:clamp(1.25rem, 2vw, 1.6rem); line-height:1.35; letter-spacing:-.025em; overflow-wrap:anywhere; }
.browse-article h2 a { color:inherit; text-decoration:none; }
.browse-article h2 a:hover { color:rgb(var(--v-theme-primary)); }
.article-introduction { font-size:.95rem; line-height:1.8; opacity:.75; margin-top:14px; overflow-wrap:anywhere; }
.article-footer { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:20px; padding-top:16px; border-top:1px solid rgba(var(--v-theme-on-surface),.07); }
.selected-heading { margin-bottom:20px; }
.selected-heading p { margin-top:6px; opacity:.65; }
.feed-sentinel { min-height:70px; display:flex; align-items:center; justify-content:center; margin-top:18px; font-size:.8rem; opacity:.75; }
.browse-empty { text-align:center; padding:70px 20px; opacity:.6; }
.browse-empty p { margin-top:16px; }
.preference-note { font-size:.75rem; opacity:.6; margin-bottom:16px; }
.browse-drawer :deep(.v-overlay__content) { align-self:stretch; margin:0; height:100dvh; max-height:100dvh; top:0; left:0; }
.browse-drawer :deep(.v-card) { border-radius:0; }
@media(max-width:599px) { .browse-toolbar { grid-template-columns:minmax(0, 1fr); } .search-area { width:100%; } .sort-field { width:100%; } .browse-article :deep(.v-card-text) { padding:20px; } }
</style>
