import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadPolicy() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('imports/x-bookmarks-policy.js'));
  fn(module, module.exports);
  return module.exports;
}

describe('X bookmarks policy', () => {
  it('rejects web, cookie, private GraphQL, and unofficial API sources', () => {
    const policy = loadPolicy();

    expect(policy.rejectUnsupportedSource('https://x.com/i/bookmarks')).toMatchObject({
      code: 'X_BOOKMARKS_UNSUPPORTED_SOURCE',
      adapterId: 'x-bookmarks',
      recoverable: true
    });
    expect(policy.rejectUnsupportedSource('https://twitter.com/i/bookmarks').message).toContain('user-owned X archive');
    expect(policy.rejectUnsupportedSource({ kind: 'browser-session-cookie' }).message).toContain('private GraphQL');
    expect(policy.rejectUnsupportedSource({ type: 'graphql' })).toMatchObject({ code: 'X_BOOKMARKS_UNSUPPORTED_SOURCE' });
    expect(policy.rejectUnsupportedSource({ path: 'twitter-archive/data/bookmarks.js' })).toBeNull();
  });

  it('does not ship X OAuth, cookies, host permissions, or page scraping UI', () => {
    const manifest = JSON.parse(loadSrc('manifest.json'));
    const optionsHtml = loadSrc('options.html');
    const optionsJs = loadSrc('options.js');
    const haystack = [optionsHtml, optionsJs].join('\n');

    expect(manifest.permissions).not.toContain('identity');
    expect(manifest.host_permissions || []).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/\/\/([^/]+\.)?(x|twitter)\.com|api\.x\.com|api\.twitter\.com/i)
    ]));
    expect(haystack).not.toMatch(/OAuth|access token|refresh token|cookie import|browser session|page crawl/i);
    expect(optionsHtml).toContain('user-owned X archive verifies bookmark fields');
    expect(optionsHtml).toContain('X/Twitter web pages, cookies, and private GraphQL are not accepted');
  });
});
