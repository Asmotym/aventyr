<template>
  <div class="rendered-article" v-html="displayHtml"></div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AdminArticleImagesService } from '@/features/articles/services/article-images.service';
import { getBackendUrl } from '@/shared/services/urls.utils';
const props = defineProps<{
  html: string;
  privateImages?: boolean;
}>();
const previews = ref<Record<string, string>>({});
let requestId = 0;
watch(() => [props.html, props.privateImages], async () => {
  const request = ++requestId;
  previews.value = {};
  if (!props.privateImages) return;
  const ids = [...new Set([...props.html.matchAll(/src="\/api\/article-images\/([a-f0-9-]{36})"/g)].map(match => match[1]))];
  const results = await Promise.all(ids.map(async id => {
    try { return [id, await AdminArticleImagesService.preview(id)] as const; }
    catch { return [id, ''] as const; }
  }));
  if (request === requestId) previews.value = Object.fromEntries(results);
}, { immediate: true });
const displayHtml = computed(() => props.html.replace(/src="(\/api\/article-images\/([a-f0-9-]{36}))"/g, (_match, path: string, id: string) => {
  const src = props.privateImages ? previews.value[id] ?? '' : `${getBackendUrl().replace(/\/$/, '')}${path}`;
  return src ? `src="${src}"` : '';
}));
</script>

<style scoped lang="scss" src="@/assets/styles/features/articles/rendered-article.scss"></style>
