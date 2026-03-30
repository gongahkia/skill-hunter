import { logInfo, logWarn } from '../logger';
import { detectBrowserTarget } from '../platform';
import { getPermissionProfile, hasAllScopes } from '../permissions';
import { loadSettings, loadToken, saveToken } from '../storage';
import { AccessMode, AuthLauncher, EditorType, OAuthTokenSet } from '../types';
import { createCodeChallenge, randomVerifier } from './pkce';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
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

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token request failed: ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
}

function toTokenSet(
  payload: TokenResponse,
  fallbackRefreshToken?: string,
  fallbackScopes?: string[]
): OAuthTokenSet {
  if (!payload.access_token || !payload.expires_in) {
    throw new Error('Google token response was missing access token fields.');
  }

  const scopeList = payload.scope?.split(' ').filter(Boolean) ?? fallbackScopes ?? [];
  const token: OAuthTokenSet = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in * 1000) - 30_000,
    scopes: scopeList,
  };

  if (payload.refresh_token) {
    token.refreshToken = payload.refresh_token;
  } else if (fallbackRefreshToken) {
    token.refreshToken = fallbackRefreshToken;
  }

  return token;
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

  const response = await requestToken(body);
  return toTokenSet(response);
}

async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  scopes: string[]
): Promise<OAuthTokenSet> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await requestToken(body);
  if (response.error) {
    throw new Error(response.error_description ?? response.error);
  }

  return toTokenSet(response, refreshToken, scopes);
}

export class GoogleAuthClient {
  constructor(private readonly launcher: AuthLauncher) {}

  private async resolveClientId(): Promise<{ browserTarget: string; clientId: string }> {
    const settings = await loadSettings();
    const browserTarget = detectBrowserTarget();
    const clientId = settings.oauthClientIds[browserTarget];

    if (!clientId) {
      throw new Error(
        `Set the ${browserTarget} Google OAuth client ID in Owl settings before signing in.`
      );
    }

    return { browserTarget, clientId };
  }

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

    if (existingToken?.refreshToken) {
      try {
        const { clientId } = await this.resolveClientId();
        const refreshedToken = await refreshAccessToken(
          clientId,
          existingToken.refreshToken,
          existingToken.scopes
        );

        if (hasAllScopes(refreshedToken.scopes, profile.oauthScopes)) {
          await saveToken(refreshedToken);
          logInfo('auth', 'refreshed Google OAuth access token');
          return refreshedToken.accessToken;
        }

        logWarn('auth', 'refreshed token did not satisfy required scopes', {
          requiredScopes: profile.oauthScopes,
          grantedScopes: refreshedToken.scopes,
        });
      } catch (error: unknown) {
        logWarn('auth', 'refresh token flow failed; falling back to interactive auth', error);
      }
    }

    const freshToken = await this.authorize(editor, accessMode);
    return freshToken.accessToken;
  }

  async authorize(editor: EditorType, accessMode: AccessMode): Promise<OAuthTokenSet> {
    const { clientId } = await this.resolveClientId();

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
      const description = parsedCallback.searchParams.get('error_description');
      throw new Error(`Google OAuth failed: ${description ?? error}`);
    }

    if (!code || returnedState !== state) {
      throw new Error('Google OAuth response was invalid or replayed.');
    }

    const token = await exchangeCodeForToken(clientId, redirectUri, code, verifier);
    await saveToken(token);
    logInfo('auth', 'completed interactive Google OAuth authorization');
    return token;
  }
}
