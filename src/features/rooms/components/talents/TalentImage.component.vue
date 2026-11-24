<template><img v-if="url" :src="url" :alt="alt || ''" v-bind="$attrs" /><v-icon v-else :icon="icon || 'mdi-star-four-points'" v-bind="$attrs" /></template>
<script setup lang="ts">
import { useObjectUrl } from '@/shared/composables/useObjectUrl';
import { talentImageRequest } from '@/features/rooms/services/talents.service';
defineOptions({ inheritAttrs: false });
const props = defineProps<{ roomId: string; imageId?: string | null; icon?: string | null; alt?: string }>();
const url = useObjectUrl(() => props.imageId
  ? talentImageRequest(props.roomId, props.imageId).then(response => response.blob())
  : null);
</script>
