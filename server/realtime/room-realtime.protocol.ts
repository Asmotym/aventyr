import { randomUUID } from 'crypto';
import type { RawData } from 'ws';
import type {
    RoomDetails,
    RoomRealtimeAuthenticateMessage,
    RoomRealtimeDetails,
    RoomRealtimeEvent
} from '../core/types/data.types';

export type PublishableRoomEvent = RoomRealtimeEvent extends infer Event
    ? Event extends RoomRealtimeEvent
        ? Omit<Event, 'eventId' | 'roomId' | 'occurredAt'>
        : never
    : never;

export function createRoomRealtimeEvent(
    roomId: string,
    payload: PublishableRoomEvent
): RoomRealtimeEvent {
    return {
        ...payload,
        eventId: randomUUID(),
        roomId,
        occurredAt: new Date().toISOString()
    } as RoomRealtimeEvent;
}

export function toRealtimeRoom(room: RoomDetails): RoomRealtimeDetails {
    const { isCreator: _isCreator, canArchive: _canArchive, ...sharedRoom } = room;
    return sharedRoom;
}

export function parseRoomRealtimeAuthentication(data: RawData): RoomRealtimeAuthenticateMessage | null {
    try {
        const parsed = JSON.parse(data.toString()) as Partial<RoomRealtimeAuthenticateMessage>;
        if (
            parsed.type !== 'authenticate'
            || typeof parsed.accessToken !== 'string'
            || parsed.accessToken.length === 0
            || typeof parsed.tokenType !== 'string'
            || parsed.tokenType.toLowerCase() !== 'bearer'
        ) {
            return null;
        }
        return {
            type: 'authenticate',
            tokenType: 'Bearer',
            accessToken: parsed.accessToken
        };
    } catch {
        return null;
    }
}

export function readRealtimeRoomId(requestUrl: string | undefined, host: string | undefined): string | null {
    if (!requestUrl) return null;
    try {
        const url = new URL(requestUrl, `http://${host ?? 'localhost'}`);
        const match = url.pathname.match(/^\/ws\/rooms\/([^/]+)$/);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    } catch {
        return null;
    }
}

