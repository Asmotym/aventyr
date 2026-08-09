<template>
  <v-dialog v-model="open" max-width="640">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('roomSettings.title') }}</span>
        <v-btn icon="mdi-close" variant="text" @click="open = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
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
        <v-tabs
          v-model="settingsTab"
          density="comfortable"
          align-tabs="start"
          class="mb-4"
        >
          <v-tab value="room">{{ t('roomSettings.tabs.room') }}</v-tab>
          <v-tab value="dices">{{ t('roomSettings.tabs.dices') }}</v-tab>
          <v-tab value="rollAwards">{{ t('roomSettings.tabs.rollAwards') }}</v-tab>
          <v-tab value="criticals">{{ t('roomSettings.tabs.criticals') }}</v-tab>
          <v-tab value="bonusPoints">{{ t('roomSettings.tabs.bonusPoints') }}</v-tab>
        </v-tabs>

        <v-window v-model="settingsTab">
          <RoomSettingsRoomTab :context="settingsContext" />
          <RoomSettingsDiceTab :context="settingsContext" />
          <RoomSettingsRollAwardsTab :context="settingsContext" />
          <RoomSettingsCriticalsTab :context="settingsContext" />
          <RoomSettingsBonusPointsTab :context="settingsContext" />
        </v-window>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.close') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="settingsTab !== 'room' || settingsSaving || !hasPendingChanges"
          :loading="settingsSaving"
          @click="saveSettings"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
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
import { computed, inject, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointRule, RoomCriticalRule, RoomDetails, RoomRollAward } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import { RoomDiceManagerKey, type RoomDiceManager } from 'core/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, type RoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';
import RoomSettingsRoomTab from './settings/RoomSettingsRoomTab.component.vue';
import RoomSettingsDiceTab from './settings/RoomSettingsDiceTab.component.vue';
import RoomSettingsRollAwardsTab from './settings/RoomSettingsRollAwardsTab.component.vue';
import RoomSettingsCriticalsTab from './settings/RoomSettingsCriticalsTab.component.vue';
import RoomSettingsBonusPointsTab from './settings/RoomSettingsBonusPointsTab.component.vue';

type SettingsTab = 'room' | 'dices' | 'criticals' | 'rollAwards' | 'bonusPoints';

const props = defineProps<{
  room: RoomDetails | null;
  currentUser: DiscordUser | null;
  initialTab?: SettingsTab;
}>();

const open = defineModel<boolean>('open', { default: false });
const roomsStore = useRoomsStore();
const { t } = useI18n();
const diceManager = inject<RoomDiceManager>(RoomDiceManagerKey);
const injectedRollAwardsManager = inject<RoomRollAwardsManager>(RoomRollAwardsManagerKey);

if (!diceManager) {
  throw new Error('RoomSettingsDialog must be used within a provider of RoomDiceManager.');
}

if (!injectedRollAwardsManager) {
  throw new Error('RoomSettingsDialog must be used within a provider of RoomRollAwardsManager.');
}

const rollAwardsManager = injectedRollAwardsManager;

const settingsTab = ref<SettingsTab>('room');
const dicePanelsOpen = ref<(string | number)[]>([]);
const roomNameInput = ref('');
const roomNameError = ref<string | null>(null);
const sessionInactivityInput = ref<number>(240);
const sessionInactivityError = ref<string | null>(null);
const currentNickname = ref<string | null>(null);
const nicknameInput = ref('');
const nicknameError = ref<string | null>(null);
const memberSettingsLoading = ref(false);
const memberSettingsError = ref<string | null>(null);
const memberSettingsLoadedRoomId = ref<string | null>(null);
const settingsSaving = ref(false);
const settingsFeedback = ref<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
let settingsFeedbackTimer: number | null = null;
const roomCriticals = ref<RoomCriticalRule[]>([]);
const newCriticalThreshold = ref<number>(1);
const newCriticalOperator = ref<RoomCriticalRule['operator']>('moreThan');
const newCriticalColorMode = ref<'preset' | 'custom'>('preset');
const newCriticalPresetColor = ref('#d32f2f');
const newCriticalCustomColor = ref('#fdd835');
const criticalsSaving = ref(false);
const criticalsError = ref<string | null>(null);
const bonusPointsEnabled = ref(false);
const bonusPointsMaxInput = ref<number>(0);
const bonusPointsAllowExtremeSpend = ref(false);
const bonusPointsSaving = ref(false);
const bonusPointsError = ref<string | null>(null);
const bonusPointBalanceSavingId = ref<string | null>(null);
const newBonusRuleName = ref('');
const newBonusRuleDiceNotation = ref('d100');
const newBonusRuleOperator = ref<RoomBonusPointRule['condition']['operator']>('moreThan');
const newBonusRuleThreshold = ref<number>(90);
const newBonusRuleThresholdMax = ref<number>(100);
const newBonusRuleAdjustmentSign = ref<RoomBonusPointRule['spendAdjustment']['sign']>('+');
const newBonusRuleAdjustmentAmount = ref<number>(1);
const editingBonusRuleId = ref<string | null>(null);
const bonusPointsPanelsOpen = ref<(string | number)[]>(['create']);
const rollAwardsPanelsOpen = ref<(string | number)[]>(['create']);
const newRollAwardNumber = ref<number>(1);
const newRollAwardNumbers = ref<number[]>([]);
const newRollAwardName = ref('');
const newRollAwardDescription = ref('');
const newRollAwardDiceNotation = ref('');
const newRollAwardError = ref<string | null>(null);
const editingRollAwardId = ref<string | null>(null);
const ROLL_AWARD_RESULT_MIN = 1;
const ROLL_AWARD_RESULT_MAX = 100;
const ROLL_AWARD_MAX_RESULTS = 20;
const ROLL_AWARD_DESCRIPTION_MAX_LENGTH = 255;
const ROLL_AWARD_NOTATION_REGEX = /^d([1-9]\d*)$/i;
const ROLL_AWARD_NOTATION_TOTAL_LIMIT = 64;
const ROLL_AWARD_MAX_DICE_NOTATIONS = 10;
const ROOM_CRITICALS_MAX_ITEMS = 20;
const CRITICAL_OPERATOR_OPTIONS = computed(() => [
  { title: t('criticals.operators.moreThan'), value: 'moreThan' },
  { title: t('criticals.operators.lessThan'), value: 'lessThan' },
] as const);
const CRITICAL_COLOR_MODE_OPTIONS = computed(() => [
  { title: t('criticals.colorModes.preset'), value: 'preset' },
  { title: t('criticals.colorModes.custom'), value: 'custom' },
] as const);
const CRITICAL_PRESET_COLORS = computed(() => [
  { title: t('criticals.colors.crimson'), value: '#d32f2f' },
  { title: t('criticals.colors.amber'), value: '#f9a825' },
  { title: t('criticals.colors.gold'), value: '#fdd835' },
  { title: t('criticals.colors.emerald'), value: '#2e7d32' },
  { title: t('criticals.colors.teal'), value: '#00897b' },
  { title: t('criticals.colors.sky'), value: '#1e88e5' },
  { title: t('criticals.colors.indigo'), value: '#3949ab' },
  { title: t('criticals.colors.rose'), value: '#c2185b' },
] as const);
const BONUS_POINT_OPERATOR_OPTIONS = computed(() => [
  { title: t('bonusPoints.operators.moreThan'), value: 'moreThan' },
  { title: t('bonusPoints.operators.lessThan'), value: 'lessThan' },
  { title: t('bonusPoints.operators.between'), value: 'between' },
] as const);
const BONUS_POINT_SIGN_OPTIONS = computed(() => [
  { title: '+', value: '+' },
  { title: '-', value: '-' },
] as const);

