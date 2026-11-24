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
            <AppDropdown v-model="selectedTags" :items="tags" item-title="name" item-value="slug" :label="t('articles.filterTags')" multiple chips hide-details clearable />
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


    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="article in articles"
        :key="article.id"
        @group:selected="(value) => handlePanelSelected(article.id, value)"
      >
        <v-expansion-panel-title>
          <div class="admin-articles__article-row">
            <div>
              <strong>{{ article.title }}</strong>
              <div class="admin-articles__article-meta text-caption text-medium-emphasis">
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
            <div class="d-flex align-center ga-2 admin-articles__actions" @click.stop>
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
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { onMounted, ref, watch } from 'vue';
import { emptyDocument, type ArticleTranslations } from '@shared/articles/document';
import { useI18n } from 'vue-i18n';
import type { ArticleDetails, ArticleSummary, ArticleTag, ArticleCategory } from '@shared/articles/articles.types';
import { AdminArticlesService, ArticlesService } from '@/features/articles/services/articles.service';
import { useCurrentUserRole } from '@/features/auth';
import { HomeRoutes } from '@/shared/navigation/routes';
import { notifications } from '@/shared/services/notifications.service';
import ArticleEditor from '@/features/articles/components/ArticleEditor.component.vue';
import RenderedArticle from '@/features/articles/components/RenderedArticle.component.vue';

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

let categoryRequest = 0;
async function loadCategories() {
  const request = ++categoryRequest;
  const next = await ArticlesService.listCategories(locale.value);
  if (request === categoryRequest) categories.value = next;
}
watch(locale, async () => {
  try { await loadCategories(); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : t('articleCategories.error'); }
});
onMounted(async () => {
  await Promise.all([ArticlesService.listTags().then(value => { tags.value = value; }), loadCategories()]);
  await loadArticles();
});

useErrorNotifications(
  () => error.value,
);
</script>

<style scoped lang="scss" src="@/assets/styles/features/articles/admin-articles.scss"></style>
