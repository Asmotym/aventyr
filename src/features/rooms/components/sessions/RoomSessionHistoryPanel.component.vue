<template>
  <RoomSlidePanel v-model="open" backdrop width="1040px" :label="t('sessions.recap.historyTitle')" class="session-history-panel">
    <v-card>
      <v-card-title class="history-heading">
        <v-icon icon="mdi-book-clock-outline" color="blue" />
        <h2 class="text-h6">{{ t('sessions.recap.historyTitle') }}</h2>
        <AppCloseButton @click="open = false" />
      </v-card-title>
      <v-divider />
      <div class="history-layout" :class="{ 'history-layout--detail': showDetail }">
        <aside class="history-sidebar" :aria-label="t('sessions.history.choose')">
          <VDateInput v-model="dateInput" prepend-icon="" prepend-inner-icon="mdi-calendar" variant="outlined" :label="t('sessions.history.filterDate')" clearable density="compact" hide-details class="ma-3" />
          <div ref="listElement" class="history-list" @scroll.passive="onListScroll">
            <v-list bg-color="transparent" :aria-label="t('sessions.history.choose')">
              <v-list-item v-for="item in visibleItems" :key="item.id" :active="selectedId === item.id" color="blue" :aria-current="selectedId === item.id ? 'true' : undefined" :title="formatDate(item.startedAt)" :subtitle="formatDuration(item.durationSeconds)" @click="selectSession(item.id)">
                <template #prepend><v-icon :icon="item.endedAt ? 'mdi-history' : 'mdi-timer-play-outline'" size="20" /></template>
                <template v-if="!item.endedAt" #append><v-chip size="x-small" color="success">{{ t('sessions.history.active') }}</v-chip></template>
              </v-list-item>
            </v-list>
            <v-progress-linear v-if="listLoading" indeterminate color="blue" />
            <div v-if="listError" class="error-recovery-actions"><v-btn variant="text" @click="loadList(!nextCursor)">{{ t('sessions.history.retry') }}</v-btn></div>
            <v-btn v-else-if="nextCursor" block variant="text" :loading="listLoading" @click="loadList(false)">{{ t('articles.loadMore') }}</v-btn>
            <p v-else-if="!listLoading && !visibleItems.length" class="pa-4 text-medium-emphasis">{{ t('sessions.history.empty') }}</p>
          </div>
        </aside>
        <main class="history-detail">
          <v-btn class="history-back mb-3" variant="text" prepend-icon="mdi-arrow-left" @click="showDetail = false">{{ t('sessions.history.back') }}</v-btn>
          <v-progress-linear v-if="detailLoading" indeterminate color="blue" class="mb-3" />
          <div v-if="detailError" class="error-recovery-actions"><v-btn variant="text" @click="loadDetail()">{{ t('sessions.history.retry') }}</v-btn></div>
          <template v-if="selectedSession">
            <div class="history-session-title mb-4"><h3>{{ formatDate(selectedSession.startedAt) }}</h3><v-chip v-if="!selectedSession.endedAt" color="success" size="small">{{ t('sessions.history.active') }}</v-chip></div>
            <RoomSessionRecap v-model:tab="recapTab" :recap="selectedSession.recap" :room-id="roomId" />
          </template>
          <v-alert v-else-if="!detailLoading && !detailError" type="info" variant="tonal">{{ t('sessions.history.empty') }}</v-alert>
        </main>
      </div>
    </v-card>
  </RoomSlidePanel>
</template>

<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { VDateInput } from 'vuetify/labs/VDateInput';
import type { RoomSession, RoomSessionListItem } from 'netlify/core/types/data.types';
import { RoomsService } from '@/features/rooms/services/rooms.service';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import RoomSessionRecap from '@/features/rooms/components/sessions/RoomSessionRecap.component.vue';
import RoomSlidePanel from '@/features/rooms/components/RoomSlidePanel.component.vue';

