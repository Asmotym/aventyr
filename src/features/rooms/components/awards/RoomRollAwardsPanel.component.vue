<template>
  <section class="room-roll-awards-panel">
    <div class="room-roll-awards-panel__awards-scroll">
      <p class="text-body-2 text-medium-emphasis mb-4">{{ t('roomTools.awardsHelp') }}</p>
      <v-progress-linear v-if="store.sessionLoading" indeterminate color="primary" class="mb-3" />

      <v-alert v-if="!store.sessionLoading && !store.currentSession" type="info" variant="tonal">{{ t('roomTools.noSession') }}</v-alert>
      <v-alert v-else-if="!awards.length && !store.sessionLoading" type="info" variant="tonal">{{ t('sessionAwards.empty') }}</v-alert>
      <v-card v-for="assignment in awards" :key="assignment.id" variant="tonal" class="mb-3" :class="{ 'room-roll-awards-panel__award-used': assignment.usedAt }">
        <v-card-text>
          <h4 class="text-subtitle-1">{{ assignment.award.name }}</h4>
          <p v-if="assignment.award.description" class="text-body-2 room-roll-awards-panel__award-description">
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
    <footer class="room-roll-awards-panel__awards-footer">
      <v-menu v-model="membersOpen" location="top" offset="8" :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" block variant="tonal" color="primary" prepend-icon="mdi-account-group-outline">{{ t('roomTools.membersRollAwards') }}</v-btn>
        </template>
        <v-card class="room-roll-awards-panel__members-awards-popup" role="region" :aria-label="t('roomTools.membersRollAwards')">
          <v-card-title class="text-subtitle-1">{{ t('roomTools.membersRollAwards') }}</v-card-title>
          <v-divider />
          <v-progress-linear v-if="store.sessionLoading" indeterminate color="primary" />
          <v-card-text>
            <section v-for="member in members" :key="member.userId" class="room-roll-awards-panel__member-awards">
              <h3 class="text-subtitle-2 mb-2">{{ member.name }}</h3>
              <div v-if="member.awards.length" class="room-roll-awards-panel__member-awards-chips">
                <v-tooltip v-for="assignment in member.awards" :key="assignment.id" :disabled="!assignment.award.description" location="top" max-width="320">
                  <template #activator="{ props: tooltipProps }">
                    <v-chip v-bind="tooltipProps" tabindex="0" variant="tonal" size="small" :color="assignment.usedAt ? undefined : 'primary'" :prepend-icon="assignment.usedAt ? 'mdi-check' : 'mdi-trophy-outline'" :aria-label="`${assignment.award.name} · ${t(assignment.usedAt ? 'sessionAwards.used' : 'sessionAwards.available')}`">{{ assignment.award.name }}</v-chip>
                  </template>
                  <span class="room-roll-awards-panel__award-description">{{ assignment.award.description }}</span>
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
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails } from '@shared/rooms/rooms.types';
import type { DiscordUser } from '@shared/accounts/discord.types';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import { formatDisplayName } from '@/features/rooms/utils/room-formatting.utils';
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

useErrorNotifications(
  () => error.value,
);
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/awards/room-roll-awards-panel.scss"></style>
