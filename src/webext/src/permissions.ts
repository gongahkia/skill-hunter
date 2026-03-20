import { FIREFOX_DATA_TYPES, OAUTH_SCOPE_MAP } from './constants';
import { AccessMode, EditorType, PermissionProfile } from './types';

const IMPLIED_SCOPE_MAP: Record<string, string[]> = {
  'https://www.googleapis.com/auth/documents': [
    'https://www.googleapis.com/auth/documents.readonly',
  ],
  'https://www.googleapis.com/auth/spreadsheets': [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
  'https://www.googleapis.com/auth/presentations': [
    'https://www.googleapis.com/auth/presentations.readonly',
  ],
};

export function getPermissionProfile(
  editor: EditorType,
  accessMode: AccessMode
): PermissionProfile {
  return {
    editor,
    accessMode,
    oauthScopes: OAUTH_SCOPE_MAP[editor][accessMode],
    firefoxDataTypes: [...FIREFOX_DATA_TYPES],
  };
}

export function getSupersetScopeSet(
  editor: EditorType,
  accessMode: AccessMode
): Set<string> {
  return new Set(getPermissionProfile(editor, accessMode).oauthScopes);
}

export function hasAllScopes(grantedScopes: string[], requiredScopes: string[]): boolean {
  const granted = new Set(grantedScopes);

  for (const scope of grantedScopes) {
    const impliedScopes = IMPLIED_SCOPE_MAP[scope] ?? [];
    impliedScopes.forEach((implied) => granted.add(implied));
  }

  return requiredScopes.every((scope) => granted.has(scope));
}
