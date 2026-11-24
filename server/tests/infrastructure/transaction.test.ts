import assert from 'node:assert/strict';
import test from 'node:test';
import { runTransaction } from '../../infrastructure/database/transaction';

function connection(failAt?: 'begin' | 'commit') {
    const events: string[] = [];
    return { events,
        async beginTransaction() { events.push('begin'); if (failAt === 'begin') throw new Error('begin'); },
        async commit() { events.push('commit'); if (failAt === 'commit') throw new Error('commit'); },
        async rollback() { events.push('rollback'); },
        release() { events.push('release'); },
    };
}

test('transactions return only after commit and release the lease exactly once', async () => {
    const lease = connection();
    const result = await runTransaction(lease, async current => {
        assert.equal(current, lease);
        current.events.push('write');
        return 'saved';
    });
    assert.equal(result, 'saved');
    assert.deepEqual(lease.events, ['begin', 'write', 'commit', 'release']);
});

test('failed work, begin and commit roll back and always release the connection', async () => {
    for (const stage of ['write', 'begin', 'commit'] as const) {
        const lease = connection(stage === 'write' ? undefined : stage);
        await assert.rejects(runTransaction(lease, async () => {
            lease.events.push('write');
            if (stage === 'write') throw new Error('write');
        }), { message: stage });
        assert.equal(lease.events.filter(event => event === 'release').length, 1);
        assert.equal(lease.events.at(-2), 'rollback');
        assert.equal(lease.events.at(-1), 'release');
    }
});
