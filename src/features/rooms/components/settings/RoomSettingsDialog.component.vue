<template>
  <RoomSlidePanel v-model="open" :label="t('roomSettings.title')" :before-close="canClose">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <h2 class="text-h6">{{ t('roomSettings.title') }}</h2>
        <AppCloseButton @click="requestClose" />
      </v-card-title>
      <v-divider />
      <v-card-text class="room-settings-dialog__main">
        <v-alert v-if="roomsStore.currentSession && isRoomCreator" type="info" variant="tonal" density="comfortable" class="mb-4">
          {{ t('sessions.settings.nextSession') }}
        </v-alert>
        <v-alert
          v-if="(settingsFeedback) && settingsFeedback.type !== 'error'"
          :type="settingsFeedback.type"
          variant="tonal"
          density="comfortable"
          class="mb-4"
        >
          {{ settingsFeedback.message }}
        </v-alert>
        <div class="room-settings-dialog__mobile-heading"><v-btn prepend-icon="mdi-menu" variant="tonal" :aria-expanded="navigationOpen" @click="navigationOpen = !navigationOpen">{{ t('roomRework.navigation') }}</v-btn><strong>{{ navigation.find(item => item.value === settingsTab)?.title }}</strong></div>
        <div class="room-settings-dialog__layout">
        <nav class="room-settings-dialog__navigation" :class="{ 'room-settings-dialog__navigation--open': navigationOpen }" :aria-label="t('roomRework.navigation')">
          <v-list nav><v-list-item v-for="item in navigation" :key="item.value" :active="settingsTab === item.value" :aria-current="settingsTab === item.value ? 'page' : undefined" :prepend-icon="item.icon" :title="item.title" @click="settingsTab = item.value; navigationOpen = false" /></v-list>
        </nav>

        <v-window v-model="settingsTab">
          <RoomSettingsRoomTab :context="settingsContext" />
          <v-window-item v-if="access.rights.manageTalentTrees && room && currentUser" value="talents"><section class="mb-6"><RoomTalentsSettings :key="room.id + currentUser.id" :room-id="room.id" :user-id="currentUser.id" /></section></v-window-item>
          <RoomSettingsDiceTab :context="settingsContext" @open-editor="(mode, dice) => emit('open-dice-editor', mode, dice)" />
          <RoomSettingsRollAwardsTab v-if="access.rights.viewRollAwards" :context="settingsContext" />
          <RoomSettingsCriticalsTab v-if="access.rights.manageCriticals" :context="settingsContext" />
          <RoomSettingsBonusPointsTab v-if="access.rights.manageBonusPoints" :context="settingsContext" />
          <v-window-item v-if="access.rights.editRoom && room && currentUser" value="bag">
            <section class="room-settings-dialog__bag mb-6">
            <header class="feature-hero">
              <span class="feature-hero__icon" aria-hidden="true"><v-icon icon="mdi-bag-personal-outline" size="36" /></span>
              <div class="feature-hero__copy"><h2>{{ t('bag.title') }}</h2><p>{{ t('bag.settingsDescription') }}</p></div>
            </header>
            <section class="room-settings-dialog__bag-controls">

            <v-switch :model-value="room.bagEnabled || false" :label="t('bag.enabled')" :hint="t('bag.disableHint')" persistent-hint :loading="bagSaving" :disabled="bagSaving" @update:model-value="toggleBag" />
            </section>
            </section>
          </v-window-item>
          <RoomSettingsAdministrationTab v-if="access.administration && room && currentUser" :room-id="room.id" :user-id="currentUser.id" />
          <v-window-item v-if="room && currentUser" value="transfer"><RoomSettingsTransfer :key="room.id + currentUser.id" :room-id="room.id" :user-id="currentUser.id" :room-name="room.name" @imported="refreshTransferredSettings" /></v-window-item>
        </v-window>
        </div>
      </v-card-text>

    </v-card>
  </RoomSlidePanel>
  <v-dialog v-model="rollAwardsImportDialogOpen" max-width="560">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('rollAwards.import.title') }}</span>
        <AppCloseButton @click="closeRollAwardsImportDialog" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <p class="text-caption text-medium-emphasis mb-3">
          {{ t('rollAwards.import.description') }}
        </p>
        <template v-if="parsedRollAwardsForImport.length > 0">
          <v-list density="comfortable">
            <v-list-item
              v-for="(award, index) in parsedRollAwardsForImport"
              :key="`${award.name}-${index}`"
              class="room-settings-roll-awards-tab__awards-list-item"
            >
              <v-list-item-title class="d-flex justify-space-between">
                <span>{{ award.name }}</span>
              </v-list-item-title>
              <div v-if="award.description" class="text-body-2 text-medium-emphasis mb-1">
                {{ award.description }}
              </div>
              <div class="d-flex flex-wrap app-spacing--gap-2 mb-2 app-spacing">
                <v-chip
                  v-for="value in award.diceResults"
                  :key="`${award.name}-${value}`"
                  size="small"
                  variant="tonal"
                  color="secondary"
                  class="mr-1"
                >
                  {{ value }}
                </v-chip>
              </div>
              <div class="text-caption text-medium-emphasis">
                <span v-if="award.diceNotations.length">{{ t('rollAwards.onlyCountsUsing', { notations: formatNotations(award.diceNotations) }) }}</span>
                <span v-else>{{ t('rollAwards.countsEveryNotation') }}</span>
              </div>
            </v-list-item>
          </v-list>
        </template>
        <v-alert v-else type="info" variant="tonal" density="comfortable">
          {{ t('rollAwards.import.noneFound') }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="d-flex flex-wrap app-spacing--gap-2 app-spacing">
        <v-btn variant="text" @click="closeRollAwardsImportDialog">{{ t('common.cancel') }}</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="tonal"
          :disabled="parsedRollAwardsForImport.length === 0 || rollAwardsImporting"
          :loading="rollAwardsImporting && importMode === 'clean'"
          @click="importParsedRollAwards(true)"
          :title="t('rollAwards.import.cleanTitle')"
        >
          {{ t('rollAwards.import.clean') }}
        </v-btn>
        <v-btn
          color="primary"
          :disabled="parsedRollAwardsForImport.length === 0 || rollAwardsImporting"
          :loading="rollAwardsImporting && importMode === 'append'"
          @click="importParsedRollAwards(false)"
          :title="t('rollAwards.import.importTitle')"
        >
          {{ t('rollAwards.import.import') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { nextTick } from 'vue';
import RoomSettingsTransfer from './RoomSettingsTransfer.component.vue';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import RoomSlidePanel from '@/features/rooms/components/RoomSlidePanel.component.vue';
import RoomSettingsAdministrationTab from '@/features/rooms/components/settings/RoomSettingsAdministrationTab.component.vue';
import RoomTalentsSettings from '@/features/rooms/components/talents/RoomTalentsSettings.component.vue';
import RoomSettingsRoomTab from '@/features/rooms/components/settings/RoomSettingsRoomTab.component.vue';
import RoomSettingsDiceTab from '@/features/rooms/components/settings/RoomSettingsDiceTab.component.vue';
import RoomSettingsRollAwardsTab from '@/features/rooms/components/settings/RoomSettingsRollAwardsTab.component.vue';
import RoomSettingsCriticalsTab from '@/features/rooms/components/settings/RoomSettingsCriticalsTab.component.vue';
import RoomSettingsBonusPointsTab from '@/features/rooms/components/settings/RoomSettingsBonusPointsTab.component.vue';
import { useRoomSettings, type RoomSettingsProps } from '@/features/rooms/composables/useRoomSettings';
import type { RoomDice } from '@shared/rooms/rooms.types';

const props = defineProps<RoomSettingsProps>();
const emit = defineEmits<{ 'open-dice-editor': [mode: 'custom' | 'edit' | 'categories', dice?: RoomDice] }>();
const open = defineModel<boolean>('open', { default: false });
const { roomsStore, t, settingsTab, navigationOpen, navigation, canClose, requestClose, bagSaving, toggleBag, settingsFeedback, access, isRoomCreator, rollAwardsImportDialogOpen, parsedRollAwardsForImport, rollAwardsImporting, importMode, formatNotations, closeRollAwardsImportDialog, importParsedRollAwards, settingsContext, refreshTransferredDice, syncTransferredSettings } = useRoomSettings(props, open);
async function refreshTransferredSettings(sections: string[]) {
  if (props.room && props.currentUser) await Promise.all([
    roomsStore.refreshRoomDetails(props.room.id, props.currentUser.id),
    roomsStore.loadBonusPoints(props.room.id, true),
    roomsStore.loadRollAwardsSnapshot(props.room.id),
    refreshTransferredDice(),
  ]);
  await nextTick();
  syncTransferredSettings(sections);
}
</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-dialog.scss"></style>
