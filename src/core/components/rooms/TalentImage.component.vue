<template><img v-if="url" :src="url" :alt="alt || ''" v-bind="$attrs" /><v-icon v-else :icon="icon || 'mdi-star-four-points'" v-bind="$attrs" /></template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { talentImageRequest } from 'core/services/talents.service';
defineOptions({ inheritAttrs: false });
const props = defineProps<{ roomId: string; imageId?: string | null; icon?: string | null; alt?: string }>();
const url = ref(''); let generation = 0;
watch(() => [props.roomId, props.imageId], async () => {
  const current = ++generation; if (url.value) URL.revokeObjectURL(url.value); url.value = '';
  if (!props.imageId) return;
  try { const response = await talentImageRequest(props.roomId, props.imageId); const blob = await response.blob(); if (current === generation) url.value = URL.createObjectURL(blob); } catch { /* Fall back to the library icon. */ }
}, { immediate: true });
onBeforeUnmount(() => { generation++; if (url.value) URL.revokeObjectURL(url.value); });
</script>
