export interface RgbColor { r: number; g: number; b: number }

export function hexToRgb(color: string): RgbColor | null {
  const normalized = color.trim().toLowerCase();
  const hex = normalized.length === 4
    ? `${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized.slice(1);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

/** Relative luminance for choosing readable text on a solid background. */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  const linear = [r, g, b].map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
