<template>
  <div class="rendered-article" v-html="displayHtml"></div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AdminArticleImagesService } from 'core/services/article-images.service';
import { getBackendUrl } from 'modules/discord-auth/utils/urls.utils';
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

<style scoped>
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

.rendered-article :deep(p:last-child),
.rendered-article :deep(ul:last-child),
.rendered-article :deep(ol:last-child),
.rendered-article :deep(blockquote:last-child),
.rendered-article :deep(pre:last-child),
.rendered-article :deep(table:last-child) {
  margin-bottom: 0;
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
.rendered-article :deep(ul[data-type="taskList"]) { list-style: none; padding-left: 0; }
.rendered-article :deep(li[data-type="taskItem"]) { display: flex; gap: 8px; }
.rendered-article :deep(li[data-type="taskItem"] > div) { flex: 1; }
.rendered-article :deep(li[data-type="taskItem"] input) { margin: 0; vertical-align: middle; }
</style>
