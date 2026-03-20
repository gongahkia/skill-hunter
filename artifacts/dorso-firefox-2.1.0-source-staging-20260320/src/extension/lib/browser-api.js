const browserApi = globalThis.browser ?? globalThis.chrome;
const isPromise = (value) => value && typeof value.then === 'function';

function callbackToPromise(invoker) {
    return new Promise((resolve, reject) => {
        invoker((result) => {
            const runtimeError = browserApi.runtime?.lastError;
            if (runtimeError) {
                reject(new Error(runtimeError.message || String(runtimeError)));
                return;
            }
            resolve(result);
        });
    });
}

export async function sendRuntimeMessage(message) {
    const response = browserApi.runtime.sendMessage(message);
    return isPromise(response) ? response : callbackToPromise((done) => {
        browserApi.runtime.sendMessage(message, done);
    });
}
