import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import type { BagSnapshot } from '../../server/core/types/bag.types';
import type { RoomRealtimeEvent } from '../../server/core/types/data.types';

Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { protocol: 'http:', hostname: 'localhost' }, setTimeout, clearTimeout } });
class TestSocket extends EventTarget {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  constructor(_url: string) { super(); TestSocket.instances.push(this); }
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  emit(payload: object) { const event = new Event('message'); Object.defineProperty(event, 'data', { value: JSON.stringify(payload) }); this.dispatchEvent(event); }
  close(code = 1000) { this.readyState = 3; const event = new Event('close'); Object.defineProperty(event, 'code', { value: code }); this.dispatchEvent(event); }
}
Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: TestSocket });
const { DiscordService } = await import('../modules/discord-auth/services/discord.service');
DiscordService.getInstance().getValidAuth = async () => ({ tokenType: 'Bearer', accessToken: 'test-token', expiresAt: Date.now() + 3600000, expiresIn: 3600, scope: '', state: '' });
const { getRealtimeUrl } = await import('../modules/discord-auth/utils/urls.utils');
const { RoomRealtimeService } = await import('../core/services/room-realtime.service');
const { useRoomsStore } = await import('../core/stores/rooms.store');
const tick = () => new Promise(resolve => setImmediate(resolve));
let eventId = 0;
const frame = (payload: object) => ({ eventId: String(++eventId), roomId: 'room', occurredAt: new Date().toISOString(), ...payload }) as RoomRealtimeEvent;
const bag = (revision = 1): BagSnapshot => ({ id: 'team-bag', scope: 'team', revision, sections: [], templates: [], items: [] });

test('room socket URL stays valid when no explicit backend port is configured', () => {
  assert.equal(getRealtimeUrl('room name'), 'ws://localhost/ws/rooms/room%20name');
});

test('Bag subscribes only after authentication, receives pushed state and restores subscription/presence after reconnect', async () => {
  const service = new RoomRealtimeService();
  const events: RoomRealtimeEvent[] = [];
  service.connect('room', { onEvent: event => events.push(event), onReady: () => {}, onStatus: () => {}, onTerminalClose: () => {} });
  try {
    const socket = TestSocket.instances.at(-1)!;
    const reading = service.subscribeBag('team');
    service.sendBagPresence({ scope: 'team', state: 'editing', target: 'item', itemId: 'item' });
    assert.equal(socket.sent.length, 0);
    socket.open(); await tick();
    assert.deepEqual(socket.sent.map(frame => frame.type), ['authenticate']);
    socket.emit(frame({ type: 'connection.ready' }));
    assert.deepEqual(socket.sent.map(frame => frame.type), ['authenticate', 'bag.subscribe', 'bag.presence']);
    const requestId = socket.sent.find(frame => frame.type === 'bag.subscribe')!.requestId;
    socket.emit(frame({ type: 'bag.snapshot', snapshot: bag(), requestId }));
    assert.equal((await reading).revision, 1);
    // A push without a requestId is the usual live-update path.
    socket.emit(frame({ type: 'bag.snapshot', snapshot: bag(2) }));
    assert.equal(events.at(-1)?.type, 'bag.snapshot');
    socket.close(1006);
    service.sendBagPresence({ scope: 'team', state: 'adding', target: 'section' });
    await new Promise(resolve => setTimeout(resolve, 1300));
    const replacement = TestSocket.instances.at(-1)!; assert.notEqual(replacement, socket);
    replacement.open(); await tick(); replacement.emit(frame({ type: 'connection.ready' }));
    assert.deepEqual(replacement.sent.map(frame => frame.type), ['authenticate', 'bag.subscribe', 'bag.presence']);
    assert.equal(replacement.sent[1]!.scope, 'team'); assert.equal(replacement.sent[2]!.target, 'section');
    service.unsubscribeBag(); assert.equal(replacement.sent.at(-1)?.type, 'bag.unsubscribe');
  } finally { service.disconnect(); }
});

test('Bag scope changes cancel stale reads and subscription errors reject the correct request', async () => {
  const service = new RoomRealtimeService();
  service.connect('room', { onEvent: () => {}, onReady: () => {}, onStatus: () => {}, onTerminalClose: () => {} });
  try {
    const socket = TestSocket.instances.at(-1)!; socket.open(); await tick(); socket.emit(frame({ type: 'connection.ready' }));
    const previous = service.subscribeBag('team'); const cancelled = assert.rejects(previous, /scope changed/);
    const personal = service.subscribeBag('personal'); await cancelled;
    const requestId = socket.sent.at(-1)!.requestId;
    const rejected = assert.rejects(personal, /denied/);
    socket.emit(frame({ type: 'bag.error', scope: 'personal', requestId, code: 'forbidden', message: 'Bag access denied' }));
    await rejected;
  } finally { service.disconnect(); }
});

