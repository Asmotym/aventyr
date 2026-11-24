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
import type { RoomDetails } from '@shared/rooms/rooms.types';
import RoomsList from '@/features/rooms/components/RoomsList.component.vue';

const props = defineProps<{
  rooms: RoomDetails[];
  selectedRoomId: string | null;
  loading: boolean;
  creating: boolean;
  joining: boolean;
  favoritingRoomIds?: string[];
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
const createForm = reactive({ name: '', password: '' });
const joinForm = reactive({ inviteCode: '', password: '' });
const busy = computed(() => props.creating || props.joining);
const dialogTitle = computed(() => t(mode.value === 'create' ? 'rooms.sidebar.createTitle' : 'rooms.sidebar.joinTitle'));
const canSubmit = computed(() => Boolean(mode.value === 'create' ? createForm.name.trim() : joinForm.inviteCode.trim()));
function openDialog(nextMode: 'create' | 'join') {
  mode.value = nextMode;
  dialogOpen.value = true;
}
function submit() {
  if (busy.value || !canSubmit.value) return;
  if (mode.value === 'create') emit('create', { name: createForm.name.trim(), password: createForm.password.trim() || null });
  else emit('join', { inviteCode: joinForm.inviteCode.trim().toUpperCase(), password: joinForm.password.trim() || null });
}
</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/rooms-sidebar.scss"></style>
