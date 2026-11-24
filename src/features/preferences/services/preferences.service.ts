import type { ArticleSort } from '@shared/articles/articles.types';
import { apiRequest } from '@/shared/services/api.service';
import type { AppLocale } from '@shared/accounts/locale.types';
import type { AppTheme, AppThemeStyle } from '@shared/accounts/theme.types';

export interface UserPreferences {
  theme: AppTheme;
  themeStyle: AppThemeStyle;
  locale: AppLocale | null;
  articleSort: ArticleSort;
}

export type UserPreferenceUpdate = Partial<Omit<UserPreferences, 'locale'>> & { locale?: AppLocale };

const pendingFetches = new Map<string, Promise<UserPreferences>>();

export function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  const pending = pendingFetches.get(userId);
  if (pending) return pending;

  const request = apiRequest<UserPreferences>(`/users/${userId}/preferences`)
    .finally(() => {
      pendingFetches.delete(userId);
    });
  pendingFetches.set(userId, request);
  return request;
}

export function saveUserPreferences(
  userId: string,
  preferences: UserPreferenceUpdate
): Promise<UserPreferences> {
  return apiRequest<UserPreferences>(`/users/${userId}/preferences`, {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });
}
