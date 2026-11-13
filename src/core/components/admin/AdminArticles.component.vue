<template>
  <div>
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-5">
      <h2 class="text-h5">{{ t('admin.articles.title') }}</h2>
      <v-btn v-if="isOwner" color="primary" :to="{ name: HomeRoutes.AdminArticleWrite }">
        {{ t('admin.articles.write') }}
      </v-btn>
    </div>

    <v-card variant="flat" class="admin-card mb-5">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" lg="6">
            <v-text-field v-model="search" :label="t('articles.search')" prepend-inner-icon="mdi-magnify" hide-details clearable />
          </v-col>
          <v-col cols="12" lg="6">
            <v-select v-model="selectedTags" :items="tags" item-title="name" item-value="slug" :label="t('articles.filterTags')" multiple chips hide-details clearable />
          </v-col>
          <v-col cols="12" class="d-flex align-center flex-wrap ga-3">
            <v-checkbox v-model="published" :label="t('admin.articles.published')" hide-details density="compact" />
            <v-checkbox v-model="unpublished" :label="t('admin.articles.unpublished')" hide-details density="compact" />
            <v-checkbox v-model="archived" :label="t('admin.articles.archived')" hide-details density="compact" />
            <v-checkbox v-model="unarchived" :label="t('admin.articles.unarchived')" hide-details density="compact" />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="article in articles"
        :key="article.id"
        @group:selected="(value) => handlePanelSelected(article.id, value)"
      >
        <v-expansion-panel-title>
          <div class="article-row">
            <div>
              <strong>{{ article.title }}</strong>
              <div class="article-meta text-caption text-medium-emphasis">
                <v-chip size="x-small" :color="article.status === 'published' ? 'success' : 'default'" variant="tonal">{{ article.status }}</v-chip>
                <span>{{ formatDate(article.publishedAt ?? article.createdAt) }}</span>
                <span class="article-uid">
                  {{ t('admin.writer.uid', { uid: article.uid }) }}
                  <v-btn
                    icon="mdi-content-copy"
                    size="x-small"
                    variant="text"
                    :title="t('admin.writer.copyUid')"
                    :aria-label="t('admin.writer.copyUid')"
                    :loading="copyingUid === article.uid"
                    @click.stop="copyArticleUid(article.uid)"
                  />
                </span>
              </div>
            </div>
            <div class="d-flex align-center ga-2 actions" @click.stop>
              <v-btn size="small" variant="tonal" @click="startEdit(article.id)">{{ t('common.edit') }}</v-btn>
              <v-btn size="small" variant="tonal" color="primary" @click="togglePublication(article)">
                {{ article.status === 'published' ? t('admin.articles.unpublish') : t('admin.articles.publish') }}
              </v-btn>
              <v-btn v-if="isOwner" size="small" variant="tonal" color="error" @click="archive(article.id)">
                {{ t('admin.articles.archive') }}
              </v-btn>
            </div>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <ArticleEditor
            v-if="editingId === article.id && editingArticle"
            v-model:translations="editTranslations"
            :article-id="article.id"
            v-model:tag-ids="editTagIds"
            :tags="tags"
            :categories="categories"
            v-model:category-ids="editCategoryIds"
          />
          <div v-else>
            <v-progress-linear
              v-if="loadingArticleId === article.id"
              indeterminate
              color="primary"
              class="mb-3"
            />
            <RenderedArticle
              v-if="articleDetailsById[article.id]"
              :html="articleDetailsById[article.id].sanitizedHtml"
              private-images
            />
            <p v-else>{{ article.excerpt }}</p>
            <div class="d-flex flex-wrap ga-2 my-3">
              <v-chip v-for="tag in article.tags" :key="tag.id" size="small" variant="outlined">{{ tag.name }}</v-chip>
            </div>
          </div>
          <div v-if="editingId === article.id" class="d-flex justify-end ga-2 mt-4">
            <v-btn variant="text" @click="cancelEdit">{{ t('common.cancel') }}</v-btn>
            <v-btn color="primary" @click="saveEdit(article.id)">{{ t('common.save') }}</v-btn>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { emptyDocument, type ArticleTranslations } from 'netlify/core/articles/document';
