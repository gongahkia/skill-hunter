import { describe, expect, it } from 'vitest';
import {
  escapeRegex,
  getAllPrefixes,
  isValidCustomPrefix,
  parseTaggedLine,
  sanitizeCustomPrefixes,
} from '../src/parser';

describe('parser', () => {
  it('validates custom prefixes against a strict allowlist', () => {
    expect(isValidCustomPrefix('HACK')).toBe(true);
    expect(isValidCustomPrefix('NOTE_1')).toBe(true);
    expect(isValidCustomPrefix('x')).toBe(false);
    expect(isValidCustomPrefix('TODO)')).toBe(false);
  });

  it('sanitizes and deduplicates custom prefixes', () => {
    expect(sanitizeCustomPrefixes(['hack', 'HACK', 'todo', 'bad)'])).toEqual([
      'HACK',
    ]);
  });

  it('parses only tags at the start of trimmed text', () => {
    expect(parseTaggedLine('  TODO revise this', ['TODO'])).toMatchObject({
      prefix: 'TODO',
      content: 'revise this',
    });
    expect(parseTaggedLine('some TODO later', ['TODO'])).toBeNull();
  });

  it('escapes regex metacharacters before building patterns', () => {
    expect(escapeRegex('TODO+')).toBe('TODO\\+');
  });

  it('keeps builtin prefixes before sanitized custom prefixes', () => {
    expect(getAllPrefixes(['note', 'todo', 'fixme', 'HACK'])).toEqual([
      'TODO',
      'FIXME',
      'TEMP',
      'REF',
      'REV',
      'HACK',
      'NOTE',
    ]);
  });
});
