import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { APP_STORAGE_KEY, appStorage } from '../core/services/app-storage.service';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();

function storedState(theme: 'dark' | 'light', locale: 'en' | 'fr') {
  return {
    version: 1,
    theme,
    locale,
    discord: { user: null, auth: null, oauthState: null },
    ui: { chatWidthPercent: 45 },
  };
}

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
});

test('migrates the unified Rolz state to the Aventyr storage key', () => {
  storage.setItem('rolz_global_state', JSON.stringify(storedState('light', 'fr')));

  assert.equal(appStorage.getTheme(), 'light');
  assert.equal(appStorage.getLocale(), 'fr');
  assert.equal(storage.getItem('rolz_global_state'), null);
  assert.ok(storage.getItem(APP_STORAGE_KEY));
});

test('migrates granular legacy settings and removes their old keys', () => {
  storage.setItem('rolz_theme', 'light');
  storage.setItem('locale', 'fr');
  storage.setItem('rolz-room-chat-width', '55');

  assert.equal(appStorage.getTheme(), 'light');
  assert.equal(appStorage.getLocale(), 'fr');
  assert.equal(appStorage.getChatWidthPercent(), 55);
  assert.equal(storage.getItem('rolz_theme'), null);
  assert.equal(storage.getItem('locale'), null);
  assert.equal(storage.getItem('rolz-room-chat-width'), null);
});

test('a corrupt Aventyr state resets safely instead of loading stale Rolz state', () => {
  storage.setItem(APP_STORAGE_KEY, '{invalid');
  storage.setItem('rolz_global_state', JSON.stringify(storedState('light', 'fr')));

  assert.equal(appStorage.getTheme(), null);
  assert.equal(storage.getItem('rolz_global_state'), null);
  assert.doesNotThrow(() => JSON.parse(storage.getItem(APP_STORAGE_KEY) ?? ''));
});

test('a valid Aventyr state takes precedence and cleans up stale Rolz state', () => {
  storage.setItem(APP_STORAGE_KEY, JSON.stringify(storedState('light', 'fr')));
  storage.setItem('rolz_global_state', JSON.stringify(storedState('dark', 'en')));

  assert.equal(appStorage.getTheme(), 'light');
  assert.equal(storage.getItem('rolz_global_state'), null);
});

test('stores the selected theme style alongside the light or dark preference', () => {
  appStorage.setTheme('light');
  appStorage.setThemeStyle('explorer');

  assert.equal(appStorage.getTheme(), 'light');
  assert.equal(appStorage.getThemeStyle(), 'explorer');
});

test('retains authentication and cached users whose profile language is unset', () => {
  const user = { id: 'user', username: 'User', avatar: '', locale: null };
  storage.setItem(APP_STORAGE_KEY, JSON.stringify({
    ...storedState('dark', 'en'),
    discord: { user, auth: null, oauthState: null },
  }));
  assert.deepEqual(appStorage.getDiscordUser(), user);
  assert.equal(appStorage.getLocale(), 'en');
});
