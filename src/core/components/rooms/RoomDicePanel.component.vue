<template>
  <section class="dice-panel">
    <div class="dice-panel-scroll">
      <v-alert v-if="!currentUser" type="info" variant="tonal">{{ t('dice.panel.signIn') }}</v-alert>
      <template v-else>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ t('roomTools.diceHelp') }}</p>
        <v-progress-linear v-if="diceManager.roomDicesLoading.value" indeterminate color="primary" class="mb-3" />
        <v-alert v-else-if="diceManager.roomDicesError.value" type="error" variant="tonal">
          {{ diceManager.roomDicesError.value }}
          <template #append><v-btn variant="text" size="small" @click="diceManager.ensureRoomDicesLoaded(true)">{{ t('common.retry') }}</v-btn></template>
        </v-alert>
        <div v-else-if="!diceManager.customDices.value.length" class="dice-panel-empty">
          <v-icon icon="mdi-dice-multiple-outline" size="40" color="primary" />
          <p>{{ t('dice.panel.empty') }}</p>
        </div>
        <div v-else class="custom-dice-groups">
          <div v-for="group in diceGroups" :key="group.key" class="custom-dice-group">
            <div class="custom-dice-group__header">
              <v-icon icon="mdi-folder-outline" size="18" />
              <span class="custom-dice-group__title">{{ group.name }}</span>
              <v-chip v-if="group.isDefault" size="x-small" variant="outlined">{{ t('dice.category.default') }}</v-chip>
            </div>
            <div class="custom-dice-chip-group">
              <v-menu v-for="dice in group.dices" :key="dice.id" location="bottom start" offset="6">
                <template #activator="{ props: menuProps }">
                  <v-chip v-bind="menuProps" variant="tonal" class="custom-dice-chip" size="large" append-icon="mdi-chevron-down">
                    <div class="custom-dice-chip__content">
                      <span class="custom-dice-chip__notation">{{ dice.notation }}</span>
                      <span v-if="dice.description" class="custom-dice-chip__description">{{ dice.description }}</span>
                    </div>
                  </v-chip>
                </template>
                <v-list density="compact" :aria-label="dice.notation">
                  <v-list-item prepend-icon="mdi-dice-multiple-outline" :title="t('roomTools.roll')" @click="diceManager.rollCustomDice(dice)" />
                  <v-list-item v-if="access.rights.manageDice" prepend-icon="mdi-pencil-outline" :title="t('roomTools.modify')" :disabled="diceManager.diceMutationLoading.value" @click="emit('open-editor', 'edit', dice)" />
                  <v-list-item v-if="access.rights.manageDice" prepend-icon="mdi-delete-outline" :title="t('roomTools.remove')" :disabled="diceManager.diceMutationLoading.value" base-color="error" @click="diceManager.deleteCustomDice(dice.id)" />
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
      </template>
      <v-alert v-if="diceManager.diceRollError.value || diceManager.diceManagementError.value" type="error" variant="tonal" class="mt-3" role="alert">{{ diceManager.diceRollError.value || diceManager.diceManagementError.value }}</v-alert>
    </div>
    <footer v-if="currentUser" class="dice-panel-footer">
      <div class="dice-panel-create">
        <v-btn v-if="access.rights.manageDice" prepend-icon="mdi-plus" variant="flat" color="primary" :disabled="busy" @click="emit('open-editor', 'custom')">{{ t('dice.actions.add') }}</v-btn>
        <v-btn v-if="access.rights.manageDiceCategories" prepend-icon="mdi-folder-plus-outline" variant="tonal" color="primary" :disabled="busy" @click="emit('open-editor', 'categories')">{{ t('roomTools.addCategory') }}</v-btn>
      </div>
      <v-btn prepend-icon="mdi-cog-outline" variant="text" block class="mt-2" @click="emit('manage-dice')">{{ t('roomTools.manageDice') }}</v-btn>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';
import type { RoomDice } from 'netlify/core/types/data.types';
import { useRoomAccess } from 'core/composables/useRoomAccess';

const props = defineProps<{
  currentUser: DiscordUser | null;
}>();

const emit = defineEmits<{
  (event: 'manage-dice'): void;
  (event: 'open-editor', mode: 'custom' | 'edit' | 'categories', dice?: RoomDice): void;
}>();

const { t } = useI18n();
const access = useRoomAccess(computed(() => props.currentUser?.id));

const injected = inject<RoomDiceManager>(RoomDiceManagerKey);

if (!injected) {
  throw new Error('RoomDicePanel must be used within a provider of RoomDiceManager.');
}

const diceManager = injected;
const busy = computed(() => diceManager.diceMutationLoading.value || diceManager.categoryMutationLoading.value || diceManager.roomDicesLoading.value);

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
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.dice-panel-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 16px; }
.dice-panel-footer { flex-shrink: 0; padding: 16px 12px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); background: rgb(var(--v-theme-surface)); }
.dice-panel-create { display: flex; gap: 8px; flex-wrap: wrap; }
.dice-panel-create .v-btn { flex: 1; font-size: 12px; }
.dice-panel-footer > .v-btn { font-size: 11px; }
.dice-panel-empty { text-align: center; padding: 32px 16px; border: 1px dashed rgba(var(--v-border-color), .3); border-radius: 12px; }
.dice-panel-empty p { margin-top: 12px; }
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
