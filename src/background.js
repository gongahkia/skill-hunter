// ----- CONST DEFINITIONS -----

const LLM_REGEX = /chatgpt\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|deepseek\.com|you\.com|jasper\.ai|copilot\.microsoft\.com|writesonic\.com\/chat|socrat\.ai|huggingface\.co\/chat/;
const resetTime = 15 * 60 * 1000;
const QUESTIONS = {
  1: {
    "Write a function to reverse a string": "function reverseString(str) { return str.split('').reverse().join(''); }"
  },
  2: {
    "Write a function to check if a number is prime": "function isPrime(num) { if (num <= 1) return false; for (let i = 2; i <= Math.sqrt(num); i++) { if (num % i === 0) return false; } return true; }"
  },
  3: {
    "Write a function to find the maximum element in an array": "function findMax(arr) { return Math.max(...arr); }"
  },
  4: {
    "Test question": "4"
  }
};

// ----- EVENT LISTENER FUNCTIONS -----

chrome.webNavigation.onBeforeNavigate.addListener(
  function(details) {
    if (LLM_REGEX.test(details.url)) {
      chrome.storage.local.get(['lastSolvedTime'], function(result) {
        const now = Date.now();
        if (!result.lastSolvedTime || now - result.lastSolvedTime > resetTime) {
          chrome.storage.local.set({originalUrl: details.url}, function() {
            chrome.tabs.update(details.tabId, {url: chrome.runtime.getURL("popup.html")});
          });
        }
      });
    }
  },
  {url: [{urlMatches: LLM_REGEX.source}]}
);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getRandomQuestion") {
    const questionKeys = Object.keys(QUESTIONS);
    const randomKey = questionKeys[Math.floor(Math.random() * questionKeys.length)];
    const questionObj = QUESTIONS[randomKey];
    const question = Object.keys(questionObj)[0];
    const answer = questionObj[question];
    sendResponse({question: question, answer: answer, id: randomKey});
  } else if (request.action === "checkAnswer") {
    const correctAnswer = QUESTIONS[request.id][request.question];
    const isCorrect = request.userAnswer.trim() === correctAnswer.trim();
    sendResponse({isCorrect: isCorrect});
  } else if (request.action === "redirectToOriginal") {
    chrome.storage.local.get(['originalUrl'], function(result) {
      if (result.originalUrl) {
        chrome.tabs.create({ url: result.originalUrl }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
  return true;
});