import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref } from 'vue';
import { notifications } from '@/shared/services/notifications.service';
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';

test('errors notify once per change, retry after clearing, and stop on scope disposal', () => {
  const error = ref<string | null>(null);
  const scope = effectScope();
  scope.run(() => useErrorNotifications(() => error.value));
  try {
    error.value = 'Save failed';
    assert.equal(notifications.current.value?.message, 'Save failed');
    assert.equal(notifications.current.value?.type, 'error');
    const first = notifications.current.value!.id;
    error.value = 'Save failed';
    assert.equal(notifications.current.value!.id, first);
    error.value = null; error.value = 'Save failed';
    assert.ok(notifications.current.value!.id > first);
    scope.stop(); notifications.close();
    error.value = 'Late response';
    assert.equal(notifications.current.value, null);
  } finally { scope.stop(); notifications.close(); }
});

test('validation arrays normalize to a single notification without empty or duplicate messages', () => {
  const errors = ref<string[]>([]);
  const scope = effectScope();
  scope.run(() => useErrorNotifications(() => errors.value));
  try {
    errors.value = ['Required', '', 'Required', 'Invalid format'];
    assert.equal(notifications.current.value?.message, 'Required\nInvalid format');
    const first = notifications.current.value!.id;
    errors.value = ['Required', 'Invalid format'];
    assert.equal(notifications.current.value!.id, first);
  } finally { scope.stop(); notifications.close(); }
});

test('clearing an error dismisses only the notification owned by that observer', () => {
  const error = ref<string | null>('First error');
  const scope = effectScope();
  scope.run(() => useErrorNotifications(() => error.value));
  try {
    error.value = null;
    assert.equal(notifications.current.value, null);
    error.value = 'First error';
    notifications.info('Another operation completed');
    error.value = null;
    assert.equal(notifications.current.value?.message, 'Another operation completed');
  } finally { scope.stop(); notifications.close(); }
});
