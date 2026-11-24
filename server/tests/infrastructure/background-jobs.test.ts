import assert from 'node:assert/strict';
import test from 'node:test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/aventyr_jobs_unused';
const { startBackgroundJobs } = await import('../../app/background-jobs');

test('background jobs retain intervals, prevent overlap, recover from failures and stop cleanly', async () => {
    const timers: Array<{ run: () => void; interval: number; cancelled: boolean }> = [];
    let calls = 0;
    let bagCalls = 0;
    let finish: (() => void) | undefined;
    const stop = startBackgroundJobs({
        cleanupArticleImages: async () => { calls++; await new Promise<void>(resolve => { finish = resolve; }); },
        cleanupBagImages: async () => { if (++bagCalls === 1) throw new Error('expected cleanup failure'); },
        expireInactiveSessions: async () => [],
    }, { every(run, interval) {
        const timer = { run, interval, cancelled: false };
        timers.push(timer);
        return () => { timer.cancelled = true; };
    } });
    assert.deepEqual(timers.map(timer => timer.interval), [3_600_000, 3_600_000, 30_000]);
    timers[0]!.run(); timers[0]!.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    timers[1]!.run();
    await new Promise(resolve => setImmediate(resolve));
    timers[1]!.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(bagCalls, 2);
    let stopped = false;
    const pendingStop = stop().then(() => { stopped = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stopped, false);
    finish!();
    await pendingStop;
    assert.ok(timers.every(timer => timer.cancelled));
    timers[0]!.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    await stop();
});
