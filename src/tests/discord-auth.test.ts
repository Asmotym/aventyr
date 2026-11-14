import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { APP_STORAGE_KEY } from '../core/services/app-storage.service';
import { DiscordService } from '../modules/discord-auth/services/discord.service';
import {
    createDiscordAuth,
    createDiscordAuthFromTokenResponse,
    isDiscordAuthExpired
} from '../modules/discord-auth/services/discord-auth.utils';
import { apiRequest } from '../core/services/api.service';

class MemoryStorage {
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
const location = {
    origin: 'http://localhost',
    hash: '',
    pathname: '/',
    search: '',
    href: 'http://localhost/'
};
const originalFetch = globalThis.fetch;

function storedState(auth: Record<string, unknown> | null, user: Record<string, unknown> | null) {
    return {
        version: 1,
        theme: null,
        locale: null,
        discord: {
            user,
            auth,
            oauthState: null
        },
        ui: {
            chatWidthPercent: null
        }
    };
}

function setStoredState(auth: Record<string, unknown> | null, user: Record<string, unknown> | null) {
    storage.setItem(APP_STORAGE_KEY, JSON.stringify(storedState(auth, user)));
}

function validAuth(overrides: Record<string, unknown> = {}) {
    return {
        tokenType: 'Bearer',
        accessToken: 'stored-token',
        expiresIn: 3_600,
        expiresAt: Date.now() + 3_600_000,
        scope: 'identify',
        state: 'stored-state',
        ...overrides
    };
}

function validUser() {
    return {
        id: 'user-123',
        username: 'Test User',
        avatar: 'https://cdn.example/avatar.png',
        role: 'user'
    };
}

beforeEach(() => {
    storage.clear();
    location.hash = '';
    location.pathname = '/';
    location.search = '';
    location.href = 'http://localhost/';
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            localStorage: storage,
            location,
            history: {
                replaceState: (_state: unknown, _title: string, url: string) => {
                    location.href = url;
                    location.hash = '';
                    location.search = new URL(url, location.origin).search;
                }
            },
            matchMedia: () => ({ matches: true })
        }
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { title: 'Aventyr' }
    });
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test('OAuth parameters produce an absolute expiry and reject invalid token types', () => {
    const params = new URLSearchParams({
        token_type: 'Bearer',
        access_token: 'new-token',
        expires_in: '3600',
        scope: 'identify',
        state: 'oauth-state'
    });
    const auth = createDiscordAuth(params, 1_000);

    assert.equal(auth?.expiresAt, 3_601_000);
    assert.equal(isDiscordAuthExpired(auth!, 2_000), false);

    params.set('token_type', 'Bot');
    assert.equal(createDiscordAuth(params, 1_000), null);

    const refreshed = createDiscordAuthFromTokenResponse({
        token_type: 'Bearer',
        access_token: 'refreshed-access',
        refresh_token: 'rotated-refresh',
        expires_in: 1800,
        scope: 'identify'
    }, 'oauth-state', 1_000);
    assert.equal(refreshed?.refreshToken, 'rotated-refresh');
    assert.equal(refreshed?.expiresAt, 1_801_000);
});

test('expired stored authentication is cleared without calling the API', async () => {
    setStoredState(validAuth({ expiresAt: Date.now() - 1 }), validUser());
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount += 1;
        return new Response();
    };

    const user = await new DiscordService().handleLogin();
    const state = JSON.parse(storage.getItem(APP_STORAGE_KEY)!) as ReturnType<typeof storedState>;

    assert.equal(user, null);
    assert.equal(fetchCount, 0);
    assert.equal(state.discord.auth, null);
    assert.equal(state.discord.user, null);
});

test('concurrent initialization makes one request and clears a rejected token', async () => {
    setStoredState(validAuth(), validUser());
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({
            success: false,
            error: 'Discord authentication failed'
        }), {
            status: 403,
            headers: { 'content-type': 'application/json' }
        });
    };

    const service = new DiscordService();
    const users = await Promise.all([
        service.handleLogin(),
        service.handleLogin(),
        service.handleLogin()
    ]);
    const state = JSON.parse(storage.getItem(APP_STORAGE_KEY)!) as ReturnType<typeof storedState>;

    assert.equal(fetchCount, 1);
    assert.deepEqual(users, [null, null, null]);
    assert.equal(state.discord.auth, null);
    assert.equal(state.discord.user, null);
});

