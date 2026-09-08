<template>
  <section class="roll-awards-panel">
    <h3 class="text-subtitle-1 mb-3">🏆 {{ t('rollAwards.title') }}</h3>
    <v-progress-linear v-if="store.sessionLoading" indeterminate color="primary" class="mb-3" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
    <v-alert v-if="!awards.length && !store.sessionLoading" type="info" variant="tonal">{{ t('sessionAwards.empty') }}</v-alert>
    <v-card v-for="assignment in awards" :key="assignment.id" variant="tonal" class="mb-3" :class="{ 'award-used': assignment.usedAt }">
      <v-card-text>
        <h4 class="text-subtitle-1">{{ assignment.award.name }}</h4>
        <p v-if="assignment.award.description" class="text-body-2 award-description">
          {{ description(assignment.id, assignment.award.description) }}
          <v-btn v-if="assignment.award.description.length > 160" variant="text" size="x-small" :aria-expanded="Boolean(expanded[assignment.id])" @click="expanded[assignment.id] = !expanded[assignment.id]">
            {{ t(expanded[assignment.id] ? 'sessionAwards.showLess' : 'sessionAwards.showMore') }}
          </v-btn>
        </p>
        <v-chip v-if="assignment.usedAt" size="small" prepend-icon="mdi-check" class="mt-2 mr-2">{{ t('sessionAwards.used') }}</v-chip>
        <v-btn size="small" color="primary" variant="flat" class="mt-2" :disabled="Boolean(assignment.usedAt) || Boolean(usingId)" :loading="usingId === assignment.id" @click="use(assignment.id)">
          {{ t('sessionAwards.use') }}
        </v-btn>
      </v-card-text>
    </v-card>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { useRoomsStore } from 'core/stores/rooms.store';
const props = defineProps<{ room: RoomDetails | null; messages: RoomMessage[]; currentUser: DiscordUser | null }>();
const store = useRoomsStore();
const { t } = useI18n();
const expanded = ref<Record<string, boolean>>({});
const usingId = ref<string | null>(null);
const error = ref<string | null>(null);
const awards = computed(() => (store.currentSession?.ownedAwards ?? []).filter(award => award.userId === props.currentUser?.id));
function description(id: string, text: string) { return expanded.value[id] || text.length <= 160 ? text : `${text.slice(0, 160)}…`; }
async function use(id: string) {
  if (usingId.value) return;
  usingId.value = id;
  error.value = null;
  try { await store.useRollAward(id); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : String(caught); }
  finally { usingId.value = null; }
}
</script>
<style scoped>
.award-description { white-space: pre-wrap; overflow-wrap: anywhere; }
.award-used { border: 1px solid rgba(var(--v-theme-on-surface), 0.2); }
</style>
