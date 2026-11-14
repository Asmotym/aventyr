import type { DiscordAuth, DiscordUser } from 'netlify/core/types/discord.types';
import type { UserRole } from 'netlify/core/types/data.types';
import {
  isAppTheme,
  isAppThemeStyle,
  type AppTheme,
  type AppThemeStyle,
} from 'netlify/core/types/theme.types';
import { isAppLocale, type AppLocale } from 'netlify/core/types/locale.types';

export const APP_STORAGE_KEY = 'aventyr_global_state';
const LEGACY_APP_STORAGE_KEY = 'rolz_global_state';

const APP_STORAGE_VERSION = 1;
const LEGACY_THEME_KEY = 'rolz_theme';
const LEGACY_LOCALE_KEY = 'locale';
const LEGACY_DISCORD_USER_KEY = 'discord_user';
const LEGACY_DISCORD_AUTH_KEY = 'discord_auth';
const LEGACY_DISCORD_OAUTH_STATE_KEY = 'discord_oauth_state';
const LEGACY_CHAT_WIDTH_KEY = 'rolz-room-chat-width';
const LEGACY_STORAGE_KEYS = [
  LEGACY_APP_STORAGE_KEY,
  LEGACY_THEME_KEY,
  LEGACY_LOCALE_KEY,
  LEGACY_DISCORD_USER_KEY,
  LEGACY_DISCORD_AUTH_KEY,
  LEGACY_DISCORD_OAUTH_STATE_KEY,
  LEGACY_CHAT_WIDTH_KEY,
];

export type StoredLocale = AppLocale;

interface AppStorageState {
  version: typeof APP_STORAGE_VERSION;
  theme: AppTheme | null;
  themeStyle: AppThemeStyle | null;
  locale: StoredLocale | null;
  discord: {
    user: DiscordUser | null;
    auth: DiscordAuth | null;
    oauthState: string | null;
  };
  ui: {
    chatWidthPercent: number | null;
  };
}

type AppStorageWriter = (state: AppStorageState) => AppStorageState;

function createDefaultState(): AppStorageState {
  return {
    version: APP_STORAGE_VERSION,
    theme: null,
    themeStyle: null,
    locale: null,
    discord: {
      user: null,
      auth: null,
      oauthState: null,
    },
    ui: {
      chatWidthPercent: null,
    },
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function readJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'admin' || value === 'user';
}

function isDiscordAuth(value: unknown): value is DiscordAuth {
  if (!isRecord(value)) return false;
  return (
    typeof value.tokenType === 'string' &&
    typeof value.accessToken === 'string' &&
    (value.refreshToken === undefined || typeof value.refreshToken === 'string') &&
    typeof value.expiresIn === 'number' &&
    Number.isFinite(value.expiresIn) &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt) &&
    typeof value.scope === 'string' &&
    typeof value.state === 'string'
  );
}

function isDiscordUser(value: unknown): value is DiscordUser {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    typeof value.avatar === 'string' &&
    (value.aboutMe === undefined || typeof value.aboutMe === 'string') &&
    (value.theme === undefined || isAppTheme(value.theme)) &&
    (value.themeStyle === undefined || isAppThemeStyle(value.themeStyle)) &&
    (value.locale === undefined || value.locale === null || isAppLocale(value.locale)) &&
    (value.role === undefined || isUserRole(value.role))
  );
}

function normalizeChatWidth(value: unknown): number | null {
  const width = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(width) && width >= 30 && width <= 80) {
    return width;
  }
  return null;
}

function normalizeState(value: unknown): AppStorageState | null {
  if (!isRecord(value) || value.version !== APP_STORAGE_VERSION) return null;

  const state = createDefaultState();
  state.theme = isAppTheme(value.theme) ? value.theme : null;
  state.themeStyle = isAppThemeStyle(value.themeStyle) ? value.themeStyle : null;
  state.locale = isAppLocale(value.locale) ? value.locale : null;

  if (isRecord(value.discord)) {
    state.discord.user = isDiscordUser(value.discord.user) ? value.discord.user : null;
    state.discord.auth = isDiscordAuth(value.discord.auth) ? value.discord.auth : null;
    state.discord.oauthState = typeof value.discord.oauthState === 'string'
      ? value.discord.oauthState
      : null;
  }

  if (isRecord(value.ui)) {
    state.ui.chatWidthPercent = normalizeChatWidth(value.ui.chatWidthPercent);
  }

  return state;
}

function parseStoredState(value: string): { state: AppStorageState | null; corrupt: boolean } {
  try {
    return { state: normalizeState(JSON.parse(value)), corrupt: false };
  } catch {
    return { state: null, corrupt: true };
  }
}

