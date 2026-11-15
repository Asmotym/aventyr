<template>
  <section class="rooms-settings">
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

    <header class="rooms-settings__intro"><span class="rooms-settings__emblem"><v-icon icon="mdi-dice-multiple-outline" size="28" /></span><div><h2>{{ t('settings.tabs.rooms') }}</h2><p>{{ t('settings.design.roomsIntro') }}</p></div></header>
    <section>
      <div class="d-flex align-center justify-space-between mb-3">
        <h3 class="room-section-title">{{ t('settings.rooms.activeTitle') }} <v-chip size="x-small" variant="tonal" color="primary">{{ activeRooms.length }}</v-chip></h3>
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
        <div class="settings-room-grid">
        <v-card
          v-for="room in activeRooms"
          :key="room.id"
          class="room-settings-card"
          variant="flat"
        >
          <v-card-title class="d-flex flex-wrap gap-3 justify-space-between">
            <div>
              <div class="room-card-name"><v-icon :icon="ROOM_ROLE_ICONS[room.isCreator ? 'creator' : room.viewerRole ?? 'player']" size="22" color="primary" :title="t('roomAccess.roles.' + (room.isCreator ? 'creator' : room.viewerRole ?? 'player'))" /><h4>{{ room.name }}</h4></div>
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
        </div>
      </template>
    </section>

    <section v-if="archivedRooms.length > 0" class="archived-rooms">
      <h3 class="text-h6 mb-3">{{ t('settings.rooms.archivedTitle') }}</h3>
      <v-alert type="info" variant="tonal" class="mb-4">
        {{ t('settings.rooms.archivedDescription') }}
      </v-alert>
      <div class="settings-room-grid">
      <v-card
        v-for="room in archivedRooms"
        :key="room.id"
        class="room-settings-card room-settings-card--archived"
        variant="flat"
      >
        <v-card-title class="d-flex flex-wrap gap-3 justify-space-between">
          <div>
            <div class="room-card-name"><v-icon icon="mdi-archive-outline" size="22" /><h4>{{ room.name }}</h4></div>
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
      </div>
    </section>

    <v-dialog v-model="archiveDialogOpen" max-width="480" :persistent="deletingRoomId !== null">
      <v-card class="settings-archive-dialog">
        <v-card-title class="text-h6"><v-icon icon="mdi-archive-outline" color="error" class="mr-2" />
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
import { ROOM_ROLE_ICONS } from 'core/utils/room-role.utils';

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
.rooms-settings { width: 100%; }
.rooms-settings__intro { display: flex; align-items: center; gap: 16px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 16px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .055), transparent), rgb(var(--v-theme-surface)); }
.rooms-settings__emblem { display: grid; place-items: center; width: 52px; height: 52px; flex-shrink: 0; border-radius: 16px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .09); }
.rooms-settings__intro h2 { font-size: 20px; letter-spacing: -.025em; margin-bottom: 4px; }
.rooms-settings__intro p { font-size: 13px; line-height: 1.6; color: rgba(var(--v-theme-on-surface), .6); }
.room-section-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
.settings-room-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.room-settings-card { display: flex; flex-direction: column; min-width: 0; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-top: 3px solid rgba(var(--v-theme-primary), .4); border-radius: 14px; background: rgb(var(--v-theme-surface)); }
.room-settings-card > .v-card-title { padding: 20px; white-space: normal; gap: 16px; }
.room-card-name { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.room-card-name h4 { font-size: 16px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.room-settings-card .text-caption { font-size: 11px !important; }
.room-settings-card > .v-card-actions { gap: 4px; padding: 12px 14px; margin-top: auto; border-top: 1px solid rgba(var(--v-border-color), .08); background: rgba(var(--v-theme-on-surface), .015); }
.room-settings-card--archived { border-top-color: rgba(var(--v-theme-on-surface), .2); }
.room-settings-card--archived .room-card-name { color: rgba(var(--v-theme-on-surface), .65); }
.archived-rooms { margin-top: 30px; }
.archived-rooms h3 { font-size: 16px !important; font-weight: 700; }
.settings-archive-dialog { border-radius: 18px !important; }
.settings-archive-dialog > .v-card-title { padding: 22px; white-space: normal; background: rgba(var(--v-theme-error), .045); }
.settings-archive-dialog > .v-card-text { padding: 22px; line-height: 1.7; }
.settings-archive-dialog > .v-card-actions { padding: 12px 22px 22px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
@media (max-width: 700px) { .settings-room-grid { grid-template-columns: minmax(0, 1fr); } .rooms-settings__intro { padding: 18px; } }
</style>
