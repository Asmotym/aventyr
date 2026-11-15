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

<style scoped>
.mobile-side-button { position: fixed; left: env(safe-area-inset-left, 0px); top: 45%; transform: translateY(-50%); z-index: 1005; width: 38px; min-width: 38px; height: auto; min-height: 112px; max-height: 70dvh; padding: 14px 8px; border-radius: 0 12px 12px 0; box-shadow: 3px 4px 16px rgba(0, 0, 0, .15); text-transform: none; letter-spacing: .03em; }
.mobile-side-button :deep(.v-btn__content) { flex-direction: column; gap: 10px; }
.mobile-side-button__label { writing-mode: vertical-rl; font-size: 11px; font-weight: 700; white-space: nowrap; }
.mobile-side-button:focus-visible { outline: 2px solid rgb(var(--v-theme-on-surface)); outline-offset: 3px; }
</style>
