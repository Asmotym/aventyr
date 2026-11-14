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
                    @click="startEdit(dice)"
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
      <v-btn v-if="context.access.value.rights.manageDice" class="dice-create-button" prepend-icon="mdi-plus" variant="flat" color="primary" @click="popup = 'custom'">{{ context.t('dice.settings.createTitle') }}</v-btn>
      <v-btn v-if="context.access.value.rights.manageDiceCategories" prepend-icon="mdi-folder-cog-outline" variant="tonal" color="primary" @click="popup = 'categories'">{{ context.t('roomRework.manageCategories') }}</v-btn>
    </div>
    <v-dialog :model-value="popup !== null" :fullscreen="smAndDown" max-width="680" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="popupTitle" @update:model-value="closePopup">
      <v-card class="dice-management-dialog">
        <v-card-title class="dice-popup-heading">
          <span class="dice-popup-icon"><v-icon :icon="popup !== 'categories' ? 'mdi-dice-d20-outline' : 'mdi-folder-cog-outline'" size="30" /></span>
          <div><div class="dice-popup-eyebrow">{{ context.t('roomSettings.tabs.dices') }}</div><h2>{{ popupTitle }}</h2></div>
          <v-btn icon="mdi-close" variant="text" :aria-label="context.t('common.close')" :disabled="busy" @click="closePopup" />
        </v-card-title>
        <v-divider />
        <v-card-text class="dice-popup-body">
          <div v-if="popup === 'custom'" class="dice-popup-form">
          <template v-if="!context.currentUser">
            <v-alert type="info" variant="tonal" density="comfortable">
              {{ context.t('dice.settings.signInDice') }}
            </v-alert>
          </template>
          <template v-else>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ context.t('dice.settings.createHelp') }}
            </p>
            <v-text-field
              v-model="context.diceManager.newDiceNotation.value"
              :label="context.t('dice.fields.notation')"
              variant="outlined"
              density="comfortable"
              :placeholder="context.t('dice.fields.notationPlaceholderAdvantage')"
              :hint="context.t('dice.fields.notationHint')"
              persistent-hint
              :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
              :error-messages="context.diceManager.newDiceError.value ? [context.diceManager.newDiceError.value] : []"
            />
            <v-text-field
              v-model="context.diceManager.newDiceDescription.value"
              :label="context.t('dice.fields.descriptionOptional')"
              variant="outlined"
              density="comfortable"
              :placeholder="context.t('dice.fields.customDescriptionPlaceholder')"
              :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
              class="mt-3"
            />
            <AppDropdown
              v-model="context.diceManager.newDiceCategoryId.value"
              :items="context.diceManager.diceCategories.value"
              item-title="name"
              item-value="id"
              :label="context.t('dice.category.label')"
              variant="outlined"
              density="comfortable"
              class="mt-3"
              :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value || context.diceManager.roomDicesLoading.value"
              :loading="context.diceManager.roomDicesLoading.value"
              :hint="context.diceManager.roomDicesLoading.value ? context.t('dice.category.loading') : context.t('dice.category.hint')"
              persistent-hint
            />
            <v-alert
              v-if="context.diceManager.diceManagementError.value"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-3"
            >
              {{ context.diceManager.diceManagementError.value }}
            </v-alert>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <v-btn
                color="primary"
                :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                :loading="context.diceManager.diceMutationLoading.value"
                @click="context.diceManager.addCustomDice"
              >
                {{ context.t('dice.actions.add') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                @click="context.diceManager.clearNewDiceForm"
              >
                {{ context.t('common.clear') }}
              </v-btn>
            </div>
          </template>

          </div>
              <div v-else-if="popup === 'edit'" class="dice-popup-form">
                <v-text-field
                  v-model="context.diceManager.editDiceNotation.value"
                  :label="context.t('dice.fields.notation')"
                  variant="outlined"
                  density="comfortable"
                  :placeholder="context.t('dice.fields.notationPlaceholderDisadvantage')"
                  :hint="context.t('dice.fields.notationHint')"
                  persistent-hint
                  :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                  :error-messages="context.diceManager.editDiceError.value ? [context.diceManager.editDiceError.value] : []"
                />
                <v-text-field
                  v-model="context.diceManager.editDiceDescription.value"
                  :label="context.t('dice.fields.descriptionOptional')"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value"
                />
                <AppDropdown
                  v-model="context.diceManager.editDiceCategoryId.value"
                  :items="context.diceManager.diceCategories.value"
                  item-title="name"
                  item-value="id"
                  :label="context.t('dice.category.label')"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="!context.access.value.rights.manageDice || context.diceManager.diceMutationLoading.value || context.diceManager.roomDicesLoading.value"
                />
                <v-alert v-if="context.diceManager.diceManagementError.value" type="error" variant="tonal" class="mt-3">{{ context.diceManager.diceManagementError.value }}</v-alert>

              </div>

          <div v-else-if="popup === 'categories'" class="dice-popup-form categories-popup">
          <template v-if="!context.currentUser">
            <v-alert type="info" variant="tonal" density="comfortable">
              {{ context.t('dice.category.signIn') }}
            </v-alert>
          </template>
          <template v-else>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ context.t('dice.category.description') }}
            </p>
            <v-text-field
              v-model="context.diceManager.newCategoryName.value"
              :label="context.t('dice.category.name')"
              variant="outlined"
              density="comfortable"
              :placeholder="context.t('dice.category.placeholder')"
              :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value"
              :error-messages="context.diceManager.newCategoryError.value ? [context.diceManager.newCategoryError.value] : []"
            />
            <v-alert
              v-if="context.diceManager.categoryManagementError.value"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mt-2"
            >
              {{ context.diceManager.categoryManagementError.value }}
            </v-alert>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <v-btn
                color="primary"
                :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value"
                :loading="context.diceManager.categoryMutationLoading.value"
                @click="context.diceManager.addDiceCategory"
              >
                {{ context.t('dice.category.create') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value"
                @click="context.diceManager.newCategoryName.value = ''"
              >
                {{ context.t('common.clear') }}
              </v-btn>
            </div>
            <div v-for="category in context.diceManager.diceCategories.value" :key="category.id" class="d-flex align-center ga-2 mt-3">
              <v-text-field :model-value="context.diceManager.categoryNameDrafts.value[category.id] ?? category.name" :label="context.t('dice.category.name')" hide-details density="compact" :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value" @update:model-value="context.diceManager.categoryNameDrafts.value[category.id] = $event" />
              <v-btn :disabled="!context.access.value.rights.manageDiceCategories || context.diceManager.categoryMutationLoading.value || !context.diceManager.categoryNameDrafts.value[category.id]?.trim() || context.diceManager.categoryNameDrafts.value[category.id] === category.name" @click="context.diceManager.renameDiceCategory(category)">{{ context.t('common.save') }}</v-btn>
            </div>
          </template>

          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="dice-popup-footer">
          <v-spacer />
          <template v-if="popup === 'edit'">
            <v-btn variant="text" :disabled="busy" @click="closePopup">{{ context.t('common.cancel') }}</v-btn>
            <v-btn color="primary" variant="flat" :disabled="!context.access.value.rights.manageDice || busy" :loading="context.diceManager.diceMutationLoading.value" @click="saveEdit">{{ context.t('common.save') }}</v-btn>
          </template>
          <v-btn v-else variant="tonal" :disabled="busy" @click="closePopup">{{ context.t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-window-item>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RoomDice } from 'netlify/core/types/data.types';
import { useDisplay } from 'vuetify';
import type { RoomSettingsContext } from '../RoomSettingsDialog.component.vue';
import AppDropdown from 'core/components/common/AppDropdown.component.vue';

function diceIcon(notation: string) {
  const sides = notation.match(/d(4|6|8|10|12|20)(?:[+-]|$)/i)?.[1];
  return sides ? `mdi-dice-d${sides}-outline` : 'mdi-dice-multiple-outline';
}
const props = defineProps<{ context: RoomSettingsContext }>();
const { smAndDown } = useDisplay();
const popup = ref<'custom' | 'categories' | 'edit' | null>(null);
const popupTitle = computed(() => props.context.t(popup.value === 'edit' ? 'bag.edit' : popup.value === 'custom' ? 'dice.settings.createTitle' : 'roomRework.manageCategories'));
const busy = computed(() => props.context.diceManager.diceMutationLoading.value || props.context.diceManager.categoryMutationLoading.value);
const editBaseline = ref('');
function editSnapshot() {
  const manager = props.context.diceManager;
  return JSON.stringify([manager.editDiceNotation.value, manager.editDiceDescription.value, manager.editDiceCategoryId.value]);
}
function startEdit(dice: RoomDice) {
  props.context.diceManager.startEditingDice(dice);
  editBaseline.value = editSnapshot();
  popup.value = 'edit';
}
async function saveEdit() {
  await props.context.diceManager.saveEditingDice();
  if (!props.context.diceManager.editingDiceId.value) popup.value = null;
}
function closePopup() {
  if (busy.value) return;
  const manager = props.context.diceManager;
  const dirty = popup.value === 'edit' ? editSnapshot() !== editBaseline.value : popup.value === 'custom'
    ? Boolean(manager.newDiceNotation.value || manager.newDiceDescription.value)
    : Boolean(manager.newCategoryName.value || Object.entries(manager.categoryNameDrafts.value).some(([id, name]) => name !== manager.diceCategories.value.find(category => category.id === id)?.name));
  if (dirty && !window.confirm(props.context.t('roomRework.discard'))) return;
  if (popup.value === 'edit') manager.cancelEditingDice();
  else if (popup.value === 'custom') manager.clearNewDiceForm();
  else { manager.newCategoryName.value = ''; manager.categoryNameDrafts.value = {}; }
  popup.value = null;
}
watch(() => props.context.room?.id, () => { popup.value = null; });

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
.dice-management-dialog { border-radius: 18px !important; }
.dice-popup-heading { display: flex; align-items: center; gap: 16px; padding: 24px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); white-space: normal; }
.dice-popup-icon { display: grid; place-items: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); }
.dice-popup-heading > div { flex: 1; min-width: 0; }
.dice-popup-heading h2 { font-size: 20px; line-height: 1.4; letter-spacing: -.025em; }
.dice-popup-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgb(var(--v-theme-primary)); margin-bottom: 4px; }
.dice-popup-body { padding: 24px; }
.dice-popup-form > p { line-height: 1.7; margin-bottom: 24px !important; }
.dice-popup-form .v-btn { border-radius: 10px; }
.categories-popup > .d-flex.align-center { padding: 14px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; background: rgba(var(--v-theme-primary), .025); }
.dice-popup-footer { padding: 16px 24px; }
@media (max-width: 600px) { .dice-management-dialog { border-radius: 0 !important; } .dice-popup-heading { padding: 18px 16px; gap: 12px; } .dice-popup-heading h2 { font-size: 18px; } .dice-popup-icon { width: 44px; height: 48px; } .dice-popup-body { padding: 20px 16px; } .dice-management-toolbar { flex-direction: column; align-items: stretch; } }
</style>