const isRoomCreator = computed(() => {
  if (!props.room || !props.currentUser) return false;
  return props.room.createdBy === props.currentUser.id;
});

type ImportableRollAward = {
  name: string;
  description: string | null;
  diceResults: number[];
  diceNotations: string[];
};

const rollAwardsEnabled = computed(() => rollAwardsManager.awardsEnabled.value);
const canManageRollAwards = computed(() => isRoomCreator.value);
const canManageCriticals = computed(() => isRoomCreator.value);
const canManageBonusPoints = computed(() => isRoomCreator.value);
const selectedCriticalColor = computed(() => (
  newCriticalColorMode.value === 'custom'
    ? newCriticalCustomColor.value
    : newCriticalPresetColor.value
));
const isEditingRollAward = computed(() => Boolean(editingRollAwardId.value));
const clipboardLoading = ref(false);
const clipboardAction = ref<'copy' | 'paste' | null>(null);
const rollAwardsClipboardFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const rollAwardsImportDialogOpen = ref(false);
const rollAwardsImportError = ref<string | null>(null);
const parsedRollAwardsForImport = ref<ImportableRollAward[]>([]);
const rollAwardsImporting = ref(false);
const importMode = ref<'append' | 'clean' | null>(null);

const normalizedRoomName = computed(() => roomNameInput.value.trim());
const currentRoomName = computed(() => props.room?.name?.trim() ?? '');
const roomNameDirty = computed(() => normalizedRoomName.value !== currentRoomName.value);
const sessionInactivityDirty = computed(() => Number(sessionInactivityInput.value) !== Number(props.room?.sessionInactivityMinutes ?? 240));

const normalizedNicknameInput = computed(() => nicknameInput.value.trim());
const currentNicknameNormalized = computed(() => currentNickname.value?.trim() ?? '');
const nicknameDirty = computed(() => normalizedNicknameInput.value !== currentNicknameNormalized.value);
const hasPendingChanges = computed(() => roomNameDirty.value || sessionInactivityDirty.value || nicknameDirty.value);

const nicknamePreview = computed(() => {
  const baseName = props.currentUser?.username ?? t('common.unknownAdventurer');
  return normalizedNicknameInput.value ? `${normalizedNicknameInput.value} (${baseName})` : baseName;
});

watch(
  () => props.room?.id,
  () => {
    resetSettingsState();
  }
);

watch(
  () => props.room?.criticals,
  (criticals) => {
    roomCriticals.value = cloneCriticalRules(criticals ?? []);
  },
  { immediate: true, deep: true }
);

watch(open, async (dialogOpen) => {
  if (dialogOpen) {
    settingsTab.value = props.initialTab ?? 'room';
    await initializeSettingsPanel();
    if (settingsTab.value === 'rollAwards') {
      await rollAwardsManager.ensureAwardsLoaded();
    }
    if (settingsTab.value === 'bonusPoints' && props.room) {
      await roomsStore.loadBonusPoints(props.room.id, true);
      syncBonusPointsForm();
    }
  } else {
    clearSettingsFeedback();
    closeRollAwardsImportDialog();
    clearClipboardFeedback();
    rollAwardsImportError.value = null;
  }
});

watch(
  () => props.initialTab,
  (tab) => {
    if (!open.value) return;
    settingsTab.value = tab ?? 'room';
    if (settingsTab.value === 'rollAwards') {
      void rollAwardsManager.ensureAwardsLoaded();
    }
    if (settingsTab.value === 'bonusPoints' && props.room) {
      void roomsStore.loadBonusPoints(props.room.id, true).then(syncBonusPointsForm);
    }
  }
);