import { useI18n } from 'vue-i18n';
import type { ArticleDetails, ArticleSummary, ArticleTag, ArticleCategory } from 'netlify/core/types/data.types';
import { AdminArticlesService, ArticlesService } from 'core/services/articles.service';
import { useCurrentUserRole } from 'core/composables/useCurrentUserRole';
import { HomeRoutes } from 'core/routes';
import { notifications } from 'core/services/notifications.service';
import ArticleEditor from './ArticleEditor.component.vue';
import RenderedArticle from '../articles/RenderedArticle.component.vue';

const { t, locale } = useI18n();
const { isOwner } = useCurrentUserRole();
const articles = ref<ArticleSummary[]>([]);
const categories = ref<ArticleCategory[]>([]);
const editCategoryIds = ref<string[]>([]);
const tags = ref<ArticleTag[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref('');
const selectedTags = ref<string[]>([]);
const published = ref(true);
const unpublished = ref(true);
const archived = ref(false);
const unarchived = ref(true);
const editingId = ref<string | null>(null);
const editingArticle = ref<ArticleDetails | null>(null);
const articleDetailsById = ref<Record<string, ArticleDetails>>({});
const loadingArticleId = ref<string | null>(null);
const editTranslations = ref<ArticleTranslations>({ en: { title: '', introduction: '', document: emptyDocument() } });
const editTagIds = ref<string[]>([]);
const copyingUid = ref<string | null>(null);
let timer: number | null = null;

function formatDate(value?: string | null): string {
  if (!value) return t('common.unknownDate');
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value));
}

function selectedStatuses(): string[] {
  const statuses: string[] = [];
  if (published.value) statuses.push('published');
  if (unpublished.value) statuses.push('unpublished');
  return statuses;
}

function archivedFilter(): boolean | null {
  if (archived.value && !unarchived.value) return true;
  if (!archived.value && unarchived.value) return false;
  return null;
}

async function loadArticles() {
  loading.value = true;
  error.value = null;
  try {
    articles.value = await AdminArticlesService.listArticles({
      search: search.value,
      tags: selectedTags.value,
      statuses: selectedStatuses(),
      archived: archivedFilter(),
      limit: 50,
    });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    loading.value = false;
  }
}

async function startEdit(articleId: string) {
  editingId.value = articleId;
  editingArticle.value = articleDetailsById.value[articleId] ?? await AdminArticlesService.getArticle(articleId);
  articleDetailsById.value = { ...articleDetailsById.value, [articleId]: editingArticle.value };
  editTranslations.value = JSON.parse(JSON.stringify(editingArticle.value.translations!));
  editCategoryIds.value = (editingArticle.value.categories ?? []).map(category => category.id);
  editTagIds.value = editingArticle.value.tags.map((tag) => tag.id);
}

function cancelEdit() {
  editingId.value = null;
  editingArticle.value = null;
}

async function saveEdit(articleId: string) {
  await AdminArticlesService.updateArticle(articleId, {
    translations: editTranslations.value,
    tagIds: editTagIds.value,
    categoryIds: editCategoryIds.value,
  });
  cancelEdit();
  const details = await AdminArticlesService.getArticle(articleId);
  articleDetailsById.value = { ...articleDetailsById.value, [articleId]: details };
  await loadArticles();
}

async function loadArticleDetails(articleId: string) {
  if (articleDetailsById.value[articleId] || loadingArticleId.value === articleId) return;
  loadingArticleId.value = articleId;
  try {
    const details = await AdminArticlesService.getArticle(articleId);
    articleDetailsById.value = { ...articleDetailsById.value, [articleId]: details };
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('articles.errors.load');
  } finally {
    loadingArticleId.value = null;
  }
}

