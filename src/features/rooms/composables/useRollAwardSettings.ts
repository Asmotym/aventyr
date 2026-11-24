import { useRoomAccess } from '@/features/rooms/composables/useRoomAccess';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomRollAward } from '@shared/rooms/rooms.types';
import { type RoomRollAwardsManager } from '@/features/rooms/composables/useRoomRollAwardsManager';
export function useRollAwardSettings(access: ReturnType<typeof useRoomAccess>, rollAwardsManager: RoomRollAwardsManager) {
  const { t } = useI18n();
  const rollAwardsPanelsOpen = ref<(string | number)[]>(['list']);
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
  type ImportableRollAward = {
    name: string;
    description: string | null;
    diceResults: number[];
    diceNotations: string[];
  };
  const rollAwardsEnabled = computed(() => rollAwardsManager.awardsEnabled.value);
  const canManageRollAwards = computed(() => access.value.rights.manageRollAwards);
  const isEditingRollAward = computed(() => Boolean(editingRollAwardId.value));
  const clipboardLoading = ref(false);
  const clipboardAction = ref<'copy' | 'paste' | null>(null);
  const rollAwardsClipboardFeedback = ref<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const rollAwardsImportDialogOpen = ref(false);
  const rollAwardsImportError = ref<string | null>(null);
  const parsedRollAwardsForImport = ref<ImportableRollAward[]>([]);
  const rollAwardsImporting = ref(false);
  const importMode = ref<'append' | 'clean' | null>(null);
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
    if (!award)
      return [];
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
  function parseRollAwardNotations(input: string): {
    notations: string[];
    error?: string;
  } {
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
    if (!access.value.rights.copyRollAwards)
      return;
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
    }
    catch (error) {
      rollAwardsClipboardFeedback.value = {
        type: 'error',
        message: error instanceof Error ? error.message : t('rollAwards.clipboard.copyError'),
      };
    }
    finally {
      clipboardLoading.value = false;
      clipboardAction.value = null;
    }
  }
  function normalizeClipboardAward(entry: unknown): ImportableRollAward | null {
    if (!entry || typeof entry !== 'object')
      return null;
    const raw = entry as Record<string, unknown>;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name)
      return null;
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    const results = Array.isArray(raw.diceResults)
      ? raw.diceResults
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value, index, list) => Number.isFinite(value) &&
        value >= ROLL_AWARD_RESULT_MIN &&
        value <= ROLL_AWARD_RESULT_MAX &&
        list.indexOf(value) === index)
      : [];
    if (!results.length)
      return null;
    if (results.length > ROLL_AWARD_MAX_RESULTS) {
      results.length = ROLL_AWARD_MAX_RESULTS;
    }
    let notationSource: string[] = [];
    if (Array.isArray(raw.diceNotations)) {
      notationSource = raw.diceNotations.map((value) => (typeof value === 'string' ? value : '')).filter(Boolean);
    }
    else if (typeof raw.diceNotation === 'string') {
      notationSource = raw.diceNotation.split(/[\s,]+/);
    }
    const { notations, error } = parseRollAwardNotations(notationSource.join(','));
    if (error)
      return null;
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
    }
    catch {
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
    }
    catch (error) {
      rollAwardsClipboardFeedback.value = {
        type: 'error',
        message: error instanceof Error ? error.message : t('rollAwards.clipboard.readError'),
      };
    }
    finally {
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
        const created = await rollAwardsManager.createAward(award.name, award.diceResults, award.diceNotations, award.description);
        if (!created) {
          throw new Error(rollAwardsManager.awardMutationError.value ?? t('rollAwards.import.createAwardError'));
        }
      }
      closeRollAwardsImportDialog();
      rollAwardsClipboardFeedback.value = {
        type: 'success',
        message: cleanExisting ? t('rollAwards.import.replaceSuccess') : t('rollAwards.import.importSuccess'),
      };
    }
    catch (error) {
      rollAwardsImportError.value = error instanceof Error ? error.message : t('rollAwards.import.importError');
    }
    finally {
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
      const updated = await rollAwardsManager.updateAward(editingRollAwardId.value, trimmedName, newRollAwardNumbers.value, normalizedNotations, trimmedDescription || null);
      if (updated) {
        clearRollAwardForm();
        rollAwardsPanelsOpen.value = ['list'];
      }
    }
    else {
      const created = await rollAwardsManager.createAward(trimmedName, newRollAwardNumbers.value, normalizedNotations, trimmedDescription || null);
      if (created) {
        clearRollAwardForm();
        rollAwardsPanelsOpen.value = ['list'];
      }
    }
  }
  return {
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
    rollAwardsEnabled,
    canManageRollAwards,
    isEditingRollAward,
    clipboardLoading,
    clipboardAction,
    rollAwardsClipboardFeedback,
    rollAwardsImportDialogOpen,
    rollAwardsImportError,
    parsedRollAwardsForImport,
    rollAwardsImporting,
    importMode,
    handleRollAwardsToggle,
    addRollAwardNumber,
    removeRollAwardNumber,
    getAwardNotations,
    formatNotations,
    formatAwardNotations,
    clearClipboardFeedback,
    copyRollAwardsToClipboard,
    handlePasteRollAwards,
    closeRollAwardsImportDialog,
    importParsedRollAwards,
    startEditingRollAward,
    clearRollAwardForm,
    handleSaveRollAward,
  };
}
