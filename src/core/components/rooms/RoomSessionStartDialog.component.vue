<template>
  <v-alert v-if="waiting" type="info" variant="tonal" class="ma-3" role="status">
    {{ t('sessionAwards.waitingForLeader') }}
  </v-alert>
  <v-alert v-for="activity in store.retainedActivities" :key="activity.id" type="info" variant="tonal" class="ma-3">
    <p>{{ t('sessionAwards.retained') }}</p>
    <p>{{ activity.payload.type === 'dice' ? `${activity.payload.dice?.notation}: ${activity.payload.dice?.total} [${activity.payload.dice?.rolls.join(', ')}]` : activity.payload.content }}</p>
    <v-btn size="small" variant="text" :disabled="store.sendingMessage" @click="store.retryActivity(activity.id)">{{ t('sessionAwards.retry') }}</v-btn>
    <v-btn size="small" variant="text" @click="store.retainedActivities = store.retainedActivities.filter(entry => entry.id !== activity.id)">{{ t('sessionAwards.dismiss') }}</v-btn>
  </v-alert>
  <v-dialog :model-value="open" persistent :fullscreen="smAndDown" max-width="760" scrollable>
    <v-card>
      <v-card-title>{{ t('sessionAwards.startTitle') }}</v-card-title>
      <v-card-text>
        <p class="mb-4">{{ t('sessionAwards.startDescription') }}</p>
        <v-alert v-if="store.startError" type="error" variant="tonal" class="mb-4">{{ store.startError }}</v-alert>
        <section v-for="candidate in candidates" :key="candidate.award.id" class="mb-5">
          <h3 :id="`award-${candidate.award.id}`" class="text-subtitle-1">{{ candidate.award.name }}</h3>
          <p v-if="candidate.award.description" class="text-body-2 mb-2">{{ candidate.award.description }}</p>
          <v-radio-group v-model="selections[candidate.award.id]" inline hide-details :disabled="store.startSubmitting" :aria-labelledby="`award-${candidate.award.id}`">
            <v-radio v-for="user in candidate.users" :key="user.userId" :label="user.displayName" :value="user.userId" />
          </v-radio-group>
        </section>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="store.startSubmitting" @click="store.cancelSessionStart()">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-play-circle-outline" :disabled="!valid" :loading="store.startSubmitting" @click="confirm">
          {{ t('sessions.start') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { useRoomsStore } from 'core/stores/rooms.store';
const props = defineProps<{ isLeader: boolean }>();
const store = useRoomsStore();
const { t } = useI18n();
const { smAndDown } = useDisplay();
const selections = ref<Record<string, string>>({});
const candidates = computed(() => store.startPreparation?.candidates ?? []);
const open = computed(() => props.isLeader && !store.currentSession && store.startPreparation?.request?.status === 'pending');
const waiting = computed(() => !props.isLeader && store.pendingActivityCount > 0 && !store.currentSession && store.startPreparation?.request?.status === 'pending');
const valid = computed(() => candidates.value.every(({ award, users }) => users.some(user => user.userId === selections.value[award.id])));
watch(() => store.startPreparation?.request?.id, () => { selections.value = {}; }, { flush: 'sync' });
watch(candidates, (values) => {
  const next: Record<string, string> = {};
  for (const { award, users } of values) {
    if (users.length === 1) next[award.id] = users[0].userId;
    else if (users.some(user => user.userId === selections.value[award.id])) next[award.id] = selections.value[award.id];
  }
  selections.value = next;
}, { immediate: true });
function confirm() {
  void store.confirmSessionStart(candidates.value.map(({ award }) => ({ awardId: award.id, userId: selections.value[award.id] })));
}
// Recovery also works when the room's realtime connection is temporarily unavailable.
let refreshing = false;
const timer = window.setInterval(async () => {
  if (refreshing || store.startSubmitting || !store.selectedRoomId || (!open.value && !store.pendingActivityCount)) return;
  refreshing = true;
  try { await store.refreshStartPreparation(store.selectedRoomId); } catch { /* Retry on the next tick. */ }
  finally { refreshing = false; }
}, 3000);
onUnmounted(() => window.clearInterval(timer));
</script>
