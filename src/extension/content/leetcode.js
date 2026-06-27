(function attachLeetCodeWatcher() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const networkMessageSource = 'dorso-leetcode-network';

    function getProblemSlug() {
        const match = location.pathname.match(/\/problems\/([^/]+)/);
        return match ? match[1] : null;
    }

    function notifyResult(success) {
        const slug = getProblemSlug();
        if (!slug) {
            return;
        }

        globalThis.DorsoMessaging.sendRuntimeMessage({
            action: 'submissionResult',
            source: 'leetcode',
            slug,
            success,
        }).catch(() => {});
    }

    function getSubmissionStatusFromDocument() {
        const resultNode = document.querySelector('span[data-e2e-locator="submission-result"]');
        if (resultNode?.textContent) {
            return resultNode.textContent.includes('Accepted');
        }

        const greenMessage = document.querySelector('.text-message-green-s');
        if (greenMessage?.textContent?.includes('Accepted')) {
            return true;
        }

        if (document.body?.textContent?.includes('Accepted')) {
            return true;
        }

        return null;
    }

    function responseTextShowsAccepted(text) {
        return text.includes('Accepted') || text.includes('"status_msg":"Accepted"');
    }

    function injectNetworkHook() {
        if (document.documentElement.dataset.dorsoLeetcodeNetworkHook === 'true') {
            return;
        }

        document.documentElement.dataset.dorsoLeetcodeNetworkHook = 'true';
        const script = document.createElement('script');
        script.textContent = `
            (() => {
                const source = '${networkMessageSource}';
                const report = (text) => window.postMessage({ source, text }, '*');
                const inspect = (url, response) => {
                    if (!String(url).includes('/submissions/detail/')) return;
                    Promise.resolve(response).then((value) => {
                        if (typeof value === 'string') {
                            report(value);
                        }
                    }).catch(() => {});
                };
                const originalFetch = window.fetch;
                if (originalFetch) {
                    window.fetch = async (...args) => {
                        const response = await originalFetch(...args);
                        const url = args[0]?.url || args[0];
                        if (String(url).includes('/submissions/detail/')) {
                            response.clone().text().then(report).catch(() => {});
                        }
                        return response;
                    };
                }
                const originalOpen = XMLHttpRequest.prototype.open;
                const originalSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this.__dorsoUrl = url;
                    return originalOpen.call(this, method, url, ...rest);
                };
                XMLHttpRequest.prototype.send = function(...args) {
                    this.addEventListener('loadend', function() {
                        inspect(this.__dorsoUrl, this.responseText);
                    });
                    return originalSend.apply(this, args);
                };
            })();
        `;
        document.documentElement.appendChild(script);
        script.remove();
    }

    function observeSubmissionState() {
        const observer = new MutationObserver(() => {
            const accepted = getSubmissionStatusFromDocument();
            if (accepted === null) {
                return;
            }

            observer.disconnect();
            notifyResult(accepted);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window || event.data?.source !== networkMessageSource) {
            return;
        }

        if (responseTextShowsAccepted(String(event.data.text || ''))) {
            notifyResult(true);
        }
    });

    injectNetworkHook();
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href === lastUrl) {
            return;
        }

        lastUrl = location.href;
        if (location.href.includes('/submissions/')) {
            observeSubmissionState();
        }
    }).observe(document, {
        childList: true,
        subtree: true,
    });
})();
