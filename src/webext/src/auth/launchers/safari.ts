import { extensionBrowser } from '../../browser-api';
import { AuthLauncher, AuthLaunchRequest } from '../../types';

const DEFAULT_SAFARI_BRIDGE_HOST = 'com.gongahkia.owl';
const BRIDGE_TIMEOUT_MS = 120_000;

type SafariBridgeCommand = 'getRedirectUri' | 'launchAuthFlow';

interface SafariBridgeRequest {
  type: 'owl:safari-auth';
  command: SafariBridgeCommand;
  authUrl?: string;
  interactive?: boolean;
}

interface SafariBridgeResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  redirectUri?: string;
  callbackUrl?: string;
  url?: string;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === 'function';
}

function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractBridgePayload(response: unknown): Record<string, unknown> | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const payload = response as Record<string, unknown>;
  if (payload.payload && typeof payload.payload === 'object') {
    return payload.payload as Record<string, unknown>;
  }
  return payload;
}

function extractBridgeError(response: unknown): string | undefined {
  const payload = extractBridgePayload(response);
  if (!payload || payload.ok !== false) {
    return undefined;
  }

  return (
    getTrimmedString(payload.error) ??
    getTrimmedString(payload.message) ??
    'Safari host bridge returned an unknown error.'
  );
}

function extractBridgeUrl(response: unknown, preferredKey: 'redirectUri' | 'callbackUrl'): string | undefined {
  if (typeof response === 'string') {
    return getTrimmedString(response);
  }

  const payload = extractBridgePayload(response);
  if (!payload) {
    return undefined;
  }

  return (
    getTrimmedString(payload[preferredKey]) ??
    getTrimmedString(payload.url) ??
    getTrimmedString(payload.callbackUrl) ??
    getTrimmedString(payload.redirectUri)
  );
}

function getBridgeHostName(explicitHost?: string): string {
  const trimmedExplicitHost = getTrimmedString(explicitHost);
  if (trimmedExplicitHost) {
    return trimmedExplicitHost;
  }

  const injectedHost = getTrimmedString((globalThis as { __OWL_SAFARI_BRIDGE_HOST__?: unknown }).__OWL_SAFARI_BRIDGE_HOST__);
  return injectedHost ?? DEFAULT_SAFARI_BRIDGE_HOST;
}

async function sendBridgeRequest(hostName: string, request: SafariBridgeRequest): Promise<unknown> {
  const runtime = extensionBrowser.runtime;
  if (!runtime?.sendNativeMessage) {
    throw new Error(
      'Safari native host bridge is unavailable. Ensure Owl runs inside the containing macOS app.'
    );
  }

  return await new Promise<unknown>((resolve, reject) => {
    let settled = false;
    const complete = (value: unknown, isError: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      if (isError) {
        reject(value);
      } else {
        resolve(value);
      }
    };

    const timeoutHandle = setTimeout(() => {
      complete(
        new Error(`Timed out waiting for Safari host bridge response: ${request.command}`),
        true
      );
    }, BRIDGE_TIMEOUT_MS);

    try {
      const maybeResult = runtime.sendNativeMessage(
        hostName,
        request,
        (callbackResponse: unknown) => {
          if (runtime.lastError) {
            const message =
              runtime.lastError.message ?? 'Safari host bridge rejected the request.';
            complete(new Error(message), true);
            return;
          }

          complete(callbackResponse, false);
        }
      );

      if (isPromiseLike(maybeResult)) {
        maybeResult.then((response) => complete(response, false)).catch((error) => {
          complete(error instanceof Error ? error : new Error(String(error)), true);
        });
      } else if (typeof maybeResult !== 'undefined') {
        complete(maybeResult, false);
      }
    } catch (error: unknown) {
      complete(error instanceof Error ? error : new Error(String(error)), true);
    }
  });
}

export class SafariBridgeAuthLauncher implements AuthLauncher {
  constructor(private readonly hostName: string = getBridgeHostName()) {}

  async getRedirectUri(): Promise<string> {
    const response = await sendBridgeRequest(this.hostName, {
      type: 'owl:safari-auth',
      command: 'getRedirectUri',
    });
    const bridgeError = extractBridgeError(response);
    if (bridgeError) {
      throw new Error(`Safari host bridge failed to provide redirect URI: ${bridgeError}`);
    }

    const redirectUri = extractBridgeUrl(response, 'redirectUri');
    if (!redirectUri) {
      throw new Error('Safari host bridge did not return a redirect URI.');
    }

    return redirectUri;
  }

  async launch(request: AuthLaunchRequest): Promise<string> {
    const response = await sendBridgeRequest(this.hostName, {
      type: 'owl:safari-auth',
      command: 'launchAuthFlow',
      authUrl: request.authUrl,
      interactive: request.interactive,
    });
    const bridgeError = extractBridgeError(response);
    if (bridgeError) {
      throw new Error(`Safari host bridge failed to launch OAuth flow: ${bridgeError}`);
    }

    const callbackUrl = extractBridgeUrl(response, 'callbackUrl');
    if (!callbackUrl) {
      throw new Error('Safari host bridge did not return an OAuth callback URL.');
    }

    return callbackUrl;
  }
}
