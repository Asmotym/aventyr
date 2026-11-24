<template>
  <div class="rooms-board">
    <v-alert
      v-if="feedback && !roomsStore.errorMessage"
      :type="feedback.type"
      variant="tonal"
      class="mb-4"
    >
      {{ feedback.message }}
    </v-alert>

    <v-row class="justify-center rooms-board__content">
      <v-col v-if="!selectedRoom" cols="12" :md="dashboard ? 12 : 6" class="rooms-board__sidebar">
        <RoomsSidebar
          :rooms="rooms"
          :selected-room-id="roomsStore.selectedRoomId"
          :loading="roomsStore.loadingRooms"
          :favoriting-room-ids="roomsStore.favoritingRoomIds"
          @favorite="handleFavoriteRoom"
          :creating="roomsStore.creatingRoom"
          :joining="roomsStore.joiningRoom"
          @select="handleSelectRoom"
          @create="handleCreateRoom"
          @join="handleJoinRoom"
        />
      </v-col>
          <v-col v-if="selectedRoom" cols="12" style="height: 100%;">
            <RoomChatPanel
              :room="selectedRoom"
              :messages="messages"
              :sending="roomsStore.sendingMessage"
              :history-loading="roomsStore.historyLoading"
              :can-load-older="canLoadOlderMessages"
              :current-user="currentUser"
              @send-message="handleSendMessage"
              @send-dice="handleDiceRoll"
              @send-message-as="handleSendMessageAs"
              @send-dice-as="handleDiceRollAs"
              @use-bonus-point="handleUseBonusPointOnRoll"
              @load-older="handleLoadOlderMessages"
              @trim-history="handleTrimMessages"
            />
          </v-col>
        </v-row>
      </div>
    </template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { isNavigationFailure, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import RoomsSidebar from '@/features/rooms/components/RoomsSidebar.component.vue';
const RoomChatPanel = defineAsyncComponent(() => import('@/features/rooms/components/chat/RoomChatPanel.component.vue'));
import { ROOM_MESSAGES_PAGE_SIZE, useRoomsStore } from '@/features/rooms/stores/rooms.store';
import { DiscordService } from '@/features/auth';
import type { DiceRoll } from '@/features/rooms/utils/dice.utils';
import type { RoomMessage } from '@shared/rooms/rooms.types';
import { parseInlineDiceCommand, rollDiceNotation } from '@/features/rooms/utils/dice.utils';
import { HomeRoutes } from '@/shared/navigation/routes';

defineProps<{
  dashboard?: boolean;
}>();

const roomsStore = useRoomsStore();
const discordService = DiscordService.getInstance();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const currentUser = computed(() => discordService.user.value);
const rooms = computed(() => roomsStore.rooms.filter((room) => !room.isArchived));
const selectedRoom = computed(() => roomsStore.selectedRoom);
const messages = computed(() => roomsStore.messages);
const canLoadOlderMessages = computed(() => {
  if (!selectedRoom.value || roomsStore.historyLoading || roomsStore.messages.length === 0) {
    return false;
  }
  if (!roomsStore.historyExhausted) {
    return true;
  }
  // Allow reloading trimmed history even after we've previously reached the start.
  return roomsStore.messages.length <= ROOM_MESSAGES_PAGE_SIZE;
});
const routeRoomId = computed(() => {
  const param = route.params.roomId;
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }
  return param ? String(param) : null;
});

const feedback = ref<{ type: 'success' | 'info'; message: string } | null>(null);
const pendingInvite = ref<string | null>(null);

const clearFeedback = () => {
  feedback.value = null;
};

function showFeedback(type: 'success' | 'info', message: string) {
  feedback.value = { type, message };
  setTimeout(clearFeedback, 4000);
}

async function ensureRoomsLoaded() {
  try {
    await roomsStore.fetchRooms(currentUser.value?.id ?? null);
  } catch (error) {
    console.error(error);
  }
}

onMounted(async () => {
  await ensureRoomsLoaded();
  attemptInviteJoin();
});

onUnmounted(() => {
  // Home.layout swaps two RoomsBoard instances when entering a room. Do not let
  // the outgoing dashboard instance tear down the socket started for that room.
  if (!routeRoomId.value) {
    void roomsStore.selectRoom(null);
  }
});

watch(
  routeRoomId,
  async (roomId) => {
    if (roomId && !currentUser.value) {
      navigateHome();
      return;
    }
    await roomsStore.selectRoom(roomId, currentUser.value?.id ?? null);
  },
  { immediate: true }
);

watch(
  () => discordService.user.value,
  async (user, previous) => {
    if (user && !previous) {
      await ensureRoomsLoaded();
      attemptInviteJoin();
    } else if (!user && previous) {
      await roomsStore.selectRoom(null);
      navigateHome();
    }
  }
);

watch(
  () => roomsStore.selectedRoomId,
  (selectedRoomId) => {
    if (!selectedRoomId && routeRoomId.value) {
      navigateHome();
    }
  }
);

watch(
  () => route.query.invite,
  (value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      pendingInvite.value = value.trim().toUpperCase();
      attemptInviteJoin();
    }
  },
  { immediate: true }
);

async function attemptInviteJoin() {
  if (!pendingInvite.value || !currentUser.value) return;
  try {
    await handleJoinRoom({ inviteCode: pendingInvite.value });
    showFeedback('success', t('rooms.feedback.joinedViaInvite'));
  } catch (error) {
    console.error(error);
  } finally {
    pendingInvite.value = null;
  }
}

