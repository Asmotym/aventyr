import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import type { RoomSession, RoomSessionStartPreparation } from '../../server/core/types/data.types';

const tick = () => new Promise(resolve => setImmediate(resolve));
const candidate = { award: { id: 'award', roomId: 'room', name: 'Award', diceResults: [20] }, users: [{ userId: 'player', displayName: 'Player', count: 1 }] };
const pending: RoomSessionStartPreparation = { session: null, previousSessionId: 'previous', candidates: [candidate], request: { id: 'request', roomId: 'room', previousSessionId: 'previous', status: 'pending', sessionId: null } };
const session: RoomSession = { id: 'session', roomId: 'room', startedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), startReason: 'activity',
    configuration: { rollAwards: { enabled: true, awards: [] }, criticals: [], bonusPoints: { roomId: 'room', enabled: false, maxPointsPerUser: 0, allowExtremeSpend: false, rules: [] } },
    recap: { messageCount: 0, rollCount: 0, durationSeconds: 0, rollAwards: [], criticals: [], bonusPoints: { awarded: 0, used: 0, users: [] } }, ownedAwards: [] };

// The room service resolves its HTTP origin at import time.
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { protocol: 'http:', hostname: 'localhost' } } });
const { RoomsService, RoomRequestError } = await import('../core/services/rooms.service');
const { useRoomsStore } = await import('../core/stores/rooms.store');

test('shared start gate holds text and send-as rolls, then transmits each original payload once', async () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    store.selectedRoomId = 'room'; store.selectedRoomUserId = 'leader';
    let preparation = structuredClone(pending);
    RoomsService.prepareSessionStart = async (_room, actor) => { assert.equal(actor, 'leader'); return structuredClone(preparation); };
    const sent: Array<Parameters<typeof RoomsService.sendMessage>[0]> = [];
    RoomsService.sendMessage = async payload => {
        sent.push(payload);
        return { id: String(sent.length), roomId: 'room', userId: payload.userId, type: payload.type, createdAt: new Date().toISOString() };
    };
    store.loadBonusPoints = async () => undefined;
    RoomsService.startSession = async payload => { assert.deepEqual(payload.selections, [{ awardId: 'award', userId: 'player' }]); preparation = { ...pending, session, candidates: [] }; return session; };
    const text = store.sendChatMessage({ roomId: 'room', userId: 'leader', content: 'hello' });
    const roll = store.sendDiceRoll({ roomId: 'room', userId: 'player', roll: { dice: 'd20', result: 17, total: 17, rolls: [17] } });
    await tick();
    assert.deepEqual(sent, []);
    assert.equal(store.pendingActivityCount, 2);
    await store.confirmSessionStart([{ awardId: 'award', userId: 'player' }]);
    await Promise.all([text, roll]);
    assert.deepEqual(sent.map(payload => payload.type), ['text', 'dice']);
    assert.equal(sent[1].userId, 'player');
    assert.deepEqual(sent[1].dice?.rolls, [17]);
    assert.equal(store.pendingActivityCount, 0);
});

test('leader cancellation restores drafts and retains original dice for an explicit retry', async () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    store.selectedRoomId = 'room'; store.selectedRoomUserId = 'player';
    RoomsService.prepareSessionStart = async () => structuredClone(pending);
    let sends = 0;
    RoomsService.sendMessage = async () => { sends++; throw new Error('Should not send'); };
    const text = store.sendChatMessage({ roomId: 'room', userId: 'player', content: 'draft' });
    const dice = store.sendDiceRoll({ roomId: 'room', userId: 'player', roll: { dice: 'd20', result: 13, total: 13, rolls: [13] } });
    await tick();
    store.applyStartCancellation({ ...pending.request!, status: 'cancelled' });
    await Promise.all([text, dice]);
    assert.equal(sends, 0);
    assert.equal(store.restoredDraft, 'draft');
    assert.deepEqual(store.retainedActivities[0].payload.dice?.rolls, [13]);
});

