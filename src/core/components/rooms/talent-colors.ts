import type { TalentColor } from 'netlify/core/types/talents.types';

export const talentColors: Record<TalentColor, string> = {
  primary: 'var(--v-theme-primary)', red: '205,85,85', rose: '210,90,115', pink: '215,105,165',
  orange: '230,125,45', amber: '225,165,50', yellow: '220,195,65', lime: '145,180,65',
  green: '65,155,110', teal: '45,155,145', cyan: '45,165,195', blue: '70,140,215',
  indigo: '95,105,195', purple: '155,105,195', brown: '140,105,80', neutral: 'var(--v-theme-on-surface)'
};
export function talentColorStyle(color?: TalentColor) {
  return { '--talent-accent': talentColors[color ?? 'primary'], '--talent-on-accent': color === 'neutral' ? 'var(--v-theme-surface)' : !color || color === 'primary' ? 'var(--v-theme-on-primary)' : color === 'indigo' || color === 'brown' ? '255,255,255' : '16,16,16' };
}
