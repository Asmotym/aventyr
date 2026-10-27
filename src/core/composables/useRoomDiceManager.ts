import { ref, watch } from 'vue';
import type { RoomDetails, RoomDice, RoomDiceCategory } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { parseDiceNotation, rollDiceNotation, type DiceRoll } from 'core/utils/dice.utils';
import i18n from 'modules/language-switcher/plugins/i18n.plugin';

export const RoomDiceManagerKey = Symbol('RoomDiceManager');
const t = i18n.global.t;

export function useRoomDiceManager(
  getRoom: () => RoomDetails | null,
  getCurrentUser: () => DiscordUser | null,
  onRoll: (roll: DiceRoll) => void
) {
  const customDices = ref<RoomDice[]>([]);
  const diceCategories = ref<RoomDiceCategory[]>([]);
  const newDiceNotation = ref('');
  const newDiceDescription = ref('');
  const newDiceError = ref<string | null>(null);
  const newDiceCategoryId = ref<string | null>(null);
  const newCategoryName = ref('');
  const newCategoryError = ref<string | null>(null);
  const editDiceNotation = ref('');
  const editDiceDescription = ref('');
  const editDiceError = ref<string | null>(null);
  const editDiceCategoryId = ref<string | null>(null);
  const editingDiceId = ref<string | null>(null);
  const diceRollError = ref<string | null>(null);
  const roomDicesLoading = ref(false);
  const roomDicesError = ref<string | null>(null);
  const roomDicesLoadedKey = ref<string | null>(null);
  const diceMutationLoading = ref(false);
  const categoryMutationLoading = ref(false);
  const diceManagementError = ref<string | null>(null);
  const categoryManagementError = ref<string | null>(null);

  watch(
    () => ({ roomId: getRoom()?.id, userId: getCurrentUser()?.id }),
    async ({ roomId, userId }) => {
      resetCustomDiceState();
      if (roomId && userId) {
        await ensureRoomDicesLoaded(true);
      }
    },
    { immediate: true }
  );

  watch(diceCategories, () => {
    ensureCategorySelections();
  });

  async function ensureRoomDicesLoaded(force = false) {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) return;
    const cacheKey = composeDiceCacheKey(room.id, currentUser.id);
    if (!force && roomDicesLoadedKey.value === cacheKey) return;
    roomDicesLoading.value = true;
    roomDicesError.value = null;
    try {
      const { dices, categories } = await RoomsService.fetchRoomDices(room.id, currentUser.id);
      customDices.value = dices;
      diceCategories.value = sortDiceCategories(categories);
      ensureCategorySelections();
      roomDicesLoadedKey.value = cacheKey;
    } catch (error) {
      roomDicesError.value = error instanceof Error ? error.message : t('dice.errors.loadRoomDice');
    } finally {
      roomDicesLoading.value = false;
    }
  }

  function resetCustomDiceState() {
    customDices.value = [];
    diceCategories.value = [];
    newDiceNotation.value = '';
    newDiceDescription.value = '';
    newDiceError.value = null;
    newDiceCategoryId.value = null;
    newCategoryName.value = '';
    newCategoryError.value = null;
    diceRollError.value = null;
    roomDicesLoadedKey.value = null;
    roomDicesError.value = null;
    roomDicesLoading.value = false;
    diceMutationLoading.value = false;
    categoryMutationLoading.value = false;
    diceManagementError.value = null;
    categoryManagementError.value = null;
    cancelEditingDice();
  }

  function rollCustomDice(dice: RoomDice) {
    diceRollError.value = null;
    try {
      const roll = rollDiceNotation(dice.notation, {}, dice.description ?? undefined);
      onRoll(roll);
    } catch (error) {
      diceRollError.value = error instanceof Error ? error.message : t('dice.errors.rollDice');
    }
  }

  function clearNewDiceForm() {
    newDiceNotation.value = '';
    newDiceDescription.value = '';
    newDiceError.value = null;
    diceManagementError.value = null;
    ensureCategorySelections();
  }

  async function addCustomDice() {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) {
      newDiceError.value = t('dice.errors.needRoomForDice');
      return;
    }
    const notation = newDiceNotation.value.trim().toLowerCase();
    const description = newDiceDescription.value.trim();
    if (!notation) {
      newDiceError.value = t('dice.errors.notationRequired');
      return;
    }
    try {
      parseDiceNotation(notation);
    } catch {
      newDiceError.value = t('dice.errors.invalidNotation');
      return;
    }
    const categoryId = getValidCategoryId(newDiceCategoryId.value);
    diceMutationLoading.value = true;
    diceManagementError.value = null;
    try {
      const created = await RoomsService.createRoomDice({
        roomId: room.id,
        userId: currentUser.id,
        notation,
        description: description || undefined,
        categoryId: categoryId ?? undefined,
      });
      customDices.value = [...customDices.value, created];
       newDiceCategoryId.value = categoryId ?? newDiceCategoryId.value;
      roomDicesLoadedKey.value = composeDiceCacheKey(room.id, currentUser.id);
      clearNewDiceForm();
    } catch (error) {
      diceManagementError.value = error instanceof Error ? error.message : t('dice.errors.addDice');
    } finally {
      diceMutationLoading.value = false;
    }
  }

  function startEditingDice(dice: RoomDice) {
    editingDiceId.value = dice.id;
    editDiceNotation.value = dice.notation;
    editDiceDescription.value = dice.description ?? '';
    editDiceCategoryId.value = getValidCategoryId(dice.categoryId ?? null);
    editDiceError.value = null;
    diceManagementError.value = null;
  }

  function cancelEditingDice() {
    editingDiceId.value = null;
    editDiceNotation.value = '';
    editDiceDescription.value = '';
    editDiceError.value = null;
    editDiceCategoryId.value = null;
    diceManagementError.value = null;
  }

  async function saveEditingDice() {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!editingDiceId.value || !room || !currentUser) return;
    const notation = editDiceNotation.value.trim().toLowerCase();
    const description = editDiceDescription.value.trim();
    if (!notation) {
      editDiceError.value = t('dice.errors.notationRequired');
      return;
    }
    try {
      parseDiceNotation(notation);
    } catch {
      editDiceError.value = t('dice.errors.invalidNotation');
      return;
    }
    const categoryId = getValidCategoryId(editDiceCategoryId.value);
    diceMutationLoading.value = true;
    diceManagementError.value = null;
    try {
      const updated = await RoomsService.updateRoomDice({
        roomId: room.id,
        userId: currentUser.id,
        diceId: editingDiceId.value,
        notation,
        description: description || undefined,
        categoryId: categoryId ?? undefined,
      });
      customDices.value = customDices.value.map((dice) => (dice.id === updated.id ? updated : dice));
      cancelEditingDice();
    } catch (error) {
      diceManagementError.value = error instanceof Error ? error.message : t('dice.errors.updateDice');
    } finally {
      diceMutationLoading.value = false;
    }
  }

  async function deleteCustomDice(id: string) {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(t('dice.confirmDelete'));
      if (!confirmed) {
        return;
      }
    }
    diceMutationLoading.value = true;
    diceManagementError.value = null;
    try {
      await RoomsService.deleteRoomDice({
        roomId: room.id,
        userId: currentUser.id,
        diceId: id,
      });
      customDices.value = customDices.value.filter((dice) => dice.id !== id);
      if (editingDiceId.value === id) {
        cancelEditingDice();
      }
    } catch (error) {
      diceManagementError.value = error instanceof Error ? error.message : t('dice.errors.deleteDice');
    } finally {
      diceMutationLoading.value = false;
    }
  }

  async function addDiceCategory() {
    const room = getRoom();
    const currentUser = getCurrentUser();
    if (!room || !currentUser) {
      newCategoryError.value = t('dice.errors.needRoomForCategory');
      return;
    }
    const name = newCategoryName.value.trim();
    if (!name) {
      newCategoryError.value = t('dice.errors.categoryRequired');
      return;
    }
    categoryMutationLoading.value = true;
    categoryManagementError.value = null;
    newCategoryError.value = null;
    try {
      const created = await RoomsService.createDiceCategory({
        roomId: room.id,
        userId: currentUser.id,
        name,
      });
      diceCategories.value = sortDiceCategories([
        ...diceCategories.value.filter((category) => category.id !== created.id),
        created,
      ]);
      newDiceCategoryId.value = created.id;
      newCategoryName.value = '';
      ensureCategorySelections();
    } catch (error) {
      categoryManagementError.value = error instanceof Error ? error.message : t('dice.errors.createCategory');
    } finally {
      categoryMutationLoading.value = false;
    }
  }

  const categoryNameDrafts = ref<Record<string, string>>({});
  async function renameDiceCategory(category: RoomDiceCategory) {
    const room = getRoom(), user = getCurrentUser();
    if (!room || !user) return;
    categoryMutationLoading.value = true;
    categoryManagementError.value = null;
    try {
      await RoomsService.updateDiceCategory({ roomId: room.id, userId: user.id, categoryId: category.id, name: categoryNameDrafts.value[category.id] ?? category.name });
      await ensureRoomDicesLoaded(true);
      delete categoryNameDrafts.value[category.id];
    } catch (error) { categoryManagementError.value = error instanceof Error ? error.message : String(error); }
    finally { categoryMutationLoading.value = false; }
  }

  function composeDiceCacheKey(roomId: string, userId: string) {
    return `${roomId}:${userId}`;
  }

  function sortDiceCategories(categories: RoomDiceCategory[]) {
    return [...categories].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }

  function getValidCategoryId(preferredId?: string | null) {
    return pickAvailableCategoryId(preferredId ?? null, diceCategories.value);
  }

  function pickAvailableCategoryId(candidateId: string | null, categories: RoomDiceCategory[]) {
    if (candidateId && categories.some((category) => category.id === candidateId)) {
      return candidateId;
    }
    const defaultCategory = categories.find((category) => category.isDefault);
    if (defaultCategory) {
      return defaultCategory.id;
    }
    return categories[0]?.id ?? null;
  }

  function ensureCategorySelections() {
    if (!diceCategories.value.length) {
      newDiceCategoryId.value = null;
      if (editingDiceId.value) {
        editDiceCategoryId.value = null;
      }
      return;
    }
    newDiceCategoryId.value = getValidCategoryId(newDiceCategoryId.value);
    if (editingDiceId.value) {
      const editingDice = customDices.value.find((dice) => dice.id === editingDiceId.value);
      const preferred = editDiceCategoryId.value ?? editingDice?.categoryId ?? null;
      editDiceCategoryId.value = getValidCategoryId(preferred);
    }
  }

  return {
    categoryNameDrafts,
    renameDiceCategory,
    customDices,
    diceCategories,
    newDiceNotation,
    newDiceDescription,
    newDiceError,
    newDiceCategoryId,
    newCategoryName,
    newCategoryError,
    editDiceNotation,
    editDiceDescription,
    editDiceError,
    editDiceCategoryId,
    editingDiceId,
    diceRollError,
    roomDicesLoading,
    roomDicesError,
    diceMutationLoading,
    categoryMutationLoading,
    diceManagementError,
    categoryManagementError,
    ensureRoomDicesLoaded,
    rollCustomDice,
    clearNewDiceForm,
    addCustomDice,
    addDiceCategory,
    startEditingDice,
    cancelEditingDice,
    saveEditingDice,
    deleteCustomDice,
  };
}

export type RoomDiceManager = ReturnType<typeof useRoomDiceManager>;