test('OAuth callback exchanges the code and uses the fresh token', async () => {
    setStoredState(validAuth({ accessToken: 'old-token' }), validUser());
    const state = JSON.parse(storage.getItem(APP_STORAGE_KEY)!) as ReturnType<typeof storedState>;
    state.discord.oauthState = 'fresh-state';
    storage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
    location.search = '?code=discord-code&state=fresh-state';

    let sentToken: string | undefined;
    globalThis.fetch = async (input, init) => {
        if (String(input).endsWith('/discord/oauth/token')) {
            assert.deepEqual(JSON.parse(String(init?.body)), {
                grantType: 'authorization_code',
                code: 'discord-code',
                redirectUri: 'http://localhost'
            });
            return new Response(JSON.stringify({
                success: true,
                data: {
                    token_type: 'Bearer',
                    access_token: 'fresh-token',
                    refresh_token: 'fresh-refresh-token',
                    expires_in: 3600,
                    scope: 'identify'
                }
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            });
        }
        sentToken = JSON.parse(String(init?.body)).accessToken;
        return new Response(JSON.stringify({
            success: true,
            data: validUser()
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };

    const user = await new DiscordService().handleLogin();
    const updated = JSON.parse(storage.getItem(APP_STORAGE_KEY)!) as ReturnType<typeof storedState>;

    assert.equal(sentToken, 'fresh-token');
    assert.equal(user?.id, 'user-123');
    assert.equal(updated.discord.auth?.accessToken, 'fresh-token');
    assert.equal(updated.discord.auth?.refreshToken, 'fresh-refresh-token');
    assert.equal(typeof updated.discord.auth?.expiresAt, 'number');
    assert.equal(location.search, '');
});

test('an unauthorized API request refreshes the token and retries once', async () => {
    setStoredState(validAuth({ refreshToken: 'stored-refresh' }), validUser());
    const requestedTokens: string[] = [];

    globalThis.fetch = async (input, init) => {
        if (String(input).endsWith('/discord/oauth/token')) {
            assert.deepEqual(JSON.parse(String(init?.body)), {
                grantType: 'refresh_token',
                refreshToken: 'stored-refresh'
            });
            return new Response(JSON.stringify({
                success: true,
                data: {
                    token_type: 'Bearer',
                    access_token: 'refreshed-token',
                    refresh_token: 'rotated-refresh',
                    expires_in: 3600,
                    scope: 'identify'
                }
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            });
        }

        requestedTokens.push(new Headers(init?.headers).get('Authorization') ?? '');
        if (requestedTokens.length === 1) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Discord authentication is required'
            }), {
                status: 401,
                headers: { 'content-type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({
            success: true,
            data: { drafts: [] }
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    };

    const result = await apiRequest<{ drafts: unknown[] }>('/admin/articles/drafts');
    const updated = JSON.parse(storage.getItem(APP_STORAGE_KEY)!) as ReturnType<typeof storedState>;

    assert.deepEqual(result, { drafts: [] });
    assert.deepEqual(requestedTokens, ['Bearer stored-token', 'Bearer refreshed-token']);
    assert.equal(updated.discord.auth?.refreshToken, 'rotated-refresh');
});

test('cached account is not fresh and a newer locale save survives an old account response', async () => {
    const cached = { ...validUser(), locale: 'fr' as const };
    setStoredState(validAuth(), cached);
    let respond!: (response: Response) => void;
    globalThis.fetch = () => new Promise<Response>(resolve => { respond = resolve; });
    const service = new DiscordService();
    const login = service.handleLogin();
    assert.equal(service.user.value?.locale, 'fr');
    assert.equal(service.freshUser.value, null);
    service.updateStoredUserPreferences({ locale: 'es' });
    respond(new Response(JSON.stringify({ success: true, data: { ...cached, locale: 'de' } })));
    await login;
    assert.equal(service.user.value?.locale, 'es');
    assert.equal(service.freshUser.value?.locale, 'es');
    assert.equal(service.getUser()?.locale, 'es');
});

test('a pending account response cannot restore a logged-out session', async () => {
    setStoredState(validAuth(), validUser());
    let respond!: (response: Response) => void;
    globalThis.fetch = () => new Promise<Response>(resolve => { respond = resolve; });
    const service = new DiscordService();
    const login = service.handleLogin();
    service.logout();
    respond(new Response(JSON.stringify({ success: true, data: validUser() })));
    await login;
    assert.equal(service.user.value, null);
    assert.equal(service.freshUser.value, null);
    assert.equal(service.getUser(), null);
});
