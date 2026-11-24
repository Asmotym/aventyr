import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, ref } from 'vue';
import { useObjectUrl } from '../../../src/shared/composables/useObjectUrl';

test('image URLs ignore stale requests, revoke replacements, and release on scope disposal', async () => {
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.createObjectURL = blob => `blob:${blob.size}`;
  URL.revokeObjectURL = url => { revoked.push(url); };
  const source = ref('first');
  const pending = new Map<string, (blob: Blob) => void>();
  const scope = effectScope();
  try {
    const url = scope.run(() => useObjectUrl(() => {
      const key = source.value;
      return key ? new Promise<Blob>(resolve => { pending.set(key, resolve); }) : null;
    }))!;
    source.value = 'second'; await nextTick();
    pending.get('first')!(new Blob(['stale'])); await nextTick(); assert.equal(url.value, '');
    pending.get('second')!(new Blob(['ok'])); await nextTick(); assert.equal(url.value, 'blob:2');
    source.value = 'third'; await nextTick(); assert.deepEqual(revoked, ['blob:2']);
    scope.stop(); pending.get('third')!(new Blob(['late'])); await nextTick(); assert.equal(url.value, '');
  } finally {
    scope.stop(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  }
});
