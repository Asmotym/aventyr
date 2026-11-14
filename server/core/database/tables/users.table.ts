import { execute, query } from '../client';
import type { DatabaseUser } from '../../types/database.types';
import {
    normalizeTheme,
    normalizeThemeStyle,
    type AppTheme,
    type AppThemeStyle
} from '../../types/theme.types';
import { isAppLocale, type AppLocale } from '../../types/locale.types';
import type { UserRole, UserSummary, ArticleSort } from '../../types/data.types';

const USER_ROLES: UserRole[] = ['owner', 'admin', 'user'];

export function normalizeUserRole(role: unknown): UserRole {
    return USER_ROLES.includes(role as UserRole) ? role as UserRole : 'user';
}

export async function getUser(discordUserId: string): Promise<DatabaseUser | undefined> {
    const result = await query<DatabaseUser[]>(
        `SELECT discord_user_id, username, avatar, about_me, theme, theme_style, locale, article_sort, role, rights_update, rights_testing_ground, created_at, updated_at
         FROM users
         WHERE discord_user_id = ?
         LIMIT 1`,
        [discordUserId]
    );
    if (!result[0]) return undefined;

    return {
        ...result[0],
        theme: normalizeTheme(result[0].theme),
        theme_style: normalizeThemeStyle(result[0].theme_style),
        locale: isAppLocale(result[0].locale) ? result[0].locale : null,
        role: normalizeUserRole(result[0].role),
        rights_update: Boolean(result[0].rights_update),
        rights_testing_ground: Boolean(result[0].rights_testing_ground)
    };
}

export async function insertUser(user: DatabaseUser): Promise<void> {
    await execute(
        `INSERT INTO users (discord_user_id, username, avatar, about_me, theme, theme_style, locale, role, rights_update, rights_testing_ground)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE discord_user_id = discord_user_id`,
        [
            user.discord_user_id ?? null,
            user.username ?? null,
            user.avatar ?? null,
            user.about_me ?? '',
            normalizeTheme(user.theme),
            normalizeThemeStyle(user.theme_style),
            isAppLocale(user.locale) ? user.locale : null,
            normalizeUserRole(user.role),
            user.rights_update ?? false,
            user.rights_testing_ground ?? false
        ]
    );
}

export async function updateUser(discordUserId: string, data: Partial<DatabaseUser>): Promise<void> {
    const theme = typeof data.theme === 'undefined' ? null : normalizeTheme(data.theme);
    const themeStyle = typeof data.theme_style === 'undefined' ? null : normalizeThemeStyle(data.theme_style);
    const locale = isAppLocale(data.locale) ? data.locale : null;

    await execute(
        `UPDATE users
         SET
             username = COALESCE(?, username),
             avatar = COALESCE(?, avatar),
             about_me = COALESCE(?, about_me),
             theme = COALESCE(?, theme),
             theme_style = COALESCE(?, theme_style),
             locale = COALESCE(?, locale),
             article_sort = COALESCE(?, article_sort),
             role = COALESCE(?, role),
             rights_update = COALESCE(?, rights_update),
             rights_testing_ground = COALESCE(?, rights_testing_ground),
             updated_at = CURRENT_TIMESTAMP
         WHERE discord_user_id = ?`,
        [
            data.username ?? null,
            data.avatar ?? null,
            typeof data.about_me === 'undefined' ? null : data.about_me,
            theme,
            themeStyle,
            locale,
            data.article_sort ?? null,
            typeof data.role === 'undefined' ? null : normalizeUserRole(data.role),
            data.rights_update ?? null,
            data.rights_testing_ground ?? null,
            discordUserId
        ]
    );
}

export interface UserPreferences {
    theme: AppTheme;
    themeStyle: AppThemeStyle;
    locale: AppLocale | null;
    articleSort: ArticleSort;
}

export async function updateUserPreferences(
    discordUserId: string,
    preferences: Partial<Omit<UserPreferences, 'locale'>> & { locale?: AppLocale }
): Promise<UserPreferences | null> {
    const { themeStyle, articleSort, ...databasePreferences } = preferences;
    await updateUser(discordUserId, {
        ...databasePreferences,
        article_sort: articleSort,
        theme_style: themeStyle
    });
    const user = await getUser(discordUserId);
    if (!user) return null;
    return {
        theme: normalizeTheme(user.theme),
        themeStyle: normalizeThemeStyle(user.theme_style),
        articleSort: user.article_sort ?? 'newest',
        locale: user.locale ?? null
    };
}

export async function listUsers(): Promise<UserSummary[]> {
    const rows = await query<DatabaseUser[]>(
        `SELECT discord_user_id, username, avatar, role, created_at, updated_at
         FROM users
         ORDER BY FIELD(role, 'owner', 'admin', 'user'), username ASC`
    );

    return rows.map((row) => ({
        id: row.discord_user_id ?? '',
        username: row.username,
        avatar: row.avatar,
        role: normalizeUserRole(row.role),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

export async function updateUserRole(discordUserId: string, role: UserRole): Promise<UserSummary | null> {
    await execute(
        `UPDATE users
         SET role = ?, updated_at = CURRENT_TIMESTAMP
         WHERE discord_user_id = ?`,
        [normalizeUserRole(role), discordUserId]
    );

    const user = await getUser(discordUserId);
    if (!user) return null;

    return {
        id: user.discord_user_id ?? discordUserId,
        username: user.username,
        avatar: user.avatar,
        role: normalizeUserRole(user.role),
        createdAt: user.created_at,
        updatedAt: user.updated_at
    };
}
