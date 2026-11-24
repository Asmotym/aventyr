import assert from 'node:assert/strict';
import test from 'node:test';
import { copyText } from '../../../src/shared/utils/clipboard';

test('clipboard uses the native API, propagates rejection and cleans up fallback fields', async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let copied = '';
  let removed = 0;
  const field = { value: '', style: {}, select() {} };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (value: string) => { copied = value; } } } });
    await copyText('native'); assert.equal(copied, 'native');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => field, body: { appendChild() {}, removeChild() { removed++; } }, execCommand: () => true } });
    await copyText('fallback'); assert.equal(field.value, 'fallback'); assert.equal(removed, 1);
    document.execCommand = () => { throw new Error('denied'); };
    await assert.rejects(copyText('failed'), /denied/); assert.equal(removed, 2);
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor); else Reflect.deleteProperty(globalThis, 'navigator');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
  }
});
