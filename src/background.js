const LLM_REGEX = /chat\.openai\.com|bard\.google\.com/; // Add more LLM URLs as needed

const QUESTIONS = {
  1: {
    "Write a function to reverse a string": "function reverseString(str) { return str.split('').reverse().join(''); }"
  },
  2: {
    "Write a function to check if a number is prime": "function isPrime(num) { if (num <= 1) return false; for (let i = 2; i <= Math.sqrt(num); i++) { if (num % i === 0) return false; } return true; }"
  },
  3: {
    "Write a function to find the maximum element in an array": "function findMax(arr) { return Math.max(...arr); }"
  }
  // Add more questions as needed
};

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (LLM_REGEX.test(details.url)) {
      chrome.storage.local.get(['lastSolvedTime'], function(result) {
        const now = Date.now();
        if (!result.lastSolvedTime || now - result.lastSolvedTime > 24 * 60 * 60 * 1000) {
          return {redirectUrl: chrome.runtime.getURL("popup.html")};
        }
      });
    }
  },
  {urls: ["<all_urls>"]},
  ["blocking"]
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
  }
  return true;
});
