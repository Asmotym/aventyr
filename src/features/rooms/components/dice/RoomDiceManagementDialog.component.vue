<template>
    <v-dialog :model-value="popup !== null" :fullscreen="smAndDown" max-width="680" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="popupTitle" @update:model-value="closePopup">
      <v-card class="room-dice-management-dialog__management-dialog">
        <v-card-title class="room-dice-management-dialog__popup-heading">
          <span class="room-dice-management-dialog__popup-icon"><v-icon :icon="popup !== 'categories' ? 'mdi-dice-d20-outline' : 'mdi-folder-cog-outline'" size="30" /></span>
          <div><div class="room-dice-management-dialog__popup-eyebrow">{{ t('roomSettings.tabs.dices') }}</div><h2>{{ popupTitle }}</h2></div>
          <AppCloseButton :disabled="busy" @click="closePopup" />
        </v-card-title>
        <v-divider />
        <v-card-text class="room-dice-management-dialog__popup-body">
          <div v-if="popup === 'custom'" class="room-dice-management-dialog__popup-form">
          <template v-if="!currentUser">
            <v-alert type="info" variant="tonal" density="comfortable">
              {{ t('dice.settings.signInDice') }}
            </v-alert>
          </template>
          <template v-else>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ t('dice.settings.createHelp') }}
            </p>
            <v-text-field
              v-model="diceManager.newDiceNotation.value"
              :label="t('dice.fields.notation')"
              variant="outlined"
              density="comfortable"
              :placeholder="t('dice.fields.notationPlaceholderAdvantage')"
              :hint="t('dice.fields.notationHint')"
              persistent-hint
              :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value"
              :error="!!(diceManager.newDiceError.value)"
            />
            <v-text-field
              v-model="diceManager.newDiceDescription.value"
              :label="t('dice.fields.descriptionOptional')"
              variant="outlined"
              density="comfortable"
              :placeholder="t('dice.fields.customDescriptionPlaceholder')"
              :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value"
              class="mt-3"
            />
            <AppDropdown
              v-model="diceManager.newDiceCategoryId.value"
              :items="diceManager.diceCategories.value"
              item-title="name"
              item-value="id"
              :label="t('dice.category.label')"
              variant="outlined"
              density="comfortable"
              class="mt-3"
              :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value || diceManager.roomDicesLoading.value"
              :loading="diceManager.roomDicesLoading.value"
              :hint="diceManager.roomDicesLoading.value ? t('dice.category.loading') : t('dice.category.hint')"
              persistent-hint
            />

            <div class="d-flex flex-wrap app-spacing--gap-2 mt-3 app-spacing">
              <v-btn
                color="primary"
                :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value"
                :loading="diceManager.diceMutationLoading.value"
                @click="diceManager.addCustomDice"
              >
                {{ t('dice.actions.add') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value"
                @click="diceManager.clearNewDiceForm"
              >
                {{ t('common.clear') }}
              </v-btn>
            </div>
          </template>

          </div>
              <div v-else-if="popup === 'edit'" class="room-dice-management-dialog__popup-form">
                <v-text-field
                  v-model="diceManager.editDiceNotation.value"
                  :label="t('dice.fields.notation')"
                  variant="outlined"
                  density="comfortable"
                  :placeholder="t('dice.fields.notationPlaceholderDisadvantage')"
                  :hint="t('dice.fields.notationHint')"
                  persistent-hint
                  :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value"
                  :error="!!(diceManager.editDiceError.value)"
                />
                <v-text-field
                  v-model="diceManager.editDiceDescription.value"
                  :label="t('dice.fields.descriptionOptional')"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value"
                />
                <AppDropdown
                  v-model="diceManager.editDiceCategoryId.value"
                  :items="diceManager.diceCategories.value"
                  item-title="name"
                  item-value="id"
                  :label="t('dice.category.label')"
                  variant="outlined"
                  density="comfortable"
                  class="mt-3"
                  :disabled="!access.rights.manageDice || diceManager.diceMutationLoading.value || diceManager.roomDicesLoading.value"
                />


              </div>

          <div v-else-if="popup === 'categories'" class="room-dice-management-dialog__popup-form room-dice-management-dialog__categories-popup">
          <template v-if="!currentUser">
            <v-alert type="info" variant="tonal" density="comfortable">
              {{ t('dice.category.signIn') }}
            </v-alert>
          </template>
          <template v-else>
            <p class="text-caption text-medium-emphasis mb-3">
              {{ t('dice.category.description') }}
            </p>
            <v-text-field
              v-model="diceManager.newCategoryName.value"
              :label="t('dice.category.name')"
              variant="outlined"
              density="comfortable"
              :placeholder="t('dice.category.placeholder')"
              :disabled="!access.rights.manageDiceCategories || diceManager.categoryMutationLoading.value"
              :error="!!(diceManager.newCategoryError.value)"
            />

            <div class="d-flex flex-wrap app-spacing--gap-2 mt-3 app-spacing">
              <v-btn
                color="primary"
                :disabled="!access.rights.manageDiceCategories || diceManager.categoryMutationLoading.value"
                :loading="diceManager.categoryMutationLoading.value"
                @click="diceManager.addDiceCategory"
              >
                {{ t('dice.category.create') }}
              </v-btn>
              <v-btn
                variant="text"
                :disabled="!access.rights.manageDiceCategories || diceManager.categoryMutationLoading.value"
                @click="diceManager.newCategoryName.value = ''"
              >
                {{ t('common.clear') }}
              </v-btn>
            </div>
            <div v-for="category in diceManager.diceCategories.value" :key="category.id" class="d-flex align-center ga-2 mt-3">
              <v-text-field :model-value="diceManager.categoryNameDrafts.value[category.id] ?? category.name" :label="t('dice.category.name')" hide-details density="compact" :disabled="!access.rights.manageDiceCategories || diceManager.categoryMutationLoading.value" @update:model-value="diceManager.categoryNameDrafts.value[category.id] = $event" />
              <v-btn :disabled="!access.rights.manageDiceCategories || diceManager.categoryMutationLoading.value || !diceManager.categoryNameDrafts.value[category.id]?.trim() || diceManager.categoryNameDrafts.value[category.id] === category.name" @click="diceManager.renameDiceCategory(category)">{{ t('common.save') }}</v-btn>
            </div>
          </template>

          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="room-dice-management-dialog__popup-footer">
          <v-spacer />
          <template v-if="popup === 'edit'">
            <v-btn variant="text" :disabled="busy" @click="closePopup">{{ t('common.cancel') }}</v-btn>
            <v-btn color="primary" variant="flat" :disabled="!access.rights.manageDice || busy" :loading="diceManager.diceMutationLoading.value" @click="saveEdit">{{ t('common.save') }}</v-btn>
          </template>
          <v-btn v-else variant="tonal" :disabled="busy" @click="closePopup">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import type { RoomDetails } from '@shared/rooms/rooms.types';
import type { DiscordUser } from '@shared/accounts/discord.types';
import { RoomDiceManagerKey, type RoomDiceManager } from '@/features/rooms/composables/useRoomDiceManager';
import { useRoomAccess } from '@/features/rooms/composables/useRoomAccess';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
const props = defineProps<{ room: RoomDetails | null; currentUser: DiscordUser | null; settingsOpen: boolean }>();
const { t } = useI18n();
const injected = inject<RoomDiceManager>(RoomDiceManagerKey);
if (!injected) throw new Error('RoomDiceManagementDialog requires RoomDiceManager');
const diceManager = injected;
const access = useRoomAccess(computed(() => props.currentUser?.id));
const { smAndDown } = useDisplay();
const popup = defineModel<'custom' | 'categories' | 'edit' | null>({ default: null });
const popupTitle = computed(() => t(popup.value === 'edit' ? 'bag.edit' : popup.value === 'custom' ? 'dice.settings.createTitle' : 'roomRework.manageCategories'));
const busy = computed(() => diceManager.diceMutationLoading.value || diceManager.categoryMutationLoading.value);
const editBaseline = ref('');
function editSnapshot() {
  const manager = diceManager;
  return JSON.stringify([manager.editDiceNotation.value, manager.editDiceDescription.value, manager.editDiceCategoryId.value]);
}
watch(popup, mode => { if (mode === 'edit') editBaseline.value = editSnapshot(); }, { flush: 'sync' });
async function saveEdit() {
  await diceManager.saveEditingDice();
  if (!diceManager.editingDiceId.value) popup.value = null;
}
function closePopup() {
  if (!popup.value) return true;
  if (busy.value) return false;
  const manager = diceManager;
  const dirty = popup.value === 'edit' ? editSnapshot() !== editBaseline.value : popup.value === 'custom'
    ? Boolean(manager.newDiceNotation.value || manager.newDiceDescription.value)
    : Boolean(manager.newCategoryName.value || Object.entries(manager.categoryNameDrafts.value).some(([id, name]) => name !== manager.diceCategories.value.find(category => category.id === id)?.name));
  if (dirty && !window.confirm(t('roomRework.discard'))) return false;
  if (popup.value === 'edit') manager.cancelEditingDice();
  else if (popup.value === 'custom') manager.clearNewDiceForm();
  else { manager.newCategoryName.value = ''; manager.categoryNameDrafts.value = {}; }
  popup.value = null;
  return true;
}
watch([() => props.room?.id, () => props.currentUser?.id], () => { popup.value = null; });
onBeforeRouteLeave(() => props.settingsOpen || closePopup());
onBeforeRouteUpdate(() => props.settingsOpen || closePopup());

</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/dice/room-dice-management-dialog.scss"></style>
