import assert from 'node:assert/strict';
import test from 'node:test';
import { notifications } from '../core/services/notifications.service';

test('effect notification messages queue and display in order', () => {
    notifications.enqueue('First'); notifications.enqueue('Second'); notifications.enqueue('Third');
    assert.equal(notifications.current.value?.message, 'First');
    notifications.close(); assert.equal(notifications.current.value?.message, 'Second');
    notifications.close(); assert.equal(notifications.current.value?.message, 'Third');
    notifications.close(); assert.equal(notifications.current.value, null);
});

test('queued notifications retain severity and duration', () => {
    notifications.enqueue('First');
    notifications.enqueue('Persistent warning', 'warning', -1);
    notifications.close();
    assert.equal(notifications.current.value?.type, 'warning');
    assert.equal(notifications.current.value?.timeout, -1);
    notifications.close();
    notifications.enqueue('Default');
    assert.equal(notifications.current.value?.type, 'info');
    assert.equal(notifications.current.value?.timeout, 3500);
    notifications.close();
});
