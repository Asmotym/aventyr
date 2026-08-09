<template>
  <section class="dice-panel">
    <template v-if="!currentUser">
      <v-alert type="info" variant="tonal" density="comfortable">
        {{ t('dice.panel.signIn') }}
      </v-alert>
    </template>
    <template v-else>
      <v-progress-linear
        v-if="diceManager.roomDicesLoading.value"
        indeterminate
        color="primary"
        class="mb-3"
      />
      <v-alert
        v-else-if="diceManager.roomDicesError.value"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ diceManager.roomDicesError.value }}
        <template #append>
          <v-btn variant="text" size="small" @click="diceManager.ensureRoomDicesLoaded(true)">{{ t('common.retry') }}</v-btn>
        </template>
      </v-alert>
      <v-alert
        v-else-if="diceManager.customDices.value.length === 0"
        type="info"
        variant="tonal"
        density="comfortable"
      >
        {{ t('dice.panel.empty') }}
        <template #append>
          <v-btn
            variant="tonal"
            size="small"
            color="primary"
            @click="emit('manage-dice')"
          >
            {{ t('dice.actions.add') }}
          </v-btn>
        </template>
      </v-alert>
      <template v-else>
        <div class="custom-dice-groups">
          <div
            v-for="group in diceGroups"
            :key="group.key"
            class="custom-dice-group"
          >
            <div class="custom-dice-group__header">
              <span class="custom-dice-group__title">{{ group.name }}</span>
              <v-chip
                v-if="group.isDefault"
                size="small"
                density="compact"
                class="custom-dice-group__badge"
                variant="outlined"
              >
                {{ t('dice.category.default') }}
              </v-chip>
            </div>
            <div class="custom-dice-chip-group">
              <v-chip
                v-for="dice in group.dices"
                :key="dice.id"
                variant="tonal"
                class="custom-dice-chip"
                size="large"
                @click="diceManager.rollCustomDice(dice)"
              >
                <div class="custom-dice-chip__content">
                  <span class="custom-dice-chip__notation">{{ dice.notation }}</span>
                  <span
                    v-if="dice.description"
                    class="custom-dice-chip__description"
                  >
                    {{ dice.description }}
                  </span>
                </div>
              </v-chip>
            </div>
          </div>
          <div>
            <v-chip
              key="add-dice"
              variant="outlined"
              size="large"
              class="custom-dice-chip custom-dice-chip--action"
              color="primary"
              :title="t('dice.actions.addNew')"
              @click="emit('manage-dice')"
            >
              <div class="custom-dice-chip__content">
                <v-icon icon="mdi-plus" size="18" class="mr-1" />
                <span>{{ t('dice.actions.add') }}</span>
              </div>
            </v-chip>
          </div>
        </div>
      </template>
    </template>
    <v-alert
      v-if="diceManager.diceRollError.value"
      type="error"
      variant="tonal"
      density="comfortable"
      class="mt-3"
    >
      {{ diceManager.diceRollError.value }}
    </v-alert>
  </section>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';
import type { RoomDice } from 'netlify/core/types/data.types';

defineProps<{
  currentUser: DiscordUser | null;
}>();

const emit = defineEmits<{
  (event: 'manage-dice'): void;
}>();

const { t } = useI18n();

const diceManager = inject<RoomDiceManager>(RoomDiceManagerKey);

if (!diceManager) {
  throw new Error('RoomDicePanel must be used within a provider of RoomDiceManager.');
}

interface DiceGroup {
  key: string;
  name: string;
  dices: RoomDice[];
  isDefault?: boolean;
}

const diceGroups = computed<DiceGroup[]>(() => {
  if (!diceManager) {
    return [];
  }
  const diceByCategory = new Map<string, RoomDice[]>();
  const fallbackKey = 'uncategorized';
  diceManager.customDices.value.forEach((dice) => {
    const key = dice.categoryId ?? fallbackKey;
    const bucket = diceByCategory.get(key);
    if (bucket) {
      bucket.push(dice);
    } else {
      diceByCategory.set(key, [dice]);
    }
  });

  const defaultCategories = diceManager.diceCategories.value.filter((category) => category.isDefault);
  const otherCategories = diceManager.diceCategories.value.filter((category) => !category.isDefault);
  const orderedCategories = [...defaultCategories, ...otherCategories];
  const groups: DiceGroup[] = [];

  orderedCategories.forEach((category) => {
    const dice = diceByCategory.get(category.id);
    if (!dice || dice.length === 0) {
      return;
    }
    groups.push({
      key: `category-${category.id}`,
      name: category.name,
      dices: dice,
      isDefault: Boolean(category.isDefault),
    });
    diceByCategory.delete(category.id);
  });

  const leftover = diceByCategory.get(fallbackKey);
  if (leftover?.length) {
    groups.push({
      key: fallbackKey,
      name: t('dice.category.other'),
      dices: leftover,
      isDefault: false,
    });
    diceByCategory.delete(fallbackKey);
  }

  diceByCategory.forEach((dice, key) => {
    if (!dice.length) return;
    groups.push({
      key: `misc-${key}`,
      name: t('dice.category.other'),
      dices: dice,
      isDefault: false,
    });
  });

  return groups;
});
</script>

<style scoped>
.dice-panel {
  min-width: 0;
  width: 100%;
}

.custom-dice-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.custom-dice-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.custom-dice-group__title {
  font-weight: 600;
}

.custom-dice-group__badge {
  font-size: 0.65rem;
}

.custom-dice-chip-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.custom-dice-chip {
  cursor: pointer;
  text-transform: none;
  display: flex;
  text-align: left;
}

.custom-dice-chip--action {
  border-style: dashed;
}

.custom-dice-chip__content {
  display: flex;
  flex-direction: row;
  align-items: center;
  line-height: 1.2;
  gap: 4px;
}

.custom-dice-chip__notation {
  font-weight: 600;
}

.custom-dice-chip__description {
  font-size: 0.78rem;
  opacity: 0.75;
  margin-top: 2px;
  white-space: normal;
  word-break: break-word;
}
</style>
