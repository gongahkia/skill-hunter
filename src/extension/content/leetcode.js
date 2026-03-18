(function attachLeetCodeWatcher() {
    const runtime = globalThis.browser ?? globalThis.chrome;

    function notifyResult(success) {
        runtime.runtime.sendMessage({
            action: 'submissionResult',
            source: 'leetcode',
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

