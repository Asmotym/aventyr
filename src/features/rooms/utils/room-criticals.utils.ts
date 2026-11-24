import { hexToRgb, relativeLuminance } from '@/shared/utils/colors';
import { getDiceFaceInfo } from 'netlify/core/utils/bonus-point-dice';
import type { RoomCriticalRule, RoomMessage } from 'netlify/core/types/data.types';

function toRgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function matchesRoomCritical(rule: RoomCriticalRule, total: number): boolean {
  if (rule.operator === 'moreThan') {
    return total > rule.threshold;
  }
  return total < rule.threshold;
}

export function findMatchingRoomCritical(message: RoomMessage, rules: RoomCriticalRule[]): RoomCriticalRule | null {
  if (message.type !== 'dice' || message.diceTotal == null) return null;
  const total = Number(message.diceTotal);
  if (!Number.isFinite(total)) return null;

  let matched: RoomCriticalRule | null = null;
  for (const rule of rules) {
    if (rule.diceType && rule.enabled !== false && getDiceFaceInfo(message.diceNotation)?.faceNotation === rule.diceType && matchesRoomCritical(rule, total)) {
      matched = rule;
    }
  }
  return matched;
}

export function getRoomCriticalSignature(rule: RoomCriticalRule | null): string | null {
  if (!rule) {
    return null;
  }

  return `${rule.diceType ?? ""}:${rule.enabled !== false && Boolean(rule.diceType)}:${rule.operator}:${rule.threshold}:${rule.color.trim().toLowerCase()}`;
}

export function getRoomCriticalRulesSignature(rules: RoomCriticalRule[]): string {
  return JSON.stringify(rules.map((rule) => getRoomCriticalSignature(rule)));
}

export function getCriticalMessageStyle(rule: RoomCriticalRule | null): Record<string, string> {
  if (!rule) {
    return {};
  }

  const rgb = hexToRgb(rule.color) ?? { r: 255, g: 255, b: 255 };
  const luminance = relativeLuminance(rgb);

  return {
    '--critical-accent': `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    '--critical-on-accent': luminance > 0.179 ? '#000000' : '#ffffff',
    '--message-bg': toRgba(rule.color, 0.24),
    '--message-border-color': toRgba(rule.color, 0.7),
    '--dice-message-bg': toRgba(rule.color, 0.14),
    '--critical-reveal-bg': toRgba(rule.color, 0.42),
    '--critical-glow': toRgba(rule.color, 0.5),
    '--critical-sweep': toRgba(rule.color, 0.72),
  };
}
