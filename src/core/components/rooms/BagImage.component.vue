<template><img v-if="url" :src="url" :alt="alt || ''" /></template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { bagImageRequest } from 'core/services/bag-images.service';
const props = defineProps<{ roomId: string; imageId: string; alt?: string }>();
const url = ref(''); let generation = 0;
watch(() => [props.roomId, props.imageId], async () => {
  const current = ++generation;
  if (url.value) URL.revokeObjectURL(url.value); url.value = '';
  try { const response = await bagImageRequest(props.roomId, props.imageId); const blob = await response.blob(); if (generation === current) url.value = URL.createObjectURL(blob); } catch { /* Optional image remains absent if access expires. */ }
}, { immediate: true });
onBeforeUnmount(() => { generation++; if (url.value) URL.revokeObjectURL(url.value); });
</script>
