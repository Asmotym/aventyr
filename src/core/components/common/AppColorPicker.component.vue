<template>
  <v-menu v-if="!inline" v-model="open" :close-on-content-click="false" location="bottom end" :offset="10" max-width="300">
    <template #activator="{ props: activator }"><v-btn v-bind="activator" class="app-color-trigger" variant="tonal" :disabled="disabled" :aria-label="label" :title="label"><span class="app-color-dot" :style="{ background: modelValue }" /><v-icon icon="mdi-palette-outline" size="21" /></v-btn></template>
    <div class="app-color-panel" @keydown.esc.stop="open = false">
      <ColorPanel />
    </div>
  </v-menu>
  <div v-else class="app-color-panel app-color-panel--inline"><ColorPanel /></div>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import { VBtn, VColorPicker, VIcon } from 'vuetify/components';
import { useI18n } from 'vue-i18n';
const props = defineProps<{ modelValue: string; label: string; disabled?: boolean; inline?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useI18n();
const open = ref(false), draft = ref(props.modelValue);
const valid = computed(() => /^#[0-9a-f]{6}$/i.test(draft.value));
watch(() => props.modelValue, value => { draft.value = value; });
watch(open, value => { if (value) draft.value = props.modelValue; });
function save() { if (!valid.value || props.disabled) return; emit('update:modelValue', draft.value.toLowerCase()); open.value = false; }
const ColorPanel = defineComponent({ setup: () => () => [
  h('div', { class: 'app-color-heading' }, [h(VIcon, { icon: 'mdi-palette-outline', size: 20 }), h('span', props.label)]),
  h(VColorPicker, { modelValue: draft.value, 'onUpdate:modelValue': (value: string) => { draft.value = value; }, mode: 'hex', hideInputs: true, width: 264, elevation: 0, disabled: props.disabled }),
  h('div', { class: 'app-color-controls' }, [h('span', { class: 'app-color-preview', style: { background: valid.value ? draft.value : 'transparent' } }), h('input', { value: draft.value, 'aria-label': t('articles.editor.hexColor'), maxlength: 7, spellcheck: false, disabled: props.disabled, onInput: (e: Event) => { draft.value = (e.target as HTMLInputElement).value; }, onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); save(); } } }), h(VBtn, { size: 'small', color: 'primary', variant: 'flat', disabled: !valid.value || props.disabled, onClick: save }, () => t('common.save'))])
] });
</script>
<style scoped>
.app-color-trigger { min-width: 56px; height: 44px; border-radius: 12px; padding-inline: 10px; }
.app-color-dot { width: 16px; height: 16px; border-radius: 5px; margin-right: 8px; border: 1px solid rgba(var(--v-border-color), .3); }
.app-color-panel { width: 288px; max-width: calc(100vw - 32px); padding: 12px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); box-shadow: 0 12px 40px rgba(0,0,0,.18); }
.app-color-panel--inline { width: 100%; max-width: 100%; box-shadow: none; padding: 8px; margin-top: 12px; }
.app-color-panel :deep(.app-color-heading) { display: flex; align-items: center; gap: 10px; padding: 8px; font-size: 13px; font-weight: 600; color: rgb(var(--v-theme-primary)); }
.app-color-panel :deep(.v-color-picker) { width: 100% !important; background: transparent; border-radius: 12px; overflow: hidden; }
.app-color-panel :deep(.v-color-picker__controls) { padding: 16px 8px; }
.app-color-panel :deep(.app-color-controls) { display: flex; align-items: center; gap: 8px; padding: 10px 4px 4px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.app-color-panel :deep(.app-color-preview) { width: 28px; height: 32px; flex-shrink: 0; border-radius: 7px; border: 1px solid rgba(var(--v-border-color), .3); }
.app-color-panel :deep(.app-color-controls input) { min-width: 0; width: 100%; padding: 8px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px; font-family: ui-monospace, monospace; font-size: 13px; }
.app-color-panel :deep(.app-color-controls input:focus-visible) { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
</style>
