import { hexToRgb } from '@/shared/utils/colors';
import { useRoomAccess } from '@/features/rooms/composables/useRoomAccess';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomCriticalRule } from 'netlify/core/types/data.types';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import type { RoomSettingsProps, SettingsFeedback } from '../types/room-settings.types';
export function useCriticalRules(props: RoomSettingsProps, access: ReturnType<typeof useRoomAccess>, showSettingsFeedback: SettingsFeedback) {
  const roomsStore = useRoomsStore();
  const { t } = useI18n();
  const roomCriticals = ref<RoomCriticalRule[]>([]);
  const newCriticalDiceType = ref('d20');
  const newCriticalThreshold = ref<number>(1);
  const newCriticalOperator = ref<RoomCriticalRule['operator']>('moreThan');
  const newCriticalColorMode = ref<'preset' | 'custom'>('preset');
  const newCriticalPresetColor = ref('#d32f2f');
  const newCriticalCustomColor = ref('#fdd835');
  const criticalsSaving = ref(false);
  const criticalsError = ref<string | null>(null);
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
  const canManageCriticals = computed(() => access.value.rights.manageCriticals);
  const selectedCriticalColor = computed(() => (newCriticalColorMode.value === 'custom'
    ? newCriticalCustomColor.value
    : newCriticalPresetColor.value));
  function cloneCriticalRules(criticals: RoomCriticalRule[]): RoomCriticalRule[] {
    return criticals.map((critical) => ({ ...critical }));
  }
  function resetCriticalForm() {
    newCriticalDiceType.value = 'd20';
    newCriticalThreshold.value = 1;
    newCriticalOperator.value = 'moreThan';
    newCriticalColorMode.value = 'preset';
    newCriticalPresetColor.value = CRITICAL_PRESET_COLORS.value[0]?.value ?? '#d32f2f';
    newCriticalCustomColor.value = '#fdd835';
    criticalsError.value = null;
  }
  function getCriticalOperatorText(operator: RoomCriticalRule['operator']) {
    if (operator === 'moreThan') {
      return t('criticals.operators.moreThan').toLowerCase();
    }
    return t('criticals.operators.lessThan').toLowerCase();
  }
  function formatCriticalRule(rule: RoomCriticalRule) {
    return `${rule.diceType ? rule.diceType + " · " : ""}${getCriticalOperatorText(rule.operator)} ${rule.threshold}`;
  }
  function getCriticalColorChipStyle(color: string) {
    return {
      backgroundColor: color,
      color: getContrastTextColor(color),
    };
  }
  function getContrastTextColor(color: string) {
    const rgb = hexToRgb(color);
    if (!rgb)
      return '#111111';
    const { r: red, g: green, b: blue } = rgb;
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
    }
    catch (error) {
      criticalsError.value = error instanceof Error ? error.message : t('criticals.errors.save');
      roomCriticals.value = cloneCriticalRules(props.room.criticals ?? []);
      return false;
    }
    finally {
      criticalsSaving.value = false;
    }
  }
  async function addCriticalRule(editIndex?: number) {
    criticalsError.value = null;
    if (!canManageCriticals.value) {
      criticalsError.value = t('criticals.creatorOnly');
      return;
    }
    if (editIndex === undefined && roomCriticals.value.length >= ROOM_CRITICALS_MAX_ITEMS) {
      criticalsError.value = t('criticals.errors.maxRules', { count: ROOM_CRITICALS_MAX_ITEMS });
      return;
    }
    const diceType = newCriticalDiceType.value.trim().toLowerCase();
    if (!/^d[1-9]\d*$/.test(diceType) || !Number.isSafeInteger(Number(diceType.slice(1)))) {
      criticalsError.value = t('criticals.errors.diceType');
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
    const duplicate = roomCriticals.value.some((critical, index) => (index !== editIndex &&
      critical.diceType === diceType &&
      critical.operator === newCriticalOperator.value &&
      critical.threshold === parsedThreshold));
    if (duplicate) {
      criticalsError.value = t('criticals.errors.duplicate');
      return;
    }
    const rule: RoomCriticalRule = { diceType, enabled: editIndex === undefined || !roomCriticals.value[editIndex]?.diceType ? true : roomCriticals.value[editIndex]?.enabled !== false, threshold: parsedThreshold, operator: newCriticalOperator.value, color: selectedCriticalColor.value };
    const next = editIndex === undefined ? [...roomCriticals.value, rule] : roomCriticals.value.map((existing, index) => index === editIndex ? rule : existing);
    const saved = await saveCriticalRules(next);
    if (saved) {
      resetCriticalForm();
    }
  }
  async function toggleCriticalRule(index: number) {
    const rule = roomCriticals.value[index];
    if (!canManageCriticals.value || criticalsSaving.value || !rule?.diceType)
      return;
    await saveCriticalRules(roomCriticals.value.map((item, i) => i === index ? { ...item, enabled: item.enabled === false } : item));
  }
  async function removeCriticalRule(index: number) {
    if (!canManageCriticals.value) {
      criticalsError.value = t('criticals.creatorOnly');
      return;
    }
    const nextRules = roomCriticals.value.filter((_, currentIndex) => currentIndex !== index);
    await saveCriticalRules(nextRules);
  }
  return {
    roomCriticals,
    newCriticalDiceType,
    newCriticalThreshold,
    newCriticalOperator,
    newCriticalColorMode,
    newCriticalPresetColor,
    newCriticalCustomColor,
    criticalsSaving,
    criticalsError,
    ROOM_CRITICALS_MAX_ITEMS,
    CRITICAL_OPERATOR_OPTIONS,
    CRITICAL_COLOR_MODE_OPTIONS,
    CRITICAL_PRESET_COLORS,
    canManageCriticals,
    selectedCriticalColor,
    cloneCriticalRules,
    resetCriticalForm,
    getCriticalOperatorText,
    formatCriticalRule,
    getCriticalColorChipStyle,
    addCriticalRule,
    toggleCriticalRule,
    removeCriticalRule,
  };
}
