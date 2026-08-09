<template>
  <section class="roll-awards-panel">
    <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
      <h3 class="text-subtitle-1">🏆 {{ t('rollAwards.title') }}</h3>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-history" :loading="historyLoading" @click="openHistory">
        {{ t('sessions.history.button') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="roomsStore.sessionLoading" indeterminate color="primary" class="mb-3" />
    <v-alert v-else-if="!roomsStore.currentSession" type="info" variant="tonal" density="comfortable">
      {{ t('sessions.awards.waiting') }}
    </v-alert>
    <template v-else>
      <p class="text-caption text-medium-emphasis mb-3">{{ t('sessions.awards.current') }}</p>
      <RoomSessionAwards :results="roomsStore.currentSession.recap.rollAwards" />
    </template>
  </section>

  <v-dialog v-model="historyOpen" :fullscreen="smAndDown" max-width="720" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('sessions.history.title') }}</span>
        <v-btn icon="mdi-close" variant="text" @click="historyOpen = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-alert v-if="historyError" type="error" variant="tonal" class="mb-3">{{ historyError }}</v-alert>
        <div v-if="historyItems.length" class="history-navigation mb-4">
          <v-btn icon="mdi-chevron-left" variant="text" :disabled="selectedIndex >= historyItems.length - 1 && !nextCursor" :title="t('sessions.history.previous')" @click="goPrevious" />
          <v-btn variant="text" class="history-date" @click="pickerOpen = true">{{ selectedLabel }}</v-btn>
          <v-btn icon="mdi-chevron-right" variant="text" :disabled="selectedIndex <= 0" :title="t('sessions.history.next')" @click="selectIndex(selectedIndex - 1)" />
        </div>
        <v-progress-linear v-if="historyLoading" indeterminate color="primary" class="mb-3" />
        <RoomSessionAwards v-if="selectedSession" :results="selectedSession.recap.rollAwards" />
        <v-alert v-else-if="!historyLoading" type="info" variant="tonal">{{ t('sessions.history.empty') }}</v-alert>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="pickerOpen" max-width="520">
    <v-card>
      <v-card-title>{{ t('sessions.history.choose') }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="dateFilter" type="date" :label="t('sessions.history.filterDate')" clearable @update:model-value="loadHistory(true)" />
        <v-list max-height="360" class="overflow-y-auto">
          <v-list-item v-for="(item, index) in historyItems" :key="item.id" :title="formatDate(item.startedAt)" :subtitle="formatDuration(item.durationSeconds)" @click="selectIndex(index); pickerOpen = false" />
        </v-list>
        <v-btn v-if="nextCursor" block variant="text" :loading="historyLoading" @click="loadMore">{{ t('common.loadMore') }}</v-btn>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import type { RoomDetails, RoomMessage, RoomSession, RoomSessionListItem } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { useRoomsStore } from 'core/stores/rooms.store';
import { RoomsService } from 'core/services/rooms.service';
import RoomSessionAwards from './RoomSessionAwards.component.vue';

const props = defineProps<{ room: RoomDetails | null; messages: RoomMessage[]; currentUser: DiscordUser | null }>();
const { t, locale } = useI18n();
const { smAndDown } = useDisplay();
const roomsStore = useRoomsStore();
const historyOpen = ref(false);
const pickerOpen = ref(false);
const historyLoading = ref(false);
const historyError = ref<string | null>(null);
const historyItems = ref<RoomSessionListItem[]>([]);
const selectedIndex = ref(0);
const selectedSession = ref<RoomSession | null>(null);
const nextCursor = ref<string | null>(null);
const dateFilter = ref('');
const selectedLabel = computed(() => historyItems.value[selectedIndex.value] ? formatDate(historyItems.value[selectedIndex.value].startedAt) : '');

async function openHistory() { historyOpen.value = true; await loadHistory(true); }
async function loadHistory(_reset = false) {
  if (!props.room || historyLoading.value) return;
  historyLoading.value = true; historyError.value = null;
  try {
    const result = await RoomsService.fetchSessions(props.room.id, { date: dateFilter.value || undefined, limit: 25 });
    historyItems.value = result.sessions; nextCursor.value = result.nextCursor; selectedIndex.value = 0;
    selectedSession.value = result.sessions[0] ? await RoomsService.fetchSessionRecap(props.room.id, result.sessions[0].id) : null;
  } catch (error) { historyError.value = error instanceof Error ? error.message : String(error); }
  finally { historyLoading.value = false; }
}
async function loadMore() {
  if (!props.room || !nextCursor.value || historyLoading.value) return;
  historyLoading.value = true;
  try {
    const result = await RoomsService.fetchSessions(props.room.id, { before: nextCursor.value, date: dateFilter.value || undefined, limit: 25 });
    historyItems.value.push(...result.sessions); nextCursor.value = result.nextCursor;
  } finally { historyLoading.value = false; }
}
async function goPrevious() {
  if (selectedIndex.value >= historyItems.value.length - 1 && nextCursor.value) await loadMore();
  await selectIndex(selectedIndex.value + 1);
}
async function selectIndex(index: number) {
  if (!props.room || index < 0 || index >= historyItems.value.length) return;
  selectedIndex.value = index; historyLoading.value = true;
  try { selectedSession.value = await RoomsService.fetchSessionRecap(props.room.id, historyItems.value[index].id); }
  finally { historyLoading.value = false; }
}
function formatDate(value: string) { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function formatDuration(seconds: number) { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return t('sessions.history.duration', { hours: h, minutes: m }); }
</script>

<style scoped>
.history-navigation { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
.history-date { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
</style>
