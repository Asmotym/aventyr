import type { RoomBonusPointSnapshot, RoomRealtimeEvent, RoomRollAwardsSnapshot } from '../../../../shared/rooms/rooms.types';
import { createRoomRealtimeEvent, type PublishableRoomEvent } from './room-realtime.protocol';
import { roomRealtimeHub } from './room-realtime.server';
export { toRealtimeRoom } from './room-realtime.protocol';
export function publishRoomEvent(roomId: string, payload: PublishableRoomEvent): RoomRealtimeEvent {
    const event = createRoomRealtimeEvent(roomId, payload);
    roomRealtimeHub.broadcast(event);
    return event;
}
export function publishBonusPointSnapshot(snapshot: RoomBonusPointSnapshot): void {
    publishRoomEvent(snapshot.roomId, {
        type: 'bonus_points.updated',
        snapshot
    });
}
export function publishRollAwardsSnapshot(snapshot: RoomRollAwardsSnapshot): void {
    publishRoomEvent(snapshot.roomId, {
        type: 'roll_awards.updated',
        snapshot
    });
}
