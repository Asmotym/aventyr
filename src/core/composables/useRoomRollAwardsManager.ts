import { ref, watch } from 'vue';
import type { RoomDetails, RoomRollAward } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomsService } from 'core/services/rooms.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import i18n from 'modules/language-switcher/plugins/i18n.plugin';

export const RoomRollAwardsManagerKey = Symbol('RoomRollAwardsManager');
const t = i18n.global.t;

export function useRoomRollAwardsManager(
  getRoom: () => RoomDetails | null,
  getCurrentUser: () => DiscordUser | null
) {
  const ROLL_AWARD_NOTATION_REGEX = /^d([1-9]\d*)$/i;
  const roomsStore = useRoomsStore();
  const awards = ref<RoomRollAward[]>([]);
  const awardsEnabled = ref(false);
  const awardsLoading = ref(false);
  const awardsError = ref<string | null>(null);
  const awardsLoadedRoomId = ref<string | null>(null);
  const toggleLoading = ref(false);
  const toggleError = ref<string | null>(null);
  const awardMutationLoading = ref(false);
  const awardMutationError = ref<string | null>(null);

  watch(
    () => getRoom()?.id,
    (roomId) => {
      resetState();
      if (roomId) {
        void ensureAwardsLoaded(true);
      }
    },
    { immediate: true }
  );

  watch(
    () => roomsStore.rollAwardsRealtimeSnapshot,
    (snapshot) => {
      if (!snapshot || snapshot.roomId !== getRoom()?.id) return;
      awards.value = snapshot.awards.map(normalizeAwardNotation);
      awardsEnabled.value = snapshot.enabled;
      awardsLoadedRoomId.value = snapshot.roomId;
    }
  );

  async function ensureAwardsLoaded(force = false) {
    const room = getRoom();
    if (!room) return;
    if (!force && awardsLoadedRoomId.value === room.id) return;
    awardsLoading.value = true;
    awardsError.value = null;
    try {
      const { awards: roomAwards, enabled } = await RoomsService.fetchRollAwards(room.id);
      awards.value = roomAwards.map(normalizeAwardNotation);
      awardsEnabled.value = enabled;
      awardsLoadedRoomId.value = room.id;
    } catch (error) {
      awardsError.value = error instanceof Error ? error.message : t('rollAwards.errors.load');
    } finally {
      awardsLoading.value = false;
    }
  }

  async function setAwardsEnabled(enabled: boolean) {
    return updateAwardsSettings({ enabled });
  }

  async function updateAwardsSettings(update: { enabled?: boolean }) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      toggleError.value = t('rollAwards.errors.creatorSetting');
      return false;
    }
    toggleLoading.value = true;
    toggleError.value = null;
    try {
      const result = await RoomsService.updateRollAwardsSettings({
        roomId: room.id,
        userId: user.id,
        enabled: typeof update.enabled === 'boolean' ? update.enabled : awardsEnabled.value,
      });
      awardsEnabled.value = result.enabled;
      awardsLoadedRoomId.value = room.id;
      if (result.enabled) {
        await ensureAwardsLoaded(true);
      } else {
        awards.value = [];
      }
      return result.enabled;
    } catch (error) {
      toggleError.value = error instanceof Error ? error.message : t('rollAwards.errors.updateSetting');
      return false;
    } finally {
      toggleLoading.value = false;
    }
  }

  async function createAward(name: string, diceResults: number[], diceNotations?: string[] | null, description?: string | null) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      awardMutationError.value = t('rollAwards.errors.signIn');
      return null;
    }
    awardMutationLoading.value = true;
    awardMutationError.value = null;
    try {
      const created = await RoomsService.createRollAward({
        roomId: room.id,
        userId: user.id,
        name,
        description,
        diceResults,
        diceNotations: diceNotations ?? undefined,
      });
      awards.value = [...awards.value, normalizeAwardNotation(created)];
      return created;
    } catch (error) {
      awardMutationError.value = error instanceof Error ? error.message : t('rollAwards.errors.save');
      return null;
    } finally {
      awardMutationLoading.value = false;
    }
  }

  async function deleteAward(awardId: string) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      awardMutationError.value = t('rollAwards.errors.signIn');
      return false;
    }
    awardMutationLoading.value = true;
    awardMutationError.value = null;
    try {
      await RoomsService.deleteRollAward({ roomId: room.id, userId: user.id, awardId });
      awards.value = awards.value.filter((award) => award.id !== awardId);
      return true;
    } catch (error) {
      awardMutationError.value = error instanceof Error ? error.message : t('rollAwards.errors.delete');
      return false;
    } finally {
      awardMutationLoading.value = false;
    }
  }

  async function updateAward(
    awardId: string,
    name: string,
    diceResults: number[],
    diceNotations?: string[] | null,
    description?: string | null
  ) {
    const room = getRoom();
    const user = getCurrentUser();
    if (!room || !user) {
      awardMutationError.value = t('rollAwards.errors.signIn');
      return null;
    }
    awardMutationLoading.value = true;
    awardMutationError.value = null;
    try {
      const updated = await RoomsService.updateRollAward({
        roomId: room.id,
        userId: user.id,
        awardId,
        name,
        description,
        diceResults,
        diceNotations: diceNotations ?? undefined,
      });
      awards.value = awards.value.map((award) => (award.id === awardId ? normalizeAwardNotation(updated) : award));
      return updated;
    } catch (error) {
      awardMutationError.value = error instanceof Error ? error.message : t('rollAwards.errors.update');
      return null;
    } finally {
      awardMutationLoading.value = false;
    }
  }

  function resetState() {
    awards.value = [];
    awardsEnabled.value = false;
    awardsLoading.value = false;
    awardsError.value = null;
    awardsLoadedRoomId.value = null;
    toggleLoading.value = false;
    toggleError.value = null;
    awardMutationLoading.value = false;
    awardMutationError.value = null;
  }

  function normalizeAwardNotation(award: RoomRollAward): RoomRollAward {
    const normalizedNotations = normalizeNotations(
      Array.isArray(award.diceNotations)
        ? award.diceNotations
        : award.diceNotation
          ? award.diceNotation.split(/[\s,]+/)
          : []
    );
    if (!normalizedNotations.length) {
      return { ...award, diceNotation: undefined, diceNotations: undefined };
    }
    return { ...award, diceNotation: normalizedNotations[0], diceNotations: normalizedNotations };
  }

  function normalizeNotations(notations: string[]): string[] {
    const normalized: string[] = [];
    for (const value of notations) {
      const trimmed = value?.trim().toLowerCase();
      if (!trimmed) continue;
      const match = trimmed.match(ROLL_AWARD_NOTATION_REGEX);
      if (!match) continue;
      const notation = `d${match[1]}`;
      if (!normalized.includes(notation)) {
        normalized.push(notation);
      }
    }
    return normalized;
  }

  return {
    awards,
    awardsEnabled,
    awardsLoading,
    awardsError,
    toggleLoading,
    toggleError,
    awardMutationLoading,
    awardMutationError,
    ensureAwardsLoaded,
    setAwardsEnabled,
    createAward,
    updateAward,
    deleteAward,
  };
}

export type RoomRollAwardsManager = ReturnType<typeof useRoomRollAwardsManager>;
