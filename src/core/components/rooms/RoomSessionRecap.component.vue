<template>
  <div class="session-recap">
    <v-tabs v-model="tab" show-arrows density="comfortable" class="mb-4">
      <v-tab value="general">{{ t('sessions.recap.general') }}</v-tab>
      <v-tab value="awards">{{ t('sessions.recap.rollAwards') }}</v-tab>
      <v-tab value="criticals">{{ t('sessions.recap.criticals') }}</v-tab>
      <v-tab value="bonus">{{ t('sessions.recap.bonusPoints') }}</v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="general">
        <div class="recap-stats">
          <v-card variant="tonal"><v-card-text><strong>{{ recap.messageCount }}</strong><span>{{ t('sessions.recap.messages') }}</span></v-card-text></v-card>
          <v-card variant="tonal"><v-card-text><strong>{{ recap.rollCount }}</strong><span>{{ t('sessions.recap.rolls') }}</span></v-card-text></v-card>
          <v-card variant="tonal"><v-card-text><strong>{{ formatDuration(recap.durationSeconds) }}</strong><span>{{ t('sessions.recap.duration') }}</span></v-card-text></v-card>
        </div>
      </v-window-item>
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
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomCriticalRule, RoomSessionRecap } from 'netlify/core/types/data.types';
import RoomSessionAwards from './RoomSessionAwards.component.vue';

const props = defineProps<{ recap: RoomSessionRecap }>();
const { t } = useI18n();
const tab = ref('general');
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
.recap-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.recap-stats--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.recap-stats .v-card-text { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.recap-stats strong { font-size: 1.35rem; }
@media (max-width: 600px) { .recap-stats { grid-template-columns: 1fr; } .recap-stats--two { grid-template-columns: repeat(2, 1fr); } }
</style>
