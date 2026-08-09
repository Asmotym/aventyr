<template>
  <v-dialog v-model="open" :fullscreen="smAndDown" max-width="780" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('sessions.recap.historyTitle') }}</span>
        <v-btn icon="mdi-close" variant="text" :title="t('common.close')" @click="open = false" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
        <div v-if="items.length" class="history-navigation mb-4">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            :disabled="selectedIndex >= items.length - 1 && !nextCursor"
            :title="t('sessions.history.previous')"
            @click="goPrevious"
          />
          <v-btn variant="text" class="history-date" @click="pickerOpen = true">
            {{ selectedLabel }}
          </v-btn>
          <v-btn
            icon="mdi-chevron-right"
            variant="text"
            :disabled="selectedIndex <= 0"
            :title="t('sessions.history.next')"
            @click="selectIndex(selectedIndex - 1)"
          />
        </div>
        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />
        <RoomSessionRecap v-if="selectedSession" :recap="selectedSession.recap" />
        <v-alert v-else-if="!loading" type="info" variant="tonal">{{ t('sessions.history.empty') }}</v-alert>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn variant="text" @click="open = false">{{ t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="pickerOpen" max-width="520">
    <v-card>
      <v-card-title>{{ t('sessions.history.choose') }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="dateFilter"
          type="date"
          :label="t('sessions.history.filterDate')"
          clearable
          @update:model-value="loadHistory(true)"
        />
        <v-list max-height="360" class="overflow-y-auto">
          <v-list-item
            v-for="(item, index) in items"
            :key="item.id"
            :title="formatDate(item.startedAt)"
            :subtitle="formatDuration(item.durationSeconds)"
            @click="selectIndex(index); pickerOpen = false"
          />
        </v-list>
        <v-btn v-if="nextCursor" block variant="text" :loading="loading" @click="loadMore">
          {{ t('common.loadMore') }}
        </v-btn>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import type { RoomSession, RoomSessionListItem } from 'netlify/core/types/data.types';
import { RoomsService } from 'core/services/rooms.service';
import RoomSessionRecap from './RoomSessionRecap.component.vue';

const props = defineProps<{ roomId: string | null }>();
const open = defineModel<boolean>({ default: false });
const { t, locale } = useI18n();
const { smAndDown } = useDisplay();
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<RoomSessionListItem[]>([]);
const selectedIndex = ref(0);
const selectedSession = ref<RoomSession | null>(null);
const nextCursor = ref<string | null>(null);
const pickerOpen = ref(false);
const dateFilter = ref('');
const selectedLabel = computed(() => items.value[selectedIndex.value] ? formatDate(items.value[selectedIndex.value].startedAt) : '');

watch(open, (value) => { if (value) void loadHistory(true); });
watch(() => props.roomId, () => reset());

function reset() {
  items.value = [];
  selectedIndex.value = 0;
  selectedSession.value = null;
  nextCursor.value = null;
  dateFilter.value = '';
  error.value = null;
}

async function loadHistory(_reset = false) {
  if (!props.roomId || loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await RoomsService.fetchSessions(props.roomId, { date: dateFilter.value || undefined, limit: 25 });
    items.value = result.sessions;
    nextCursor.value = result.nextCursor;
    selectedIndex.value = 0;
    selectedSession.value = result.sessions[0]
      ? await RoomsService.fetchSessionRecap(props.roomId, result.sessions[0].id)
      : null;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!props.roomId || !nextCursor.value || loading.value) return;
  loading.value = true;
  try {
    const result = await RoomsService.fetchSessions(props.roomId, {
      before: nextCursor.value,
      date: dateFilter.value || undefined,
      limit: 25,
    });
    items.value.push(...result.sessions);
    nextCursor.value = result.nextCursor;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loading.value = false;
  }
}

async function goPrevious() {
  if (selectedIndex.value >= items.value.length - 1 && nextCursor.value) await loadMore();
  await selectIndex(selectedIndex.value + 1);
}

async function selectIndex(index: number) {
  if (!props.roomId || index < 0 || index >= items.value.length) return;
  selectedIndex.value = index;
  loading.value = true;
  error.value = null;
  try {
    selectedSession.value = await RoomsService.fetchSessionRecap(props.roomId, items.value[index].id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(seconds: number) {
  return t('sessions.history.duration', {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
  });
}
</script>

<style scoped>
.history-navigation { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
.history-date { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
</style>