test('reconnect reads release waiting sends after the leader starts elsewhere', async () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    store.selectedRoomId = 'room'; store.selectedRoomUserId = 'player';
    let preparation = structuredClone(pending);
    RoomsService.prepareSessionStart = async () => structuredClone(preparation);
    let sends = 0;
    RoomsService.sendMessage = async () => { sends++; return { id: 'message', roomId: 'room', userId: 'player', type: 'text', createdAt: new Date().toISOString() }; };
    const sending = store.sendChatMessage({ roomId: 'room', userId: 'player', content: 'waiting' });
    await tick();
    preparation = { ...pending, session, candidates: [] };
    await store.loadSession('room');
    await sending;
    assert.equal(sends, 1);
});

test('inactivity conflicts re-enter selection, while ambiguous network failures are retained without resending', async () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    store.selectedRoomId = 'room'; store.selectedRoomUserId = 'player';
    let preparation: RoomSessionStartPreparation = { ...pending, session, candidates: [] };
    RoomsService.prepareSessionStart = async () => structuredClone(preparation);
    let sends = 0;
    RoomsService.sendMessage = async () => {
        sends++;
        if (sends === 1) { preparation = pending; throw new RoomRequestError('Expired', 'session_start_required'); }
        throw new Error('Unknown send outcome');
    };
    const sending = store.sendChatMessage({ roomId: 'room', userId: 'player', content: 'retry gate' });
    await tick();
    assert.equal(sends, 1);
    preparation = { ...pending, session, candidates: [] };
    await store.loadSession('room');
    await sending;
    assert.equal(sends, 2);
    assert.equal(store.retainedActivities.length, 1);
});

test('a cancellation received during preparation cannot leave a new waiter stuck', async () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    store.selectedRoomId = 'room'; store.selectedRoomUserId = 'player';
    let resolvePreparation!: (preparation: RoomSessionStartPreparation) => void;
    let calls = 0;
    RoomsService.prepareSessionStart = async () => {
        calls++;
        if (calls === 1) return new Promise(resolve => { resolvePreparation = resolve; });
        return { ...structuredClone(pending), request: { ...pending.request!, status: 'cancelled' } };
    };
    let sends = 0;
    RoomsService.sendMessage = async () => { sends++; throw new Error('Should not send'); };
    const sending = store.sendChatMessage({ roomId: 'room', userId: 'player', content: 'draft' });
    await tick();
    store.applyStartCancellation({ ...pending.request!, status: 'cancelled' });
    resolvePreparation(structuredClone(pending));
    await sending;
    assert.equal(sends, 0);
    assert.equal(store.restoredDraft, 'draft');
    assert.equal(store.pendingActivityCount, 0);
});

test('an empty award list lets a non-leader send without opening a modal', async () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    store.selectedRoomId = 'room'; store.selectedRoomUserId = 'player';
    RoomsService.prepareSessionStart = async () => ({ session: null, candidates: [], previousSessionId: null, request: null });
    let sends = 0;
    RoomsService.sendMessage = async () => { sends++; return { id: 'message', roomId: 'room', userId: 'player', type: 'text', createdAt: new Date().toISOString() }; };
    await store.sendChatMessage({ roomId: 'room', userId: 'player', content: 'start automatically' });
    assert.equal(sends, 1);
    assert.equal(store.startPreparation?.request, null);
});

test('a delayed session snapshot cannot make a consumed award available again', () => {
    setActivePinia(createPinia());
    const store = useRoomsStore();
    const assignment = { id: 'assignment', sessionId: session.id, sourceSessionId: 'previous', userId: 'player', award: candidate.award, usedAt: new Date().toISOString(), usageMessageId: 'usage' };
    store.currentSession = { ...session, ownedAwards: [assignment] };
    store.applyCurrentSession({ ...session, ownedAwards: [{ ...assignment, usedAt: null, usageMessageId: null }] });
    assert.equal(store.currentSession!.ownedAwards![0].usageMessageId, 'usage');
});
