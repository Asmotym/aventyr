<template>
  <section class="room-dice-panel">
    <div class="room-dice-panel__panel-scroll">
      <v-alert v-if="!currentUser" type="info" variant="tonal">{{ t('dice.panel.signIn') }}</v-alert>
      <template v-else>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ t('roomTools.diceHelp') }}</p>
        <v-progress-linear v-if="diceManager.roomDicesLoading.value" indeterminate color="primary" class="mb-3" />
        <div v-else-if="diceManager.roomDicesError.value" class="error-recovery-actions"><v-btn variant="text" size="small" @click="diceManager.ensureRoomDicesLoaded(true)">{{ t('common.retry') }}</v-btn></div>
        <div v-else-if="!diceManager.customDices.value.length" class="room-dice-panel__panel-empty">
          <v-icon icon="mdi-dice-multiple-outline" size="40" color="primary" />
          <p>{{ t('dice.panel.empty') }}</p>
        </div>
        <div v-else class="room-dice-panel__custom-dice-groups">
          <div v-for="group in diceGroups" :key="group.key" class="custom-dice-group">
            <div class="custom-dice-group__header">
              <v-icon icon="mdi-folder-outline" size="18" />
              <span class="custom-dice-group__title">{{ group.name }}</span>
              <v-chip v-if="group.isDefault" size="x-small" variant="outlined">{{ t('dice.category.default') }}</v-chip>
            </div>
            <div class="room-dice-panel__custom-dice-chip-group">
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

    </div>
    <footer v-if="currentUser" class="room-dice-panel__panel-footer">
      <div class="room-dice-panel__panel-create">
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
import type { DiscordUser } from '@shared/accounts/discord.types';
import { RoomDiceManagerKey, type RoomDiceManager } from '@/features/rooms/composables/useRoomDiceManager';
import type { RoomDice } from '@shared/rooms/rooms.types';
import { useRoomAccess } from '@/features/rooms/composables/useRoomAccess';

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

<style scoped lang="scss" src="@/assets/styles/features/rooms/dice/room-dice-panel.scss"></style>
