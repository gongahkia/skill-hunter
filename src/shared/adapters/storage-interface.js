/**
 * Abstract interface for browser storage.
 * Implementations must provide get, set, and remove methods.
 */

class StorageInterface {
    async get(key) {
        throw new Error('get() must be implemented');
    }

    async set(key, value) {
        throw new Error('set() must be implemented');
    }

    async remove(key) {
        throw new Error('remove() must be implemented');
    }

    async clear() {
        throw new Error('clear() must be implemented');
    }
}

export default StorageInterface;