watch(settingsTab, (tab) => {
  if (tab === 'rollAwards') {
    void rollAwardsManager.ensureAwardsLoaded();
  }
  if (tab === 'bonusPoints' && props.room) {
    void roomsStore.loadBonusPoints(props.room.id, true).then(syncBonusPointsForm);
  }
});

watch(
  () => props.room,
  (room) => {
    if (!room) {
      open.value = false;
    }
  }
);

async function initializeSettingsPanel() {
  if (!props.room || !props.currentUser) return;
  roomNameInput.value = props.room.name ?? '';
  sessionInactivityInput.value = props.room.sessionInactivityMinutes ?? 240;
  roomNameError.value = null;
  nicknameError.value = null;
  await ensureMemberSettingsLoaded();
}

async function ensureMemberSettingsLoaded(force = false) {
  if (!props.room || !props.currentUser) return;
  if (!force && memberSettingsLoadedRoomId.value === props.room.id) {
    nicknameInput.value = currentNickname.value ?? '';
    return;
  }
  memberSettingsLoading.value = true;
  memberSettingsError.value = null;
  try {
    const member = await RoomsService.fetchMember({
      roomId: props.room.id,
      userId: props.currentUser.id,
    });
    currentNickname.value = member.nickname ?? null;
    nicknameInput.value = member.nickname ?? '';
    memberSettingsLoadedRoomId.value = props.room.id;
  } catch (error) {
    memberSettingsError.value = error instanceof Error ? error.message : t('roomSettings.errors.loadMemberSettings');
  } finally {
    memberSettingsLoading.value = false;
  }
}

function resetSettingsState() {
  roomNameInput.value = props.room?.name ?? '';
  sessionInactivityInput.value = props.room?.sessionInactivityMinutes ?? 240;
  sessionInactivityError.value = null;
  roomNameError.value = null;
  nicknameError.value = null;
  currentNickname.value = null;
  nicknameInput.value = '';
  memberSettingsLoadedRoomId.value = null;
  memberSettingsError.value = null;
  memberSettingsLoading.value = false;
  settingsSaving.value = false;
  roomCriticals.value = cloneCriticalRules(props.room?.criticals ?? []);
  resetCriticalForm();
  criticalsSaving.value = false;
  criticalsError.value = null;
  resetBonusPointRuleForm();
  bonusPointsEnabled.value = props.room?.bonusPointSettings?.enabled ?? false;
  bonusPointsMaxInput.value = props.room?.bonusPointSettings?.maxPointsPerUser ?? 0;
  bonusPointsAllowExtremeSpend.value = props.room?.bonusPointSettings?.allowExtremeSpend ?? false;
  bonusPointsSaving.value = false;
  bonusPointBalanceSavingId.value = null;
  bonusPointsError.value = null;
  bonusPointsPanelsOpen.value = ['create'];
  clearRollAwardForm();
  rollAwardsPanelsOpen.value = ['create'];
  clearClipboardFeedback();
  rollAwardsImportError.value = null;
  closeRollAwardsImportDialog();
  clipboardLoading.value = false;
  clipboardAction.value = null;
  if (!props.room) {
    open.value = false;
    clearSettingsFeedback();
  }
}

function clearSettingsFeedback() {
  settingsFeedback.value = null;
  if (settingsFeedbackTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(settingsFeedbackTimer);
    settingsFeedbackTimer = null;
  }
}

function showSettingsFeedback(type: 'success' | 'error' | 'info', message: string) {
  settingsFeedback.value = { type, message };
  if (typeof window === 'undefined') return;
  if (settingsFeedbackTimer !== null) {
    window.clearTimeout(settingsFeedbackTimer);
  }
  settingsFeedbackTimer = window.setTimeout(() => {
    settingsFeedback.value = null;
    settingsFeedbackTimer = null;
  }, 3500);
}

function cloneCriticalRules(criticals: RoomCriticalRule[]): RoomCriticalRule[] {
  return criticals.map((critical) => ({ ...critical }));
}

function resetCriticalForm() {
  newCriticalThreshold.value = 1;
  newCriticalOperator.value = 'moreThan';
  newCriticalColorMode.value = 'preset';
  newCriticalPresetColor.value = CRITICAL_PRESET_COLORS.value[0]?.value ?? '#d32f2f';
  newCriticalCustomColor.value = '#fdd835';
  criticalsError.value = null;
}

function syncBonusPointsForm() {
  bonusPointsEnabled.value = roomsStore.bonusPointSettings?.enabled ?? props.room?.bonusPointSettings?.enabled ?? false;
  bonusPointsMaxInput.value = roomsStore.bonusPointSettings?.maxPointsPerUser ?? props.room?.bonusPointSettings?.maxPointsPerUser ?? 0;
  bonusPointsAllowExtremeSpend.value = roomsStore.bonusPointSettings?.allowExtremeSpend ?? props.room?.bonusPointSettings?.allowExtremeSpend ?? false;
}

function resetBonusPointRuleForm() {
  newBonusRuleName.value = '';
  newBonusRuleDiceNotation.value = 'd100';
  newBonusRuleOperator.value = 'moreThan';
  newBonusRuleThreshold.value = 90;
  newBonusRuleThresholdMax.value = 100;
  newBonusRuleAdjustmentSign.value = '+';
  newBonusRuleAdjustmentAmount.value = 1;
  editingBonusRuleId.value = null;
  bonusPointsPanelsOpen.value = ['create'];
  bonusPointsError.value = null;
}

