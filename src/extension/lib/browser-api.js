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

export function getBrowserApi() {
    return browserApi;
}

export function getBrowserName() {
    return globalThis.browser ? 'firefox' : 'chrome';
}

export function runtimeUrl(path) {
    return browserApi.runtime.getURL(path);
}

export async function sendRuntimeMessage(message) {
    const response = browserApi.runtime.sendMessage(message);
    return isPromise(response) ? response : callbackToPromise((done) => {
        browserApi.runtime.sendMessage(message, done);
    });
}

export async function queryTabs(queryInfo) {
    const response = browserApi.tabs.query(queryInfo);
    return isPromise(response) ? response : callbackToPromise((done) => {
        browserApi.tabs.query(queryInfo, done);
    });
}

export async function createTab(createProperties) {
    const response = browserApi.tabs.create(createProperties);
    return isPromise(response) ? response : callbackToPromise((done) => {
        browserApi.tabs.create(createProperties, done);
    });
}

export async function updateTab(tabId, updateProperties) {
    const response = browserApi.tabs.update(tabId, updateProperties);
    return isPromise(response) ? response : callbackToPromise((done) => {
        browserApi.tabs.update(tabId, updateProperties, done);
    });
}

export async function getTab(tabId) {
    const response = browserApi.tabs.get(tabId);
    return isPromise(response) ? response : callbackToPromise((done) => {
        browserApi.tabs.get(tabId, done);
    });
}

export function addAsyncMessageListener(handler) {
    browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
        Promise.resolve(handler(message, sender))
            .then((result) => sendResponse(result || {}))
            .catch((error) => {
                sendResponse({
                    success: false,
                    error: error.message || 'Unknown extension error.',
                });
            });
        return true;
    });
}

