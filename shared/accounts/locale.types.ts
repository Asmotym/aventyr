export const APP_LOCALES = ['en', 'es', 'fr', 'de'] as const;
export type AppLocale = typeof APP_LOCALES[number];
export function isAppLocale(value: unknown): value is AppLocale {
    return typeof value === 'string' && APP_LOCALES.includes(value as AppLocale);
}
export function normalizeLocale(value: unknown, fallback: AppLocale = 'en'): AppLocale {
    return isAppLocale(value) ? value : fallback;
}