function startEditingBonusPointRule(rule: RoomBonusPointRule) {
  editingBonusRuleId.value = rule.id;
  newBonusRuleName.value = rule.name;
  newBonusRuleDiceNotation.value = rule.diceNotation;
  newBonusRuleOperator.value = rule.condition.operator;
  newBonusRuleThreshold.value = rule.condition.threshold;
  newBonusRuleThresholdMax.value = rule.condition.thresholdMax ?? rule.condition.threshold;
  newBonusRuleAdjustmentSign.value = rule.spendAdjustment.sign;
  newBonusRuleAdjustmentAmount.value = rule.spendAdjustment.amount;
  bonusPointsPanelsOpen.value = ['create'];
  bonusPointsError.value = null;
}

function formatBonusPointRule(rule: RoomBonusPointRule) {
  const operator = rule.condition.operator === 'between'
    ? t('bonusPoints.ruleBetween', { min: rule.condition.threshold, max: rule.condition.thresholdMax })
    : t(`bonusPoints.ruleSimple.${rule.condition.operator}`, { threshold: rule.condition.threshold });
  return `${rule.name}: ${rule.diceNotation} ${operator}`;
}

function formatBonusPointAdjustment(rule: RoomBonusPointRule) {
  return `${rule.spendAdjustment.sign}${rule.spendAdjustment.amount}`;
}

function buildBonusPointRulePayload() {
  return {
    name: newBonusRuleName.value,
    diceNotation: newBonusRuleDiceNotation.value,
    condition: {
      operator: newBonusRuleOperator.value,
      threshold: Number(newBonusRuleThreshold.value),
      thresholdMax: newBonusRuleOperator.value === 'between' ? Number(newBonusRuleThresholdMax.value) : null,
    },
    spendAdjustment: {
      sign: newBonusRuleAdjustmentSign.value,
      amount: Number(newBonusRuleAdjustmentAmount.value),
    },
  };
}

async function saveBonusPointSettings() {
  if (!props.room || !props.currentUser) return;
  if (!canManageBonusPoints.value) {
    bonusPointsError.value = t('bonusPoints.creatorOnly');
    return;
  }
  bonusPointsSaving.value = true;
  bonusPointsError.value = null;
  try {
    await roomsStore.updateBonusPointSettings({
      roomId: props.room.id,
      userId: props.currentUser.id,
      enabled: bonusPointsEnabled.value,
      maxPointsPerUser: Number(bonusPointsMaxInput.value),
      allowExtremeSpend: bonusPointsAllowExtremeSpend.value,
    });
    syncBonusPointsForm();
    showSettingsFeedback('success', t('bonusPoints.feedback.settingsSaved'));
  } catch (error) {
    bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveSettings');
  } finally {
    bonusPointsSaving.value = false;
  }
}

async function handleBonusPointsToggle(value: boolean | null) {
  if (!props.room || !props.currentUser) return;
  if (!canManageBonusPoints.value) {
    bonusPointsError.value = t('bonusPoints.creatorOnly');
    return;
  }
  const nextValue = Boolean(value);
  bonusPointsEnabled.value = nextValue;
  bonusPointsSaving.value = true;
  bonusPointsError.value = null;
  try {
    await roomsStore.updateBonusPointSettings({
      roomId: props.room.id,
      userId: props.currentUser.id,
      enabled: nextValue,
    });
    syncBonusPointsForm();
    showSettingsFeedback('success', t('bonusPoints.feedback.settingsSaved'));
  } catch (error) {
    bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveSettings');
    syncBonusPointsForm();
  } finally {
    bonusPointsSaving.value = false;
  }
}

async function handleBonusPointsAllowExtremeSpendToggle(value: boolean | null) {
  if (!props.room || !props.currentUser) return;
  if (!canManageBonusPoints.value) {
    bonusPointsError.value = t('bonusPoints.creatorOnly');
    return;
  }
  const nextValue = Boolean(value);
  bonusPointsAllowExtremeSpend.value = nextValue;
  bonusPointsSaving.value = true;
  bonusPointsError.value = null;
  try {
    await roomsStore.updateBonusPointSettings({
      roomId: props.room.id,
      userId: props.currentUser.id,
      allowExtremeSpend: nextValue,
    });
    syncBonusPointsForm();
    showSettingsFeedback('success', t('bonusPoints.feedback.settingsSaved'));
  } catch (error) {
    bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveSettings');
    syncBonusPointsForm();
  } finally {
    bonusPointsSaving.value = false;
  }
}

function getBonusPointBalanceDisplayName(balance: { username?: string; nickname?: string; userId: string }) {
  return balance.nickname || balance.username || balance.userId;
}

async function updateMemberBonusPointBalance(targetUserId: string, points: number) {
  if (!props.room || !props.currentUser) return;
  if (!canManageBonusPoints.value) {
    bonusPointsError.value = t('bonusPoints.creatorOnly');
    return;
  }
  bonusPointBalanceSavingId.value = targetUserId;
  bonusPointsError.value = null;
  try {
    await roomsStore.updateBonusPointBalance({
      roomId: props.room.id,
      userId: props.currentUser.id,
      targetUserId,
      points,
    });
  } catch (error) {
    bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveBalance');
  } finally {
    bonusPointBalanceSavingId.value = null;
  }
}

function incrementMemberBonusPoints(userId: string, delta: number) {
  const balance = roomsStore.bonusPointBalances.find((current) => current.userId === userId);
  if (!balance) return;
  void updateMemberBonusPointBalance(userId, Number(balance.points ?? 0) + delta);
}

