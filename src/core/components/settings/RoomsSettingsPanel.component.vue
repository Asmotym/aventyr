<template>
  <section class="rooms-settings pt-4 pl-2 pr-2">
    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="errorMessage = null"
    >
      {{ errorMessage }}
    </v-alert>
    <v-alert
      v-else-if="successMessage"
      type="success"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="successMessage = null"
    >
      {{ successMessage }}
    </v-alert>

    <section>
      <div class="d-flex align-center justify-space-between mb-3">
        <h3 class="text-h6 mb-0">{{ t('settings.rooms.activeTitle') }}</h3>
        <v-btn
          size="small"
          variant="text"
          :loading="loadingRooms"
          @click="loadRooms"
        >
          <v-icon icon="mdi-refresh" start size="16" />
          {{ t('settings.rooms.refresh') }}
        </v-btn>
      </div>

      <v-skeleton-loader
        v-if="loadingRooms"
        type="list-item-two-line@3"
        class="mb-4"
      />

      <template v-else>
        <v-alert
          v-if="activeRooms.length === 0"
          type="info"
          variant="tonal"
        >
          {{ t('settings.rooms.emptyActive') }}
        </v-alert>
        <v-card
          v-for="room in activeRooms"
          :key="room.id"
          class="mb-3"
          variant="tonal"
        >
          <v-card-title class="d-flex flex-wrap gap-3 justify-space-between">
            <div>
              <div class="text-h6">{{ room.name }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ t('settings.rooms.inviteCode', { code: room.inviteCode }) }}
              </div>
            </div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <v-chip size="small" variant="outlined" color="primary">
                <v-icon icon="mdi-account-group-outline" start size="16" />
                {{ room.memberCount }}
              </v-chip>
              <v-chip size="small" variant="outlined" class="ml-2">
                <v-icon icon="mdi-clock-outline" start size="16" />
                {{ formatDate(room.lastActivity) }}
              </v-chip>
            </div>
          </v-card-title>
          <v-card-actions class="d-flex flex-wrap gap-2">
            <v-btn
              color="primary"
              size="small"
              variant="flat"
              @click="openRoom(room.id)"
            >
              <v-icon icon="mdi-open-in-new" start size="16" />
              {{ t('settings.rooms.actions.open') }}
            </v-btn>
            <v-btn
              v-if="!room.isCreator"
              color="warning"
              size="small"
              variant="text"
              :loading="leavingRoomId === room.id"
              @click="handleLeaveRoom(room)"
            >
              {{ t('settings.rooms.actions.leave') }}
            </v-btn>
            <v-btn
              v-if="room.canArchive ?? room.isCreator"
              color="error"
              size="small"
              variant="text"
              :loading="deletingRoomId === room.id"
              @click="promptArchiveRoom(room)"
            >
              {{ t('settings.rooms.actions.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </template>
    </section>

    <section v-if="archivedRooms.length > 0">
      <h3 class="text-h6 mb-3">{{ t('settings.rooms.archivedTitle') }}</h3>
      <v-alert type="info" variant="tonal" class="mb-4">
        {{ t('settings.rooms.archivedDescription') }}
      </v-alert>
      <v-card
        v-for="room in archivedRooms"
        :key="room.id"
        class="mb-3"
        variant="outlined"
      >
        <v-card-title class="d-flex flex-wrap gap-3 justify-space-between">
          <div>
            <div class="text-h6 mb-1">{{ room.name }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ formatDate(room.archivedAt) }}
            </div>
          </div>
          <v-chip size="small" variant="tonal">
            {{ t('settings.rooms.archivedLabel') }}
          </v-chip>
        </v-card-title>
        <v-card-text class="text-body-2">
          {{ t('settings.rooms.inviteCode', { code: room.inviteCode }) }}
        </v-card-text>
        <v-card-actions class="d-flex justify-end">
          <v-btn
            color="primary"
            size="small"
            variant="text"
            :loading="restoringRoomId === room.id"
            @click="handleUnarchiveRoom(room)"
          >
            {{ t('settings.rooms.actions.restore') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </section>

    <v-dialog v-model="archiveDialogOpen" max-width="480">
      <v-card>
        <v-card-title class="text-h6">
          {{ t('settings.rooms.actions.delete') }}
        </v-card-title>
        <v-card-text>
          {{ t('settings.rooms.confirmDelete', { name: archiveDialogRoom?.name ?? '' }) }}
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="closeArchiveDialog" :disabled="deletingRoomId !== null">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="deletingRoomId === archiveDialogRoom?.id"
            :disabled="!archiveDialogRoom"
            @click="confirmArchiveRoom"
          >
            {{ t('settings.rooms.actions.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from 'netlify/core/types/data.types';
import { RoomsService } from 'core/services/rooms.service';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { useRoomsStore } from 'core/stores/rooms.store';
import { HomeRoutes } from 'core/routes';

const { t } = useI18n();
const router = useRouter();
const discordService = DiscordService.getInstance();
const roomsStore = useRoomsStore();

const rooms = ref<RoomDetails[]>([]);
const loadingRooms = ref(false);
const leavingRoomId = ref<string | null>(null);
const deletingRoomId = ref<string | null>(null);
const restoringRoomId = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const archiveDialogOpen = ref(false);
const archiveDialogRoom = ref<RoomDetails | null>(null);

const currentUser = computed(() => discordService.user.value);
const activeRooms = computed(() => rooms.value.filter((room) => !room.isArchived));
const archivedRooms = computed(() => rooms.value.filter((room) => room.isArchived));

function resetFeedback() {
  errorMessage.value = null;
  successMessage.value = null;
}

async function syncRoomsStore() {
  try {
    await roomsStore.fetchRooms(currentUser.value?.id ?? null);
  } catch (error) {
    console.error(error);
  }
}

async function loadRooms() {
  if (!currentUser.value) {
    rooms.value = [];
    return;
  }
  loadingRooms.value = true;
  resetFeedback();
  try {
    rooms.value = await RoomsService.fetchUserRooms(currentUser.value.id);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loadingRooms.value = false;
  }
}

async function handleLeaveRoom(room: RoomDetails) {
  if (!currentUser.value) return;
  leavingRoomId.value = room.id;
  resetFeedback();
  try {
    await RoomsService.leaveRoom({ roomId: room.id, userId: currentUser.value.id });
    if (roomsStore.selectedRoomId === room.id) {
      await roomsStore.selectRoom(null);
    }
    successMessage.value = t('settings.rooms.messages.leaveSuccess', { name: room.name });
    await Promise.all([loadRooms(), syncRoomsStore()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    leavingRoomId.value = null;
  }
}

async function handleUnarchiveRoom(room: RoomDetails) {
  if (!currentUser.value) return;
  restoringRoomId.value = room.id;
  resetFeedback();
  try {
    await RoomsService.unarchiveRoom({ roomId: room.id, userId: currentUser.value.id });
    successMessage.value = t('settings.rooms.messages.restoreSuccess', { name: room.name });
    await Promise.all([loadRooms(), syncRoomsStore()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    restoringRoomId.value = null;
  }
}

function promptArchiveRoom(room: RoomDetails) {
  archiveDialogRoom.value = room;
  archiveDialogOpen.value = true;
}

function closeArchiveDialog() {
  if (deletingRoomId.value) {
    return;
  }
  archiveDialogOpen.value = false;
  archiveDialogRoom.value = null;
}

async function confirmArchiveRoom() {
  if (!archiveDialogRoom.value) return;
  await handleArchiveRoom(archiveDialogRoom.value);
}

async function handleArchiveRoom(room: RoomDetails) {
  if (!currentUser.value) return;
  deletingRoomId.value = room.id;
  resetFeedback();
  try {
    await RoomsService.archiveRoom({ roomId: room.id, userId: currentUser.value.id });
    if (roomsStore.selectedRoomId === room.id) {
      await roomsStore.selectRoom(null);
    }
    successMessage.value = t('settings.rooms.messages.deleteSuccess', { name: room.name });
    await Promise.all([loadRooms(), syncRoomsStore()]);
    archiveDialogOpen.value = false;
    archiveDialogRoom.value = null;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    deletingRoomId.value = null;
  }
}

function openRoom(roomId: string) {
  router.push({ name: HomeRoutes.Room, params: { roomId } }).catch((error) => {
    console.error(error);
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return t('settings.rooms.noActivity');
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t('settings.rooms.noActivity');
    }
    return date.toLocaleString();
  } catch {
    return t('settings.rooms.noActivity');
  }
}

watch(currentUser, (user, previous) => {
  if (user && !previous) {
    loadRooms();
  } else if (!user) {
    rooms.value = [];
  }
});

onMounted(() => {
  loadRooms();
});
</script>

<style scoped>
.rooms-settings {
  width: 100%;
}

.rooms-settings h3 {
  font-weight: 600;
}
</style>
