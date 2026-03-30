import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadLauncher(runtime: Record<string, unknown>) {
  vi.resetModules();
  vi.stubGlobal('browser', { runtime });
  const module = await import('../src/auth/launchers/safari');
  return module.SafariBridgeAuthLauncher;
}

describe('SafariBridgeAuthLauncher', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('requests redirect URI from the Safari host bridge', async () => {
    const sendNativeMessage = vi
      .fn()
      .mockResolvedValue({ ok: true, redirectUri: 'owl://oauth/callback' });
    const Launcher = await loadLauncher({ sendNativeMessage });
    const launcher = new Launcher('com.example.owl');

    await expect(launcher.getRedirectUri()).resolves.toBe('owl://oauth/callback');
    expect(sendNativeMessage).toHaveBeenCalledWith(
      'com.example.owl',
      expect.objectContaining({
        type: 'owl:safari-auth',
        command: 'getRedirectUri',
      }),
      expect.any(Function)
    );
  });

  it('handles callback-style native messaging responses for launch', async () => {
    const sendNativeMessage = vi.fn((_host: string, _payload: unknown, callback: (response: unknown) => void) => {
      callback({ ok: true, callbackUrl: 'owl://oauth/callback?code=abc&state=xyz' });
    });
    const Launcher = await loadLauncher({ sendNativeMessage });
    const launcher = new Launcher('com.example.owl');

    await expect(
      launcher.launch({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=xyz',
        interactive: true,
      })
    ).resolves.toBe('owl://oauth/callback?code=abc&state=xyz');
  });

  it('surfaces host bridge failures', async () => {
    const sendNativeMessage = vi.fn().mockResolvedValue({
      ok: false,
      error: 'native bridge unavailable',
    });
    const Launcher = await loadLauncher({ sendNativeMessage });
    const launcher = new Launcher('com.example.owl');

    await expect(
      launcher.launch({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        interactive: true,
      })
    ).rejects.toThrow('native bridge unavailable');
  });

  it('fails when native messaging bridge is missing', async () => {
    const Launcher = await loadLauncher({});
    const launcher = new Launcher('com.example.owl');

    await expect(launcher.getRedirectUri()).rejects.toThrow(
      'Safari native host bridge is unavailable'
    );
  });
});
