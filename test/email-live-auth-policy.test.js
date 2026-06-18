import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

describe('Email live auth policy', () => {
  it('does not ship IMAP, Gmail API, OAuth, or password import UI in M13', () => {
    const manifest = JSON.parse(loadSrc('manifest.json'));
    const optionsHtml = loadSrc('options.html');
    const optionsJs = loadSrc('options.js');
    const haystack = [optionsHtml, optionsJs].join('\n');

    expect(manifest.permissions).not.toContain('identity');
    expect(manifest.host_permissions || []).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/mail\.google\.com|gmail\.googleapis\.com|imap/i)
    ]));
    expect(haystack).not.toMatch(/IMAP|Gmail API|OAuth|app password|email password/i);
  });
});
