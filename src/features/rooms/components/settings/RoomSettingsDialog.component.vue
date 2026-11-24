<template>
  <RoomSlidePanel v-model="open" :label="t('roomSettings.title')" :before-close="canClose">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <h2 class="text-h6">{{ t('roomSettings.title') }}</h2>
        <AppCloseButton @click="requestClose" />
      </v-card-title>
      <v-divider />
      <v-card-text class="settings-main">
        <v-alert v-if="roomsStore.currentSession && isRoomCreator" type="info" variant="tonal" density="comfortable" class="mb-4">
          {{ t('sessions.settings.nextSession') }}
        </v-alert>
        <v-alert
          v-if="settingsFeedback"
          :type="settingsFeedback.type"
          variant="tonal"
          density="comfortable"
          class="mb-4"
        >
          {{ settingsFeedback.message }}
        </v-alert>
        <div class="settings-mobile-heading"><v-btn prepend-icon="mdi-menu" variant="tonal" :aria-expanded="navigationOpen" @click="navigationOpen = !navigationOpen">{{ t('roomRework.navigation') }}</v-btn><strong>{{ navigation.find(item => item.value === settingsTab)?.title }}</strong></div>
        <div class="settings-layout">
        <nav class="settings-navigation" :class="{ 'is-open': navigationOpen }" :aria-label="t('roomRework.navigation')">
          <v-list nav><v-list-item v-for="item in navigation" :key="item.value" :active="settingsTab === item.value" :aria-current="settingsTab === item.value ? 'page' : undefined" :prepend-icon="item.icon" :title="item.title" @click="settingsTab = item.value; navigationOpen = false" /></v-list>
        </nav>

        <v-window v-model="settingsTab">
          <RoomSettingsRoomTab :context="settingsContext" />
          <v-window-item v-if="access.rights.manageTalentTrees && room && currentUser" value="talents"><RoomTalentsSettings :key="room.id + currentUser.id" :room-id="room.id" :user-id="currentUser.id" /></v-window-item>
          <RoomSettingsDiceTab :context="settingsContext" @open-editor="(mode, dice) => emit('open-dice-editor', mode, dice)" />
          <RoomSettingsRollAwardsTab v-if="access.rights.viewRollAwards" :context="settingsContext" />
          <RoomSettingsCriticalsTab v-if="access.rights.manageCriticals" :context="settingsContext" />
          <RoomSettingsBonusPointsTab v-if="access.rights.manageBonusPoints" :context="settingsContext" />
          <v-window-item v-if="access.rights.editRoom && room && currentUser" value="bag">
            <p class="text-body-2 text-medium-emphasis mb-4">{{ t('bag.settingsDescription') }}</p>
            <v-alert v-if="bagError" type="error">{{ bagError }}</v-alert>
            <v-switch :model-value="room.bagEnabled || false" :label="t('bag.enabled')" :hint="t('bag.disableHint')" persistent-hint :loading="bagSaving" :disabled="bagSaving" @update:model-value="toggleBag" />
          </v-window-item>
          <RoomSettingsAdministrationTab v-if="access.administration && room && currentUser" :room-id="room.id" :user-id="currentUser.id" />
        </v-window>
        </div>
      </v-card-text>

    </v-card>
  </RoomSlidePanel>
  <v-dialog v-model="rollAwardsImportDialogOpen" max-width="560">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('rollAwards.import.title') }}</span>
        <v-btn icon="mdi-close" variant="text" @click="closeRollAwardsImportDialog" />
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
              class="roll-awards-list-item"
            >
              <v-list-item-title class="d-flex justify-space-between">
                <span>{{ award.name }}</span>
              </v-list-item-title>
              <div v-if="award.description" class="text-body-2 text-medium-emphasis mb-1">
                {{ award.description }}
              </div>
              <div class="d-flex flex-wrap gap-2 mb-2">
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
      <v-card-actions class="d-flex flex-wrap gap-2">
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
import type { RoomDice } from 'netlify/core/types/data.types';

const props = defineProps<RoomSettingsProps>();
const emit = defineEmits<{ 'open-dice-editor': [mode: 'custom' | 'edit' | 'categories', dice?: RoomDice] }>();
const open = defineModel<boolean>('open', { default: false });
const { roomsStore, t, settingsTab, navigationOpen, navigation, canClose, requestClose, bagSaving, bagError, toggleBag, settingsFeedback, access, isRoomCreator, rollAwardsImportDialogOpen, parsedRollAwardsForImport, rollAwardsImporting, importMode, formatNotations, closeRollAwardsImportDialog, importParsedRollAwards, settingsContext } = useRoomSettings(props, open);
</script>

<style scoped>
.settings-main { container-type: inline-size; }
.settings-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start; }
.settings-navigation { position: sticky; top: 0; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; overflow: hidden; }
.settings-layout > :deep(.v-window) { min-width: 0; }
.settings-layout :deep(.v-window-item > section), .settings-layout :deep(.critical-rule-form) { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; padding: 20px; background: rgba(var(--v-theme-surface), .7); }
.settings-layout :deep(.v-window-item > section + section) { margin-top: 20px; }
.settings-mobile-heading { display: none; }
@container (max-width: 959px) {
 .settings-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
 .settings-navigation { display: none; position: static; }
 .settings-navigation.is-open { display: block; }
 .settings-mobile-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
}

</style>
