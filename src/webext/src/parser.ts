import { BUILTIN_PREFIXES } from './constants';
import { PrefixMatch } from './types';

const CUSTOM_PREFIX_RE = /^[A-Z][A-Z0-9_-]{1,31}$/;

export function normalizePrefix(prefix: string): string {
  return prefix.trim().toUpperCase();
}

export function isValidCustomPrefix(prefix: string): boolean {
  return CUSTOM_PREFIX_RE.test(normalizePrefix(prefix));
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function dedupePrefixes(prefixes: string[]): string[] {
  return Array.from(new Set(prefixes.map(normalizePrefix))).sort();
}

export function sanitizeCustomPrefixes(prefixes: string[]): string[] {
  return dedupePrefixes(prefixes).filter((prefix) => {
    return !BUILTIN_PREFIXES.includes(prefix as (typeof BUILTIN_PREFIXES)[number]) &&
      isValidCustomPrefix(prefix);
  });
}

export function getAllPrefixes(customPrefixes: string[]): string[] {
  return [...BUILTIN_PREFIXES, ...sanitizeCustomPrefixes(customPrefixes)];
}

export function buildPrefixRegex(prefixes: string[]): RegExp {
  const escaped = dedupePrefixes(prefixes).map(escapeRegex);
  return new RegExp(
    `^(\\s*)((${escaped.join('|')}))(?:[:\\s(]|$)(.*)$`,
    'i'
  );
}

export function parseTaggedLine(line: string, prefixes: string[]): PrefixMatch | null {
  const regex = buildPrefixRegex(prefixes);
  const match = regex.exec(line);

  if (!match) {
    return null;
  }

  const leadingWhitespace = match[1] ?? '';
  const rawPrefix = match[2] ?? '';
  const rest = (match[4] ?? '').trim();

  return {
    prefix: normalizePrefix(rawPrefix),
    rawText: line.trim(),
    content: rest,
    matchStart: leadingWhitespace.length,
    prefixStart: leadingWhitespace.length,
    prefixEnd: leadingWhitespace.length + rawPrefix.length,
  };
}