const props = defineProps<{ roomId: string | null; initialSessionId?: string | null }>();
const open = defineModel<boolean>({ default: false });
const { t, locale } = useI18n();
const store = useRoomsStore();
const items = ref<RoomSessionListItem[]>([]);
const selectedId = ref<string | null>(null);
const selectedSession = ref<RoomSession | null>(null);
const nextCursor = ref<string | null>(null);
const dateFilter = ref<string | null>('');
const dateInput = computed<Date | null>({
  get: () => dateFilter.value ? new Date(`${dateFilter.value}T00:00:00`) : null,
  set: value => {
    if (!value || Number.isNaN(value.getTime())) { dateFilter.value = ''; return; }
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    dateFilter.value = `${value.getFullYear()}-${month}-${day}`;
  },
});
const showDetail = ref(false);
const recapTab = ref('awards');
const listLoading = ref(false), detailLoading = ref(false);
const listError = ref(''), detailError = ref('');
const listElement = ref<HTMLElement>();
let listGeneration = 0, detailGeneration = 0;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
const visibleItems = computed(() => {
  const current = store.currentSession;
  const active = current && current.roomId === props.roomId && (!dateFilter.value || current.startedAt.slice(0, 10) === dateFilter.value)
    ? [{ ...current, durationSeconds: current.recap.durationSeconds }] : [];
  return [...active, ...items.value.filter(item => item.id !== current?.id)];
});
function invalidate() {
  listGeneration++; detailGeneration++;
  listLoading.value = false; detailLoading.value = false;
}
async function loadList(reset: boolean) {
  if (!open.value || !props.roomId || (!reset && (listLoading.value || !nextCursor.value))) return;
  if (reset) { listGeneration++; listLoading.value = false; nextCursor.value = null; items.value = []; }
  const generation = ++listGeneration, roomId = props.roomId;
  listLoading.value = true; listError.value = '';
  try {
    const result = await RoomsService.fetchSessions(roomId, { before: reset ? undefined : nextCursor.value!, date: dateFilter.value || undefined, limit: 25 });
    if (generation !== listGeneration) return;
    items.value = [...new Map([...items.value, ...result.sessions].map(item => [item.id, item])).values()];
    nextCursor.value = result.nextCursor;
    if (reset) {
      const preferred = selectedId.value || props.initialSessionId;
      const id = preferred && visibleItems.value.some(item => item.id === preferred) ? preferred : visibleItems.value[0]?.id;
      if (id) await selectSession(id, false);
      else { selectedId.value = null; selectedSession.value = null; }
    }
  } catch (error) { if (generation === listGeneration) listError.value = String(error instanceof Error ? error.message : error); }
  finally {
    if (generation === listGeneration) {
      listLoading.value = false;
      await nextTick();
      if (!listError.value) onListScroll();
    }
  }
}
async function selectSession(id: string, reveal = true) {
  if (selectedId.value !== id) selectedSession.value = null;
  selectedId.value = id;
  if (reveal) showDetail.value = true;
  await loadDetail();
}
async function loadDetail() {
  if (!open.value || !props.roomId || !selectedId.value) return;
  const generation = ++detailGeneration, roomId = props.roomId, id = selectedId.value;
  detailLoading.value = true; detailError.value = '';
  try {
    const session = await RoomsService.fetchSessionRecap(roomId, id);
    if (generation === detailGeneration) {
      selectedSession.value = session;
      await nextTick();
      listElement.value?.querySelector('.v-list-item--active')?.scrollIntoView({ block: 'nearest' });
    }
  } catch (error) { if (generation === detailGeneration) detailError.value = String(error instanceof Error ? error.message : error); }
  finally { if (generation === detailGeneration) detailLoading.value = false; }
}
function onListScroll() {
  const el = listElement.value;
  if (el && el.clientHeight > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 80 && !listLoading.value && !listError.value && nextCursor.value) void loadList(false);
}
function formatDate(value: string) { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function formatDuration(seconds: number) { return t('sessions.history.duration', { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60) }); }
watch(open, value => {
  clearInterval(refreshTimer);
  if (value) {
    if (props.initialSessionId) dateFilter.value = '';
    selectedId.value = props.initialSessionId || store.currentSession?.id || null;
    selectedSession.value = null;
    showDetail.value = Boolean(props.initialSessionId);
    void loadList(true);
    refreshTimer = setInterval(() => { if (document.visibilityState === 'visible' && selectedId.value === store.currentSession?.id && !detailLoading.value) void loadDetail(); }, 10_000);
  } else invalidate();
});
watch(() => props.roomId, () => { invalidate(); items.value = []; selectedId.value = null; selectedSession.value = null; dateFilter.value = ''; if (open.value) void loadList(true); });
watch(dateFilter, () => { selectedId.value = null; selectedSession.value = null; detailGeneration++; if (open.value) void loadList(true); });
watch(() => props.initialSessionId, id => { if (open.value && id) { dateFilter.value = ''; showDetail.value = true; void selectSession(id); } });
watch(() => store.currentSession?.id, () => { if (open.value) void loadList(true); });
watch(() => store.realtimeStatus, status => { if (open.value && status === 'connected') { void loadDetail(); void loadList(true); } });
onBeforeUnmount(() => { clearInterval(refreshTimer); invalidate(); });

useErrorNotifications(
  () => listError.value,
  () => detailError.value,
);
</script>

<style scoped>
.history-heading { display: flex; align-items: center; gap: 12px; padding: 18px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); }
.history-heading h2 { flex: 1; }
.history-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); flex: 1; min-height: 0; overflow: hidden; }
.history-sidebar { display: flex; flex-direction: column; min-height: 0; border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); background: rgba(var(--v-theme-on-surface), .025); }
.history-sidebar > :deep(.v-input) { flex: 0 0 auto; }
.history-list { flex: 1; overflow-y: auto; min-height: 0; }
.history-detail { overflow-y: auto; min-width: 0; padding: 20px 60px 20px 20px; }
.history-session-title { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.history-back { display: none; }
@media (max-width: 767px) {
  .history-sidebar { padding-inline-end: 48px; }
  .history-layout { grid-template-columns: minmax(0, 1fr); }
  .history-detail { display: none; padding: 12px 60px 12px 12px; }
  .history-layout--detail .history-detail { display: block; }
  .history-layout--detail .history-sidebar { display: none; }
  .history-back { display: inline-flex; }
}
</style>
