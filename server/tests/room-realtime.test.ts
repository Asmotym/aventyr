import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createRoomRealtimeEvent,
    parseRoomRealtimeAuthentication,
    readRealtimeRoomId,
    toRealtimeRoom
} from '../realtime/room-realtime.protocol';
import type { RoomDetails, RoomMessage } from '../core/types/data.types';

test('room realtime authentication accepts only non-empty bearer credentials', () => {
    const valid = parseRoomRealtimeAuthentication(Buffer.from(JSON.stringify({
        type: 'authenticate',
        tokenType: 'bearer',
        accessToken: 'sensitive-token'
    })));
    assert.deepEqual(valid, {
        type: 'authenticate',
        tokenType: 'Bearer',
        accessToken: 'sensitive-token'
    });

    assert.equal(parseRoomRealtimeAuthentication(Buffer.from('{}')), null);
    assert.equal(parseRoomRealtimeAuthentication(Buffer.from('not-json')), null);
    assert.equal(parseRoomRealtimeAuthentication(Buffer.from(JSON.stringify({
        type: 'authenticate',
        tokenType: 'Basic',
        accessToken: 'value'
    }))), null);
});

test('room realtime route accepts only the exact room WebSocket path', () => {
    assert.equal(readRealtimeRoomId('/ws/rooms/room%201', 'localhost'), 'room 1');
    assert.equal(readRealtimeRoomId('/api/rooms/room-1', 'localhost'), null);
    assert.equal(readRealtimeRoomId('/ws/rooms/room-1/extra', 'localhost'), null);
});

test('published events contain routing metadata without viewer-specific room state', () => {
    const room: RoomDetails = {
        id: 'room-1',
        name: 'Room',
        inviteCode: 'ABC123',
        isProtected: false,
        memberCount: 2,
        isCreator: true,
        canArchive: true
    };
    assert.equal('isCreator' in toRealtimeRoom(room), false);
    assert.equal('canArchive' in toRealtimeRoom(room), false);

    const message: RoomMessage = {
        id: 'message-1',
        roomId: room.id,
        userId: 'user-1',
        type: 'text',
        content: 'hello',
        createdAt: new Date().toISOString()
    };
    const event = createRoomRealtimeEvent(room.id, { type: 'message.created', message });
    assert.equal(event.type, 'message.created');
    assert.equal(event.roomId, room.id);
    assert.ok(event.eventId);
    assert.ok(event.occurredAt);
    assert.equal(JSON.stringify(event).includes('sensitive-token'), false);
});
