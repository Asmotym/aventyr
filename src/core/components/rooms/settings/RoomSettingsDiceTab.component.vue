<template>
  <v-window-item eager value="dices" class="dice-workshop">


    <section>
      <header class="dice-hero">
        <div class="dice-hero__icon"><v-icon icon="mdi-dice-d20-outline" size="40" /></div>
        <div class="dice-hero__copy"><h2>{{ context.t('dice.settings.myDice') }}</h2><p>{{ context.t('dice.settings.createHelp') }}</p></div>
        <span class="dice-count">{{ sortedDice.length }}</span>
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
        <v-alert
          v-else-if="context.diceManager.roomDicesError.value"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-3"
        >
          {{ context.diceManager.roomDicesError.value }}
          <template #append>
            <v-btn variant="text" size="small" @click="context.diceManager.ensureRoomDicesLoaded(true)">{{ context.t('common.retry') }}</v-btn>
          </template>
        </v-alert>
        <template v-else-if="context.diceManager.customDices.value.length === 0">
          <div class="dice-empty"><v-icon icon="mdi-dice-multiple-outline" size="48" /><p>{{ context.t('dice.settings.empty') }}</p></div>
        </template>
        <template v-else>
          <div class="custom-dice-list">
            <template v-for="(dice, index) in sortedDice" :key="dice.id">
              <h3 v-if="index === 0 || sortedDice[index - 1]?.categoryId !== dice.categoryId" class="dice-category"><v-icon icon="mdi-folder-outline" size="18" />{{ dice.categoryName ?? context.t('dice.category.general') }}<span>{{ sortedDice.filter(item => item.categoryId === dice.categoryId).length }}</span></h3>
            <v-card
              variant="flat"
              class="custom-dice-card mb-3"
            >

              <div class="custom-dice-card__content">
                <div class="dice-face" aria-hidden="true"><v-icon :icon="diceIcon(dice.notation)" size="30" /></div>
                <div class="dice-details">
                  <div class="dice-notation">{{ dice.notation }}</div>
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
    <div class="dice-management-toolbar">
      <v-btn v-if="context.access.value.rights.manageDice" class="dice-create-button" prepend-icon="mdi-plus" variant="flat" color="primary" @click="emit('open-editor', 'custom')">{{ context.t('dice.settings.createTitle') }}</v-btn>
      <v-btn v-if="context.access.value.rights.manageDiceCategories" prepend-icon="mdi-folder-cog-outline" variant="tonal" color="primary" @click="emit('open-editor', 'categories')">{{ context.t('roomRework.manageCategories') }}</v-btn>
    </div>

  </v-window-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RoomDice } from 'netlify/core/types/data.types';
import type { RoomSettingsContext } from '../RoomSettingsDialog.component.vue';

function diceIcon(notation: string) {
  const sides = notation.match(/d(4|6|8|10|12|20)(?:[+-]|$)/i)?.[1];
  return sides ? `mdi-dice-d${sides}-outline` : 'mdi-dice-multiple-outline';
}
const props = defineProps<{ context: RoomSettingsContext }>();
const emit = defineEmits<{ 'open-editor': [mode: 'custom' | 'edit' | 'categories', dice?: RoomDice] }>();

const sortedDice = computed(() => [...props.context.diceManager.customDices.value].sort((a,b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || a.notation.localeCompare(b.notation)));

</script>

<style scoped>
.dice-hero { display: flex; align-items: center; gap: 18px; padding: 24px; margin: -4px -4px 24px; border-radius: 14px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .14), rgba(var(--v-theme-primary), .02)); border: 1px solid rgba(var(--v-theme-primary), .15); }
.dice-hero__icon { display: grid; place-items: center; width: 72px; height: 72px; flex-shrink: 0; border-radius: 20px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .1); transform: rotate(-8deg); }
.dice-hero__copy { flex: 1; min-width: 0; }
.dice-hero h2 { font-size: 22px; letter-spacing: -.025em; margin-bottom: 6px; }
.dice-hero p { font-size: 13px; line-height: 1.6; color: rgba(var(--v-theme-on-surface), .65); }
.dice-count { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgb(var(--v-theme-primary)); }
.custom-dice-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.dice-category { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(var(--v-theme-on-surface), .65); padding: 12px 0 4px; }
.dice-category span { margin-left: auto; font-size: 11px; background: rgba(var(--v-theme-on-surface), .06); border-radius: 6px; padding: 2px 8px; }
.custom-dice-card { padding: 18px; margin-bottom: 0 !important; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; transition: border-color 160ms, box-shadow 160ms; }
.custom-dice-card:hover { border-color: rgba(var(--v-theme-primary), .5); box-shadow: 0 4px 18px rgba(var(--v-theme-primary), .07); }
.custom-dice-card:has(input) { grid-column: 1 / -1; }
.custom-dice-card__content { display: flex; align-items: center; gap: 14px; height: 100%; }
.dice-face { width: 50px; height: 56px; display: grid; place-items: center; flex-shrink: 0; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); border-radius: 12px; }
.dice-details { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dice-notation { font-size: 20px; font-weight: 700; letter-spacing: -.03em; font-family: ui-monospace, monospace; }
.custom-dice-card__actions { display: flex; flex-direction: column; gap: 2px; }
.dice-empty { text-align: center; padding: 40px 20px; color: rgba(var(--v-theme-on-surface), .5); border: 1px dashed rgba(var(--v-border-color), .3); border-radius: 12px; }
.dice-empty p { margin-top: 14px; }
.dice-create-button { border-radius: 10px; }
.dice-workshop :deep(.v-expansion-panels) { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; overflow: hidden; }
.dice-workshop :deep(.v-expansion-panel-title) { font-weight: 600; min-height: 64px; }
@media (max-width: 600px) { .dice-hero { padding: 16px; gap: 12px; } .dice-hero__icon { width: 48px; height: 56px; border-radius: 14px; } .dice-hero h2 { font-size: 19px; } .dice-count { font-size: 24px; } .custom-dice-card { padding: 14px; } }
@media (prefers-reduced-motion: reduce) { .custom-dice-card { transition: none; } }
</style>

<style scoped>
.dice-management-toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-block: 20px; }
.dice-management-toolbar .v-btn { border-radius: 10px; }
@media (max-width: 600px) { .dice-management-toolbar { flex-direction: column; align-items: stretch; } }
</style>
