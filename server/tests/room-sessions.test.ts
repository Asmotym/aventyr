import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSessionInactivityMinutes } from '../services/rooms/rooms.normalizers';
import { createRoomRealtimeEvent } from '../realtime/room-realtime.protocol';
import type { RoomSession } from '../core/types/data.types';

test('session inactivity accepts only whole minutes in the supported range', () => {
    assert.equal(normalizeSessionInactivityMinutes(1), 1);
    assert.equal(normalizeSessionInactivityMinutes(240), 240);
    assert.equal(normalizeSessionInactivityMinutes(10_080), 10_080);
    for (const invalid of [0, 10_081, 1.5, Number.NaN]) {
        assert.throws(() => normalizeSessionInactivityMinutes(invalid));
    }
});

test('session realtime events retain the immutable recap payload', () => {
    const session: RoomSession = {
        id: 'session-1', roomId: 'room-1', startedAt: '2026-01-01T10:00:00.000Z',
        lastActivityAt: '2026-01-01T11:00:00.000Z', endedAt: '2026-01-01T11:30:00.000Z',
        startReason: 'manual', closeReason: 'manual',
        configuration: {
            rollAwards: { enabled: false, awards: [] }, criticals: [],
            bonusPoints: { roomId: 'room-1', enabled: false, maxPointsPerUser: 0, allowExtremeSpend: false, rules: [] }
        },
        recap: { messageCount: 4, rollCount: 3, durationSeconds: 5400, rollAwards: [], criticals: [], bonusPoints: { awarded: 0, used: 0, users: [] } }
    };
    const event = createRoomRealtimeEvent('room-1', { type: 'session.closed', session });
    assert.equal(event.type, 'session.closed');
    if (event.type === 'session.closed') assert.deepEqual(event.session.recap, session.recap);
});
