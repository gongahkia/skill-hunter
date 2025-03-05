// ----- CONST DEFINITIONS -----

const LLM_REGEX = /chatgpt\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|deepseek\.com|you\.com|jasper\.ai|copilot\.microsoft\.com|writesonic\.com\/chat|socrat\.ai|huggingface\.co\/chat/;
const RESETTIME = 15 * 60 * 1000;
const LEETCODE_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';
const QUESTION_QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    title
    titleSlug
    content
    difficulty
    exampleTestcases
  }
}
`;

// ----- HELPER FUNCTION -----

async function fetchLeetCodeQuestion(titleSlug) {
    const response = await fetch(LEETCODE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: QUESTION_QUERY,
            variables: { titleSlug: titleSlug },
        }),
    });

    const data = await response.json();
    if (data.errors) {
        console.error("GraphQL Error:", data.errors);
        throw new Error("Failed to fetch LeetCode question");
    }
    return data.data.question;
}

// FUA to update this later
async function getRandomLeetCodeProblemTitleSlug() {
    return "two-sum";
}

// ----- EVENT LISTENER FUNCTIONS -----

browser.webNavigation.onBeforeNavigate.addListener(
    function(details) {
        if (LLM_REGEX.test(details.url)) {
            browser.storage.local.get(['lastSolvedTime']).then((result) => {
                const now = Date.now();
                if (!result.lastSolvedTime || now - result.lastSolvedTime > RESETTIME) {
                    browser.storage.local.set({originalUrl: details.url}).then(() => {
                        browser.tabs.update(details.tabId, {url: browser.runtime.getURL("popup.html")});
                    });
                }
            });
        }
    },
    {
        url: [{urlMatches: LLM_REGEX.source}]
    }
);

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getRandomQuestion") {
        (async () => {
            try {
                const titleSlug = await getRandomLeetCodeProblemTitleSlug();
                const questionData = await fetchLeetCodeQuestion(titleSlug);
                console.log("LeetCode Question Data:", questionData);
                sendResponse({ 
                    question: questionData.content, 
                    id: questionData.questionId, 
                    title: questionData.title,
                    slug: questionData.titleSlug
                });
            } catch (error) {
                console.error("Error fetching question:", error);
                sendResponse({ question: "Failed to fetch question.", id: null, title: null, slug: null });
            }
        })();
        return true; 
    }
    else if (request.action === "redirectToOriginal") {
        return browser.storage.local.get(['originalUrl']).then((result) => {
            if (result.originalUrl) {
                return browser.tabs.create({ url: result.originalUrl });
            }
        });
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message in background script:", message);
    if (message.action === "submissionSuccess" || (message.action === "submissionResult" && message.success)) {
        console.log("Successful submission detected");
        browser.runtime.sendMessage({ action: "updatePopup", content: "Congratulations! You've solved the problem." });
        browser.tabs.remove(sender.tab.id);
        browser.storage.local.set({lastSolvedTime: Date.now()}).then(() => {
            console.log("Last solved time updated");
        });
    } else if (message.action === "submissionResult" && !message.success) {
        console.log("Submission failed");
    }
});