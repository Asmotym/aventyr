export const APP_THEMES = ['dark', 'light'] as const;
export const APP_THEME_STYLES = ['aventyr', 'arcane', 'explorer', 'kingdom', 'campfire'] as const;
export type AppTheme = typeof APP_THEMES[number];
export type AppThemeStyle = typeof APP_THEME_STYLES[number];
export function isAppTheme(value: unknown): value is AppTheme {
    return typeof value === 'string' && APP_THEMES.includes(value as AppTheme);
}
export function normalizeTheme(value: unknown, fallback: AppTheme = 'dark'): AppTheme {
    return isAppTheme(value) ? value : fallback;
}
export function isAppThemeStyle(value: unknown): value is AppThemeStyle {
    return typeof value === 'string' && APP_THEME_STYLES.includes(value as AppThemeStyle);
}
export function normalizeThemeStyle(value: unknown, fallback: AppThemeStyle = 'aventyr'): AppThemeStyle {
    return isAppThemeStyle(value) ? value : fallback;
}
