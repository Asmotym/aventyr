import type { UserRole } from './accounts.types';
import type { AppLocale } from './locale.types';
import type { AppTheme, AppThemeStyle } from './theme.types';
export type DiscordAuth = {
    tokenType: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    expiresAt: number;
    scope: string;
    state: string;
};
export interface DiscordUser {
    id: string;
    username: string;
    avatar: string;
    aboutMe?: string;
    theme?: AppTheme;
    themeStyle?: AppThemeStyle;
    locale?: AppLocale | null;
    role?: UserRole;
}
