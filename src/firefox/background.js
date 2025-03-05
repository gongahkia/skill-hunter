// ----- CONST DEFINITIONS -----

const fs = require('fs').promises;
const LLM_REGEX = /chatgpt\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|deepseek\.com|you\.com|jasper\.ai|copilot\.microsoft\.com|writesonic\.com\/chat|socrat\.ai|huggingface\.co\/chat/;
const RESETTIME = 15 * 60 * 1000;
const LEETCODE_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';
const QUESTION_QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    title
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
            variables: { titleSlug: titleSlug }, // Example: "two-sum"
        }),
    });

    const data = await response.json();
    if (data.errors) {
        console.error("GraphQL Error:", data.errors);
        throw new Error("Failed to fetch LeetCode question");
    }
    return data.data.question;
}

async function getRandomLeetCodeProblemTitleSlug() {
    try {
        const data = await fs.readFile('questions.txt', 'utf8');
        const questions = data.split('\n').filter(line => line.trim() !== '');
        const randomIndex = Math.floor(Math.random() * questions.length);
        return questions[randomIndex].trim();
    } catch (error) {
        console.error('Error reading questions.txt:', error);
        return "two-sum";
    }
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
                const question = questionData.content; 
                const questionId = questionData.questionId;
                const questionTitle = questionData.title;
                sendResponse({ question: question, id: questionId, title: questionTitle }); 
            } catch (error) {
                console.error("Error fetching question:", error);
                sendResponse({ question: "Failed to fetch question.", id: null });
            }
        })();
        return true; 
    }
    else if (request.action === "checkAnswer") {
        // Implement a more robust checking mechanism.  For example, you can use a combination of string matching and regular expressions.
        const correctAnswer = "Stack"; // Replace with your actual answer checking logic
        const isCorrect = request.userAnswer.trim() === correctAnswer.trim();
        return Promise.resolve({isCorrect: isCorrect});

    }
    else if (request.action === "redirectToOriginal") {
        return browser.storage.local.get(['originalUrl']).then((result) => {
            if (result.originalUrl) {
                return browser.tabs.create({ url: result.originalUrl });
            }
        });
    }
});