import { describe, expect, it } from 'vitest';
import { getPermissionProfile, hasAllScopes } from '../src/permissions';

describe('permissions', () => {
  it('maps docs readonly operations to readonly scopes', () => {
    expect(getPermissionProfile('docs', 'readonly')).toEqual({
      editor: 'docs',
      accessMode: 'readonly',
      oauthScopes: ['https://www.googleapis.com/auth/documents.readonly'],
      firefoxDataTypes: ['authenticationInfo', 'websiteContent'],
    });
  });

  it('checks scope supersets correctly', () => {
    expect(
      hasAllScopes(
        ['https://www.googleapis.com/auth/documents'],
        ['https://www.googleapis.com/auth/documents.readonly']
      )
    ).toBe(true);
    expect(
      hasAllScopes(
        ['https://www.googleapis.com/auth/documents.readonly'],
        ['https://www.googleapis.com/auth/documents.readonly']
      )
    ).toBe(true);
  });
});
