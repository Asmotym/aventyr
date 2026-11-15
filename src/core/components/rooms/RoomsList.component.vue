<template>
  <v-card class="rooms-list">
    <v-card-title class="d-flex justify-space-between align-center">
      <span class="text-subtitle-1">{{ t('rooms.sidebar.title') }}</span>
      <v-chip v-if="rooms.length" size="small" color="primary" variant="flat">
        {{ rooms.length }}
      </v-chip>
    </v-card-title>
    <v-card-text class="pr-0">
      <v-skeleton-loader
        v-if="loading"
        type="list-item-avatar-two-line@3"
      />
      <v-list v-else density="compact" class="pr-0">
        <v-list-item
          v-for="room in sortedRooms"
          :key="room.id"
          :active="room.id === selectedRoomId"
          rounded="lg"
          @click="emit('select', room.id)"
        >
          <template #prepend>
            <v-avatar size="32" color="primary" variant="tonal" :title="t('roomAccess.roles.' + getRoomRole(room))" :aria-label="t('roomAccess.roles.' + getRoomRole(room))">
              <v-icon :icon="ROOM_ROLE_ICONS[getRoomRole(room)]" />
            </v-avatar>
          </template>
          <div class="d-flex flex-column">
            <span class="text-body-1 font-weight-medium">
              {{ room.name }}
              <v-icon v-if="room.isProtected" icon="mdi-lock" size="14" :title="t('rooms.sidebar.passwordIfNeeded')" />
            </span>
            <small class="text-medium-emphasis">
              {{ formatActivity(room.lastActivity) }}
            </small>
          </div>
          <template #append>
            <v-btn :icon="room.isFavorite ? 'mdi-star' : 'mdi-star-outline'" :color="room.isFavorite ? 'amber-darken-2' : undefined" variant="text" size="small" :aria-label="t(room.isFavorite ? 'rooms.sidebar.unfavorite' : 'rooms.sidebar.favorite', { name: room.name })" :title="t(room.isFavorite ? 'rooms.sidebar.unfavorite' : 'rooms.sidebar.favorite', { name: room.name })" :aria-pressed="Boolean(room.isFavorite)" :loading="favoritingRoomIds.includes(room.id)" :disabled="favoritingRoomIds.includes(room.id)" class="mr-1" @click.stop="emit('favorite', room.id)" />
            <v-chip size="small" color="secondary" variant="tonal">
              {{ room.memberCount ?? 0 }} 👥
            </v-chip>
          </template>
        </v-list-item>

        <div
          v-if="!rooms.length"
          class="text-medium-emphasis text-center py-6"
        >
          {{ t('rooms.sidebar.empty') }}
        </div>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from 'netlify/core/types/data.types';
import { ROOM_ROLE_ICONS } from 'core/utils/room-role.utils';

const props = withDefaults(defineProps<{
  rooms: RoomDetails[];
  selectedRoomId: string | null;
  loading: boolean;
  favoritingRoomIds?: string[];
}>(), { favoritingRoomIds: () => [] });

const emit = defineEmits<{
  (event: 'select', roomId: string): void;
  (event: 'favorite', roomId: string): void;
}>();

const { t } = useI18n();
const sortedRooms = computed(() => [...props.rooms].sort((a, b) => Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite))));

function getRoomRole(room: RoomDetails) {
  return room.isCreator ? 'creator' : room.viewerRole ?? 'player';
}

function formatActivity(timestamp?: string | null) {
  if (!timestamp) return t('rooms.sidebar.noActivity');
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}
</script>

<style scoped>
.rooms-list { display: flex; flex-direction: column; min-height: 0; }
.rooms-list > .v-card-title { flex-shrink: 0; padding: 20px 16px 16px; }
.rooms-list > .v-card-text { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding-bottom: 12px; }
</style>
