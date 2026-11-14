<template>
  <img v-if="url" :key="url" v-show="loaded" v-bind="$attrs" :src="url" :alt="alt || ''" @load="loaded = true" @error="loaded = false" />
  <v-icon v-if="!loaded && icon" v-bind="$attrs" :icon="icon" :size="iconSize" aria-hidden="true" />
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount, inject } from 'vue';
import { bagImageRequest } from 'core/services/bag-images.service';
defineOptions({ inheritAttrs: false });
const props = defineProps<{ roomId: string; imageId?: string | null; icon?: string | null; iconSize?: number | string; alt?: string }>();
const devBagUserId = inject<string | undefined>('devBagUserId', undefined);
const url = ref(''), loaded = ref(false); let generation = 0;
watch(() => [props.roomId, props.imageId], async () => {
  const current = ++generation;
  if (url.value) URL.revokeObjectURL(url.value); url.value = ''; loaded.value = false;
  if (!props.imageId) return;
  try { const response = await bagImageRequest(props.roomId, props.imageId, undefined, undefined, devBagUserId); const blob = await response.blob(); if (generation === current) url.value = URL.createObjectURL(blob); } catch { /* Optional image remains absent if access expires. */ }
}, { immediate: true });
onBeforeUnmount(() => { generation++; if (url.value) URL.revokeObjectURL(url.value); });
</script>
