<template>
  <div>
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
      <div class="writer-heading">
        <h2 class="text-h5">{{ t('admin.writer.title') }}</h2>
        <div class="article-uid">
          <span>{{ t('admin.writer.uid', { uid: articleUid }) }}</span>
          <v-btn
            icon="mdi-content-copy"
            size="x-small"
            variant="text"
            :title="t('admin.writer.copyUid')"
            :aria-label="t('admin.writer.copyUid')"
            :disabled="!articleUid"
            :loading="copyingUid"
            @click="copyArticleUid"
          />
        </div>
      </div>
      <div class="d-flex align-center ga-2">
        <v-btn id="article-drafts-toggle" variant="tonal" prepend-icon="mdi-file-document-edit-outline" :aria-label="t('admin.writer.drafts')" aria-haspopup="dialog" :aria-expanded="draftPanel" aria-controls="article-drafts-panel">{{ t('admin.writer.drafts') }}<v-chip size="x-small" class="ml-2" aria-hidden="true">{{ drafts.length }}</v-chip></v-btn>
        <v-btn variant="text" :to="{ name: HomeRoutes.AdminArticles }">{{ t('admin.writer.back') }}</v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-card variant="tonal" class="admin-card writer-editor-card" :inert="entryDialog || undefined">
      <v-card-text>
        <ArticleEditor
          v-model:translations="translations"
          :draft-id="currentDraftId"
          :session-key="editorSession"
          :prepare-draft="() => createInitialDraft(true)"
          :inert="publishing || undefined"
          v-model:tag-ids="selectedTagIds"
          :tags="tags"
          :categories="categories"
          v-model:category-ids="selectedCategoryIds"
        />
      </v-card-text>
      <v-card-actions class="justify-end flex-wrap ga-2">
        <div v-if="savedDraft?.updatedAt" class="draft-save-info" role="status"><v-icon icon="mdi-content-save-check-outline" size="16" /><span>{{ t('admin.writer.lastSaved', { user: editorName, date: savedDate }) }}</span></div>
        <v-btn variant="tonal" prepend-icon="mdi-tag-multiple-outline" @click="tagError = ''; tagDialog = true">{{ t('admin.writer.manageTags') }}</v-btn>
        <v-btn variant="tonal" :disabled="publishing" @click="saveCurrentDraft().catch(showSaveError)">{{ t('admin.writer.saveDraft') }}</v-btn>
        <v-btn variant="tonal" color="primary" :disabled="publishing" @click="saveArticle('unpublished')">{{ t('common.save') }}</v-btn>
        <v-btn color="primary" :disabled="publishing" @click="saveArticle('published')">{{ t('admin.articles.publish') }}</v-btn>
        <v-btn variant="tonal" color="primary" @click="scheduleDialog = true">{{ t('admin.writer.publishOnDate') }}</v-btn>
      </v-card-actions>
    </v-card>

    <v-dialog v-model="entryDialog" persistent max-width="560" :aria-label="t('admin.writer.chooseDraft')">
      <v-card>
        <v-card-title>{{ t('admin.writer.chooseDraft') }}</v-card-title>
        <v-card-text>
          <p class="mb-4">{{ t('admin.writer.chooseDraftHint') }}</p>
          <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
          <v-progress-linear v-if="loadingDrafts" indeterminate />
          <v-list v-else-if="drafts.length" bg-color="transparent">
            <v-list-item v-for="draft in drafts" :key="draft.id" class="draft-preview-item" prepend-icon="mdi-file-document-edit-outline" @click="selectDraft(draft).catch(showSaveError)"><v-list-item-title>{{ draft.title || t('admin.writer.untitledDraft') }}</v-list-item-title><template #append><ArticleDraftPreview :draft="draft" /></template></v-list-item>
          </v-list>
          <p v-else>{{ t('admin.writer.noDrafts') }}</p>
        </v-card-text>
        <v-card-actions><v-btn :to="{ name: HomeRoutes.AdminArticles }">{{ t('admin.writer.back') }}</v-btn><v-spacer /><v-btn color="primary" variant="flat" :disabled="loadingDrafts" @click="entryDialog = false">{{ t('admin.writer.newArticle') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="draftPanel" activator="#article-drafts-toggle" class="draft-panel-dialog" width="360" scrollable transition="slide-x-reverse-transition" :aria-label="t('admin.writer.drafts')">
      <v-card id="article-drafts-panel" class="draft-side-panel">
        <v-card-title class="draft-panel-heading"><h2>{{ t('admin.writer.drafts') }}</h2><v-btn icon="mdi-close" size="small" variant="text" :aria-label="t('common.close')" @click="draftPanel = false" /></v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">{{ error }}</v-alert>
          <v-list v-if="drafts.length > 0" class="draft-panel-list" bg-color="transparent">
            <v-list-item v-for="draft in drafts" :key="draft.id" class="draft-preview-item" rounded="lg" color="primary" :active="draft.id === currentDraftId" :disabled="publishing" @click="selectDraft(draft).catch(showSaveError)">
              <v-list-item-title>{{ draft.title || t('admin.writer.untitledDraft') }}</v-list-item-title>
              <div class="draft-preview-uid">{{ t('admin.writer.uid', { uid: draft.uid }) }}</div>
              <template #append><ArticleDraftPreview :draft="draft" /><v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" :aria-label="t('admin.writer.deleteDraft')" :disabled="publishing" @click.stop="deleteDraft(draft.id).catch(showSaveError)" /></template>
            </v-list-item>
          </v-list>
          <div v-else class="draft-panel-empty"><v-icon icon="mdi-file-document-outline" size="36" /><p>{{ t('admin.writer.noDrafts') }}</p></div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="scheduleDialog" max-width="420">
      <v-card>
        <v-card-title>{{ t('admin.writer.publishOnDate') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="publishedAt" type="datetime-local" :label="t('admin.writer.publicationDate')" />
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="scheduleDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="publishing" @click="saveArticle('published', publishedAt)">{{ t('admin.writer.validateDate') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="tagDialog" max-width="620" scrollable :aria-label="t('admin.writer.manageTags')">
      <v-card class="tag-manager">
        <div class="tag-manager-heading"><div class="tag-manager-emblem"><v-icon icon="mdi-tag-multiple-outline" size="25" /></div><div><h2>{{ t('admin.writer.manageTags') }}</h2><p>{{ t('admin.writer.tagsHint') }}</p></div><v-btn class="ml-auto" icon="mdi-close" variant="text" size="small" :aria-label="t('common.close')" @click="tagDialog = false" /></div>
        <v-card-text class="tag-manager-content">
          <v-alert v-if="tagError" type="error" variant="tonal" density="compact" class="mb-4">{{ tagError }}</v-alert>
          <form class="tag-create-form" @submit.prevent="createTag">
            <div class="tag-section-heading"><v-icon icon="mdi-plus-circle-outline" size="17" /><h3>{{ t('admin.writer.addTag') }}</h3></div>
            <div class="tag-create-controls"><v-text-field v-model="newTag" :label="t('admin.writer.tagName')" :placeholder="t('admin.writer.tagPlaceholder')" maxlength="80" variant="outlined" density="comfortable" hide-details="auto" :error-messages="duplicateTag ? t('admin.writer.duplicateTag') : ''" :disabled="!!tagBusy" /><v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-plus" :loading="tagBusy === 'create'" :disabled="!!tagBusy || !newTag.trim() || duplicateTag">{{ t('admin.writer.addTag') }}</v-btn></div>
            <p class="tag-create-hint">{{ t('admin.writer.newTagHint') }}</p>
          </form>
          <div class="tag-section-heading tag-existing-heading"><h3>{{ t('admin.writer.existingTags') }}</h3><span>{{ tags.length }}</span></div>
          <div v-if="!tags.length" class="tag-manager-empty"><v-icon icon="mdi-tag-outline" size="34" /><p>{{ t('admin.writer.noTags') }}</p></div>
          <div v-else class="tag-manager-list">
            <div v-for="tag in tags" :key="tag.id" class="tag-manager-row">
              <v-icon icon="mdi-pound" class="tag-row-icon" size="18" />
              <v-text-field v-model="tagEdits[tag.id]" :aria-label="t('admin.writer.editTag', { name: tag.name })" maxlength="80" variant="plain" density="compact" hide-details :disabled="!!tagBusy" @keydown.enter.prevent="renameTag(tag.id)" />
              <v-btn icon="mdi-check" size="small" variant="tonal" color="primary" :title="t('admin.writer.saveTag')" :aria-label="t('admin.writer.saveTag')" :loading="tagBusy === tag.id + ':save'" :disabled="!!tagBusy || !tagEdits[tag.id]?.trim() || tagEdits[tag.id]?.trim() === tag.name" @click="renameTag(tag.id)" />
              <v-btn icon="mdi-trash-can-outline" size="small" variant="text" color="error" :title="t('admin.writer.removeTag')" :aria-label="t('admin.writer.removeTag')" :loading="tagBusy === tag.id + ':delete'" :disabled="!!tagBusy" @click="deleteTag(tag.id)" />
            </div>
          </div>
        </v-card-text>
        <v-card-actions class="tag-manager-footer"><span><v-icon icon="mdi-check-circle-outline" size="14" />{{ t('admin.writer.tagsImmediate') }}</span><v-spacer /><v-btn variant="tonal" @click="tagDialog = false">{{ t('common.close') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { emptyDocument, documentHasContent, type ArticleTranslations } from 'netlify/core/articles/document';
import { useI18n } from 'vue-i18n';
import type { ArticleDraft, ArticleTag, ArticleCategory } from 'netlify/core/types/data.types';
import { AdminArticlesService, ArticlesService } from 'core/services/articles.service';
import { HomeRoutes } from 'core/routes';
import { notifications } from 'core/services/notifications.service';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import ArticleDraftPreview from './ArticleDraftPreview.component.vue';
import ArticleEditor from './ArticleEditor.component.vue';

const { t, locale } = useI18n();
const entryDialog = ref(true);
const editorSession = ref(0);
const loadingDrafts = ref(true);
const savedDraft = ref<ArticleDraft>();
const editorName = computed(() => DiscordService.getInstance().user.value?.username ?? '');
const savedDate = computed(() => {
  const date = new Date(savedDraft.value?.updatedAt ?? '');
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
});
const blankTranslations = (): ArticleTranslations => ({ en: { title: '', introduction: '', document: emptyDocument() } });
const translations = ref<ArticleTranslations>(blankTranslations());
const publishing = ref(false);
let revision = 0;
let draftEpoch = 0;
let saveQueue: Promise<void> = Promise.resolve();
const selectedCategoryIds = ref<string[]>([]);
const categories = ref<ArticleCategory[]>([]);
const selectedTagIds = ref<string[]>([]);
const tags = ref<ArticleTag[]>([]);
const drafts = ref<ArticleDraft[]>([]);
const draftPanel = ref(false);
const currentDraftId = ref<string | undefined>();
const error = ref<string | null>(null);
const scheduleDialog = ref(false);
const tagDialog = ref(false);
const publishedAt = ref('');
const dirty = ref(false);
const articleUid = ref('');
const copyingUid = ref(false);
const tagEdits = reactive<Record<string, string>>({});
const newTag = ref('');
const tagError = ref('');
const tagBusy = ref('');
const duplicateTag = computed(() => tags.value.some(tag => tag.name.toLocaleLowerCase() === newTag.value.trim().toLocaleLowerCase()));
let autosave: number | null = null;
let draftCreation: Promise<void> | null = null;

const hasContent = computed(() => Object.values(translations.value).some(item => item.title.trim() || item.introduction.trim() || documentHasContent(item.document)) || selectedTagIds.value.length > 0 || selectedCategoryIds.value.length > 0);

function markSaved(text: string) {
  error.value = null;
  dirty.value = false;
  notifications.success(text);
}

async function loadTags(savedId?: string) {
  const previous = new Map(tags.value.map(tag => [tag.id, tag.name]));
  tags.value = await ArticlesService.listTags();
  for (const tag of tags.value) {
    if (!(tag.id in tagEdits) || tag.id === savedId || tagEdits[tag.id] === previous.get(tag.id)) tagEdits[tag.id] = tag.name;
  }
  for (const id of Object.keys(tagEdits)) if (!tags.value.some(tag => tag.id === id)) delete tagEdits[id];
}

async function loadDrafts() {
  drafts.value = await AdminArticlesService.listDrafts();
}

async function updateTags(key: string, action: () => Promise<void>) {
  if (tagBusy.value) return;
  tagBusy.value = key; tagError.value = '';
  try { await action(); }
  catch (caught) { tagError.value = caught instanceof Error ? caught.message : t('admin.writer.tagsError'); }
  finally { tagBusy.value = ''; }
}
async function createTag() {
  const name = newTag.value.trim();
  if (!name || duplicateTag.value) return;
  await updateTags('create', async () => {
    const tag = await AdminArticlesService.createTag(name);
    newTag.value = '';
    selectedTagIds.value = [...new Set([...selectedTagIds.value, tag.id])];
    await loadTags();
  });
}
async function renameTag(tagId: string) {
  const name = tagEdits[tagId]?.trim();
  if (!name || name === tags.value.find(tag => tag.id === tagId)?.name) return;
  await updateTags(`${tagId}:save`, async () => { await AdminArticlesService.renameTag(tagId, name); await loadTags(tagId); });
}
async function deleteTag(tagId: string) {
  await updateTags(`${tagId}:delete`, async () => {
    await AdminArticlesService.deleteTag(tagId);
    selectedTagIds.value = selectedTagIds.value.filter(id => id !== tagId);
    await loadTags();
  });
}

function showSaveError(caught: unknown) { error.value = caught instanceof Error ? caught.message : t('admin.writer.draftError'); }

async function saveCurrentDraft() {
  const epoch = draftEpoch;
  const job = async () => {
    await draftCreation;
    if (entryDialog.value || (!currentDraftId.value && !hasContent.value)) return;
    if (epoch !== draftEpoch) return;
    const snapshot = JSON.parse(JSON.stringify(translations.value));
    const tagSnapshot = [...selectedTagIds.value];
    const savedRevision = revision;
    const draft = await AdminArticlesService.saveDraft({ id: currentDraftId.value, translations: snapshot, selectedTagIds: tagSnapshot, selectedCategoryIds: [...selectedCategoryIds.value] });
    if (epoch !== draftEpoch) return;
    currentDraftId.value = draft.id;
    savedDraft.value = draft;
    articleUid.value = draft.uid;
    await loadDrafts();
    if (revision === savedRevision) markSaved(t('admin.writer.draftSaved'));
  };
  const pending = saveQueue.then(job);
  saveQueue = pending.catch(() => {});
  return pending;
}

async function createInitialDraft(forUpload = false) {
  if (currentDraftId.value || (!forUpload && !hasContent.value) || entryDialog.value) return;
  if (!draftCreation) {
    draftCreation = (async () => {
      const draft = await AdminArticlesService.saveDraft({
        translations: JSON.parse(JSON.stringify(translations.value)),
        selectedTagIds: [...selectedTagIds.value],
        selectedCategoryIds: [...selectedCategoryIds.value],
      });
      currentDraftId.value = draft.id;
      savedDraft.value = draft;
      articleUid.value = draft.uid;
      await loadDrafts();
    })().finally(() => {
      draftCreation = null;
    });
  }
  await draftCreation;
}

async function selectDraft(draft: ArticleDraft) {
  if (publishing.value) return;
  if (draft.id === currentDraftId.value) { draftPanel.value = false; return; }
  await draftCreation;
  if ((hasContent.value || currentDraftId.value) && dirty.value) {
    const shouldSave = window.confirm(t('admin.writer.saveBeforeSwitch'));
    if (shouldSave) await saveCurrentDraft();
  }
  await saveQueue;
  draftEpoch++;
  editorSession.value++;
  currentDraftId.value = draft.id;
  savedDraft.value = draft;
  entryDialog.value = false;
  articleUid.value = draft.uid;
  translations.value = JSON.parse(JSON.stringify(draft.translations!));
  selectedTagIds.value = draft.selectedTagIds;
  selectedCategoryIds.value = draft.selectedCategoryIds ?? [];
  dirty.value = false;
  draftPanel.value = false;
}

async function deleteDraft(draftId: string) {
  if (publishing.value) return;
  await draftCreation;
  await saveQueue;
  draftEpoch++;
  await AdminArticlesService.deleteDraft(draftId);
  if (currentDraftId.value === draftId) {
    editorSession.value++;
    currentDraftId.value = undefined;
    articleUid.value = '';
    savedDraft.value = undefined;
    translations.value = blankTranslations();
    selectedTagIds.value = [];
    selectedCategoryIds.value = [];
    dirty.value = false;
  }
  await loadDrafts();
}

async function saveArticle(status: 'unpublished' | 'published', date?: string) {
  if (publishing.value) return;
  publishing.value = true;
  try {
    await saveQueue;
    await createInitialDraft();
    const article = await AdminArticlesService.createArticle({
      translations: translations.value,
      tagIds: selectedTagIds.value,
      categoryIds: selectedCategoryIds.value,
      status,
      publishedAt: date ? new Date(date).toISOString() : null,
      draftId: currentDraftId.value,
    });
    const savedDraftId = currentDraftId.value;
    if (savedDraftId) {
      drafts.value = drafts.value.filter((draft) => draft.id !== savedDraftId);
    }
    scheduleDialog.value = false;
    draftEpoch++;
    editorSession.value++;
    translations.value = blankTranslations();
    selectedTagIds.value = [];
    selectedCategoryIds.value = [];
    currentDraftId.value = undefined;
    savedDraft.value = undefined;
    articleUid.value = article.uid;
    markSaved(status === 'published' ? t('admin.writer.published') : t('admin.writer.saved'));
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('admin.writer.saveError');
  } finally { publishing.value = false; }
}

async function copyArticleUid() {
  if (!articleUid.value) return;
  copyingUid.value = true;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(articleUid.value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = articleUid.value;
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
    copyingUid.value = false;
  }
}

watch([translations, selectedTagIds, selectedCategoryIds], () => {
  revision++;
  dirty.value = true;
}, { deep: true, flush: 'sync' });

onMounted(async () => {
  try { await Promise.all([loadTags(), loadDrafts(), ArticlesService.listCategories().then(value => { categories.value = value; })]); }
  catch (caught) { showSaveError(caught); }
  finally { loadingDrafts.value = false; }
  autosave = window.setInterval(() => {
    if (!entryDialog.value && !publishing.value && dirty.value && (currentDraftId.value || hasContent.value)) {
      saveCurrentDraft().catch((caught) => {
        error.value = caught instanceof Error ? caught.message : t('admin.writer.draftError');
      });
    }
  }, 15000);
});

onUnmounted(() => {
  if (autosave) window.clearInterval(autosave);
});
</script>

<style scoped>
.draft-preview-item { padding-top: 12px; padding-bottom: 12px; }
.draft-preview-uid { margin-top: 6px; font-size: .65rem; opacity: .45; font-family: monospace; }
.draft-save-info { display: flex; align-items: center; gap: 8px; margin-right: auto; padding: 8px; color: rgba(var(--v-theme-on-surface), .65); font-size: .78rem; }
.tag-manager { border:1px solid rgba(var(--v-theme-primary),.2); border-radius:20px !important; }
.tag-manager-heading { display:flex; align-items:center; gap:14px; padding:22px 24px; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); background:linear-gradient(120deg, rgba(var(--v-theme-primary),.08), transparent); }
.tag-manager-emblem { display:grid; place-items:center; flex-shrink:0; width:46px; height:46px; border-radius:14px; color:rgb(var(--v-theme-primary)); background:rgba(var(--v-theme-primary),.12); }
.tag-manager-heading h2 { font-size:1.15rem; font-weight:650; }
.tag-manager-heading p { margin-top:4px; font-size:.76rem; color:rgba(var(--v-theme-on-surface),.6); line-height:1.5; }
.tag-manager-content { padding:24px !important; }
.tag-create-form { padding:16px; border:1px solid rgba(var(--v-theme-primary),.18); border-radius:14px; background:rgba(var(--v-theme-primary),.045); }
.tag-section-heading { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
.tag-section-heading h3 { font-size:.78rem; font-weight:600; }
.tag-section-heading > .v-icon { color:rgb(var(--v-theme-primary)); }
.tag-create-controls { display:flex; align-items:flex-start; gap:10px; }
.tag-create-controls > .v-btn { margin-top:5px; }
.tag-create-controls :deep(.v-field) { border-radius:10px; }
.tag-create-hint { margin-top:10px; color:rgba(var(--v-theme-on-surface),.5); font-size:.7rem; line-height:1.5; }
.tag-existing-heading { margin-top:24px; }
.tag-existing-heading span { padding:2px 7px; border-radius:6px; font-size:.67rem; background:rgba(var(--v-theme-on-surface),.07); color:rgba(var(--v-theme-on-surface),.6); }
.tag-manager-list { display:grid; gap:8px; }
.tag-manager-row { display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid rgba(var(--v-theme-on-surface),.08); border-radius:12px; background:rgba(var(--v-theme-on-surface),.025); }
.tag-manager-row:focus-within { border-color:rgba(var(--v-theme-primary),.45); }
.tag-row-icon { color:rgba(var(--v-theme-primary),.6); }
.tag-manager-row :deep(.v-field__input) { padding-top:5px; padding-bottom:5px; min-height:36px; font-size:.85rem; }
.tag-manager-empty { display:grid; justify-items:center; gap:10px; padding:24px 12px; border:1px dashed rgba(var(--v-theme-on-surface),.12); border-radius:12px; color:rgba(var(--v-theme-on-surface),.45); font-size:.8rem; }
.tag-manager-footer { padding:14px 24px; border-top:1px solid rgba(var(--v-theme-on-surface),.08); }
.tag-manager-footer > span { display:flex; align-items:center; gap:6px; color:rgba(var(--v-theme-on-surface),.45); font-size:.65rem; }
@media (max-width:600px) { .tag-manager-heading { padding:18px 16px; gap:10px; } .tag-manager-content { padding:16px !important; } .tag-create-controls { flex-direction:column; } .tag-create-controls > .v-input, .tag-create-controls > .v-btn { width:100%; } .tag-manager-footer { padding:12px 16px; } }
.admin-card {
  border-radius: 8px;
}

.writer-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.article-uid {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-family: monospace;
  font-size: 0.875rem;
}
.draft-panel-dialog { align-items: stretch; justify-content: flex-end; }
.draft-panel-dialog :deep(.v-overlay__content) { margin: 0; height: 100%; max-height: 100%; max-width: 100vw; }
.draft-side-panel { height: 100%; border-radius: 0 !important; border-left: 1px solid rgba(var(--v-theme-primary), .18); }
.draft-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px; }
.draft-panel-heading h2 { font-size: 1.1rem; font-weight: 600; }
.draft-panel-list .v-list-item { margin-bottom: 6px; }
.draft-panel-empty { display: grid; justify-items: center; gap: 12px; padding: 48px 12px; color: rgba(var(--v-theme-on-surface), .55); text-align: center; }
</style>
