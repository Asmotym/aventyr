<template>
  <v-window-item value="administration">
    <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
    <v-list>
      <v-list-item v-for="member in store.members" :key="member.userId" >
        <template #prepend><UserProfileAvatar :user-id="member.userId" :avatar="member.avatar" :display-name="member.nickname || member.username || member.userId" :room-id="roomId" :size="36" :classes="['mr-3']" /></template>
        <v-list-item-title>{{ member.nickname || member.username }} <span v-if="member.nickname" class="text-caption">({{ member.username }})</span></v-list-item-title>
        <div class="d-flex align-center ga-2 mt-2">
          <v-select :model-value="member.role || 'player'" :items="roles" hide-details density="compact" :disabled="busy || member.role === 'creator'" @update:model-value="changeRole(member, $event)" />
          <v-btn variant="text" :disabled="busy" @click="edit(member)">{{ t('roomAccess.rights') }}<v-icon v-if="Object.keys(member.permissionOverrides || {}).length" color="warning" end>mdi-alert-outline</v-icon></v-btn>
        </div>
      </v-list-item>
    </v-list>
    <v-dialog :model-value="!!confirmation" max-width="480" @update:model-value="confirmation = null">
      <v-card :title="t('roomAccess.confirmTitle')" :text="t(confirmation?.role === 'creator' ? 'roomAccess.transferWarning' : 'roomAccess.adminWarning')">
        <v-card-actions><v-btn @click="confirmation = null">{{ t('common.cancel') }}</v-btn><v-btn :loading="busy" @click="confirmRole">{{ t('roomAccess.confirm') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!editing" max-width="900" @update:model-value="editing = null">
      <v-card :title="t('roomAccess.rights')">
        <v-card-text>
          <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
          <v-alert v-if="customized" type="warning" variant="tonal" class="mb-3">{{ t('roomAccess.modified') }}<v-btn variant="text" :disabled="readOnly" @click="draft = roleDefaults(editing?.role || 'player')">{{ t('roomAccess.reset') }}</v-btn></v-alert>
          <div class="rights-columns">
          <section v-for="group in permissionGroups" :key="group.title" class="mb-3">
          <div class="text-subtitle-2">{{ t(group.title) }}</div>
          <v-checkbox v-for="key in group.keys" :key="key" v-model="draft[key]" :label="t('roomAccess.permissions.' + key)" :disabled="readOnly || busy" hide-details :class="{ 'rights-edited': draft[key] !== original[key] }">
            <template #append><v-icon v-if="draft[key] !== defaults[key]" v-tooltip="t('roomAccess.nonDefault')" color="warning" size="small">mdi-alert-outline</v-icon></template>
          </v-checkbox>
          </section>
          </div>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="editing = null">{{ t('common.cancel') }}</v-btn><v-btn :color="!readOnly && dirty && !busy ? 'success' : undefined" variant="flat" :disabled="readOnly || !dirty || busy" :loading="busy" @click="saveRights">{{ t('common.save') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-window-item>
</template>
<script setup lang="ts">
import UserProfileAvatar from 'core/components/UserProfileAvatar.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoomsStore } from 'core/stores/rooms.store';
import { updateRoomAccess } from 'core/services/rooms.service';
import { ROOM_ROLES, ROOM_PERMISSIONS, roleDefaults, resolveRoomRights, type RoomRole, type RoomRights } from 'netlify/core/utils/room-permissions';
import type { RoomMemberDetails } from 'netlify/core/types/data.types';
const props = defineProps<{ roomId: string; userId: string }>();
const { t } = useI18n();
const store = useRoomsStore();
const permissionGroups = [
  { title: 'bag.title', keys: ['viewBag', 'editBag'] },
  { title: 'roomSettings.tabs.room', keys: ['editNickname', 'editRoom', 'manageSessions', 'archiveRoom'] },
  { title: 'roomSettings.tabs.dices', keys: ['manageDice', 'manageDiceCategories'] },
  { title: 'roomSettings.tabs.rollAwards', keys: ['viewRollAwards', 'manageRollAwards', 'copyRollAwards', 'assignRollAwards'] },
  { title: 'roomSettings.tabs.criticals', keys: ['manageCriticals'] },
  { title: 'roomSettings.tabs.bonusPoints', keys: ['manageBonusPoints'] },
] as const;
const busy = ref(false), error = ref('');
const editing = ref<RoomMemberDetails | null>(null);
const confirmation = ref<{ member: RoomMemberDetails; role: RoomRole } | null>(null);
const draft = ref<RoomRights>(roleDefaults('player')), original = ref<RoomRights>(roleDefaults('player'));
const isCreator = computed(() => store.members.find(m => m.userId === props.userId)?.role === 'creator');
const roles = computed(() => ROOM_ROLES.filter(role => role !== 'creator' || isCreator.value).map(value => ({ title: t('roomAccess.roles.' + value), value })));
const defaults = computed(() => roleDefaults(editing.value?.role || 'player'));
const readOnly = computed(() => editing.value?.role === 'creator');
const customized = computed(() => ROOM_PERMISSIONS.some(key => draft.value[key] !== defaults.value[key]));
const dirty = computed(() => ROOM_PERMISSIONS.some(key => draft.value[key] !== original.value[key]));
function edit(member: RoomMemberDetails) { editing.value = member; draft.value = resolveRoomRights(member.role || 'player', member.permissionOverrides); original.value = { ...draft.value }; }
async function mutate(action: 'updateMemberRole' | 'updateMemberRights' | 'transferRoomOwnership', targetUserId: string, extra: Record<string, unknown>) {
  busy.value = true; error.value = '';
  try { const result = await updateRoomAccess(action, { roomId: props.roomId, userId: props.userId, targetUserId, ...extra }); for (const member of result.members) store.upsertMember(member); return true; }
  catch (e) { error.value = e instanceof Error ? e.message : String(e); return false; }
  finally { busy.value = false; }
}
async function changeRole(member: RoomMemberDetails, role: RoomRole) {
  if (role === member.role) return;
  if (role === 'admin' || role === 'creator') confirmation.value = { member, role };
  else await mutate('updateMemberRole', member.userId, { role });
}
async function confirmRole() { const change = confirmation.value; if (!change) return; if (await mutate(change.role === 'creator' ? 'transferRoomOwnership' : 'updateMemberRole', change.member.userId, { role: change.role })) confirmation.value = null; }
async function saveRights() { if (editing.value && await mutate('updateMemberRights', editing.value.userId, { rights: draft.value })) editing.value = null; }
watch(() => store.members.find(m => m.userId === editing.value?.userId), (member) => { if (editing.value && member && member !== editing.value) edit(member); });
</script>
<style scoped>
.rights-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; }
.rights-columns > section { min-width: 0; }
@media (max-width: 599px) {
  .rights-columns { grid-template-columns: minmax(0, 1fr); }
}
.rights-edited { background: rgba(var(--v-theme-primary), .06); border-radius: 4px; }
</style>
