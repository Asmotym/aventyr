<template>
    <AppDropdown v-model="model" :label="t('bag.rarity')" :aria-label="t('bag.rarity')" :items="rarities">
      <template #selection="{ item }">
        <span class="bag-rarity-select__rarity-selection" :style="{ '--bag-rarity-select-rarity-selection-background': item.raw.color }">{{ item.title }}</span>
      </template>
      <template #item="{ props: itemProps, item }">
        <v-list-item class="bag-rarity" v-bind="itemProps" role="option" :aria-selected="model === item.value" :class="['bag-rarity-select__rarity-option', 'bag-rarity--tier-' + item.raw.tier]" :style="{ '--rarity': item.raw.color, background: item.raw.color }">
          <template #title>
            <div class="bag-item-card__name">
              <span class="bag-rarity-select__rarity-option-title">{{ item.title }}</span>
              <v-icon v-if="model === item.value" class="bag-rarity-select__rarity-option-check" icon="mdi-check" size="18" aria-hidden="true" />
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
import { BAG_RARITIES, type BagRarity } from '@shared/rooms/bag.types';
import { BAG_RARITY_COLORS } from '@/features/rooms/utils/bag-rarity.utils';
const model = defineModel<BagRarity>({ required: true });
const { t } = useI18n();
const rarities = computed(() => BAG_RARITIES.map((value, tier) => ({ title: t('bag.rarities.' + value), value, tier, color: BAG_RARITY_COLORS[value] })));
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/bags/bag-rarity-select.scss"></style>
