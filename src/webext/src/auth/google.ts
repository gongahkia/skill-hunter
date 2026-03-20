import { detectBrowserTarget } from '../platform';
import { getPermissionProfile, hasAllScopes } from '../permissions';
import { loadSettings, loadToken, saveToken } from '../storage';
import { AccessMode, AuthLauncher, EditorType, OAuthTokenSet } from '../types';
import { createCodeChallenge, randomVerifier } from './pkce';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: 'true',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForToken(
  clientId: string,
  redirectUri: string,
  code: string,
  verifier: string
): Promise<OAuthTokenSet> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const json = (await response.json()) as TokenResponse;
  const token: OAuthTokenSet = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in * 1000) - 30_000,
    scopes: json.scope ? json.scope.split(' ') : [],
  };

  if (json.refresh_token) {
    token.refreshToken = json.refresh_token;
  }

  return token;
}

export class GoogleAuthClient {
  constructor(private readonly launcher: AuthLauncher) {}

  async getAccessToken(editor: EditorType, accessMode: AccessMode): Promise<string> {
    const profile = getPermissionProfile(editor, accessMode);
    const existingToken = await loadToken();
    if (
      existingToken &&
      existingToken.expiresAt > Date.now() &&
      hasAllScopes(existingToken.scopes, profile.oauthScopes)
    ) {
      return existingToken.accessToken;
    }

    const freshToken = await this.authorize(editor, accessMode);
    return freshToken.accessToken;
  }

  async authorize(editor: EditorType, accessMode: AccessMode): Promise<OAuthTokenSet> {
    const settings = await loadSettings();
    const browserTarget = detectBrowserTarget();
    const clientId = settings.oauthClientIds[browserTarget];

    if (!clientId) {
      throw new Error(
        `Set the ${browserTarget} Google OAuth client ID in Owl settings before signing in.`
      );
    }

    const verifier = randomVerifier();
    const challenge = await createCodeChallenge(verifier);
    const redirectUri = await this.launcher.getRedirectUri();
    const state = crypto.randomUUID();
    const scopes = getPermissionProfile(editor, accessMode).oauthScopes;
    const authUrl = buildAuthUrl(clientId, redirectUri, scopes, state, challenge);
    const callbackUrl = await this.launcher.launch({
      authUrl,
      interactive: true,
    });

    const parsedCallback = new URL(callbackUrl);
    const returnedState = parsedCallback.searchParams.get('state');
    const code = parsedCallback.searchParams.get('code');
    const error = parsedCallback.searchParams.get('error');

    if (error) {
      throw new Error(`Google OAuth failed: ${error}`);
    }

    if (!code || returnedState !== state) {
      throw new Error('Google OAuth response was invalid or replayed.');
    }

    const token = await exchangeCodeForToken(clientId, redirectUri, code, verifier);
    await saveToken(token);
    return token;
  }
}