async function saveBonusPointRule() {
  if (!props.room || !props.currentUser) return;
  if (!canManageBonusPoints.value) {
    bonusPointsError.value = t('bonusPoints.creatorOnly');
    return;
  }
  bonusPointsSaving.value = true;
  bonusPointsError.value = null;
  try {
    const basePayload = {
      roomId: props.room.id,
      userId: props.currentUser.id,
      ...buildBonusPointRulePayload(),
    };
    if (editingBonusRuleId.value) {
      await roomsStore.updateBonusPointRule({
        ...basePayload,
        ruleId: editingBonusRuleId.value,
      });
    } else {
      await roomsStore.createBonusPointRule(basePayload);
    }
    resetBonusPointRuleForm();
    bonusPointsPanelsOpen.value = ['list'];
    showSettingsFeedback('success', t('bonusPoints.feedback.ruleSaved'));
  } catch (error) {
    bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveRule');
  } finally {
    bonusPointsSaving.value = false;
  }
}

async function removeBonusPointRule(ruleId: string) {
  if (!props.room || !props.currentUser) return;
  if (!canManageBonusPoints.value) {
    bonusPointsError.value = t('bonusPoints.creatorOnly');
    return;
  }
  bonusPointsSaving.value = true;
  bonusPointsError.value = null;
  try {
    await roomsStore.deleteBonusPointRule({
      roomId: props.room.id,
      userId: props.currentUser.id,
      ruleId,
    });
    if (editingBonusRuleId.value === ruleId) {
      resetBonusPointRuleForm();
    }
    showSettingsFeedback('success', t('bonusPoints.feedback.ruleDeleted'));
  } catch (error) {
    bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.deleteRule');
  } finally {
    bonusPointsSaving.value = false;
  }
}

function getCriticalOperatorText(operator: RoomCriticalRule['operator']) {
  if (operator === 'moreThan') {
    return t('criticals.operators.moreThan').toLowerCase();
  }
  return t('criticals.operators.lessThan').toLowerCase();
}

function formatCriticalRule(rule: RoomCriticalRule) {
  return `${getCriticalOperatorText(rule.operator)} ${rule.threshold}`;
}

function getCriticalColorChipStyle(color: string) {
  return {
    backgroundColor: color,
    color: getContrastTextColor(color),
  };
}

