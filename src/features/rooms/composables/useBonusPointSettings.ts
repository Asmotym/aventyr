import { useRoomAccess } from '@/features/rooms/composables/useRoomAccess';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointRule } from '@shared/rooms/rooms.types';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import type { RoomSettingsProps, SettingsFeedback } from '../types/room-settings.types';
export function useBonusPointSettings(props: RoomSettingsProps, access: ReturnType<typeof useRoomAccess>, showSettingsFeedback: SettingsFeedback) {
  const roomsStore = useRoomsStore();
  const { t } = useI18n();
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
  const BONUS_POINT_OPERATOR_OPTIONS = computed(() => [
    { title: t('bonusPoints.operators.moreThan'), value: 'moreThan' },
    { title: t('bonusPoints.operators.lessThan'), value: 'lessThan' },
    { title: t('bonusPoints.operators.between'), value: 'between' },
  ] as const);
  const BONUS_POINT_SIGN_OPTIONS = computed(() => [
    { title: '+', value: '+' },
    { title: '-', value: '-' },
  ] as const);
  const canManageBonusPoints = computed(() => access.value.rights.manageBonusPoints);
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
    if (!props.room || !props.currentUser)
      return;
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
    }
    catch (error) {
      bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveSettings');
    }
    finally {
      bonusPointsSaving.value = false;
    }
  }
  async function handleBonusPointsToggle(value: boolean | null) {
    if (!props.room || !props.currentUser)
      return;
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
    }
    catch (error) {
      bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveSettings');
      syncBonusPointsForm();
    }
    finally {
      bonusPointsSaving.value = false;
    }
  }
  async function handleBonusPointsAllowExtremeSpendToggle(value: boolean | null) {
    if (!props.room || !props.currentUser)
      return;
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
    }
    catch (error) {
      bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveSettings');
      syncBonusPointsForm();
    }
    finally {
      bonusPointsSaving.value = false;
    }
  }
  function getBonusPointBalanceDisplayName(balance: {
    username?: string;
    nickname?: string;
    userId: string;
  }) {
    return balance.nickname || balance.username || balance.userId;
  }
  async function updateMemberBonusPointBalance(targetUserId: string, points: number) {
    if (!props.room || !props.currentUser)
      return;
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
    }
    catch (error) {
      bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveBalance');
    }
    finally {
      bonusPointBalanceSavingId.value = null;
    }
  }
  function incrementMemberBonusPoints(userId: string, delta: number) {
    const balance = roomsStore.bonusPointBalances.find((current) => current.userId === userId);
    if (!balance)
      return;
    void updateMemberBonusPointBalance(userId, Number(balance.points ?? 0) + delta);
  }
  async function saveBonusPointRule() {
    if (!props.room || !props.currentUser)
      return;
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
      }
      else {
        await roomsStore.createBonusPointRule(basePayload);
      }
      resetBonusPointRuleForm();
      bonusPointsPanelsOpen.value = ['list'];
      showSettingsFeedback('success', t('bonusPoints.feedback.ruleSaved'));
    }
    catch (error) {
      bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.saveRule');
    }
    finally {
      bonusPointsSaving.value = false;
    }
  }
  async function removeBonusPointRule(ruleId: string) {
    if (!props.room || !props.currentUser)
      return;
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
    }
    catch (error) {
      bonusPointsError.value = error instanceof Error ? error.message : t('bonusPoints.errors.deleteRule');
    }
    finally {
      bonusPointsSaving.value = false;
    }
  }
  return {
    bonusPointsEnabled,
    bonusPointsMaxInput,
    bonusPointsAllowExtremeSpend,
    bonusPointsSaving,
    bonusPointsError,
    bonusPointBalanceSavingId,
    newBonusRuleName,
    newBonusRuleDiceNotation,
    newBonusRuleOperator,
    newBonusRuleThreshold,
    newBonusRuleThresholdMax,
    newBonusRuleAdjustmentSign,
    newBonusRuleAdjustmentAmount,
    editingBonusRuleId,
    bonusPointsPanelsOpen,
    BONUS_POINT_OPERATOR_OPTIONS,
    BONUS_POINT_SIGN_OPTIONS,
    canManageBonusPoints,
    syncBonusPointsForm,
    resetBonusPointRuleForm,
    startEditingBonusPointRule,
    formatBonusPointRule,
    formatBonusPointAdjustment,
    saveBonusPointSettings,
    handleBonusPointsToggle,
    handleBonusPointsAllowExtremeSpendToggle,
    getBonusPointBalanceDisplayName,
    updateMemberBonusPointBalance,
    incrementMemberBonusPoints,
    saveBonusPointRule,
    removeBonusPointRule,
  };
}
