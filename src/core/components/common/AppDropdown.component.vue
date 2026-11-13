<template>
  <component
    :is="autocomplete ? VAutocomplete : VSelect"
    v-bind="$attrs"
    class="app-dropdown"
    :model-value="modelValue"
    :items="items"
    :label="label"
    :aria-label="$attrs['aria-label'] ?? label"
    :multiple="multiple"
    :chips="chips ?? multiple"
    :closable-chips="closableChips ?? multiple"
    :loading="loading"
    :menu-props="menuProps"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #prepend-item v-if="!$slots['prepend-item'] && multiple">
      <div class="dropdown-heading">
        <span>{{ label }}</span>
        <span class="dropdown-count" role="status">{{ t('common.dropdown.selected', { count: selectedCount }) }}</span>
      </div>
    </template>
    <template #item="{ props: itemProps, item }" v-if="!$slots.item">
      <v-list-item v-bind="itemProps" role="option" :title="item.title" :prepend-icon="item.props.prependIcon || item.raw?.icon">
        <template #append="{ isSelected }">
          <v-icon v-if="multiple || isSelected" :icon="isSelected ? 'mdi-check-circle' : 'mdi-circle-outline'" class="dropdown-check" size="19" aria-hidden="true" />
        </template>
      </v-list-item>
    </template>
    <template #selection="{ item }" v-if="!$slots.selection && !multiple">
      <span class="dropdown-selection"><v-icon v-if="item.props.prependIcon || item.raw?.icon" :icon="item.props.prependIcon || item.raw?.icon" size="18" aria-hidden="true" />{{ item.title }}</span>
    </template>
    <template #no-data v-if="!$slots['no-data']">
      <div class="dropdown-empty" role="status">
        <v-icon :icon="loading ? 'mdi-dots-horizontal' : 'mdi-text-search'" size="28" aria-hidden="true" />
        <span>{{ t(loading ? 'common.dropdown.loading' : items.length ? 'common.dropdown.noMatching' : 'common.dropdown.empty') }}</span>
      </div>
    </template>
    <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps || {}" /></template>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { VAutocomplete, VSelect } from 'vuetify/components';

// Keep Vuetify's item/value shapes, field attributes, events and slots available to callers.
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  modelValue?: any;
  items?: readonly any[];
  label?: string;
  multiple?: boolean;
  chips?: boolean;
  closableChips?: boolean;
  autocomplete?: boolean;
  loading?: boolean | string;
  menuProps?: Record<string, any>;
}>(), { items: () => [], chips: undefined, closableChips: undefined });
const emit = defineEmits<{ 'update:modelValue': [value: any] }>();
const { t } = useI18n();
const selectedCount = computed(() => Array.isArray(props.modelValue) ? props.modelValue.length : 0);
</script>
