import { computed, type Ref } from 'vue';
import { useRoomsStore } from '@/features/rooms/stores/rooms.store';
import { memberAccess } from '@shared/rooms/room-permissions';
export function useRoomAccess(userId: Ref<string | undefined>) {
  const store = useRoomsStore();
  return computed(() => memberAccess(store.members.find(member => member.userId === userId.value)));
}
