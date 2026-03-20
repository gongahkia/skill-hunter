(function attachLeetCodeWatcher() {
    const browserApi = globalThis.browser ?? globalThis.chrome;

    function getProblemSlug() {
        const match = location.pathname.match(/\/problems\/([^/]+)/);
        return match ? match[1] : null;
    }

    function notifyResult(success) {
        const slug = getProblemSlug();
        if (!slug) {
            return;
        }

        browserApi.runtime.sendMessage({
            action: 'submissionResult',
            source: 'leetcode',
            slug,
            success,
        });
    }

    function observeSubmissionState() {
        const observer = new MutationObserver(() => {
            const resultNode = document.querySelector('span[data-e2e-locator="submission-result"]');

            if (!resultNode) {
                return;
            }

            observer.disconnect();
            notifyResult(resultNode.textContent.includes('Accepted'));
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

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
