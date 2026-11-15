<template>
  <div class="session-recap">
    <div class="recap-stats mb-5">
      <v-card v-for="stat in summaryStats" :key="stat.label" variant="tonal" :color="stat.color"><v-card-text><v-icon :icon="stat.icon" /><strong>{{ stat.value }}</strong><span>{{ t(stat.label) }}</span></v-card-text></v-card>
    </div>
    <v-tabs v-model="tab" show-arrows density="comfortable" class="mb-4">
      <v-tab value="awards">{{ t('sessions.recap.rollAwards') }}</v-tab>
      <v-tab value="criticals">{{ t('sessions.recap.criticals') }}</v-tab>
      <v-tab value="bonus">{{ t('sessions.recap.bonusPoints') }}</v-tab>
      <v-tab value="bag">{{ t('bag.title') }}</v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="awards"><RoomSessionAwards :results="awardedRollAwards" /></v-window-item>
      <v-window-item value="criticals">
        <v-list v-if="recap.criticals.length" lines="two">
          <v-list-item v-for="(result, index) in recap.criticals" :key="index">
            <v-list-item-title>{{ criticalLabel(result.rule) }}</v-list-item-title>
            <template #append><v-chip size="small">{{ result.matchCount }}</v-chip></template>
          </v-list-item>
        </v-list>
        <v-alert v-else type="info" variant="tonal">{{ t('sessions.recap.noCriticals') }}</v-alert>
      </v-window-item>
      <v-window-item value="bonus">
        <div class="recap-stats recap-stats--two mb-4">
          <v-card variant="tonal"><v-card-text><strong>{{ recap.bonusPoints.awarded }}</strong><span>{{ t('sessions.recap.awarded') }}</span></v-card-text></v-card>
          <v-card variant="tonal"><v-card-text><strong>{{ recap.bonusPoints.used }}</strong><span>{{ t('sessions.recap.used') }}</span></v-card-text></v-card>
        </div>
        <v-list v-if="recap.bonusPoints.users.length" lines="two">
          <v-list-item v-for="user in recap.bonusPoints.users" :key="user.userId" :title="user.displayName">
            <v-list-item-subtitle>{{ t('sessions.recap.userBonus', { awarded: user.awarded, used: user.used }) }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <v-alert v-else type="info" variant="tonal">{{ t('sessions.recap.noBonus') }}</v-alert>
      </v-window-item>
      <v-window-item value="bag">
        <template v-if="recap.bag">
          <section v-for="section in bagSections" :key="section.title" class="mb-5">
            <h3 class="text-subtitle-1 mb-3">{{ t(section.title) }}</h3>
            <div class="bag-stats">
              <v-card v-for="metric in bagMetrics" :key="metric.key" variant="tonal" :color="metric.color"><v-card-text class="bag-stat"><v-icon :icon="metric.icon" /><strong>{{ section.counts[metric.key] }}</strong><span>{{ t('sessions.recap.bag.' + metric.key) }}</span></v-card-text></v-card>
            </div>
          </section>
        </template>
        <v-alert v-else type="info" variant="tonal">{{ t('sessions.recap.bag.unavailable') }}</v-alert>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomCriticalRule, RoomSessionRecap } from 'netlify/core/types/data.types';
import RoomSessionAwards from './RoomSessionAwards.component.vue';

const props = defineProps<{ recap: RoomSessionRecap }>();
const { t } = useI18n();
const tab = defineModel<string>('tab', { default: 'awards' });
const summaryStats = computed(() => [
  { label: 'sessions.recap.messages', value: props.recap.messageCount, icon: 'mdi-message-text-outline', color: 'blue' },
  { label: 'sessions.recap.rolls', value: props.recap.rollCount, icon: 'mdi-dice-multiple-outline', color: 'teal' },
  { label: 'sessions.recap.duration', value: formatDuration(props.recap.durationSeconds), icon: 'mdi-clock-outline', color: 'purple' },
]);
const bagMetrics = [
  { key: 'created', icon: 'mdi-plus-circle-outline', color: 'teal' },
  { key: 'edited', icon: 'mdi-pencil-outline', color: 'blue' },
  { key: 'deleted', icon: 'mdi-delete-outline', color: 'red' },
  { key: 'gifted', icon: 'mdi-gift-outline', color: 'purple' },
] as const;
const bagSections = computed(() => props.recap.bag ? [
  { title: 'bag.team', counts: props.recap.bag.team },
  ...(props.recap.bag.personal ? [{ title: 'sessions.recap.bag.personal', counts: props.recap.bag.personal }] : []),
] : []);
const awardedRollAwards = computed(() => props.recap.rollAwards.filter((result) => result.leaders.length > 0));
function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':');
}
function criticalLabel(rule: RoomCriticalRule) {
  return t(rule.operator === 'moreThan' ? 'sessions.recap.moreThan' : 'sessions.recap.lessThan', { value: rule.threshold });
}
</script>

<style scoped>
.bag-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bag-stat { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.bag-stat strong { font-size: 1.5rem; }
.recap-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.recap-stats--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.recap-stats .v-card-text { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.recap-stats strong { font-size: 1.35rem; }
@media (max-width: 600px) {
  .recap-stats { gap: 6px; }
  .recap-stats .v-card-text { padding: 12px 4px; font-size: .75rem; }
  .recap-stats strong { font-size: 1rem; }
}
</style>
