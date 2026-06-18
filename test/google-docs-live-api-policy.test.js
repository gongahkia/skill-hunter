import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

describe('Google Docs live API policy', () => {
  it('does not ship Drive host permissions for the M10 local importer', () => {
    const manifest = JSON.parse(loadSrc('manifest.json'));
    const hosts = manifest.host_permissions || [];

    expect(hosts.some((host) => /googleapis\.com\/.*drive|drive\.google\.com/i.test(host))).toBe(false);
    expect(manifest.permissions).not.toContain('identity');
  });
});
