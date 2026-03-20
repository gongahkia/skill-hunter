function checkSubmissionResult() {
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations) => {
            const resultSpans = document.querySelectorAll('span[data-e2e-locator="submission-result"]');
            for (let span of resultSpans) {
                console.log("Submission result found:", span.textContent);
                observer.disconnect();
                if (span.textContent.includes('Accepted')) {
                    console.log('Success');
                    chrome.runtime.sendMessage({ action: "submissionResult", success: true });
                    resolve('success');
                } else {
                    console.log('Failure');
                    chrome.runtime.sendMessage({ action: "submissionResult", success: false });
                    resolve('failure');
                }
                return;
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function checkURLChange(lastSubmittedSolution) {
    console.log('Starting URL change check...');
    let lastUrl = location.href;
    console.log(lastUrl);
    new MutationObserver(async () => {
        const url = location.href;
        console.log('Current URL:', url);
        if (url !== lastUrl) {
            console.log('URL changed from', lastUrl, 'to', url);
            lastUrl = url;
            if (url.includes('/submissions/')) {
                const result = await checkSubmissionResult();
                console.log('Submission result:', result);
            }
        }
    }).observe(document, { subtree: true, childList: true });
}

(async function() {
    console.log("LeetCode content script running");
    chrome.storage.local.get(['lastSubmittedSolution', 'lastQuestionSlug'], function(data) {
        const { lastSubmittedSolution, lastQuestionSlug } = data;
        console.log("Last submitted solution:", lastSubmittedSolution);
        console.log("Last question slug:", lastQuestionSlug);
        checkURLChange(lastSubmittedSolution);
    });
})();