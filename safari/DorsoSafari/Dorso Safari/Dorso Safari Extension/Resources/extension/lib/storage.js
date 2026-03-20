import ChromeStorageAdapter from '../../shared/adapters/chrome-storage.js';
import FirefoxStorageAdapter from '../../shared/adapters/firefox-storage.js';

export function createStorageAdapter() {
    if (globalThis.browser) {
        return new FirefoxStorageAdapter();
    }

    return new ChromeStorageAdapter();
}

