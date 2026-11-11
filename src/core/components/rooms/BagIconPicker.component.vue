<template>
  <div class="d-flex align-center ga-2 mt-3">
    <v-menu v-model="open" :close-on-content-click="false" location="bottom start" :offset="6" :content-props="{ role: 'dialog', 'aria-label': label || t('bag.tabIcon') }">
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="outlined" :prepend-icon="model || 'mdi-emoticon-outline'">{{ label || t('bag.tabIcon') }}</v-btn>
      </template>
      <v-card class="bag-icon-picker" width="360">
        <div class="pa-3 pb-2">
          <v-text-field v-model="search" :placeholder="t('bag.searchIcons')" :aria-label="t('bag.searchIcons')" prepend-inner-icon="mdi-magnify" density="compact" variant="outlined" hide-details clearable autofocus @keydown.esc.stop="open = false" />
        </div>
        <div v-if="visibleRecent.length" class="px-3 pb-2">
          <p class="bag-icon-heading">{{ t('bag.recentIcons') }}</p>
          <div class="bag-icon-grid" @keydown="navigate">
            <v-btn v-for="icon in visibleRecent" :key="icon" :icon="icon" :aria-label="iconLabel(icon)" :title="iconLabel(icon)" :aria-pressed="model === icon" :variant="model === icon ? 'tonal' : 'text'" size="small" @click="select(icon)" />
          </div>
        </div>
        <p class="bag-icon-heading px-3">{{ t('bag.icons') }}</p>
        <v-virtual-scroll v-if="rows.length" :key="search || ''" :items="rows" :item-height="38" height="266" class="px-3 pb-3" @keydown="navigate">
          <template #default="{ item }">
            <div class="bag-icon-grid">
              <v-btn v-for="icon in item" :key="icon" :icon="icon" :aria-label="iconLabel(icon)" :title="iconLabel(icon)" :aria-pressed="model === icon" :variant="model === icon ? 'tonal' : 'text'" size="small" @click="select(icon)" />
            </div>
          </template>
        </v-virtual-scroll>
        <p v-else class="pa-4 text-body-2 text-medium-emphasis">{{ t('bag.noIcons') }}</p>
      </v-card>
    </v-menu>
    <v-btn v-if="model" icon="mdi-close" size="small" variant="text" :title="t('bag.removeIcon')" :aria-label="t('bag.removeIcon')" @click="model = null" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import icons from 'core/utils/bag-icons.json';
defineProps<{ label?: string }>();
const model = defineModel<string | null>();
const { t } = useI18n();
const open = ref(false), search = ref<string | null>('');
const storageKey = 'bag.recentIcons';
const validIcons = new Set(icons);
function loadRecent(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(stored) ? [...new Set(stored.filter((icon): icon is string => typeof icon === 'string' && validIcons.has(icon)))].slice(0, 16) : [];
  } catch { return []; }
}
const recent = ref(loadRecent());
const iconLabel = (icon: string) => icon.slice(4).replace(/-/g, ' ');
const matches = (icon: string) => iconLabel(icon).includes((search.value || '').trim().toLowerCase().replace(/-/g, ' ').replace(/^mdi /, ''));
const visibleRecent = computed(() => recent.value.filter(matches));
const rows = computed(() => {
  const filtered = icons.filter(matches);
  const result: string[][] = [];
  for (let i = 0; i < filtered.length; i += 8) result.push(filtered.slice(i, i + 8));
  return result;
});
function select(icon: string) {
  model.value = icon;
  recent.value = [icon, ...recent.value.filter(value => value !== icon)].slice(0, 16);
  try { localStorage.setItem(storageKey, JSON.stringify(recent.value)); } catch { /* Selection works without browser storage. */ }
  open.value = false;
}
function navigate(event: KeyboardEvent) {
  const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 } as Record<string, number>)[event.key];
  if (!offset || !(event.target instanceof HTMLButtonElement)) return;
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')];
  const next = buttons[buttons.indexOf(event.target) + offset];
  if (next) { event.preventDefault(); next.focus(); }
}
watch(open, value => { if (value) { search.value = ''; recent.value = loadRecent(); } });
</script>
<style scoped>
.bag-icon-picker { max-width: calc(100vw - 32px); }
.bag-icon-heading { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: rgba(var(--v-theme-on-surface), .65); }
.bag-icon-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); align-items: center; min-height: 38px; }
.bag-icon-grid .v-btn { width: 100%; max-width: 36px; height: 34px; border-radius: 6px; }
</style>
