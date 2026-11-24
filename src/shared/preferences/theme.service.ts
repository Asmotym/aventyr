import {
  isAppTheme,
  isAppThemeStyle,
  normalizeTheme,
  normalizeThemeStyle,
  type AppTheme,
  type AppThemeStyle,
} from '@shared/accounts/theme.types';
import { appStorage } from '@/shared/services/app-storage.service';

type ThemeTarget = {
  change: (themeName: string) => void;
  global: {
    name: {
      value: string;
    };
  };
};

export function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null;

  const storedTheme = appStorage.getTheme();
  return isAppTheme(storedTheme) ? storedTheme : null;
}

export function getStoredThemeStyle(): AppThemeStyle | null {
  if (typeof window === 'undefined') return null;

  const storedThemeStyle = appStorage.getThemeStyle();
  return isAppThemeStyle(storedThemeStyle) ? storedThemeStyle : null;
}

export function detectPreferredTheme(): AppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getInitialTheme(): AppTheme {
  return getStoredTheme() ?? detectPreferredTheme();
}

export function getInitialThemeStyle(): AppThemeStyle {
  return getStoredThemeStyle() ?? 'aventyr';
}

export function getVuetifyThemeName(style: AppThemeStyle, theme: AppTheme): string {
  return `${style}${theme === 'dark' ? 'Dark' : 'Light'}`;
}

export function getInitialVuetifyTheme(): string {
  return getVuetifyThemeName(getInitialThemeStyle(), getInitialTheme());
}

export function saveTheme(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  appStorage.setTheme(theme);
}

export function saveThemeStyle(themeStyle: AppThemeStyle): void {
  if (typeof window === 'undefined') return;
  appStorage.setThemeStyle(themeStyle);
}

export function applyTheme(
  themeTarget: ThemeTarget,
  theme: AppTheme,
  style: AppThemeStyle = getAppliedThemeStyle(themeTarget)
): void {
  themeTarget.change(getVuetifyThemeName(style, theme));
}

export function getAppliedTheme(themeTarget: ThemeTarget): AppTheme {
  const name = themeTarget.global.name.value;
  if (name.endsWith('Dark')) return 'dark';
  if (name.endsWith('Light')) return 'light';
  return normalizeTheme(name, getInitialTheme());
}

export function getAppliedThemeStyle(themeTarget: ThemeTarget): AppThemeStyle {
  const name = themeTarget.global.name.value.replace(/(?:Dark|Light)$/, '');
  return normalizeThemeStyle(name, getInitialThemeStyle());
}
