<template>
  <Transition name="room-slide" @after-leave="restoreFocus">
    <section v-show="modelValue" ref="panel" class="room-slide-panel" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1">
      <slot />
    </section>
  </Transition>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps<{ modelValue: boolean; label: string; beforeClose?: () => boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const panel = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';
function restoreFocus() { if (previousFocus?.isConnected) previousFocus.focus(); }
function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue || event.defaultPrevented || document.querySelector('.v-overlay--active')) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    if (!props.beforeClose || props.beforeClose()) emit('update:modelValue', false);
  }
  if (event.key === 'Tab') {
    const items = [...panel.value!.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (!first) { event.preventDefault(); panel.value?.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.value?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
}
watch(() => props.modelValue, async open => {
  if (open) { previousFocus = document.activeElement as HTMLElement; await nextTick(); panel.value?.focus(); }
}, { immediate: true });
onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeydown); restoreFocus(); });
</script>
<style scoped>
.room-slide-panel { position: absolute; inset: 0; z-index: 10; background: rgb(var(--v-theme-surface)); display: flex; flex-direction: column; min-width: 0; overflow: hidden; outline: none; border-radius: inherit; }
.room-slide-panel :deep(> .v-card) { display: flex; flex-direction: column; flex: 1; min-height: 0; border-radius: inherit; }
.room-slide-panel :deep(> .v-card > .v-card-text) { overflow-y: auto; min-height: 0; }
.room-slide-panel :deep(.v-card-title) { flex-shrink: 0; white-space: normal; }
.room-slide-enter-active, .room-slide-leave-active { transition: transform 240ms ease; }
.room-slide-enter-from, .room-slide-leave-to { transform: translateX(100%); }
@media (prefers-reduced-motion: reduce) { .room-slide-enter-active, .room-slide-leave-active { transition: none; } }
</style>