function handlePanelSelected(articleId: string, value: unknown) {
  const selected = typeof value === 'object' && value !== null && 'value' in value
    ? Boolean((value as { value?: unknown }).value)
    : Boolean(value);
  if (selected) {
    loadArticleDetails(articleId);
  }
}

async function togglePublication(article: ArticleSummary) {
  await AdminArticlesService.setPublication(article.id, article.status !== 'published');
  await loadArticles();
}

async function archive(articleId: string) {
  await AdminArticlesService.archiveArticle(articleId);
  await loadArticles();
}

async function copyArticleUid(uid: string) {
  copyingUid.value = uid;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(uid);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = uid;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    notifications.success(t('admin.writer.copyUidSuccess'));
  } catch {
    notifications.error(t('admin.writer.copyUidError'));
  } finally {
    copyingUid.value = null;
  }
}

watch([search, selectedTags, published, unpublished, archived, unarchived], () => {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(loadArticles, 300);
});

onMounted(async () => {
  [tags.value, categories.value] = await Promise.all([ArticlesService.listTags(), ArticlesService.listCategories()]);
  await loadArticles();
});
</script>

<style scoped>
.admin-card {
  border-radius: 8px;
}

.article-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  width: 100%;
}

@media (max-width: 1279px) {
  .article-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .article-row .actions { justify-content: flex-start; }
}
.article-row strong { overflow-wrap: anywhere; }

.actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.article-uid {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: monospace;
}

.rendered-article {
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.rendered-article :deep(p),
.rendered-article :deep(ul),
.rendered-article :deep(ol),
.rendered-article :deep(blockquote),
.rendered-article :deep(pre),
.rendered-article :deep(table) {
  margin-block: 0 14px;
}

.rendered-article :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.32);
  color: rgb(var(--v-theme-primary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.92em;
}

.rendered-article :deep(pre) {
  padding: 14px 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: #111827;
  overflow: auto;
}

.rendered-article :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  color: #e5e7eb;
  font-size: 0.9rem;
  line-height: 1.55;
}

.rendered-article :deep(blockquote) {
  padding: 8px 14px;
  border-left: 4px solid rgb(var(--v-theme-primary));
  border-radius: 0 6px 6px 0;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.86);
}

.rendered-article :deep(ul),
.rendered-article :deep(ol) {
  padding-left: 28px;
}

.rendered-article :deep(li) {
  margin: 5px 0;
  padding-left: 4px;
}

.rendered-article :deep(li input[type="checkbox"]) {
  width: 16px;
  height: 16px;
  margin: 0 8px 0 -24px;
  vertical-align: -2px;
  accent-color: rgb(var(--v-theme-primary));
}

.rendered-article :deep(ul:has(input[type="checkbox"])) {
  list-style: none;
  padding-left: 28px;
}

.rendered-article :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px 0;
  border-radius: 8px;
}

.rendered-article :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.rendered-article :deep(th),
.rendered-article :deep(td) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 8px 10px;
  text-align: left;
}

.rendered-article :deep(th) {
  font-weight: 700;
  background: rgba(var(--v-theme-surface-variant), 0.45);
}

.rendered-article :deep(.hljs-keyword),
.rendered-article :deep(.hljs-selector-tag),
.rendered-article :deep(.hljs-title.function_) {
  color: #93c5fd;
}

.rendered-article :deep(.hljs-string),
.rendered-article :deep(.hljs-attr),
.rendered-article :deep(.hljs-symbol) {
  color: #86efac;
}

.rendered-article :deep(.hljs-number),
.rendered-article :deep(.hljs-literal),
.rendered-article :deep(.hljs-built_in) {
  color: #fbbf24;
}

.rendered-article :deep(.hljs-comment) {
  color: #9ca3af;
  font-style: italic;
}

.rendered-article :deep(.hljs-type),
.rendered-article :deep(.hljs-class),
.rendered-article :deep(.hljs-title.class_) {
  color: #c4b5fd;
}

.rendered-article :deep(.hljs-variable),
.rendered-article :deep(.hljs-property) {
  color: #fca5a5;
}
</style>
