<template>
  <div class="talent-appearance">
    <span class="talent-appearance-preview" :style="talentColorStyle(target.color)"><TalentImage :room-id="roomId" :image-id="target.imageId" :icon="target.icon" /></span>
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
<style scoped>
.talent-appearance { display:flex; align-items:center; gap:14px; }.talent-appearance-preview { display:grid; place-items:center; width:64px; height:72px; border-radius:16px; border:1px solid rgba(var(--talent-accent, var(--v-theme-primary)),.2); background:rgba(var(--talent-accent, var(--v-theme-primary)),.045); color:rgb(var(--talent-accent, var(--v-theme-primary))); flex-shrink:0; }.talent-appearance-preview :deep(img) { width:36px; height:36px; object-fit:contain; }.talent-appearance-preview :deep(.v-icon) { font-size:32px; }.talent-appearance > div { min-width:0; flex:1; display:flex; flex-direction:column; gap:8px; }.talent-appearance :deep(.mt-3) { margin-top:0 !important; }.talent-appearance :deep(.v-btn) { max-width:100%; font-size:11px; }.talent-appearance :deep(.v-field__input) { font-size:11px; }.talent-appearance :deep(.v-field__prepend-inner > .v-icon) { font-size:18px; }
</style>
