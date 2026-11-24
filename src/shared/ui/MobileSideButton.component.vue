<template>
  <v-btn
    class="mobile-side-button"
    color="primary"
    variant="flat"
    :aria-label="label"
    :title="label"
    :aria-expanded="expanded"
    :aria-controls="controls"
    aria-haspopup="dialog"
  >
    <v-icon :icon="icon" size="20" aria-hidden="true" />
    <span class="mobile-side-button__label">{{ label }}</span>
  </v-btn>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  icon: string;
  expanded: boolean;
  controls: string;
}>();
</script>

<style scoped lang="scss" src="@/assets/styles/components/mobile-side-button.scss"></style>
