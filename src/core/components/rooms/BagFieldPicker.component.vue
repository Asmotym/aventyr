<template>
  <v-dialog v-model="open" class="bag-field-picker-dialog" max-width="680" scrollable>
    <v-card class="bag-field-picker"><v-card-title class="bag-templates-title"><v-icon icon="mdi-text-box-plus-outline" class="mr-3" />{{ t('bag.addField') }}</v-card-title>
      <v-card-text>
        <p class="bag-templates-intro">{{ t('bag.addFieldIntro') }}</p>
        <div class="bag-field-quick-options">
          <button v-for="type in (['string', 'integer'] as const)" :key="type" type="button" :disabled="disabled" class="bag-field-quick-option" @click="select(type)"><v-avatar :color="templateAppearance(type).color" size="40" variant="tonal"><v-icon :icon="templateAppearance(type).icon" /></v-avatar><span><strong>{{ t('bag.types.' + type) }}</strong><small>{{ t(type === 'string' ? 'bag.stringFieldHint' : 'bag.integerFieldHint') }}</small></span><v-icon icon="mdi-plus" size="20" /></button>
        </div>
        <v-tabs v-model="fieldCatalog" color="primary" class="mt-4"><v-tab value="mine" prepend-icon="mdi-lock-outline">{{ t('bag.myFields') }}</v-tab><v-tab value="public" prepend-icon="mdi-earth">{{ t('bag.publicFields') }}</v-tab></v-tabs>
        <v-text-field v-model="fieldSearch" :label="t('bag.searchFields')" prepend-inner-icon="mdi-magnify" variant="outlined" density="compact" hide-details clearable class="my-4" />
        <div class="bag-field-catalog">
          <button v-for="template in filteredFieldCatalog" :key="template.id" type="button" :disabled="disabled" class="bag-field-catalog-entry" @click="select(template)"><v-avatar :color="templateAppearance(template.type).color" size="34" variant="tonal"><v-icon :icon="templateAppearance(template.type).icon" size="20" /></v-avatar><span><strong>{{ template.name }}</strong><small>{{ t('bag.types.' + template.type) }}<template v-if="fieldCatalog === 'public'"> · {{ memberName(template.ownerId || '') }}</template></small></span><v-icon icon="mdi-plus-circle-outline" color="primary" size="22" /></button>
          <div v-if="!filteredFieldCatalog.length" class="bag-template-empty"><v-icon :icon="fieldCatalog === 'public' ? 'mdi-earth' : 'mdi-shape-outline'" size="32" /><p>{{ t('bag.noMatchingFields') }}</p></div>
        </div>
      </v-card-text>
      <v-card-actions class="bag-templates-footer"><v-btn v-if="canManage" prepend-icon="mdi-shape-outline" variant="tonal" @click="manage">{{ t('bag.customFields') }}</v-btn><v-spacer /><v-btn @click="open = false">{{ t('common.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BagTemplate } from 'netlify/core/types/bag.types';
const open = defineModel<boolean>({ default: false });
const props = withDefaults(defineProps<{ templates?: BagTemplate[]; publicTemplates?: BagTemplate[]; excludedNames?: string[]; disabled?: boolean; canManage?: boolean; memberName: (id: string) => string }>(), { templates: () => [], publicTemplates: () => [], excludedNames: () => [] });
const emit = defineEmits<{ select: [value: 'string' | 'integer' | BagTemplate]; manage: [] }>();
const { t } = useI18n();
const fieldCatalog = ref('mine'), fieldSearch = ref<string | null>('');
const filteredFieldCatalog = computed(() => {
  const source = fieldCatalog.value === 'mine' ? props.templates : props.publicTemplates;
  const excluded = new Set(props.excludedNames.map(name => name.trim().toLowerCase()));
  const query = (fieldSearch.value || '').trim().toLocaleLowerCase();
  return source.filter(field => !excluded.has(field.name.trim().toLowerCase()) && (field.name + ' ' + t('bag.types.' + field.type) + ' ' + field.options.join(' ')).toLocaleLowerCase().includes(query));
});
function templateAppearance(type: BagTemplate['type']) {
  return ({ string: { icon: 'mdi-format-text', color: 'blue' }, integer: { icon: 'mdi-numeric', color: 'teal' }, select: { icon: 'mdi-form-select', color: 'purple' }, 'multi-select': { icon: 'mdi-format-list-checks', color: 'orange' } })[type];
}
function select(value: 'string' | 'integer' | BagTemplate) { if (props.disabled) return; emit('select', value); open.value = false; }
function manage() { open.value = false; emit('manage'); }
watch(open, value => { if (value) { fieldSearch.value = ''; fieldCatalog.value = 'mine'; } });
</script>
<style scoped>
.bag-field-quick-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bag-field-quick-option, .bag-field-catalog-entry { display: flex; align-items: center; text-align: start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid rgba(var(--v-theme-on-surface), .15); border-radius: 10px; background: rgba(var(--v-theme-on-surface), .035); color: rgb(var(--v-theme-on-surface)); cursor: pointer; }
.bag-field-quick-option > span, .bag-field-catalog-entry > span { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.bag-field-quick-option strong, .bag-field-catalog-entry strong { font-size: 14px; overflow-wrap: anywhere; }
.bag-field-quick-option small, .bag-field-catalog-entry small { font-size: 12px; color: rgba(var(--v-theme-on-surface), .65); }
.bag-field-quick-option:hover, .bag-field-catalog-entry:hover { background: rgba(var(--v-theme-primary), .08); border-color: rgba(var(--v-theme-primary), .5); }
.bag-field-quick-option:focus-visible, .bag-field-catalog-entry:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.bag-field-catalog { display: flex; flex-direction: column; gap: 8px; }
.bag-field-catalog-entry { padding: 12px; }

@media (max-width: 480px) { .bag-field-quick-options { grid-template-columns: minmax(0, 1fr); } }
.bag-templates-title { display: flex; align-items: center; padding: 20px 24px 16px; }
.bag-templates-intro { color: rgba(var(--v-theme-on-surface), .7); font-size: 13px; line-height: 1.6; margin: 0 0 24px; max-width: 760px; }
.bag-template-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 36px 20px; border: 1px dashed rgba(var(--v-theme-on-surface), .2); border-radius: 10px; color: rgba(var(--v-theme-on-surface), .6); }
.bag-template-empty p { font-size: 13px; line-height: 1.5; }
.bag-templates-footer { border-top: 1px solid rgba(var(--v-theme-on-surface), .1); padding: 12px 20px; }
.bag-field-quick-option:disabled, .bag-field-catalog-entry:disabled { opacity: .5; cursor: default; }
</style>
