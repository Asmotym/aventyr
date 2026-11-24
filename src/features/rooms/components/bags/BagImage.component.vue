<template>
  <img v-if="url" :key="url" v-show="loaded" v-bind="$attrs" :src="url" :alt="alt || ''" @load="loaded = true" @error="loaded = false" />
  <v-icon v-if="!loaded && icon" v-bind="$attrs" :icon="icon" :size="iconSize" aria-hidden="true" />
</template>
<script setup lang="ts">
import { ref, watch, inject } from 'vue';
import { useObjectUrl } from '@/shared/composables/useObjectUrl';
import { bagImageRequest } from '@/features/rooms/services/bag-images.service';
defineOptions({ inheritAttrs: false });
const props = defineProps<{ roomId: string; imageId?: string | null; icon?: string | null; iconSize?: number | string; alt?: string }>();
const devBagUserId = inject<string | undefined>('devBagUserId', undefined);
const url = useObjectUrl(() => props.imageId
  ? bagImageRequest(props.roomId, props.imageId, undefined, undefined, devBagUserId).then(response => response.blob())
  : null);
const loaded = ref(false);
watch(url, () => { loaded.value = false; });
</script>
