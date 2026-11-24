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
    <v-card class="assign-awards-dialog">
      <AppDialogHeading class="assign-awards-heading">
        <span class="assign-awards-icon" aria-hidden="true"><v-icon icon="mdi-trophy-outline" size="28" /></span>
        <div>
          <div class="assign-awards-eyebrow">{{ t('sessions.start') }}</div>
          <h2 id="assign-awards-title">{{ t('sessionAwards.startTitle') }}</h2>
        </div>
      </AppDialogHeading>
      <v-divider />
      <v-card-text class="assign-awards-body">
        <p class="assign-awards-intro">{{ t('sessionAwards.startDescription') }}</p>
        <v-alert v-if="store.startError" type="error" variant="tonal" class="mb-4">{{ store.startError }}</v-alert>
        <section v-for="candidate in candidates" :key="candidate.award.id" class="assign-award" :class="{ 'assign-award--selected': selections[candidate.award.id] }">
          <div class="assign-award-heading">
            <v-icon icon="mdi-trophy-outline" size="20" color="primary" aria-hidden="true" />
            <h3 :id="`award-${candidate.award.id}`">{{ candidate.award.name }}</h3>
            <v-icon v-if="selections[candidate.award.id]" icon="mdi-check-circle" size="20" color="primary" aria-hidden="true" />
          </div>
          <p v-if="candidate.award.description" class="assign-award-description">{{ candidate.award.description }}</p>
          <v-radio-group v-model="selections[candidate.award.id]" class="assign-award-owners" hide-details :disabled="!props.isLeader || store.startSubmitting" :aria-labelledby="`award-${candidate.award.id}`" color="primary">
            <v-radio v-for="user in candidate.users" :key="user.userId" class="assign-award-owner" :class="{ 'assign-award-owner--selected': selections[candidate.award.id] === user.userId }" :label="user.displayName" :value="user.userId" />
          </v-radio-group>
        </section>
      </v-card-text>
      <v-card-actions class="assign-awards-actions">
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

<style scoped>
.assign-awards-dialog { border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 20px !important; }

.assign-awards-icon { display: grid; place-items: center; flex-shrink: 0; width: 56px; height: 56px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 16px; background: rgba(var(--v-theme-primary), .08); color: rgb(var(--v-theme-primary)); }
.assign-awards-heading > div { min-width: 0; }
.assign-awards-eyebrow { margin-bottom: 4px; font-size: 11px; font-weight: 700; color: rgb(var(--v-theme-primary)); }
.assign-awards-heading h2 { font-size: 22px; line-height: 1.4; font-weight: 700; letter-spacing: -.025em; overflow-wrap: anywhere; }
.assign-awards-body { padding: 24px !important; }
.assign-awards-intro { margin-bottom: 24px; font-size: 14px; line-height: 1.7; color: rgba(var(--v-theme-on-surface), .7); }
.assign-award { padding: 20px; border: 1px solid rgba(var(--v-border-color), .12); border-radius: 16px; background: rgba(var(--v-theme-on-surface), .02); }
.assign-award + .assign-award { margin-top: 16px; }
.assign-award--selected { border-color: rgba(var(--v-theme-primary), .25); }
.assign-award-heading { display: flex; align-items: center; gap: 10px; }
.assign-award-heading h3 { flex: 1; min-width: 0; font-size: 16px; font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
.assign-award-description { margin-top: 10px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; color: rgba(var(--v-theme-on-surface), .7); }
.assign-award-owners { margin-top: 16px; container-type: inline-size; }
.assign-award-owners :deep(.v-selection-control-group) { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.assign-award-owner { grid-area: auto; min-width: 0; padding: 4px 10px 4px 4px; border: 1px solid rgba(var(--v-border-color), .12); border-radius: 12px; background: rgb(var(--v-theme-surface)); }
@container (min-width: 428px) {
  .assign-award-owners :deep(.v-selection-control-group) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .assign-award-owner:only-child { grid-column: 1 / -1; }
}
.assign-award-owner--selected { border-color: rgba(var(--v-theme-primary), .4); background: rgba(var(--v-theme-primary), .07); }
.assign-award-owner :deep(.v-label) { font-size: 13px; opacity: 1; overflow-wrap: anywhere; }
.assign-awards-actions { justify-content: flex-end; flex-wrap: wrap; gap: 8px; padding: 16px 24px; border-top: 1px solid rgba(var(--v-border-color), .1); }
.assign-awards-actions .v-btn { min-height: 40px; padding-inline: 18px; border-radius: 10px; text-transform: none; letter-spacing: 0; }
@media (max-width: 959px) {
  .assign-awards-dialog { border-radius: 0 !important; }
  .assign-awards-heading { padding: 20px 16px; gap: 12px; }
  .assign-awards-icon { width: 44px; height: 48px; border-radius: 12px; }
  .assign-awards-heading h2 { font-size: 20px; }
  .assign-awards-body { padding: 20px 16px !important; }
  .assign-award { padding: 16px; }
  .assign-awards-actions { padding: 12px 16px; }
}
</style>
