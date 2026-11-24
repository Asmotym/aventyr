import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { bagRequest } from '@/features/rooms/services/rooms.service';
import { useRoomAccess } from '@/features/rooms/composables/useRoomAccess';
import { ROOM_PERMISSIONS } from 'netlify/core/utils/room-permissions';
import { computed, inject, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { RoomsService } from '@/features/rooms/services/rooms.service';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import { RoomDiceManagerKey, type RoomDiceManager } from '@/features/rooms/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, type RoomRollAwardsManager } from '@/features/rooms/composables/useRoomRollAwardsManager';
import type { Ref } from 'vue';
import { useCriticalRules } from './useCriticalRules';
import { useBonusPointSettings } from './useBonusPointSettings';
import { useRollAwardSettings } from './useRollAwardSettings';
import type { RoomSettingsProps, SettingsTab } from '../types/room-settings.types';
export type { RoomSettingsProps } from '../types/room-settings.types';
export function useRoomSettings(props: RoomSettingsProps, open: Ref<boolean>) {
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
  const navigationOpen = ref(false);
  const bonusEditorDirty = ref(false);
  const editorEpoch = ref(0);
  const navigation = computed(() => [
    { value: 'room' as const, title: t('roomSettings.tabs.room'), icon: 'mdi-cog-outline', visible: true },
    { value: 'dices' as const, title: t('roomSettings.tabs.dices'), icon: 'mdi-dice-multiple-outline', visible: true },
    { value: 'rollAwards' as const, title: t('roomSettings.tabs.rollAwards'), icon: 'mdi-trophy-outline', visible: access.value.rights.viewRollAwards },
    { value: 'criticals' as const, title: t('roomSettings.tabs.criticals'), icon: 'mdi-palette-outline', visible: access.value.rights.manageCriticals },
    { value: 'bonusPoints' as const, title: t('roomSettings.tabs.bonusPoints'), icon: 'mdi-star-four-points-outline', visible: access.value.rights.manageBonusPoints },
    { value: 'talents' as const, title: t('talents.title'), icon: 'mdi-file-tree', visible: access.value.rights.manageTalentTrees },
    { value: 'bag' as const, title: t('bag.title'), icon: 'mdi-bag-personal-outline', visible: access.value.rights.editRoom },
    { value: 'administration' as const, title: t('roomAccess.administration'), icon: 'mdi-account-key-outline', visible: access.value.administration },
  ].filter(item => item.visible));
  function canClose() {
    if (settingsSaving.value || bagSaving.value || criticalsSaving.value || bonusPointsSaving.value || diceManager?.diceMutationLoading.value || diceManager?.categoryMutationLoading.value)
      return false;
    const diceDirty = !!diceManager && Boolean(diceManager.newDiceNotation.value || diceManager.newDiceDescription.value || diceManager.newCategoryName.value || diceManager.editingDiceId.value || Object.entries(diceManager.categoryNameDrafts.value).some(([id, name]) => name !== diceManager.diceCategories.value.find(category => category.id === id)?.name));
    const criticalDirty = newCriticalDiceType.value !== 'd20' || Number(newCriticalThreshold.value) !== 1 || newCriticalOperator.value !== 'moreThan' || newCriticalColorMode.value !== 'preset' || newCriticalPresetColor.value !== '#d32f2f' || newCriticalCustomColor.value !== '#fdd835';
    const awardsDirty = Boolean(newRollAwardName.value || newRollAwardDescription.value || newRollAwardNumbers.value.length || newRollAwardDiceNotation.value);
    return !(hasPendingChanges.value || (Number(bonusPointsMaxInput.value) !== Number(roomsStore.bonusPointSettings?.maxPointsPerUser ?? props.room?.bonusPointSettings?.maxPointsPerUser ?? 0)) || diceDirty || criticalDirty || awardsDirty || bonusEditorDirty.value) || window.confirm(t('roomRework.discard'));
  }
  function requestClose() { if (canClose())
    open.value = false; }
  onBeforeRouteLeave(() => !open.value || canClose());
  onBeforeRouteUpdate(() => !open.value || canClose());
  const bagSaving = ref(false), bagError = ref('');
  async function toggleBag(value: boolean | null) {
    if (!props.room || !props.currentUser)
      return;
    bagSaving.value = true;
    bagError.value = '';
    try {
      const result = await bagRequest('setBagEnabled', { roomId: props.room.id, userId: props.currentUser.id, enabled: !!value });
      if (result.room)
        roomsStore.upsertRoom(result.room);
    }
    catch (e) {
      bagError.value = e instanceof Error ? e.message : String(e);
    }
    finally {
      bagSaving.value = false;
    }
  }
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
  const settingsFeedback = ref<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  let settingsFeedbackTimer: number | null = null;
  const access = useRoomAccess(computed(() => props.currentUser?.id));
  const { roomCriticals, newCriticalDiceType, newCriticalThreshold, newCriticalOperator, newCriticalColorMode, newCriticalPresetColor, newCriticalCustomColor, criticalsSaving, criticalsError, ROOM_CRITICALS_MAX_ITEMS, CRITICAL_OPERATOR_OPTIONS, CRITICAL_COLOR_MODE_OPTIONS, CRITICAL_PRESET_COLORS, canManageCriticals, selectedCriticalColor, cloneCriticalRules, resetCriticalForm, getCriticalOperatorText, formatCriticalRule, getCriticalColorChipStyle, addCriticalRule, toggleCriticalRule, removeCriticalRule, } = useCriticalRules(props, access, showSettingsFeedback);
  const { bonusPointsEnabled, bonusPointsMaxInput, bonusPointsAllowExtremeSpend, bonusPointsSaving, bonusPointsError, bonusPointBalanceSavingId, newBonusRuleName, newBonusRuleDiceNotation, newBonusRuleOperator, newBonusRuleThreshold, newBonusRuleThresholdMax, newBonusRuleAdjustmentSign, newBonusRuleAdjustmentAmount, editingBonusRuleId, bonusPointsPanelsOpen, BONUS_POINT_OPERATOR_OPTIONS, BONUS_POINT_SIGN_OPTIONS, canManageBonusPoints, syncBonusPointsForm, resetBonusPointRuleForm, startEditingBonusPointRule, formatBonusPointRule, formatBonusPointAdjustment, saveBonusPointSettings, handleBonusPointsToggle, handleBonusPointsAllowExtremeSpendToggle, getBonusPointBalanceDisplayName, updateMemberBonusPointBalance, incrementMemberBonusPoints, saveBonusPointRule, removeBonusPointRule, } = useBonusPointSettings(props, access, showSettingsFeedback);
  const { rollAwardsPanelsOpen, newRollAwardNumber, newRollAwardNumbers, newRollAwardName, newRollAwardDescription, newRollAwardDiceNotation, newRollAwardError, ROLL_AWARD_RESULT_MIN, ROLL_AWARD_RESULT_MAX, ROLL_AWARD_MAX_RESULTS, ROLL_AWARD_DESCRIPTION_MAX_LENGTH, rollAwardsEnabled, canManageRollAwards, isEditingRollAward, clipboardLoading, clipboardAction, rollAwardsClipboardFeedback, rollAwardsImportDialogOpen, rollAwardsImportError, parsedRollAwardsForImport, rollAwardsImporting, importMode, handleRollAwardsToggle, addRollAwardNumber, removeRollAwardNumber, getAwardNotations, formatNotations, formatAwardNotations, clearClipboardFeedback, copyRollAwardsToClipboard, handlePasteRollAwards, closeRollAwardsImportDialog, importParsedRollAwards, startEditingRollAward, clearRollAwardForm, handleSaveRollAward, } = useRollAwardSettings(access, rollAwardsManager);
  const isRoomCreator = computed(() => access.value.rights.editRoom);
  watch([access, settingsTab], () => {
    const allowed = settingsTab.value === 'talents' ? access.value.rights.manageTalentTrees : settingsTab.value === 'bag' ? access.value.rights.editRoom : settingsTab.value === 'criticals' ? access.value.rights.manageCriticals : settingsTab.value === 'bonusPoints' ? access.value.rights.manageBonusPoints : settingsTab.value === 'rollAwards' ? access.value.rights.viewRollAwards : settingsTab.value === 'administration' ? access.value.administration : true;
    if (!allowed)
      settingsTab.value = 'room';
  });
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
  watch(() => props.room?.id, () => {
    resetSettingsState();
  });
  watch(() => props.room?.criticals, (criticals) => {
    roomCriticals.value = cloneCriticalRules(criticals ?? []);
  }, { immediate: true, deep: true });
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
    }
    else {
      editorEpoch.value++;
      bonusEditorDirty.value = false;
      diceManager.clearNewDiceForm();
      diceManager.cancelEditingDice();
      diceManager.newCategoryName.value = '';
      diceManager.categoryNameDrafts.value = {};
      clearRollAwardForm();
      resetCriticalForm();
      clearSettingsFeedback();
      closeRollAwardsImportDialog();
      clearClipboardFeedback();
      rollAwardsImportError.value = null;
    }
  });
  watch(() => props.initialTab, (tab) => {
    if (!open.value)
      return;
    settingsTab.value = tab ?? 'room';
    if (settingsTab.value === 'rollAwards') {
      void rollAwardsManager.ensureAwardsLoaded();
    }
    if (settingsTab.value === 'bonusPoints' && props.room) {
      void roomsStore.loadBonusPoints(props.room.id);
    }
  });
  watch(settingsTab, (tab) => {
    if (tab === 'rollAwards') {
      void rollAwardsManager.ensureAwardsLoaded();
    }
    if (tab === 'bonusPoints' && props.room) {
      void roomsStore.loadBonusPoints(props.room.id);
    }
  });
  watch(() => props.room, (room) => {
    if (!room) {
      open.value = false;
    }
  });
  async function initializeSettingsPanel() {
    if (!props.room || !props.currentUser)
      return;
    syncBonusPointsForm();
    roomNameInput.value = props.room.name ?? '';
    sessionInactivityInput.value = props.room.sessionInactivityMinutes ?? 240;
    roomNameError.value = null;
    nicknameError.value = null;
    await ensureMemberSettingsLoaded();
  }
  async function ensureMemberSettingsLoaded(force = false) {
    if (!props.room || !props.currentUser)
      return;
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
    }
    catch (error) {
      memberSettingsError.value = error instanceof Error ? error.message : t('roomSettings.errors.loadMemberSettings');
    }
    finally {
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
    rollAwardsPanelsOpen.value = ['list'];
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
    if (typeof window === 'undefined')
      return;
    if (settingsFeedbackTimer !== null) {
      window.clearTimeout(settingsFeedbackTimer);
    }
    settingsFeedbackTimer = window.setTimeout(() => {
      settingsFeedback.value = null;
      settingsFeedbackTimer = null;
    }, 3500);
  }
  async function saveSettings() {
    if (!props.room || !props.currentUser)
      return;
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
        }
        else if (!normalizedRoomName.value) {
          roomNameError.value = t('roomSettings.errors.roomNameRequired');
          lastError = roomNameError.value;
        }
        else {
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
          }
          catch (error) {
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
        }
        catch (error) {
          nicknameError.value = error instanceof Error ? error.message : t('roomSettings.errors.updateNickname');
          lastError = nicknameError.value;
        }
      }
      if (anySuccess) {
        showSettingsFeedback('success', t('roomSettings.feedback.saved'));
      }
      else if (lastError) {
        showSettingsFeedback('error', lastError);
      }
      else {
        showSettingsFeedback('info', t('roomSettings.feedback.noChanges'));
      }
    }
    finally {
      settingsSaving.value = false;
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
    bonusEditorDirty,
    editorEpoch,
    saveSettings,
    hasPendingChanges,
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
    newCriticalDiceType,
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
    access,
    memberRole: computed(() => roomsStore.members.find(member => member.userId === props.currentUser?.id)?.role ?? 'player'),
    ROOM_PERMISSIONS,
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
    toggleCriticalRule,
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
  useErrorNotifications(
    () => bagError.value,
    () => settingsFeedback.value?.type === 'error' ? settingsFeedback.value.message : null,
    () => roomNameError.value,
    () => sessionInactivityError.value,
    () => nicknameError.value,
    () => memberSettingsError.value,
    () => criticalsError.value,
    () => bonusPointsError.value,
    () => newRollAwardError.value,
    () => rollAwardsImportError.value,
    () => rollAwardsClipboardFeedback.value?.type === 'error' ? rollAwardsClipboardFeedback.value.message : null,
  );
  return {
    roomsStore,
    t,
    settingsTab,
    navigationOpen,
    navigation,
    canClose,
    requestClose,
    bagSaving,
    bagError,
    toggleBag,
    settingsFeedback,
    access,
    isRoomCreator,
    rollAwardsImportDialogOpen,
    parsedRollAwardsForImport,
    rollAwardsImporting,
    importMode,
    formatNotations,
    closeRollAwardsImportDialog,
    importParsedRollAwards,
    settingsContext,
  };
}
export type RoomSettingsContext = ReturnType<typeof useRoomSettings>['settingsContext'];
