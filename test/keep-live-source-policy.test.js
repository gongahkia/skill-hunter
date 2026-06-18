import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadPolicy() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('imports/keep-policy.js'));
  fn(module, module.exports);
  return module.exports;
}

describe('Keep live source policy', () => {
  it('rejects Keep URLs and browser/API source hints with Takeout copy', () => {
    const policy = loadPolicy();

    expect(policy.rejectUnsupportedSource('https://keep.google.com/u/0/#NOTE/test')).toMatchObject({
      code: 'KEEP_UNSUPPORTED_LIVE_SOURCE',
      adapterId: 'keep',
      recoverable: true
    });
    expect(policy.rejectUnsupportedSource({ url: 'https://keep.google.com/' }).message).toContain('Google Takeout');
    expect(policy.rejectUnsupportedSource({ kind: 'keep-api' }).message).toContain('Keep URLs and browser pages are not accepted');
    expect(policy.rejectUnsupportedSource({ path: 'Takeout/Keep/note.json' })).toBeNull();
  });

  it('does not ship Keep live auth, host permissions, or scraping UI', () => {
    const manifest = JSON.parse(loadSrc('manifest.json'));
    const optionsHtml = loadSrc('options.html');
    const optionsJs = loadSrc('options.js');
    const haystack = [optionsHtml, optionsJs].join('\n');

    expect(manifest.permissions).not.toContain('identity');
    expect(manifest.host_permissions || []).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/keep\.google\.com|googleapis\.com\/.*keep/i)
    ]));
    expect(haystack).not.toMatch(/Keep API|OAuth|scrape|browser session|keep\.google\.com/i);
    expect(optionsHtml).toContain('Google Takeout exports');
    expect(optionsHtml).toContain('Keep URLs and browser pages are not accepted');
  });
});
