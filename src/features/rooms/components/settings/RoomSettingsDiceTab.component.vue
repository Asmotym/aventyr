<template>
  <v-window-item eager value="dices" class="room-settings-dice-tab">


    <section>
      <header class="dice-hero">
        <div class="dice-hero__icon"><v-icon icon="mdi-dice-d20-outline" size="40" /></div>
        <div class="dice-hero__copy"><h2>{{ context.t('dice.settings.myDice') }}</h2><p>{{ context.t('dice.settings.createHelp') }}</p></div>
        <span class="room-settings-dice-tab__count">{{ sortedDice.length }}</span>
      </header>
      <template v-if="!context.currentUser">
        <p class="text-caption text-medium-emphasis">
          {{ context.t('dice.settings.signInView') }}
        </p>
      </template>
      <template v-else>
        <v-progress-linear
          v-if="context.diceManager.roomDicesLoading.value"
          indeterminate
          color="primary"
          class="mb-3"
        />
        <div v-else-if="context.diceManager.roomDicesError.value" class="error-recovery-actions"><v-btn variant="text" size="small" @click="context.diceManager.ensureRoomDicesLoaded(true)">{{ context.t('common.retry') }}</v-btn></div>
        <template v-else-if="context.diceManager.customDices.value.length === 0">
          <div class="room-settings-dice-tab__empty"><v-icon icon="mdi-dice-multiple-outline" size="48" /><p>{{ context.t('dice.settings.empty') }}</p></div>
        </template>
        <template v-else>
          <div class="room-settings-dice-tab__custom-dice-list">
            <template v-for="(dice, index) in sortedDice" :key="dice.id">
              <h3 v-if="index === 0 || sortedDice[index - 1]?.categoryId !== dice.categoryId" class="room-settings-dice-tab__category"><v-icon icon="mdi-folder-outline" size="18" />{{ dice.categoryName ?? context.t('dice.category.general') }}<span>{{ sortedDice.filter(item => item.categoryId === dice.categoryId).length }}</span></h3>
            <v-card
              variant="flat"
              class="custom-dice-card mb-3"
            >

              <div class="custom-dice-card__content">
                <div class="room-settings-dice-tab__face" aria-hidden="true"><v-icon :icon="diceIcon(dice.notation)" size="30" /></div>
                <div class="room-settings-dice-tab__details">
                  <div class="room-settings-dice-tab__notation">{{ dice.notation }}</div>
                  <div v-if="dice.description" class="text-body-2 text-medium-emphasis">
                    {{ dice.description }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ context.t('dice.category.display', { category: dice.categoryName ?? context.t('dice.category.general') }) }}
                  </div>
                </div>
                <div class="custom-dice-card__actions">
                  <v-btn
                    icon="mdi-pencil"
                    :aria-label="context.t('bag.edit')"
                    variant="text"
                    size="small"
                    :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                    @click="emit('open-editor', 'edit', dice)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    :aria-label="context.t('bag.remove')"
                    variant="text"
                    size="small"
                    color="error"
                    :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                    @click="context.diceManager.deleteCustomDice(dice.id)"
                  />
                </div>
              </div>
            </v-card>
            </template>
          </div>
        </template>
      </template>
    </section>
    <div class="room-settings-dice-tab__management-toolbar">
      <v-btn v-if="context.access.value.rights.manageDice" class="room-settings-dice-tab__create-button" prepend-icon="mdi-plus" variant="flat" color="primary" @click="emit('open-editor', 'custom')">{{ context.t('dice.settings.createTitle') }}</v-btn>
      <v-btn v-if="context.access.value.rights.manageDiceCategories" prepend-icon="mdi-folder-cog-outline" variant="tonal" color="primary" @click="emit('open-editor', 'categories')">{{ context.t('roomRework.manageCategories') }}</v-btn>
    </div>

  </v-window-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RoomDice } from '@shared/rooms/rooms.types';
import type { RoomSettingsContext } from '@/features/rooms/composables/useRoomSettings';

function diceIcon(notation: string) {
  const sides = notation.match(/d(4|6|8|10|12|20)(?:[+-]|$)/i)?.[1];
  return sides ? `mdi-dice-d${sides}-outline` : 'mdi-dice-multiple-outline';
}
const props = defineProps<{ context: RoomSettingsContext }>();
const emit = defineEmits<{ 'open-editor': [mode: 'custom' | 'edit' | 'categories', dice?: RoomDice] }>();

const sortedDice = computed(() => [...props.context.diceManager.customDices.value].sort((a,b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || a.notation.localeCompare(b.notation)));

</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-dice-tab.scss"></style>
