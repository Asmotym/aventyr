<template>
  <v-menu v-model="open" open-on-hover :open-on-click="true" :open-delay="250" :close-delay="150" :close-on-content-click="false" location="end top" :z-index="2700">
    <template #activator="{ props: previewProps }">
      <v-btn v-bind="previewProps" icon="mdi-eye-outline" variant="text" size="small" :aria-label="t('admin.writer.previewDraft')" :title="t('admin.writer.previewDraft')" aria-haspopup="dialog" @click.stop @keydown.stop @keydown.esc.prevent="open = false" />
    </template>
    <v-card class="draft-preview-popup" width="380" role="dialog" :aria-label="t('admin.writer.previewDraft')" @keydown.esc.stop="open = false">
      <div class="draft-preview-heading"><span><v-icon icon="mdi-file-document-outline" size="16" />{{ t('admin.writer.previewDraft') }}</span><v-btn icon="mdi-close" size="x-small" variant="text" :aria-label="t('common.close')" @click="open = false" /></div>
      <div class="draft-preview-page">
        <h3>{{ draft.title || t('admin.writer.untitledDraft') }}</h3>
        <p v-if="introduction" class="draft-preview-introduction">{{ introduction }}</p>
        <v-progress-linear v-if="loading" indeterminate class="my-4" />
        <v-alert v-else-if="error" type="error" density="compact">{{ error }}<v-btn variant="text" size="small" :aria-label="t('admin.writer.previewDraft')" icon="mdi-refresh" @click="load" /></v-alert>
        <div v-else class="draft-preview-blocks" @click.prevent><RenderedArticle :html="html" private-images /></div>
      </div>
      <div class="draft-preview-caption">{{ t('admin.writer.previewLimited') }}</div>
    </v-card>
  </v-menu>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleDraft } from 'netlify/core/types/data.types';
import { AdminArticlesService } from 'core/services/articles.service';
import RenderedArticle from '../articles/RenderedArticle.component.vue';
const props = defineProps<{ draft: ArticleDraft }>();
const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const error = ref('');
const html = ref('');
const introduction = computed(() => props.draft.translations?.en?.introduction ?? props.draft.introduction);
let generation = 0;
async function load() {
  const request = ++generation;
  loading.value = true; error.value = ''; html.value = '';
  try {
    const result = await AdminArticlesService.previewDraft(props.draft.id);
    if (request === generation) html.value = result;
  } catch (caught) { if (request === generation) error.value = caught instanceof Error ? caught.message : t('admin.writer.draftError'); }
  finally { if (request === generation) loading.value = false; }
}
watch(open, value => { if (value) void load(); else generation++; });
watch(() => [props.draft.id, props.draft.updatedAt], () => { generation++; if (open.value) void load(); });
onBeforeUnmount(() => { generation++; });
</script>
<style scoped>
.draft-preview-popup { max-width:calc(100vw - 32px); border:1px solid rgba(var(--v-theme-primary),.22); border-radius:14px !important; box-shadow:0 12px 40px #0005 !important; }
.draft-preview-heading { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid rgba(var(--v-theme-on-surface),.08); }
.draft-preview-heading > span { display:flex; align-items:center; gap:8px; color:rgba(var(--v-theme-on-surface),.55); font-size:.7rem; }
.draft-preview-page { padding:20px; max-height:min(380px, 60vh); overflow:hidden; background:rgba(var(--v-theme-primary),.025); }
.draft-preview-page h3 { font-size:1.2rem; line-height:1.3; margin-bottom:12px; }
.draft-preview-introduction { font-size:.8rem; line-height:1.6; opacity:.65; margin-bottom:16px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.draft-preview-blocks { pointer-events:none; font-size:.8rem; max-height:260px; overflow:hidden; mask-image:linear-gradient(#000 85%, transparent); }
.draft-preview-blocks :deep(h1), .draft-preview-blocks :deep(h2) { font-size:1.1rem; margin-top:12px; }
.draft-preview-blocks :deep(h3), .draft-preview-blocks :deep(h4) { font-size:.95rem; }
.draft-preview-blocks :deep(img) { max-height:130px; object-fit:contain; }
.draft-preview-caption { padding:8px 16px; border-top:1px solid rgba(var(--v-theme-on-surface),.07); color:rgba(var(--v-theme-on-surface),.45); font-size:.65rem; }
</style>
