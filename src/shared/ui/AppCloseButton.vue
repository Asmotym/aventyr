<template>
  <v-btn icon="mdi-close" variant="text" :aria-label="label ?? t('common.close')" v-bind="$attrs" />
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
defineOptions({ inheritAttrs: false });
defineProps<{ label?: string }>();
const { t } = useI18n();
</script>
