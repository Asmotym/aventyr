<template>
  <section class="roll-awards-panel">
    <div class="roll-awards-scroll">
      <p class="text-body-2 text-medium-emphasis mb-4">{{ t('roomTools.awardsHelp') }}</p>
      <v-progress-linear v-if="store.sessionLoading" indeterminate color="primary" class="mb-3" />
      <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
      <v-alert v-if="!store.sessionLoading && !store.currentSession" type="info" variant="tonal">{{ t('roomTools.noSession') }}</v-alert>
      <v-alert v-else-if="!awards.length && !store.sessionLoading" type="info" variant="tonal">{{ t('sessionAwards.empty') }}</v-alert>
      <v-card v-for="assignment in awards" :key="assignment.id" variant="tonal" class="mb-3" :class="{ 'award-used': assignment.usedAt }">
        <v-card-text>
          <h4 class="text-subtitle-1">{{ assignment.award.name }}</h4>
          <p v-if="assignment.award.description" class="text-body-2 award-description">
            {{ description(assignment.id, assignment.award.description) }}
            <v-btn v-if="assignment.award.description.length > 160" variant="text" size="x-small" :aria-expanded="Boolean(expanded[assignment.id])" @click="expanded[assignment.id] = !expanded[assignment.id]">
              {{ t(expanded[assignment.id] ? 'sessionAwards.showLess' : 'sessionAwards.showMore') }}
            </v-btn>
          </p>
          <v-chip size="small" :prepend-icon="assignment.usedAt ? 'mdi-check' : 'mdi-star-outline'" class="mt-2 mr-2" :color="assignment.usedAt ? undefined : 'primary'">{{ t(assignment.usedAt ? 'sessionAwards.used' : 'sessionAwards.available') }}</v-chip>
          <v-btn size="small" color="primary" variant="flat" class="mt-2" :disabled="Boolean(assignment.usedAt) || Boolean(usingId)" :loading="usingId === assignment.id" @click="use(assignment.id)">
            {{ t('sessionAwards.use') }}
          </v-btn>
        </v-card-text>
      </v-card>
    </div>
    <footer class="roll-awards-footer">
      <v-menu v-model="membersOpen" location="top" offset="8" :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" block variant="tonal" color="primary" prepend-icon="mdi-account-group-outline">{{ t('roomTools.membersRollAwards') }}</v-btn>
        </template>
        <v-card class="members-awards-popup" role="region" :aria-label="t('roomTools.membersRollAwards')">
          <v-card-title class="text-subtitle-1">{{ t('roomTools.membersRollAwards') }}</v-card-title>
          <v-divider />
          <v-progress-linear v-if="store.sessionLoading" indeterminate color="primary" />
          <v-card-text>
            <section v-for="member in members" :key="member.userId" class="member-awards">
              <h3 class="text-subtitle-2 mb-2">{{ member.name }}</h3>
              <div v-if="member.awards.length" class="member-awards-chips">
                <v-tooltip v-for="assignment in member.awards" :key="assignment.id" :disabled="!assignment.award.description" location="top" max-width="320">
                  <template #activator="{ props: tooltipProps }">
                    <v-chip v-bind="tooltipProps" tabindex="0" variant="tonal" size="small" :color="assignment.usedAt ? undefined : 'primary'" :prepend-icon="assignment.usedAt ? 'mdi-check' : 'mdi-trophy-outline'" :aria-label="`${assignment.award.name} · ${t(assignment.usedAt ? 'sessionAwards.used' : 'sessionAwards.available')}`">{{ assignment.award.name }}</v-chip>
                  </template>
                  <span class="award-description">{{ assignment.award.description }}</span>
                </v-tooltip>
              </div>
              <p v-else class="text-body-2 text-medium-emphasis">{{ t('roomTools.noMemberAwards') }}</p>
            </section>
          </v-card-text>
        </v-card>
      </v-menu>
    </footer>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { useRoomsStore } from 'core/stores/rooms.store';
import { formatDisplayName } from 'core/utils/room-formatting.utils';
const props = defineProps<{ room: RoomDetails | null; currentUser: DiscordUser | null; active: boolean }>();
const store = useRoomsStore();
const { t } = useI18n();
const expanded = ref<Record<string, boolean>>({});
const usingId = ref<string | null>(null);
const error = ref<string | null>(null);
const membersOpen = ref(false);
const members = computed(() => store.members.map(member => ({
  userId: member.userId,
  name: formatDisplayName(member.username, member.nickname),
  awards: (store.currentSession?.ownedAwards ?? []).filter(award => award.userId === member.userId),
})));
watch([() => props.room?.id, () => props.currentUser?.id], () => { expanded.value = {}; error.value = null; membersOpen.value = false; });
watch(() => props.active, active => { if (!active) membersOpen.value = false; });
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
.roll-awards-panel { width: 100%; min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column; }
.roll-awards-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 16px; }
.roll-awards-footer { flex-shrink: 0; padding: 16px 12px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.roll-awards-panel h4 { overflow-wrap: anywhere; }
.award-description { white-space: pre-wrap; overflow-wrap: anywhere; }
.award-used { border: 1px solid rgba(var(--v-theme-on-surface), 0.2); }
.members-awards-popup { width: min(420px, calc(100vw - 32px)); max-height: min(60dvh, 480px); overflow-y: auto; }
.member-awards + .member-awards { margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.member-awards h3 { overflow-wrap: anywhere; }
.member-awards-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.member-awards-chips .v-chip { max-width: 100%; height: auto; min-height: 26px; }
.member-awards-chips :deep(.v-chip__content) { white-space: normal; overflow-wrap: anywhere; }
</style>
