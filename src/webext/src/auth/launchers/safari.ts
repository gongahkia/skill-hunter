import { AuthLauncher, AuthLaunchRequest } from '../../types';

export class SafariBridgeAuthLauncher implements AuthLauncher {
  async getRedirectUri(): Promise<string> {
    throw new Error(
      'Safari auth requires a containing macOS app bridge. See README2.md before packaging for Safari.'
    );
  }

  async launch(_request: AuthLaunchRequest): Promise<string> {
    throw new Error(
      'Safari auth requires a containing macOS app bridge. See README2.md before packaging for Safari.'
    );
  }
}
