import { extensionBrowser } from '../../browser-api';
import { AuthLauncher, AuthLaunchRequest } from '../../types';

export class ExtensionIdentityAuthLauncher implements AuthLauncher {
  async getRedirectUri(): Promise<string> {
    if (!extensionBrowser.identity?.getRedirectURL) {
      throw new Error('The browser identity redirect API is unavailable.');
    }

    return extensionBrowser.identity.getRedirectURL('owl-auth');
  }

  async launch(request: AuthLaunchRequest): Promise<string> {
    if (!extensionBrowser.identity?.launchWebAuthFlow) {
      throw new Error('The browser identity web auth flow API is unavailable.');
    }

    return await extensionBrowser.identity.launchWebAuthFlow({
      interactive: request.interactive,
      url: request.authUrl,
    });
  }
}
