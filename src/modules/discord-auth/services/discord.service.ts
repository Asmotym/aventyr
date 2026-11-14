import type { DiscordAuth, DiscordUser } from "netlify/core/types/discord.types";
import { getApiUrl, getRedirectUri } from "modules/discord-auth/utils/urls.utils";
import { ref, type Ref } from 'vue';
import { getInitialTheme, getInitialThemeStyle } from 'core/services/theme.service';
import { getInitialLocale } from 'core/services/locale.service';
import type { AppTheme, AppThemeStyle } from 'netlify/core/types/theme.types';
import type { AppLocale } from 'netlify/core/types/locale.types';
import { appStorage } from 'core/services/app-storage.service';
import {
    createDiscordAuthFromTokenResponse,
    isDiscordAuthExpired,
    type DiscordTokenResponse
} from './discord-auth.utils';

class DiscordApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'DiscordApiError';
    }
}

export class DiscordService {
    private static readonly DISCORD_CLIENT_ID = import.meta.env?.VITE_DISCORD_CLIENT_ID ?? '';
    private static readonly DISCORD_API_URL = 'https://discord.com/api/v10';
    public user: Ref<DiscordUser | null> = ref(null);
    // Cached users render immediately; locale reconciliation requires a fresh response.
    public freshUser: Ref<DiscordUser | null> = ref(null);
    private sessionRevision = 0;
    private localePreferenceRevision = 0;
    private static instance: DiscordService | null = null;
    private loginPromise: Promise<DiscordUser | null> | null = null;
    private refreshPromise: Promise<DiscordAuth> | null = null;
    private initialized = false;

