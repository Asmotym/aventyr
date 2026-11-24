import { getApiUrl } from '@/shared/services/urls.utils';
import type { DiscordAuth } from '@shared/accounts/discord.types';

interface ApiAuthProvider {
  getValidAuth(): Promise<DiscordAuth | null>;
  refreshAuth(force?: boolean): Promise<DiscordAuth>;
}
let authProvider: ApiAuthProvider | undefined;

export function configureApiAuth(provider: ApiAuthProvider): void {
  authProvider = provider;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let auth = await authProvider?.getValidAuth();

  const send = (accessToken?: string, tokenType = 'Bearer') => {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (accessToken) {
      headers.set('Authorization', `${tokenType} ${accessToken}`);
    }
    return fetch(getApiUrl(path), { ...options, headers });
  };

  let response = await send(auth?.accessToken, auth?.tokenType);
  if (response.status === 401 && auth?.refreshToken) {
    auth = await authProvider!.refreshAuth(true);
    response = await send(auth.accessToken, auth.tokenType);
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) as ApiResponse<T> : null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? (text.trim() || `Request failed with status ${response.status}`));
  }

  return payload.data;
}

export function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || typeof value === 'undefined' || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