function getContrastTextColor(color: string) {
  const normalized = color.trim().toLowerCase();
  const hex = normalized.length === 4
    ? `${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized.slice(1);

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return '#111111';
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness >= 150 ? '#111111' : '#ffffff';
}

async function saveCriticalRules(nextRules: RoomCriticalRule[]) {
  if (!props.room || !props.currentUser) {
    criticalsError.value = t('criticals.errors.signIn');
    return false;
  }

  criticalsSaving.value = true;
  criticalsError.value = null;

  try {
    const updatedRoom = await roomsStore.updateRoomCriticals({
      roomId: props.room.id,
      userId: props.currentUser.id,
      criticals: nextRules,
    });
    roomCriticals.value = cloneCriticalRules(updatedRoom.criticals ?? []);
    showSettingsFeedback('success', t('criticals.feedback.saved'));
    return true;
  } catch (error) {
    criticalsError.value = error instanceof Error ? error.message : t('criticals.errors.save');
    roomCriticals.value = cloneCriticalRules(props.room.criticals ?? []);
    return false;
  } finally {
    criticalsSaving.value = false;
  }
}

async function addCriticalRule() {
  criticalsError.value = null;

  if (!canManageCriticals.value) {
    criticalsError.value = t('criticals.creatorOnly');
    return;
  }
  if (roomCriticals.value.length >= ROOM_CRITICALS_MAX_ITEMS) {
    criticalsError.value = t('criticals.errors.maxRules', { count: ROOM_CRITICALS_MAX_ITEMS });
    return;
  }

  const trimmedThreshold = String(newCriticalThreshold.value).trim();
  if (!trimmedThreshold) {
    criticalsError.value = t('criticals.errors.numberRequired');
    return;
  }

  const parsedThreshold = Number(trimmedThreshold);
  if (!Number.isFinite(parsedThreshold) || !Number.isInteger(parsedThreshold)) {
    criticalsError.value = t('criticals.errors.wholeNumber');
    return;
  }

  const duplicate = roomCriticals.value.some((critical) => (
    critical.operator === newCriticalOperator.value &&
    critical.threshold === parsedThreshold
  ));
  if (duplicate) {
    criticalsError.value = t('criticals.errors.duplicate');
    return;
  }

  const saved = await saveCriticalRules([
    ...roomCriticals.value,
    {
      threshold: parsedThreshold,
      operator: newCriticalOperator.value,
      color: selectedCriticalColor.value,
    },
  ]);

  if (saved) {
    resetCriticalForm();
  }
}

async function removeCriticalRule(index: number) {
  if (!canManageCriticals.value) {
    criticalsError.value = t('criticals.creatorOnly');
    return;
  }

  const nextRules = roomCriticals.value.filter((_, currentIndex) => currentIndex !== index);
  await saveCriticalRules(nextRules);
}

async function saveSettings() {
  if (!props.room || !props.currentUser) return;
  if (!hasPendingChanges.value) {
    showSettingsFeedback('info', t('roomSettings.feedback.noChanges'));
    return;
  }

  settingsSaving.value = true;
  roomNameError.value = null;
  nicknameError.value = null;

  let anySuccess = false;
  let lastError: string | null = null;

  try {
    if (roomNameDirty.value || sessionInactivityDirty.value) {
      if (!isRoomCreator.value) {
        roomNameError.value = t('roomSettings.roomDetails.nonCreatorHelp');
        lastError = roomNameError.value;
      } else if (!normalizedRoomName.value) {
        roomNameError.value = t('roomSettings.errors.roomNameRequired');
        lastError = roomNameError.value;
      } else {
        const inactivity = Number(sessionInactivityInput.value);
        if (!Number.isInteger(inactivity) || inactivity < 1 || inactivity > 10080) {
          sessionInactivityError.value = t('sessions.settings.range');
          lastError = sessionInactivityError.value;
          return;
        }
        try {
          await roomsStore.renameRoom({
            roomId: props.room.id,
            userId: props.currentUser.id,
            name: normalizedRoomName.value,
            sessionInactivityMinutes: inactivity,
          });
          anySuccess = true;
        } catch (error) {
          roomNameError.value = error instanceof Error ? error.message : t('roomSettings.errors.updateRoomName');
          lastError = roomNameError.value;
        }
      }
    }

    if (nicknameDirty.value) {
      try {
        const member = await roomsStore.updateNickname({
          roomId: props.room.id,
          userId: props.currentUser.id,
          nickname: normalizedNicknameInput.value || undefined,
        });
        currentNickname.value = member.nickname ?? null;
        nicknameInput.value = member.nickname ?? '';
        memberSettingsLoadedRoomId.value = props.room.id;
        anySuccess = true;
      } catch (error) {
        nicknameError.value = error instanceof Error ? error.message : t('roomSettings.errors.updateNickname');
        lastError = nicknameError.value;
      }
    }

    if (anySuccess) {
      showSettingsFeedback('success', t('roomSettings.feedback.saved'));
    } else if (lastError) {
      showSettingsFeedback('error', lastError);
    } else {
      showSettingsFeedback('info', t('roomSettings.feedback.noChanges'));
    }
  } finally {
    settingsSaving.value = false;
  }
}

async function handleRollAwardsToggle(value: boolean | null) {
  const nextValue = Boolean(value);
  await rollAwardsManager.setAwardsEnabled(nextValue);
  if (!nextValue) {
    clearRollAwardForm();
    closeRollAwardsImportDialog();
  }
}

function addRollAwardNumber() {
  newRollAwardError.value = null;
  const value = Number.parseInt(String(newRollAwardNumber.value || '1'));
  if (value === null || Number.isNaN(value)) {
    newRollAwardError.value = t('rollAwards.errors.resultRequired');
    return;
  }
  if (value < ROLL_AWARD_RESULT_MIN || value > ROLL_AWARD_RESULT_MAX) {
    newRollAwardError.value = t('rollAwards.errors.resultRange', { min: ROLL_AWARD_RESULT_MIN, max: ROLL_AWARD_RESULT_MAX });
    return;
  }
  if (newRollAwardNumbers.value.includes(value)) {
    newRollAwardError.value = t('rollAwards.errors.duplicateResult');
    return;
  }
  if (newRollAwardNumbers.value.length >= ROLL_AWARD_MAX_RESULTS) {
    newRollAwardError.value = t('rollAwards.errors.maxResults', { count: ROLL_AWARD_MAX_RESULTS });
    return;
  }
  newRollAwardNumbers.value = [...newRollAwardNumbers.value, value];
  newRollAwardNumber.value = 1;
}

function removeRollAwardNumber(value: number) {
  newRollAwardNumbers.value = newRollAwardNumbers.value.filter((entry) => entry !== value);
}

function getAwardNotations(award: RoomRollAward | null): string[] {
  if (!award) return [];
  if (Array.isArray(award.diceNotations) && award.diceNotations.length) {
    return award.diceNotations;
  }
  return award.diceNotation ? [award.diceNotation] : [];
}

function formatNotations(notations: string[]): string {
  return notations.join(', ');
}

function formatAwardNotations(award: RoomRollAward): string {
  return formatNotations(getAwardNotations(award));
}

function parseRollAwardNotations(input: string): { notations: string[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { notations: [] };
  }
  const parts = trimmed.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean);
  if (!parts.length) {
    return { notations: [] };
  }
  const normalized: string[] = [];
  for (const value of parts) {
    const match = value.match(ROLL_AWARD_NOTATION_REGEX);
    if (!match) {
      return { notations: [], error: t('rollAwards.errors.notationFormat') };
    }
    const notation = `d${match[1]}`.toLowerCase();
    if (!normalized.includes(notation)) {
      normalized.push(notation);
    }
    if (normalized.length > ROLL_AWARD_MAX_DICE_NOTATIONS) {
      return { notations: [], error: t('rollAwards.errors.maxNotations', { count: ROLL_AWARD_MAX_DICE_NOTATIONS }) };
    }
  }
  const combinedLength = normalized.join(',').length;
  if (combinedLength > ROLL_AWARD_NOTATION_TOTAL_LIMIT) {
    return {
      notations: [],
      error: t('rollAwards.errors.notationLength', { count: ROLL_AWARD_NOTATION_TOTAL_LIMIT }),
    };
  }
  return { notations: normalized };
}

function buildExportableAward(award: RoomRollAward): ImportableRollAward {
  return {
    name: award.name,
    description: award.description ?? null,
    diceResults: [...award.diceResults],
    diceNotations: getAwardNotations(award),
  };
}

function clearClipboardFeedback() {
  rollAwardsClipboardFeedback.value = null;
}

async function copyRollAwardsToClipboard() {
  clearClipboardFeedback();
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    rollAwardsClipboardFeedback.value = { type: 'error', message: t('rollAwards.clipboard.unavailable') };
    return;
  }
  const awardsToCopy = rollAwardsManager.awards.value.map(buildExportableAward);
  clipboardLoading.value = true;
  clipboardAction.value = 'copy';
  try {
    await navigator.clipboard.writeText(JSON.stringify(awardsToCopy, null, 2));
    rollAwardsClipboardFeedback.value = { type: 'success', message: t('rollAwards.clipboard.copySuccess') };
  } catch (error) {
    rollAwardsClipboardFeedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('rollAwards.clipboard.copyError'),
    };
  } finally {
    clipboardLoading.value = false;
    clipboardAction.value = null;
  }
}

function normalizeClipboardAward(entry: unknown): ImportableRollAward | null {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const results = Array.isArray(raw.diceResults)
    ? raw.diceResults
        .map((value) => Number.parseInt(String(value), 10))
        .filter(
          (value, index, list) =>
            Number.isFinite(value) &&
            value >= ROLL_AWARD_RESULT_MIN &&
            value <= ROLL_AWARD_RESULT_MAX &&
            list.indexOf(value) === index
        )
    : [];
  if (!results.length) return null;
  if (results.length > ROLL_AWARD_MAX_RESULTS) {
    results.length = ROLL_AWARD_MAX_RESULTS;
  }
  let notationSource: string[] = [];
  if (Array.isArray(raw.diceNotations)) {
    notationSource = raw.diceNotations.map((value) => (typeof value === 'string' ? value : '')).filter(Boolean);
  } else if (typeof raw.diceNotation === 'string') {
    notationSource = raw.diceNotation.split(/[\s,]+/);
  }
  const { notations, error } = parseRollAwardNotations(notationSource.join(','));
  if (error) return null;
  return {
    name,
    description: description || null,
    diceResults: results,
    diceNotations: notations,
  };
}

function parseAwardsClipboard(raw: string): ImportableRollAward[] {
  try {
    const parsed = JSON.parse(raw);
    const entries = (Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).awards)
        ? (parsed as Record<string, unknown>).awards
        : []) as Array<any>;
    const normalized: ImportableRollAward[] = [];
    for (const entry of entries) {
      const award = normalizeClipboardAward(entry);
      if (award) {
        normalized.push(award);
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

async function handlePasteRollAwards() {
  clearClipboardFeedback();
  rollAwardsImportError.value = null;
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    rollAwardsClipboardFeedback.value = { type: 'error', message: t('rollAwards.clipboard.unavailable') };
    return;
  }
  clipboardLoading.value = true;
  clipboardAction.value = 'paste';
  try {
    const clipboardText = await navigator.clipboard.readText();
    const parsed = parseAwardsClipboard(clipboardText);
    if (!parsed.length) {
      rollAwardsImportError.value = t('rollAwards.import.noValidClipboard');
      return;
    }
    parsedRollAwardsForImport.value = parsed;
    rollAwardsImportDialogOpen.value = true;
  } catch (error) {
    rollAwardsClipboardFeedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('rollAwards.clipboard.readError'),
    };
  } finally {
    clipboardLoading.value = false;
    clipboardAction.value = null;
  }
}

function closeRollAwardsImportDialog() {
  rollAwardsImportDialogOpen.value = false;
  rollAwardsImportError.value = null;
  parsedRollAwardsForImport.value = [];
  importMode.value = null;
}

async function importParsedRollAwards(cleanExisting: boolean) {
  if (!rollAwardsEnabled.value) {
    rollAwardsImportError.value = t('rollAwards.import.enableFirst');
    return;
  }
  if (!canManageRollAwards.value) {
    rollAwardsImportError.value = t('rollAwards.import.creatorOnly');
    return;
  }
  if (!parsedRollAwardsForImport.value.length) {
    rollAwardsImportError.value = t('rollAwards.import.noAwards');
    return;
  }
  rollAwardsImportError.value = null;
  rollAwardsImporting.value = true;
  importMode.value = cleanExisting ? 'clean' : 'append';
  try {
    if (cleanExisting && rollAwardsManager.awards.value.length) {
      for (const existing of [...rollAwardsManager.awards.value]) {
        const deleted = await rollAwardsManager.deleteAward(existing.id);
        if (!deleted) {
          throw new Error(rollAwardsManager.awardMutationError.value ?? t('rollAwards.import.removeExistingError'));
        }
      }
    }
    for (const award of parsedRollAwardsForImport.value) {
      const created = await rollAwardsManager.createAward(
        award.name,
        award.diceResults,
        award.diceNotations,
        award.description
      );
      if (!created) {
        throw new Error(rollAwardsManager.awardMutationError.value ?? t('rollAwards.import.createAwardError'));
      }
    }
    closeRollAwardsImportDialog();
    rollAwardsClipboardFeedback.value = {
      type: 'success',
      message: cleanExisting ? t('rollAwards.import.replaceSuccess') : t('rollAwards.import.importSuccess'),
    };
  } catch (error) {
    rollAwardsImportError.value = error instanceof Error ? error.message : t('rollAwards.import.importError');
  } finally {
    rollAwardsImporting.value = false;
    importMode.value = null;
  }
}

function startEditingRollAward(award: RoomRollAward) {
  editingRollAwardId.value = award.id;
  newRollAwardName.value = award.name;
  newRollAwardDescription.value = award.description ?? '';
  newRollAwardDiceNotation.value = formatAwardNotations(award);
  newRollAwardNumbers.value = [...award.diceResults];
  newRollAwardNumber.value = award.diceResults[award.diceResults.length - 1] ?? 1;
  newRollAwardError.value = null;
  rollAwardsManager.awardMutationError.value = null;
  rollAwardsPanelsOpen.value = ['create'];
}

function clearRollAwardForm() {
  newRollAwardNumber.value = 1;
  newRollAwardNumbers.value = [];
  newRollAwardName.value = '';
  newRollAwardDescription.value = '';
  newRollAwardDiceNotation.value = '';
  newRollAwardError.value = null;
  editingRollAwardId.value = null;
  rollAwardsManager.awardMutationError.value = null;
  clearClipboardFeedback();
}

async function handleSaveRollAward() {
  newRollAwardError.value = null;
  if (!rollAwardsEnabled.value) {
    newRollAwardError.value = t('rollAwards.errors.enableBeforeManage');
    return;
  }
  const trimmedName = newRollAwardName.value.trim();
  if (!trimmedName) {
    newRollAwardError.value = t('rollAwards.errors.nameRequired');
    return;
  }
  const trimmedDescription = newRollAwardDescription.value.trim();
  if (trimmedDescription.length > ROLL_AWARD_DESCRIPTION_MAX_LENGTH) {
    newRollAwardError.value = t('rollAwards.errors.descriptionLength', { count: ROLL_AWARD_DESCRIPTION_MAX_LENGTH });
    return;
  }
  if (newRollAwardNumbers.value.length === 0) {
    newRollAwardError.value = t('rollAwards.errors.atLeastOneResult');
    return;
  }
  const notationResult = parseRollAwardNotations(newRollAwardDiceNotation.value);
  if (notationResult.error) {
    newRollAwardError.value = notationResult.error;
    return;
  }
  const normalizedNotations = notationResult.notations;
  if (editingRollAwardId.value) {
    const updated = await rollAwardsManager.updateAward(
      editingRollAwardId.value,
      trimmedName,
      newRollAwardNumbers.value,
      normalizedNotations,
      trimmedDescription || null
    );
    if (updated) {
      clearRollAwardForm();
      rollAwardsPanelsOpen.value = ['list'];
    }
  } else {
    const created = await rollAwardsManager.createAward(
      trimmedName,
      newRollAwardNumbers.value,
      normalizedNotations,
      trimmedDescription || null
    );
    if (created) {
      clearRollAwardForm();
      rollAwardsPanelsOpen.value = ['list'];
    }
  }
}

const settingsContext = {
  get room() {
    return props.room;
  },
  get currentUser() {
    return props.currentUser;
  },
  t,
  $roomsStore: roomsStore,
  diceManager,
  rollAwardsManager,
  dicePanelsOpen,
  roomNameInput,
  roomNameError,
  sessionInactivityInput,
  sessionInactivityError,
  nicknameInput,
  nicknameError,
  memberSettingsLoading,
  memberSettingsError,
  settingsSaving,
  roomCriticals,
  newCriticalThreshold,
  newCriticalOperator,
  newCriticalColorMode,
  newCriticalPresetColor,
  newCriticalCustomColor,
  criticalsSaving,
  criticalsError,
  bonusPointsEnabled,
  bonusPointsMaxInput,
  bonusPointsAllowExtremeSpend,
  bonusPointsSaving,
  bonusPointsError,
  bonusPointBalanceSavingId,
  bonusPointsPanelsOpen,
  newBonusRuleName,
  newBonusRuleDiceNotation,
  newBonusRuleOperator,
  newBonusRuleThreshold,
  newBonusRuleThresholdMax,
  newBonusRuleAdjustmentSign,
  newBonusRuleAdjustmentAmount,
  editingBonusRuleId,
  rollAwardsPanelsOpen,
  newRollAwardNumber,
  newRollAwardNumbers,
  newRollAwardName,
  newRollAwardDescription,
  newRollAwardDiceNotation,
  newRollAwardError,
  ROLL_AWARD_RESULT_MIN,
  ROLL_AWARD_RESULT_MAX,
  ROLL_AWARD_MAX_RESULTS,
  ROLL_AWARD_DESCRIPTION_MAX_LENGTH,
  ROOM_CRITICALS_MAX_ITEMS,
  CRITICAL_OPERATOR_OPTIONS,
  CRITICAL_COLOR_MODE_OPTIONS,
  CRITICAL_PRESET_COLORS,
  BONUS_POINT_OPERATOR_OPTIONS,
  BONUS_POINT_SIGN_OPTIONS,
  isRoomCreator,
  rollAwardsEnabled,
  canManageRollAwards,
  canManageCriticals,
  canManageBonusPoints,
  selectedCriticalColor,
  isEditingRollAward,
  clipboardLoading,
  clipboardAction,
  rollAwardsClipboardFeedback,
  rollAwardsImportError,
  nicknamePreview,
  ensureMemberSettingsLoaded,
  resetCriticalForm,
  resetBonusPointRuleForm,
  startEditingBonusPointRule,
  formatBonusPointRule,
  formatBonusPointAdjustment,
  saveBonusPointSettings,
  handleBonusPointsToggle,
  handleBonusPointsAllowExtremeSpendToggle,
  saveBonusPointRule,
  removeBonusPointRule,
  getBonusPointBalanceDisplayName,
  updateMemberBonusPointBalance,
  incrementMemberBonusPoints,
  getCriticalOperatorText,
  formatCriticalRule,
  getCriticalColorChipStyle,
  addCriticalRule,
  removeCriticalRule,
  handleRollAwardsToggle,
  addRollAwardNumber,
  removeRollAwardNumber,
  getAwardNotations,
  formatAwardNotations,
  copyRollAwardsToClipboard,
  handlePasteRollAwards,
  startEditingRollAward,
  clearRollAwardForm,
  handleSaveRollAward,
};

onUnmounted(() => {
  clearSettingsFeedback();
});
</script>

<style scoped>
.custom-dice-list {
  margin-top: 12px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 6px;
}

.custom-dice-card {
  padding: 16px;
}

.custom-dice-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.custom-dice-card__actions {
  display: flex;
  gap: 4px;
}

.roll-awards-list-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.roll-awards-list-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.roll-award-number-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.roll-award-number-input {
  flex: 1;
}

.roll-award-number-btn {
  align-self: flex-end;
}

.critical-rule-form {
  border: 1px solid rgba(var(--v-theme-outline), 0.18);
  border-radius: 12px;
  padding: 16px;
}

.critical-rule-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.critical-rule-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.critical-rule-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.critical-color-input {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  height: 42px;
  padding: 0;
  width: 72px;
}

.critical-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 640px) {
  .critical-rule-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
