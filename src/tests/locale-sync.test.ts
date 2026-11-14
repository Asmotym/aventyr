import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocaleSync } from '../core/services/locale-sync.service';
import { detectPreferredLocale } from '../core/services/locale.service';
import type { AppLocale } from '../../server/core/types/locale.types';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(initial: AppLocale | null = 'fr', detected: AppLocale = 'en') {
  let stored = initial;
  let userId: string | undefined = 'user';
  const saved: Array<[string, AppLocale]> = [];
  const updated: AppLocale[] = [];
  let save: () => Promise<unknown> = async () => {};
  const sync = createLocaleSync({
    getUserId: () => userId,
    getStoredLocale: () => stored,
    detectLocale: () => detected,
    applyLocale: locale => { stored = locale; },
    saveLocale: async (id, locale) => { saved.push([id, locale]); await save(); },
    updateUser: locale => { updated.push(locale); },
  });
  return {
    ...sync, saved, updated,
    get stored() { return stored; },
    setUser(id: string | undefined) { userId = id; sync.reset(); },
    setSave(callback: () => Promise<unknown>) { save = callback; },
  };
}

test('detects supported languages in browser order, normalizes regions and falls back safely', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const [navigator, expected] of [
      [{ languages: ['it-IT', 'FR-ca', 'de-DE'], language: 'es-ES' }, 'fr'],
      [{ languages: ['de-AT', 'fr'], language: 'fr' }, 'de'],
      [{ language: 'ES-mx' }, 'es'],
      [{ languages: ['ja'], language: 'it' }, 'en'],
      [{}, 'en'],
    ] as const) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
      assert.equal(detectPreferredLocale(), expected);
    }
    Reflect.deleteProperty(globalThis, 'navigator');
    assert.equal(detectPreferredLocale(), 'en');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('saved profile wins over cache without writing back or prompting', async () => {
  const f = fixture('fr');
  await f.reconcile('user', 'de');
  assert.equal(f.stored, 'de');
  assert.equal(f.state.choice, null);
  assert.deepEqual(f.saved, []);
});

for (const initial of [null, 'en'] as const) {
  test(`missing profile detects and saves without prompting when cache is ${initial}`, async () => {
    const f = fixture(initial);
    await f.reconcile('user', null);
    assert.equal(f.stored, 'en');
    assert.deepEqual(f.saved, [['user', 'en']]);
    assert.deepEqual(f.updated, ['en']);
    assert.equal(f.state.choice, null);
  });
}

for (const selected of ['fr', 'en'] as const) {
  test(`different cache prompts once and saves the ${selected} choice`, async () => {
    const f = fixture();
    await f.reconcile('user', null);
    assert.deepEqual(f.state.choice, { current: 'fr', detected: 'en' });
    assert.deepEqual(f.saved, []);
    await f.select(selected, true);
    assert.equal(f.stored, selected);
    assert.deepEqual(f.updated, [selected]);
    assert.equal(f.state.choice, null);
    await f.reconcile('user', selected);
    assert.equal(f.state.choice, null);
    assert.equal(f.saved.length, 1);
  });
}

test('failed prompt save stays open with an error and can be retried', async () => {
  const f = fixture();
  await f.reconcile('user', null);
  f.setSave(async () => { throw new Error('offline'); });
  await f.select('en', true);
  assert.ok(f.state.choice);
  assert.equal(f.state.error, true);
  assert.equal(f.state.saving, false);
  assert.deepEqual(f.updated, []);
  f.setSave(async () => {});
  await f.select('en', true);
  assert.equal(f.state.choice, null);
  assert.equal(f.state.error, false);
  assert.deepEqual(f.updated, ['en']);
});

test('failed automatic save exposes a retry', async () => {
  const f = fixture(null);
  f.setSave(async () => { throw new Error('offline'); });
  await f.reconcile('user', null);
  assert.ok(f.state.choice);
  assert.equal(f.state.error, true);
  f.setSave(async () => {});
  await f.select('en', true);
  assert.equal(f.state.choice, null);
});

test('guest manual changes stay local and make no profile requests', async () => {
  const f = fixture(null);
  f.setUser(undefined);
  await f.select('es');
  assert.equal(f.stored, 'es');
  assert.deepEqual(f.saved, []);
});

test('manual change during account loading survives the older profile response', async () => {
  const f = fixture();
  await f.select('es');
  await f.reconcile('user', 'de');
  assert.equal(f.stored, 'es');
  assert.deepEqual(f.updated, ['es']);
});

test('newer manual writes follow in-flight writes and ignore old completions', async () => {
  const f = fixture('en');
  const first = deferred();
  f.setSave(() => first.promise);
  const automatic = f.reconcile('user', null);
  await new Promise<void>(resolve => setImmediate(resolve));
  const manual = f.select('es');
  f.setSave(async () => {});
  first.resolve();
  await Promise.all([automatic, manual]);
  assert.equal(f.stored, 'es');
  assert.deepEqual(f.saved, [['user', 'en'], ['user', 'es']]);
  assert.deepEqual(f.updated, ['es']);
});

test('logout and account switches invalidate pending saves and prompts', async () => {
  const f = fixture('en');
  const pending = deferred();
  f.setSave(() => pending.promise);
  const automatic = f.reconcile('user', null);
  await new Promise<void>(resolve => setImmediate(resolve));
  f.setUser('other');
  await f.reconcile('other', 'de');
  pending.reject(new Error('old account offline'));
  await automatic;
  assert.equal(f.stored, 'de');
  assert.equal(f.state.choice, null);
  assert.equal(f.state.error, false);
  assert.deepEqual(f.updated, []);
  f.setUser(undefined);
  await f.reconcile('user', null);
  assert.equal(f.state.choice, null);
});

test('failed manual save retains local choice and reports failure', async () => {
  const f = fixture();
  f.setSave(async () => { throw new Error('offline'); });
  await assert.rejects(f.select('es'), /offline/);
  assert.equal(f.stored, 'es');
  assert.deepEqual(f.updated, []);
});
