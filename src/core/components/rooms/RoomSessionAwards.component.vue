<template>
  <div v-if="results.length" class="session-awards">
    <v-card v-for="result in results" :key="result.award.id" variant="tonal" class="mb-3">
      <v-card-title class="text-subtitle-2">{{ result.award.name }}</v-card-title>
      <v-card-text>
        <p v-if="result.award.description" class="text-body-2 text-medium-emphasis mb-2">
          {{ result.award.description }}
        </p>
        <div class="text-caption text-medium-emphasis mb-2">
          {{ t('sessions.awards.tracking', { values: result.award.diceResults.join(', ') }) }}
        </div>
        <div v-if="result.leaders.length" class="d-flex flex-wrap ga-2">
          <v-chip v-for="leader in result.leaders" :key="leader.userId" color="primary" size="small">
            {{ leader.displayName }} · {{ leader.count }}
          </v-chip>
        </div>
        <div v-else class="text-caption text-medium-emphasis">{{ t('sessions.awards.noWinner') }}</div>
        <v-list v-if="result.users.length" density="compact" class="mt-2 bg-transparent">
          <v-list-item v-for="user in result.users" :key="user.userId" :title="user.displayName">
            <template #append>{{ user.count }}</template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
  <v-alert v-else type="info" variant="tonal">{{ t('sessions.awards.empty') }}</v-alert>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RoomSessionAwardResult } from 'netlify/core/types/data.types';

defineProps<{ results: RoomSessionAwardResult[] }>();
const { t } = useI18n();
</script>
