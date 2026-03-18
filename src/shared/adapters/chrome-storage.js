/**
 * Chrome storage adapter using chrome.storage.local API.
 */

import StorageInterface from './storage-interface.js';
import logger from '../utils/logger.js';

class ChromeStorageAdapter extends StorageInterface {
    async get(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    logger.error('Chrome storage get error', {
                        key,
                        error: chrome.runtime.lastError,
                    });
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result[key]);
                }
            });
        });
    }

    async getMany(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(result);
            });
        });
    }

    async set(key, value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    logger.error('Chrome storage set error', {
                        key,
                        error: chrome.runtime.lastError,
                    });
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    async setMany(entries) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(entries, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve();
            });
        });
    }

    async remove(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(key, () => {
                if (chrome.runtime.lastError) {
                    logger.error('Chrome storage remove error', {
                        key,
                        error: chrome.runtime.lastError,
                    });
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    async clear() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                    logger.error('Chrome storage clear error', {
                        error: chrome.runtime.lastError,
                    });
                    reject(chrome.runtime.lastError);
                } else {
                    logger.info('Chrome storage cleared');
                    resolve();
                }
            });
        });
    }
}

export default ChromeStorageAdapter;
