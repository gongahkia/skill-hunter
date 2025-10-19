/**
 * Firefox storage adapter using browser.storage.local API.
 */

import StorageInterface from './storage-interface.js';
import logger from '../utils/logger.js';

class FirefoxStorageAdapter extends StorageInterface {
    async get(key) {
        try {
            const result = await browser.storage.local.get(key);
            return result[key];
        } catch (error) {
            logger.error('Firefox storage get error', {
                key,
                error: error.message,
            });
            throw error;
        }
    }

    async set(key, value) {
        try {
            await browser.storage.local.set({ [key]: value });
        } catch (error) {
            logger.error('Firefox storage set error', {
                key,
                error: error.message,
            });
            throw error;
        }
    }

    async remove(key) {
        try {
            await browser.storage.local.remove(key);
        } catch (error) {
            logger.error('Firefox storage remove error', {
                key,
                error: error.message,
            });
            throw error;
        }
    }

    async clear() {
        try {
            await browser.storage.local.clear();
            logger.info('Firefox storage cleared');
        } catch (error) {
            logger.error('Firefox storage clear error', {
                error: error.message,
            });
            throw error;
        }
    }
}

export default FirefoxStorageAdapter;