function migrateLegacyState(storage: Storage): AppStorageState {
  const state = createDefaultState();
  const theme = storage.getItem(LEGACY_THEME_KEY);
  const locale = storage.getItem(LEGACY_LOCALE_KEY);
  const discordUser = readJson(storage.getItem(LEGACY_DISCORD_USER_KEY));
  const discordAuth = readJson(storage.getItem(LEGACY_DISCORD_AUTH_KEY));
  const oauthState = storage.getItem(LEGACY_DISCORD_OAUTH_STATE_KEY);

  state.theme = isAppTheme(theme) ? theme : null;
  state.locale = isAppLocale(locale) ? locale : null;
  state.discord.user = isDiscordUser(discordUser) ? discordUser : null;
  state.discord.auth = isDiscordAuth(discordAuth) ? discordAuth : null;
  state.discord.oauthState = typeof oauthState === 'string' ? oauthState : null;
  state.ui.chatWidthPercent = normalizeChatWidth(storage.getItem(LEGACY_CHAT_WIDTH_KEY));

  return state;
}

function writeState(storage: Storage, state: AppStorageState): void {
  storage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
}

function removeLegacyKeys(storage: Storage): void {
  for (const key of LEGACY_STORAGE_KEYS) {
    storage.removeItem(key);
  }
}

function readState(): AppStorageState {
  const storage = getBrowserStorage();
  if (!storage) return createDefaultState();

  const rawState = storage.getItem(APP_STORAGE_KEY);
  const parsedState = rawState ? parseStoredState(rawState) : null;

  if (parsedState?.state) {
    removeLegacyKeys(storage);
    return parsedState.state;
  }

  const rawLegacyState = rawState ? null : storage.getItem(LEGACY_APP_STORAGE_KEY);
  const parsedLegacyState = rawLegacyState ? parseStoredState(rawLegacyState) : null;
  const nextState = parsedState?.corrupt || parsedLegacyState?.corrupt
    ? createDefaultState()
    : parsedLegacyState?.state ?? migrateLegacyState(storage);
  writeState(storage, nextState);
  removeLegacyKeys(storage);
  return nextState;
}

function updateState(writer: AppStorageWriter): void {
  const storage = getBrowserStorage();
  if (!storage) return;

  const nextState = writer(readState());
  writeState(storage, nextState);
}

export const appStorage = {
  getTheme(): AppTheme | null {
    return readState().theme;
  },
  setTheme(theme: AppTheme): void {
    updateState((state) => ({ ...state, theme }));
  },
  getThemeStyle(): AppThemeStyle | null {
    return readState().themeStyle;
  },
  setThemeStyle(themeStyle: AppThemeStyle): void {
    updateState((state) => ({ ...state, themeStyle }));
  },
  getLocale(): StoredLocale | null {
    return readState().locale;
  },
  setLocale(locale: StoredLocale): void {
    updateState((state) => ({ ...state, locale }));
  },
  getDiscordUser(): DiscordUser | null {
    return readState().discord.user;
  },
  setDiscordUser(user: DiscordUser): void {
    updateState((state) => ({
      ...state,
      discord: { ...state.discord, user },
    }));
  },
  removeDiscordUser(): void {
    updateState((state) => ({
      ...state,
      discord: { ...state.discord, user: null },
    }));
  },
  getDiscordAuth(): DiscordAuth | null {
    return readState().discord.auth;
  },
  setDiscordAuth(auth: DiscordAuth): void {
    updateState((state) => ({
      ...state,
      discord: { ...state.discord, auth },
    }));
  },
  removeDiscordAuth(): void {
    updateState((state) => ({
      ...state,
      discord: { ...state.discord, auth: null },
    }));
  },
  getDiscordOauthState(): string | null {
    return readState().discord.oauthState;
  },
  setDiscordOauthState(oauthState: string): void {
    updateState((state) => ({
      ...state,
      discord: { ...state.discord, oauthState },
    }));
  },
  removeDiscordOauthState(): void {
    updateState((state) => ({
      ...state,
      discord: { ...state.discord, oauthState: null },
    }));
  },
  getChatWidthPercent(): number | null {
    return readState().ui.chatWidthPercent;
  },
  setChatWidthPercent(chatWidthPercent: number): void {
    const normalizedWidth = normalizeChatWidth(chatWidthPercent);
    updateState((state) => ({
      ...state,
      ui: { ...state.ui, chatWidthPercent: normalizedWidth },
    }));
  },
};
