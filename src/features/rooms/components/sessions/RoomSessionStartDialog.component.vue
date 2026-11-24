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
  <v-dialog :model-value="open" persistent :fullscreen="smAndDown" max-width="760" scrollable aria-labelledby="assign-awards-title">
    <v-card class="room-session-start-dialog__assign-awards-dialog">
      <AppDialogHeading class="room-session-start-dialog__assign-awards-heading">
        <span class="room-session-start-dialog__assign-awards-icon" aria-hidden="true"><v-icon icon="mdi-trophy-outline" size="28" /></span>
        <div>
          <div class="room-session-start-dialog__assign-awards-eyebrow">{{ t('sessions.start') }}</div>
          <h2 id="assign-awards-title">{{ t('sessionAwards.startTitle') }}</h2>
        </div>
      </AppDialogHeading>
      <v-divider />
      <v-card-text class="room-session-start-dialog__assign-awards-body">
        <p class="room-session-start-dialog__assign-awards-intro">{{ t('sessionAwards.startDescription') }}</p>

        <section v-for="candidate in candidates" :key="candidate.award.id" class="room-session-start-dialog__assign-award" :class="{ 'room-session-start-dialog__assign-award--selected': selections[candidate.award.id] }">
          <div class="room-session-start-dialog__assign-award-heading">
            <v-icon icon="mdi-trophy-outline" size="20" color="primary" aria-hidden="true" />
            <h3 :id="`award-${candidate.award.id}`">{{ candidate.award.name }}</h3>
            <v-icon v-if="selections[candidate.award.id]" icon="mdi-check-circle" size="20" color="primary" aria-hidden="true" />
          </div>
          <p v-if="candidate.award.description" class="room-session-start-dialog__assign-award-description">{{ candidate.award.description }}</p>
          <v-radio-group v-model="selections[candidate.award.id]" class="room-session-start-dialog__assign-award-owners" hide-details :disabled="!props.isLeader || store.startSubmitting" :aria-labelledby="`award-${candidate.award.id}`" color="primary">
            <v-radio v-for="user in candidate.users" :key="user.userId" class="room-session-start-dialog__assign-award-owner" :class="{ 'room-session-start-dialog__assign-award-owner--selected': selections[candidate.award.id] === user.userId }" :label="user.displayName" :value="user.userId" />
          </v-radio-group>
        </section>
      </v-card-text>
      <v-card-actions class="room-session-start-dialog__assign-awards-actions">
        <v-btn variant="text" :disabled="!props.isLeader || store.startSubmitting" @click="store.cancelSessionStart()">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-play-circle-outline" :disabled="!props.isLeader || !valid" :loading="store.startSubmitting" @click="confirm">
          {{ t('sessions.start') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AppDialogHeading from '@/shared/ui/AppDialogHeading.vue';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
const props = defineProps<{ isLeader: boolean }>();
const store = useRoomsStore();
const { t } = useI18n();
const { smAndDown } = useDisplay();
const selections = ref<Record<string, string>>({});
const candidates = computed(() => store.startPreparation?.candidates ?? []);
const open = computed(() => !store.currentSession && store.startPreparation?.request?.status === 'pending');
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

<style scoped lang="scss" src="@/assets/styles/features/rooms/sessions/room-session-start-dialog.scss"></style>