test('Bag snapshots and activity apply during chat hydration, ignore stale/cross-scope state and clear on access loss', () => {
  setActivePinia(createPinia()); const store = useRoomsStore();
  store.selectedRoomId = 'room'; store.selectedRoomUserId = 'alice'; store.bagScope = 'team'; store.realtimeHydrated = false;
  store.receiveRealtimeEvent(frame({ type: 'bag.snapshot', snapshot: bag(3) }));
  assert.equal(store.bagSnapshots.team?.revision, 3);
  store.receiveRealtimeEvent(frame({ type: 'bag.snapshot', snapshot: bag(2) }));
  assert.equal(store.bagSnapshots.team?.revision, 3);
  const presence = [{ userId: 'bob', scope: 'team' as const, state: 'editing' as const, target: 'item' as const, itemId: 'item', sectionId: null, expiresAt: Date.now() + 30000 }];
  store.receiveRealtimeEvent(frame({ type: 'bag.presence', scope: 'team', presence })); assert.deepEqual(store.bagPresence.team, presence);
  store.receiveRealtimeEvent(frame({ type: 'bag.snapshot', snapshot: { ...bag(8), id: 'personal-bag', scope: 'personal' } }));
  assert.equal(store.bagSnapshots.personal, undefined);
  store.receiveRealtimeEvent({ ...frame({ type: 'bag.snapshot', snapshot: bag(9) }), roomId: 'other-room' });
  assert.equal(store.bagSnapshots.team?.revision, 3);
  store.receiveRealtimeEvent(frame({ type: 'bag.error', scope: 'team', code: 'forbidden', message: 'Bag access denied' }));
  assert.equal(store.bagSnapshots.team, undefined); assert.equal(store.bagPresence.team.length, 0); assert.equal(store.bagSyncError, 'Bag access denied');
  store.receiveRealtimeEvent(frame({ type: 'bag.snapshot', snapshot: bag(4) })); assert.equal(store.bagSyncError, null);
  store.closeBag(); assert.equal(store.bagScope, null); assert.deepEqual(store.bagSnapshots, {});
});

test('inspection targets isolate reads and stale events, suppress presence, and replay after reconnect', async () => {
  const service = new RoomRealtimeService();
  service.connect('room', { onEvent: () => {}, onReady: () => {}, onStatus: () => {}, onTerminalClose: () => {} });
  try {
    const socket = TestSocket.instances.at(-1)!; socket.open(); await tick(); socket.emit(frame({ type: 'connection.ready' }));
    const first = service.subscribeBag('personal', 'bob');
    const cancelled = assert.rejects(first, /scope changed/);
    const second = service.subscribeBag('personal', 'carol');
    await cancelled;
    const requestId = socket.sent.at(-1)!.requestId;
    const inspected = { ...bag(), scope: 'personal' as const, targetUserId: 'carol' };
    socket.emit(frame({ type: 'bag.snapshot', requestId, snapshot: { ...inspected, targetUserId: 'bob' } }));
    socket.emit(frame({ type: 'bag.snapshot', requestId, snapshot: inspected }));
    assert.equal((await second).targetUserId, 'carol');
    const count = socket.sent.length;
    service.sendBagPresence({ scope: 'personal', state: 'editing', target: 'item', itemId: 'forged' });
    assert.equal(socket.sent.length, count);
    socket.close(1006);
    await new Promise(resolve => setTimeout(resolve, 1300));
    const replacement = TestSocket.instances.at(-1)!;
    replacement.open(); await tick(); replacement.emit(frame({ type: 'connection.ready' }));
    assert.equal(replacement.sent[1]!.targetUserId, 'carol');
    assert.equal(replacement.sent.some(frame => frame.type === 'bag.presence'), false);
  } finally { service.disconnect(); }
});

test('inspection store ignores another target snapshots/errors and private presence', () => {
  setActivePinia(createPinia()); const store = useRoomsStore();
  store.selectedRoomId = 'room'; store.selectedRoomUserId = 'alice'; store.bagScope = 'personal'; store.bagTargetUserId = 'bob';
  const inspected = { ...bag(), scope: 'personal' as const, targetUserId: 'bob' };
  store.receiveRealtimeEvent(frame({ type: 'bag.snapshot', snapshot: inspected }));
  store.receiveRealtimeEvent(frame({ type: 'bag.snapshot', snapshot: { ...inspected, targetUserId: 'carol', revision: 99 } }));
  store.receiveRealtimeEvent(frame({ type: 'bag.error', scope: 'personal', targetUserId: 'carol', message: 'stale error' }));
  store.receiveRealtimeEvent(frame({ type: 'bag.presence', scope: 'personal', presence: [{ userId: 'bob' }] }));
  assert.equal(store.bagSnapshots.personal?.targetUserId, 'bob');
  assert.equal(store.bagSyncError, null); assert.deepEqual(store.bagPresence.personal, []);
  store.receiveRealtimeEvent(frame({ type: 'bag.error', scope: 'personal', targetUserId: 'bob', message: 'Bag access denied' }));
  assert.equal(store.bagSnapshots.personal, undefined); assert.equal(store.bagSyncError, 'Bag access denied');
  store.closeBag(); assert.equal(store.bagTargetUserId, undefined);
});
