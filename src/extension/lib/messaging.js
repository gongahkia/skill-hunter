(function installDorsoMessaging() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const failureCountKey = 'messageFailureCount';
    const defaultTimeoutMs = 5000;
    const defaultRetries = 1;

    function callbackToPromise(invoker) {
        return new Promise((resolve, reject) => {
            invoker((result) => {
                const runtimeError = browserApi.runtime?.lastError;
                if (runtimeError) {
                    reject(new Error(runtimeError.message || String(runtimeError)));
                    return;
                }

                resolve(result || {});
            });
        });
    }

    function storageGet(key) {
        if (globalThis.browser?.storage?.local) {
            return globalThis.browser.storage.local.get([key]);
        }

        return callbackToPromise((done) => browserApi.storage.local.get([key], done));
    }

    function storageSet(values) {
        if (globalThis.browser?.storage?.local) {
            return globalThis.browser.storage.local.set(values);
        }

        return callbackToPromise((done) => browserApi.storage.local.set(values, done));
    }

    async function recordMessageFailure() {
        try {
            const stored = await storageGet(failureCountKey);
            const count = Number(stored?.[failureCountKey] || 0);
            await storageSet({ [failureCountKey]: Number.isFinite(count) ? count + 1 : 1 });
        } catch {
        }
    }

    function rawSendRuntimeMessage(message) {
        if (globalThis.browser?.runtime?.sendMessage) {
            return globalThis.browser.runtime.sendMessage(message);
        }

        return callbackToPromise((done) => browserApi.runtime.sendMessage(message, done));
    }

    function withTimeout(promise, message, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = globalThis.setTimeout(() => {
                reject(new Error(`Runtime message timed out: ${message?.action || 'unknown'}`));
            }, timeoutMs);

            Promise.resolve(promise)
                .then(resolve, reject)
                .finally(() => {
                    globalThis.clearTimeout(timeout);
                });
        });
    }

    async function sendRuntimeMessage(message, options = {}) {
        const retries = Number.isInteger(options.retries) ? Math.max(0, options.retries) : defaultRetries;
        const timeoutMs = Number.isInteger(options.timeoutMs) ? Math.max(1, options.timeoutMs) : defaultTimeoutMs;
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                return await withTimeout(rawSendRuntimeMessage(message), message, timeoutMs);
            } catch (error) {
                lastError = error;
            }
        }

        await recordMessageFailure();
        throw lastError;
    }

    globalThis.DorsoMessaging = {
        failureCountKey,
        sendRuntimeMessage,
    };
})();
