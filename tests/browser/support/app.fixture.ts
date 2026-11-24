import type { Page } from '@playwright/test';

export interface AppFixtureOptions {
  signedIn?: boolean;
  theme?: 'light' | 'dark';
  themeStyle?: string;
}

/** Minimal app fixture; feature tests override endpoints requiring richer state. */
export async function setupApp(page: Page, { signedIn = true, theme = 'dark', themeStyle = 'aventyr' }: AppFixtureOptions = {}) {
  const user = { id: 'owner', username: 'Owner', avatar: '', role: 'owner', locale: 'en', theme, themeStyle, aboutMe: '' };
  await page.addInitScript(({ user, signedIn }) => {
    // Seed once so reload tests exercise the application's persisted state.
    if (!localStorage.getItem('aventyr_global_state')) localStorage.setItem('aventyr_global_state', JSON.stringify({
      version: 1, theme: user.theme, themeStyle: user.themeStyle, locale: 'en',
      discord: { user: signedIn ? user : null, auth: signedIn ? { tokenType: 'Bearer', accessToken: 'test', expiresIn: 3600, expiresAt: Date.now() + 3600000, scope: 'identify', state: 'test' } : null }, ui: {},
    }));
  }, { user, signedIn });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith('/discord') || path.endsWith('/users/owner')) data = user;
    else if (path.endsWith('/rooms')) data = { rooms: [] };
    else if (path.endsWith('/articles/categories')) data = { categories: [] };
    else if (path.endsWith('/articles/tags')) data = { tags: [] };
    else if (path.endsWith('/articles/news')) data = { articles: [] };
    else if (path.endsWith('/articles')) data = { articles: [], hasMore: false };
    else if (path.endsWith('/profile')) data = { ...user, userId: user.id };
    else if (path.endsWith('/api-key')) data = { apiKey: null };
    await route.fulfill({ json: { success: true, data } });
  });
  return user;
}
