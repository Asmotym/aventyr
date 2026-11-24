import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyTalentPlayer, type TalentSnapshot } from '../../server/core/types/talents.types';
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { protocol: 'http:', hostname: 'localhost' } } });
const { DiscordService } = await import('../modules/discord-auth/services/discord.service');
DiscordService.getInstance().getValidAuth = async () => null;
const { talentRoom } = await import('../core/services/talents.service');
function snapshot(revision: number, canManage = true): TalentSnapshot { return { revision, canManage, settings: { enabled: true, globalEnabled: true, maxGlobal: 0 }, player: emptyTalentPlayer(), trees: [], states: {} }; }
const response = (talents: TalentSnapshot) => new Response(JSON.stringify({ success: true, data: { talents } }));
const tick = () => new Promise(resolve => setImmediate(resolve));
test('delayed realtime reads cannot roll back a committed talent mutation', async () => {
    const fetch = globalThis.fetch;
    try {
        const pending: ((response: Response) => void)[] = [];
        globalThis.fetch = async () => new Promise<Response>(resolve => pending.push(resolve));
        const room = talentRoom('sync-race', 'alice');
        const initial = room.load(); await tick(); pending.shift()!(response(snapshot(0))); await initial;
        const writing = room.mutate({ op: 'balance', targetUserId: 'alice', points: 3 }); await tick();
        const reading = room.load(); await tick();
        pending[0]!(response(snapshot(1))); await writing;
        pending[1]!(response(snapshot(0))); await reading;
        assert.equal(room.state.snapshot?.revision, 1);
    } finally { globalThis.fetch = fetch; }
});
test('a newer permissions read wins over a delayed mutation response at the same revision', async () => {
    const fetch = globalThis.fetch;
    try {
        const pending: ((response: Response) => void)[] = [];
        globalThis.fetch = async () => new Promise<Response>(resolve => pending.push(resolve));
        const room = talentRoom('sync-rights', 'alice');
        const initial = room.load(); await tick(); pending.shift()!(response(snapshot(0))); await initial;
        const writing = room.mutate({ op: 'balance', targetUserId: 'alice', points: 3 }); await tick();
        const reading = room.load(); await tick(); pending[1]!(response(snapshot(1, false))); await reading;
        pending[0]!(response(snapshot(1, true))); await writing;
        assert.equal(room.state.snapshot?.canManage, false);
    } finally { globalThis.fetch = fetch; }
});
