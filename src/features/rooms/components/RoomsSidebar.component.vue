<template>
  <section class="rooms-sidebar">
    <RoomsList
      class="rooms-sidebar__list"
      :rooms="rooms"
      :selected-room-id="selectedRoomId"
      :loading="loading"
      :favoriting-room-ids="favoritingRoomIds"
      @favorite="emit('favorite', $event)"
      @select="emit('select', $event)"
    />
    <footer class="rooms-sidebar__actions">
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" size="large" @click="openDialog('create')">
        {{ t('rooms.sidebar.create') }}
      </v-btn>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-door-open" size="large" @click="openDialog('join')">
        {{ t('rooms.sidebar.join') }}
      </v-btn>
    </footer>

    <v-dialog v-model="dialogOpen" max-width="520" :persistent="busy" :aria-label="dialogTitle">
      <v-card class="room-entry-dialog">
        <header class="room-entry-dialog__header">
          <div class="room-entry-dialog__emblem"><v-icon :icon="mode === 'create' ? 'mdi-dice-multiple-outline' : 'mdi-door-open'" size="34" /></div>
          <div class="room-entry-dialog__heading">
            <span class="room-entry-dialog__eyebrow">{{ t('rooms.sidebar.title') }}</span>
            <h2>{{ dialogTitle }}</h2>
          </div>
          <AppCloseButton :disabled="busy" @click="dialogOpen = false" />
        </header>
        <v-form @submit.prevent="submit">
          <v-card-text class="room-entry-dialog__body">
            <p class="room-entry-dialog__intro">{{ t(mode === 'create' ? 'rooms.sidebar.createIntro' : 'rooms.sidebar.joinIntro') }}</p>
            <template v-if="mode === 'create'">
              <v-text-field v-model="createForm.name" :label="t('rooms.sidebar.roomName')" prepend-inner-icon="mdi-flag-outline" variant="outlined" maxlength="80" autofocus :disabled="busy" />
              <v-text-field v-model="createForm.password" type="password" :label="t('rooms.sidebar.passwordOptional')" prepend-inner-icon="mdi-lock-outline" variant="outlined" :hint="t('rooms.sidebar.publicRoomHint')" persistent-hint :disabled="busy" />
            </template>
            <template v-else>
              <v-text-field v-model="joinForm.inviteCode" :label="t('rooms.sidebar.inviteCode')" prepend-inner-icon="mdi-ticket-confirmation-outline" variant="outlined" autofocus :disabled="busy" class="room-entry-dialog__code" />
              <v-text-field v-model="joinForm.password" type="password" :label="t('rooms.sidebar.passwordIfNeeded')" prepend-inner-icon="mdi-lock-outline" variant="outlined" :disabled="busy" />
            </template>
            <v-alert v-if="submitted && errorMessage" type="error" variant="tonal" density="comfortable" class="mt-3">{{ errorMessage }}</v-alert>
          </v-card-text>
          <v-card-actions class="room-entry-dialog__footer">
            <v-btn variant="text" :disabled="busy" @click="dialogOpen = false">{{ t('common.cancel') }}</v-btn>
            <v-spacer />
            <v-btn type="submit" color="primary" variant="flat" :prepend-icon="mode === 'create' ? 'mdi-plus' : 'mdi-arrow-right'" :loading="busy" :disabled="!canSubmit || busy">{{ t(mode === 'create' ? 'rooms.sidebar.create' : 'rooms.sidebar.join') }}</v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from 'netlify/core/types/data.types';
import RoomsList from '@/features/rooms/components/RoomsList.component.vue';

const props = defineProps<{
  rooms: RoomDetails[];
  selectedRoomId: string | null;
  loading: boolean;
  creating: boolean;
  joining: boolean;
  favoritingRoomIds?: string[];
  errorMessage?: string | null;
}>();
const emit = defineEmits<{
  (event: 'select', roomId: string): void;
  (event: 'favorite', roomId: string): void;
  (event: 'create', payload: { name: string; password?: string | null }): void;
  (event: 'join', payload: { inviteCode: string; password?: string | null }): void;
}>();
const { t } = useI18n();
const dialogOpen = ref(false);
const mode = ref<'create' | 'join'>('create');
const submitted = ref(false);
const createForm = reactive({ name: '', password: '' });
const joinForm = reactive({ inviteCode: '', password: '' });
const busy = computed(() => props.creating || props.joining);
const dialogTitle = computed(() => t(mode.value === 'create' ? 'rooms.sidebar.createTitle' : 'rooms.sidebar.joinTitle'));
const canSubmit = computed(() => Boolean(mode.value === 'create' ? createForm.name.trim() : joinForm.inviteCode.trim()));
function openDialog(nextMode: 'create' | 'join') {
  mode.value = nextMode;
  submitted.value = false;
  dialogOpen.value = true;
}
function submit() {
  if (busy.value || !canSubmit.value) return;
  submitted.value = true;
  if (mode.value === 'create') emit('create', { name: createForm.name.trim(), password: createForm.password.trim() || null });
  else emit('join', { inviteCode: joinForm.inviteCode.trim().toUpperCase(), password: joinForm.password.trim() || null });
}
</script>

<style scoped>
.rooms-sidebar { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); }
.rooms-sidebar__list { flex: 1; min-height: 0; box-shadow: none !important; border-radius: 0; background: transparent; }
.rooms-sidebar__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex-shrink: 0; padding: 16px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); background: rgb(var(--v-theme-surface)); }
.rooms-sidebar__actions .v-btn { min-width: 0; border-radius: 10px; font-size: 12px; }
.room-entry-dialog { border-radius: 20px !important; overflow: hidden; }
.room-entry-dialog__header { display: flex; align-items: center; gap: 16px; padding: 24px; background: linear-gradient(135deg, rgba(var(--v-theme-primary), .17), rgba(var(--v-theme-primary), .03)); border-bottom: 1px solid rgba(var(--v-theme-primary), .12); }
.room-entry-dialog__emblem { display: grid; place-items: center; width: 64px; height: 64px; flex-shrink: 0; border-radius: 18px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .12); transform: rotate(-6deg); }
.room-entry-dialog__heading { flex: 1; min-width: 0; }
.room-entry-dialog__eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: rgb(var(--v-theme-primary)); font-weight: 700; }
.room-entry-dialog__heading h2 { font-size: 21px; line-height: 1.3; margin-top: 5px; }
.room-entry-dialog__body { padding: 24px 24px 12px !important; }
.room-entry-dialog__intro { color: rgba(var(--v-theme-on-surface), .7); font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
.room-entry-dialog__code :deep(input) { text-transform: uppercase; letter-spacing: .12em; }
.room-entry-dialog__footer { padding: 16px 24px 24px; }
@media (max-width: 400px) { .rooms-sidebar__actions { padding: 12px; gap: 8px; } .room-entry-dialog__header { padding: 20px 16px; gap: 12px; } .room-entry-dialog__emblem { width: 48px; height: 48px; } .room-entry-dialog__heading h2 { font-size: 18px; } }
</style>