async function handleCreateRoom(payload: { name: string; password?: string | null }) {
  if (!currentUser.value) return;
  try {
    const room = await roomsStore.createRoom({
      ...payload,
      userId: currentUser.value.id,
    });
    if (room) {
      navigateToRoom(room.id);
    }
    showFeedback('success', t('rooms.feedback.created'));
  } catch (error) {
    console.error(error);
  }
}

async function handleJoinRoom(payload: { inviteCode: string; password?: string | null }) {
  if (!currentUser.value) return;
  try {
    const room = await roomsStore.joinRoom({
      ...payload,
      userId: currentUser.value.id,
    });
    if (room) {
      navigateToRoom(room.id);
    }
    showFeedback('success', t('rooms.feedback.joined'));
    return room;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function handleSendMessage(content: string, skipBonusPointRules = false) {
  if (!currentUser.value || !roomsStore.selectedRoomId) return;
  const trimmed = content.trim();
  if (!trimmed) return;

  const inlineDice = parseInlineDiceCommand(trimmed);
  if (inlineDice) {
    try {
      const roll = rollDiceNotation(inlineDice.notation, undefined, inlineDice.description);
      await roomsStore.sendDiceRoll({
        roomId: roomsStore.selectedRoomId,
        userId: currentUser.value.id,
        roll,
        skipBonusPointRules,
      });
    } catch (error) {
      console.error(error);
    }
    return;
  }

  try {
    await roomsStore.sendChatMessage({
      roomId: roomsStore.selectedRoomId,
      userId: currentUser.value.id,
      content: trimmed,
    });
  } catch (error) {
    console.error(error);
  }
}

async function handleDiceRoll(roll: DiceRoll, skipBonusPointRules = false) {
  if (!currentUser.value || !roomsStore.selectedRoomId) return;
  try {
    await roomsStore.sendDiceRoll({
      roomId: roomsStore.selectedRoomId,
      userId: currentUser.value.id,
      roll,
      skipBonusPointRules,
    });
  } catch (error) {
    console.error(error);
  }
}

async function handleSendMessageAs(userId: string, content: string) {
  if (!canUseRoomDevTools() || !roomsStore.selectedRoomId || !isOtherRoomMember(userId)) return;
  const trimmed = content.trim();
  if (!trimmed) return;
  try {
    await roomsStore.sendChatMessage({
      roomId: roomsStore.selectedRoomId,
      userId,
      devMessageUserId: userId,
      content: trimmed,
    });
  } catch (error) {
    console.error(error);
  }
}

async function handleDiceRollAs(userId: string, roll: DiceRoll, skipBonusPointRules = false) {
  if (!canUseRoomDevTools() || !roomsStore.selectedRoomId || !isOtherRoomMember(userId)) return;
  try {
    await roomsStore.sendDiceRoll({
      roomId: roomsStore.selectedRoomId,
      userId,
      devMessageUserId: userId,
      roll,
      skipBonusPointRules,
    });
  } catch (error) {
    console.error(error);
  }
}

function isOtherRoomMember(userId: string) {
  return userId !== currentUser.value?.id && roomsStore.members.some((member) => member.userId === userId);
}

function canUseRoomDevTools() {
  const role = currentUser.value?.role;
  return import.meta.env.DEV && (role === 'owner' || role === 'admin');
}

async function handleUseBonusPointOnRoll(message: RoomMessage) {
  if (!currentUser.value || !roomsStore.selectedRoomId) return;
  try {
    await roomsStore.useBonusPointOnRoll({
      roomId: roomsStore.selectedRoomId,
      userId: currentUser.value.id,
      messageId: message.id,
    });
  } catch (error) {
    console.error(error);
  }
}

function handleFavoriteRoom(roomId: string) {
  if (currentUser.value) void roomsStore.toggleRoomFavorite(roomId, currentUser.value.id);
}

function handleSelectRoom(roomId: string) {
  navigateToRoom(roomId);
}

async function handleLoadOlderMessages() {
  if (!roomsStore.selectedRoomId || roomsStore.historyLoading) return;
  try {
    const allowWhenExhausted =
      roomsStore.historyExhausted && roomsStore.messages.length <= ROOM_MESSAGES_PAGE_SIZE;
    await roomsStore.loadOlderMessages(
      roomsStore.selectedRoomId,
      currentUser.value?.id ?? null,
      ROOM_MESSAGES_PAGE_SIZE,
      allowWhenExhausted
    );
  } catch (error) {
    console.error(error);
  }
}

function handleTrimMessages() {
  roomsStore.trimMessages(ROOM_MESSAGES_PAGE_SIZE);
}

function navigateToRoom(roomId: string) {
  router.push({ name: HomeRoutes.Room, params: { roomId } }).catch((error) => {
    if (!isNavigationFailure(error)) {
      console.error(error);
    }
  });
}

function navigateHome() {
  router.push({ name: HomeRoutes.Base }).catch((error) => {
    if (!isNavigationFailure(error)) {
      console.error(error);
    }
  });
}
</script>

<style scoped>
.rooms-board {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.rooms-board__content { flex: 1; min-height: 0; }
.rooms-board__sidebar { height: 100%; min-height: 0; }
</style>
