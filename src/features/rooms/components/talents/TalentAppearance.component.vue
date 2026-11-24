<template>
  <div class="talent-appearance">
    <span class="talent-appearance__preview" :style="talentColorStyle(target.color)"><TalentImage :room-id="roomId" :image-id="target.imageId" :icon="target.icon" /></span>
    <div><BagIconPicker v-model="target.icon" :label="t('talents.icon')" /><v-file-input accept="image/png,image/jpeg,image/webp" :label="t('talents.design.uploadImage')" :aria-label="t('talents.upload')" :title="t('talents.upload')" prepend-icon="" prepend-inner-icon="mdi-image-plus-outline" variant="outlined" density="compact" hide-details :disabled="uploading" @update:model-value="emit('upload', $event)" /><v-btn v-if="target.imageId" size="x-small" variant="text" color="primary" prepend-icon="mdi-close" @click="target.imageId = null">{{ t('talents.removeImage') }}</v-btn></div>
  </div>
</template>
<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { talentColorStyle } from '@/features/rooms/components/talents/talent-colors';
import type { TalentColor, TalentIcon } from '@shared/rooms/talents.types';
import TalentImage from '@/features/rooms/components/talents/TalentImage.component.vue';
const BagIconPicker = defineAsyncComponent(() => import('@/features/rooms/components/bags/BagIconPicker.component.vue'));
defineProps<{ target: TalentIcon & { color?: TalentColor }; roomId: string; uploading: boolean }>();
const emit = defineEmits<{ upload: [value: File | File[] | null] }>();
const { t } = useI18n();
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/talents/talent-appearance.scss"></style>
