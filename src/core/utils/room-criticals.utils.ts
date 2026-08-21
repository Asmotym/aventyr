import type { RoomCriticalRule, RoomMessage } from 'netlify/core/types/data.types';

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().toLowerCase();
  const hex = normalized.length === 4
    ? `${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized.slice(1);

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

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
  if (message.type !== 'dice') return null;
  const total = Number(message.diceTotal);
  if (!Number.isFinite(total)) return null;

  let matched: RoomCriticalRule | null = null;
  for (const rule of rules) {
    if (matchesRoomCritical(rule, total)) {
      matched = rule;
    }
  }
  return matched;
}

export function getRoomCriticalSignature(rule: RoomCriticalRule | null): string | null {
  if (!rule) {
    return null;
  }

  return `${rule.operator}:${rule.threshold}:${rule.color.trim().toLowerCase()}`;
}

export function getRoomCriticalRulesSignature(rules: RoomCriticalRule[]): string {
  return JSON.stringify(rules.map((rule) => getRoomCriticalSignature(rule)));
}

export function getCriticalMessageStyle(rule: RoomCriticalRule | null): Record<string, string> {
  if (!rule) {
    return {};
  }

  return {
    '--message-bg': toRgba(rule.color, 0.24),
    '--message-border-color': toRgba(rule.color, 0.7),
    '--dice-message-bg': toRgba(rule.color, 0.14),
    '--critical-reveal-bg': toRgba(rule.color, 0.42),
    '--critical-glow': toRgba(rule.color, 0.5),
    '--critical-sweep': toRgba(rule.color, 0.72),
  };
}
