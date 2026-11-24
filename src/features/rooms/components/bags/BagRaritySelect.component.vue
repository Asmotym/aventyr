<template>
    <AppDropdown v-model="model" :label="t('bag.rarity')" :aria-label="t('bag.rarity')" :items="rarities">
      <template #selection="{ item }">
        <span class="bag-rarity-selection" :style="{ background: item.raw.color }">{{ item.title }}</span>
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" role="option" :aria-selected="model === item.value" :class="['bag-rarity-option', 'rarity-' + item.raw.tier]" :style="{ '--rarity': item.raw.color, background: item.raw.color, color: '#141821' }">
          <template #title>
            <div class="bag-card-name">
              <span class="bag-rarity-option-title">{{ item.title }}</span>
              <v-icon v-if="model === item.value" class="bag-rarity-option-check" icon="mdi-check" size="18" aria-hidden="true" />
            </div>
          </template>
        </v-list-item>
      </template>
    </AppDropdown>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { BAG_RARITIES, type BagRarity } from 'netlify/core/types/bag.types';
import { BAG_RARITY_COLORS } from '@/features/rooms/utils/bag-rarity.utils';
const model = defineModel<BagRarity>({ required: true });
const { t } = useI18n();
const rarities = computed(() => BAG_RARITIES.map((value, tier) => ({ title: t('bag.rarities.' + value), value, tier, color: BAG_RARITY_COLORS[value] })));
</script>
<style scoped>
.bag-rarity-selection { display: inline-block; padding: 2px 10px; border-radius: 4px; color: #141821; font-weight: 600; }
.bag-rarity-option { margin: 4px 8px; border-radius: 6px; animation: none; box-shadow: none; }
.bag-rarity-option .bag-card-name { margin: 0; padding: 8px 32px 12px; border: 0; }
.bag-rarity-option .bag-card-name::after { bottom: 4px; min-width: 24px; font-size: 10px; line-height: 12px; }
.bag-rarity-option-title { font-size: 14px; font-weight: 700; letter-spacing: .03em; }
.bag-rarity-option-check { position: absolute; inset-inline-end: 4px; top: 50%; transform: translateY(-50%); }

</style>
