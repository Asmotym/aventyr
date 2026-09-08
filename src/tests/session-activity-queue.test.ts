import assert from 'node:assert/strict';
import test from 'node:test';
import { SessionActivityQueue, SessionStartCancelledError } from '../core/utils/session-activity-queue';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('messages and original dice results remain local until approval, then drain in order once', async () => {
    const queue = new SessionActivityQueue();
    let approve!: () => void;
    const gate = new Promise<void>(resolve => { approve = resolve; });
    const sent: unknown[] = [];
    const dice = { notation: 'd20', rolls: [17], total: 17 };
    const first = queue.enqueue(async check => { await gate; check(); sent.push('message'); });
    const second = queue.enqueue(async check => { await gate; check(); sent.push(dice); });
    await tick();
    assert.deepEqual(sent, []);
    approve();
    await Promise.all([first, second]);
    assert.deepEqual(sent, ['message', dice]);
});

test('cancellation prevents all pending sends and allows an explicit retry with the same roll', async () => {
    const queue = new SessionActivityQueue();
    let approve!: () => void;
    const gate = new Promise<void>(resolve => { approve = resolve; });
    let sends = 0;
    const first = queue.enqueue(async check => { await gate; check(); sends++; });
    const second = queue.enqueue(async () => { sends++; });
    const assertions = [assert.rejects(first, SessionStartCancelledError), assert.rejects(second, SessionStartCancelledError)];
    await tick();
    queue.cancel();
    approve();
    await Promise.all(assertions);
    assert.equal(sends, 0);
    await queue.enqueue(async () => { sends++; });
    assert.equal(sends, 1);
});

test('ambiguous send failures are never automatically retried', async () => {
    const queue = new SessionActivityQueue();
    let attempts = 0;
    await assert.rejects(queue.enqueue(async () => { attempts++; throw new Error('Connection lost after sending'); }));
    await tick();
    assert.equal(attempts, 1);
});
