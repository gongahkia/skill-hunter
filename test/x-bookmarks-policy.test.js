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

  it('classifies official X API auth, access, cost, and rate-limit failures', () => {
    const policy = loadPolicy();

    expect(policy.classifyApiError({ status: 401 })).toMatchObject({
      code: 'X_BOOKMARKS_AUTH_FAILED',
      action: 'reauth',
      recoverable: true
    });
    expect(policy.classifyApiError({
      status: 403,
      body: { type: 'https://api.x.com/2/problems/client-forbidden', detail: 'App lacks access' }
    })).toMatchObject({
      code: 'X_BOOKMARKS_INSUFFICIENT_ACCESS',
      action: 'stop',
      costRelated: true
    });
    expect(policy.classifyApiError({
      status: 403,
      body: { type: 'https://api.x.com/2/problems/usage-capped', detail: 'Usage cap exceeded' }
    })).toMatchObject({
      code: 'X_BOOKMARKS_USAGE_CAPPED',
      action: 'stop',
      costRelated: true
    });
    expect(policy.classifyApiError({
      status: 429,
      headers: { 'x-rate-limit-reset': '1781740800' },
      body: { errors: [{ code: 88, message: 'Rate limit exceeded' }] }
    })).toMatchObject({
      code: 'X_BOOKMARKS_RATE_LIMITED',
      action: 'retry-after-reset',
      retryAt: '2026-06-18T00:00:00.000Z'
    });
  });

  it('classifies deleted, protected, retryable, and partial X API failures', () => {
    const policy = loadPolicy();

    expect(policy.classifyApiError({
      status: 404,
      body: { type: 'https://api.x.com/2/problems/resource-not-found' }
    })).toMatchObject({
      code: 'X_BOOKMARKS_POST_UNAVAILABLE',
      action: 'skip',
      preserveContext: true
    });
    expect(policy.classifyApiError({
      status: 403,
      body: { type: 'https://api.x.com/2/problems/not-authorized-for-resource', detail: 'protected account' }
    })).toMatchObject({
      code: 'X_BOOKMARKS_PROTECTED_POST',
      action: 'skip',
      preserveContext: true
    });
    expect(policy.classifyApiError({
      status: 503,
      headers: { 'retry-after': '60' }
    })).toMatchObject({
      code: 'X_BOOKMARKS_API_RETRYABLE',
      action: 'retry',
      recoverable: true
    });
    expect(policy.classifyPartialError({
      type: 'https://api.x.com/2/problems/resource-not-found',
      resource_id: '123'
    })).toMatchObject({
      code: 'X_BOOKMARKS_POST_UNAVAILABLE',
      preserveContext: true
    });
  });
});
