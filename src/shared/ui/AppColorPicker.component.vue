<template>
  <v-menu v-if="!inline" v-model="open" :close-on-content-click="false" location="bottom end" :offset="10" max-width="300">
    <template #activator="{ props: activator }"><v-btn v-bind="activator" class="app-color-picker__app-color-trigger" variant="tonal" :disabled="disabled" :aria-label="label" :title="label"><span class="app-color-picker__app-color-dot" :style="{ '--app-color-picker-app-color-dot-background': modelValue }" /><v-icon icon="mdi-palette-outline" size="21" /></v-btn></template>
    <div class="app-color-picker__app-color-panel" @keydown.esc.stop="open = false">
      <ColorPanel />
    </div>
  </v-menu>
  <div v-else class="app-color-picker__app-color-panel app-color-picker__app-color-panel--inline"><ColorPanel /></div>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import { VBtn } from 'vuetify/components/VBtn';
import { VColorPicker } from 'vuetify/components/VColorPicker';
import { VIcon } from 'vuetify/components/VIcon';
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
  h('div', { class: "app-color-picker__app-color-heading" }, [h(VIcon, { icon: 'mdi-palette-outline', size: 20 }), h('span', props.label)]),
  h(VColorPicker, { modelValue: draft.value, 'onUpdate:modelValue': (value: string) => { draft.value = value; }, mode: 'hex', hideInputs: true, width: 264, elevation: 0, disabled: props.disabled }),
  h('div', { class: "app-color-picker__app-color-controls" }, [h('span', { class: "app-color-picker__app-color-preview", style: { background: valid.value ? draft.value : 'transparent' } }), h('input', { value: draft.value, 'aria-label': t('articles.editor.hexColor'), maxlength: 7, spellcheck: false, disabled: props.disabled, onInput: (e: Event) => { draft.value = (e.target as HTMLInputElement).value; }, onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); save(); } } }), h(VBtn, { size: 'small', color: 'primary', variant: 'flat', disabled: !valid.value || props.disabled, onClick: save }, () => t('common.save'))])
] });
</script>
<style scoped lang="scss" src="@/assets/styles/components/app-color-picker.scss"></style>
