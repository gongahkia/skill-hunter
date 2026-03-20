import { BUILTIN_PREFIXES, COLORSCHEMES } from './constants';

const FALLBACK_COLORS = [
  '#ff6b6b',
  '#ffa06b',
  '#ffd93d',
  '#6bff6b',
  '#6bd9ff',
  '#b06bff',
  '#ff6bb0',
  '#c8c8c8',
];

export function getPrefixColor(colorscheme: string, prefix: string, customPrefixes: string[]): string {
  const palette = COLORSCHEMES[colorscheme] ?? COLORSCHEMES.gruvbox ?? {};
  const normalized = prefix.toUpperCase();

  if (palette[normalized]) {
    return palette[normalized];
  }

  const customIndex = customPrefixes.findIndex((value) => value === normalized);
  return FALLBACK_COLORS[customIndex % FALLBACK_COLORS.length] ?? '#ffffff';
}

export function hexToRgbColor(hex: string): { red: number; green: number; blue: number } {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;

  return {
    red: Number.parseInt(value.slice(0, 2), 16) / 255,
    green: Number.parseInt(value.slice(2, 4), 16) / 255,
    blue: Number.parseInt(value.slice(4, 6), 16) / 255,
  };
}

export function getBuiltinOrCustomIndex(prefix: string, customPrefixes: string[]): number {
  const normalized = prefix.toUpperCase();
  const builtinIndex = BUILTIN_PREFIXES.indexOf(normalized as (typeof BUILTIN_PREFIXES)[number]);
  if (builtinIndex >= 0) {
    return builtinIndex;
  }

  return customPrefixes.findIndex((value) => value === normalized);
}