    public static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
    }

    public async handleLogin(): Promise<DiscordUser | null> {
        if (this.initialized) {
            return this.user.value;
        }
        if (this.loginPromise) {
            return this.loginPromise;
        }

        this.loginPromise = this.initializeLogin().finally(() => {
            this.initialized = true;
            this.loginPromise = null;
        });
        return this.loginPromise;
    }

    private async initializeLogin(): Promise<DiscordUser | null> {
        const callbackParams = new URLSearchParams(window.location.search);
        if (callbackParams.has('code') || callbackParams.has('error')) {
            try {
                return await this.handleAuthCallback();
            } catch (error) {
                console.error('[DiscordAuth] Failed to process OAuth callback', error);
                return this.user.value;
            }
        }

        let auth = appStorage.getDiscordAuth();
        if (!auth) {
            this.removeUser();
            return null;
        }
        if (isDiscordAuthExpired(auth)) {
            try {
                auth = await this.refreshAuth();
            } catch (error) {
                console.error('[DiscordAuth] Failed to refresh expired authentication', error);
                return null;
            }
        }

        const savedUser = this.getUser();
        if (savedUser) this.storeUser(savedUser);

        try {
            return await this.fetchUserInfo(auth);
        } catch (error) {
            console.error('[DiscordAuth] Failed to refresh user info', error);
            return this.user.value;
        }
    }

    public login() {
        this.clearSession();
        this.initialized = false;
        const state = this.generateRandomString(32)
        this.storeOauthState(state)

        const params = new URLSearchParams({
            client_id: DiscordService.DISCORD_CLIENT_ID,
            redirect_uri: getRedirectUri(),
            response_type: 'code',
            scope: 'identify email',
            state: state
        })

        window.location.href = `${DiscordService.DISCORD_API_URL}/oauth2/authorize?${params.toString()}`
    }

    public logout() {
        this.clearSession();
        this.initialized = false;
    }

    public async handleAuthCallback(): Promise<DiscordUser> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const savedState = this.getOauthState();
        const returnedState = urlParams.get('state');
        const oauthError = urlParams.get('error');

        this.cleanOAuthCallback();
        this.removeOauthState();

        if (oauthError || !code || !savedState || returnedState !== savedState) {
            this.clearSession();
            throw new Error(oauthError
                ? `[DiscordAuth] Discord authorization failed: ${oauthError}`
                : '[DiscordAuth] Invalid OAuth callback');
        }

        const token = await this.requestToken({
            grantType: 'authorization_code',
            code,
            redirectUri: getRedirectUri()
        });
        const auth = createDiscordAuthFromTokenResponse(token, savedState);
        if (!auth) {
            this.clearSession();
            throw new Error('[DiscordAuth] Invalid token response');
        }
        this.storeAuth(auth);
        return this.fetchUserInfo(auth);
    }

    public async getValidAuth(): Promise<DiscordAuth | null> {
        const auth = appStorage.getDiscordAuth();
        if (!auth) return null;
        if (!isDiscordAuthExpired(auth)) return auth;
        if (!auth.refreshToken) {
            this.clearSession();
            return null;
        }
        return this.refreshAuth();
    }

    public async refreshAuth(force = false): Promise<DiscordAuth> {
        const auth = appStorage.getDiscordAuth();
        if (!auth?.refreshToken) {
            this.clearSession();
            throw new Error('[DiscordAuth] No refresh token is available');
        }
        if (!force && !isDiscordAuthExpired(auth)) return auth;
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = this.requestToken({
            grantType: 'refresh_token',
            refreshToken: auth.refreshToken
        }).then((token) => {
            const refreshed = createDiscordAuthFromTokenResponse(token, auth.state);
            if (!refreshed) {
                throw new Error('[DiscordAuth] Invalid refresh response');
            }
            this.storeAuth(refreshed);
            return refreshed;
        }).catch((error) => {
            this.clearSession();
            throw error;
        }).finally(() => {
            this.refreshPromise = null;
        });

        return this.refreshPromise;
    }

    private async requestToken(payload: Record<string, string>): Promise<DiscordTokenResponse> {
        const response = await fetch(getApiUrl('/discord/oauth/token'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json() as {
            success?: boolean;
            data?: DiscordTokenResponse;
            error?: string;
        };
        if (!response.ok || !data.success || !data.data) {
            throw new DiscordApiError(
                data.error ?? '[DiscordAuth] Failed to exchange Discord token',
                response.status
            );
        }
        return data.data;
    }

    public async fetchUserInfo(auth: DiscordAuth): Promise<DiscordUser> {
        const sessionRevision = this.sessionRevision;
        const localePreferenceRevision = this.localePreferenceRevision;
        const userInfo = await fetch(getApiUrl('/discord'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...auth,
                queryType: 'user',
                theme: getInitialTheme(),
                themeStyle: getInitialThemeStyle(),
                locale: getInitialLocale()
            }),
        });
        const data = await userInfo.json() as { success?: boolean; data?: DiscordUser; error?: string };
        if (sessionRevision !== this.sessionRevision) {
            throw new Error('[DiscordAuth] Session changed while fetching user info');
        }
        if (!userInfo.ok || !data?.success || !data.data) {
            if (userInfo.status === 401 || userInfo.status === 403) {
                this.clearSession();
            }
            throw new DiscordApiError(
                data?.error ?? '[DiscordAuth] Failed to fetch user info',
                userInfo.status
            );
        }

        // A preference saved while this request was loading is newer than its snapshot.
        if (localePreferenceRevision !== this.localePreferenceRevision && this.user.value?.id === data.data.id) {
            data.data.locale = this.user.value.locale;
        }
        this.storeUser(data.data);
        this.freshUser.value = data.data;
        return data.data;
    }

    private generateRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    protected storeUser(user: DiscordUser) {
        appStorage.setDiscordUser(user);
        this.user.value = user;
    }

    public updateStoredUserPreferences(preferences: {
        theme?: AppTheme;
        themeStyle?: AppThemeStyle;
        locale?: AppLocale | null;
    }) {
        const user = this.user.value;
        if (!user) return;
        if (preferences.locale !== undefined) this.localePreferenceRevision += 1;
        this.storeUser({ ...user, ...preferences });
    }

    public updateStoredUserProfile(profile: { aboutMe: string }) {
        const user = this.user.value;
        if (!user) return;
        this.storeUser({ ...user, ...profile });
    }

    protected storeAuth(auth: DiscordAuth) {
        appStorage.setDiscordAuth(auth);
    }

    protected storeOauthState(state: string) {
        appStorage.setDiscordOauthState(state);
    }

    protected removeUser() {
        appStorage.removeDiscordUser();
        this.user.value = null;
    }

    protected removeAuth() {
        appStorage.removeDiscordAuth();
    }

    protected removeOauthState() {
        appStorage.removeDiscordOauthState();
    }

    private clearSession() {
        this.sessionRevision += 1;
        this.freshUser.value = null;
        this.removeAuth();
        this.removeUser();
        this.removeOauthState();
    }

    private cleanOAuthCallback() {
        const search = new URLSearchParams(window.location.search);
        search.delete('code');
        search.delete('state');
        search.delete('error');
        search.delete('error_description');
        const remainingQuery = search.toString();
        window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ''}`
        );
    }

    public getUser(): DiscordUser | null {
        return appStorage.getDiscordUser();
    }

    public isLoggedIn(): boolean {
        return this.getUser() !== null;
    }

    public getAuth(): DiscordAuth | null {
        const auth = appStorage.getDiscordAuth();
        if (!auth) return null;
        if (isDiscordAuthExpired(auth)) {
            console.info('[DiscordAuth] Stored token expired; refresh is required');
            return null;
        }
        return auth;
    }

    public getOauthState(): string | null {
        return appStorage.getDiscordOauthState();
    }
}
