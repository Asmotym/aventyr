<template>
  <Transition name="room-backdrop">
    <div v-if="modelValue && backdrop" class="room-slide-panel__room-panel-backdrop" aria-hidden="true" @click="requestClose" />
  </Transition>
  <Transition name="room-slide" @after-leave="restoreFocus">
    <section v-bind="$attrs" v-show="modelValue" ref="panel" class="room-slide-panel" :class="{ 'room-slide-panel--backdrop': backdrop, 'room-slide-panel--custom-width': !!width }" :style="{ '--room-slide-panel-width': width }" role="dialog" :aria-modal="modal === false ? undefined : true" :aria-label="label" tabindex="-1">
      <slot />
    </section>
  </Transition>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{ modelValue: boolean; label: string; width?: string; backdrop?: boolean; modal?: boolean; beforeClose?: () => boolean }>(), { modal: true });
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const panel = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';
function restoreFocus() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused.closest('.room-slide-panel') && !panel.value?.contains(focused)) return;
  if (!previousFocus) return;
  const fallback = panel.value?.closest(".room-chat-panel__room-panel-host")?.querySelector<HTMLElement>('[data-room-panel-trigger]');
  const target = previousFocus.isConnected && previousFocus.getClientRects().length ? previousFocus : fallback;
  if (target && !target.closest('[inert]')) target.focus({ preventScroll: true });
}
function requestClose() {
  if (!props.beforeClose || props.beforeClose()) emit('update:modelValue', false);
}
function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue || event.defaultPrevented || document.querySelector('.v-overlay--active:not(.v-tooltip):not(.v-snackbar)')) return;
  const visiblePanels = [...document.querySelectorAll<HTMLElement>('.room-slide-panel')].filter(element => element.getClientRects().length);
  if (event.key === 'Escape') {
    if (visiblePanels[visiblePanels.length - 1] !== panel.value) return;
    event.stopPropagation();
    requestClose();
  }
  if (event.key === 'Tab') {
    const modalPanels = visiblePanels.filter(element => element.getAttribute('aria-modal') === 'true');
    if (props.modal === false || modalPanels[modalPanels.length - 1] !== panel.value) return;
    const items = [...panel.value!.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (!first) { event.preventDefault(); panel.value?.focus({ preventScroll: true }); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.value?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
}
watch(() => props.modelValue, async open => {
  if (open) { previousFocus = document.activeElement as HTMLElement; await nextTick(); panel.value?.focus({ preventScroll: true }); }
}, { immediate: true });
onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeydown); restoreFocus(); });
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/room-slide-panel.scss"></style>
