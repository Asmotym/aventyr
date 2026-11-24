<template>
  <v-menu v-model="open" open-on-hover :open-on-click="true" :open-delay="250" :close-delay="150" :close-on-content-click="false" location="end top" :z-index="2700">
    <template #activator="{ props: previewProps }">
      <v-btn v-bind="previewProps" icon="mdi-eye-outline" variant="text" size="small" :aria-label="t('admin.writer.previewDraft')" :title="t('admin.writer.previewDraft')" aria-haspopup="dialog" @click.stop @keydown.stop @keydown.esc.prevent="open = false" />
    </template>
    <v-card class="article-draft-preview__preview-popup" width="380" role="dialog" :aria-label="t('admin.writer.previewDraft')" @keydown.esc.stop="open = false">
      <div class="article-draft-preview__preview-heading"><span><v-icon icon="mdi-file-document-outline" size="16" />{{ t('admin.writer.previewDraft') }}</span><AppCloseButton size="x-small" @click="open = false" /></div>
      <div class="article-draft-preview__preview-page">
        <h3>{{ draft.title || t('admin.writer.untitledDraft') }}</h3>
        <p v-if="introduction" class="article-draft-preview__preview-introduction">{{ introduction }}</p>
        <v-progress-linear v-if="loading" indeterminate class="my-4" />
        <div v-else-if="error" class="error-recovery-actions"><v-btn variant="text" size="small" :aria-label="t('admin.writer.previewDraft')" icon="mdi-refresh" @click="load" /></div>
        <div v-else class="article-draft-preview__preview-blocks" @click.prevent><RenderedArticle :html="html" private-images /></div>
      </div>
      <div class="article-draft-preview__preview-caption">{{ t('admin.writer.previewLimited') }}</div>
    </v-card>
  </v-menu>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleDraft } from '@shared/articles/articles.types';
import { AdminArticlesService } from '@/features/articles/services/articles.service';
import RenderedArticle from '@/features/articles/components/RenderedArticle.component.vue';
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

useErrorNotifications(
  () => error.value,
);
</script>
<style scoped lang="scss" src="@/assets/styles/features/articles/article-draft-preview.scss"></style>
