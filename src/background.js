// ----- CONST DEFINITIONS -----

const LLM_REGEX = /chatgpt\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|deepseek\.com|you\.com|jasper\.ai|copilot\.microsoft\.com|writesonic\.com\/chat|socrat\.ai|huggingface\.co\/chat/;
const resetTime = 15 * 60 * 1000;
const QUESTIONS = {
  1: {
    "What data structure is LIFO (Last In First Out) and starts with an S? Capitalize your answer.": "Stack",
  },
  2: {
    "What data structure is FIFO (First In First Out) and starts with a Q? Capitalize your answer.": "Queue",
  },
  3: {
    "What data structure starts with a H? Capitalize your answer.": "Heap",
  },
  4 : {
    "In a perfect binary tree of depth 10, what is the maximum number of nodes?": "1023",
  },
  5: {
    "How many loops are there in a naive implementation of binary search?": "1"
  },
  6: {
    "What is the worst-case time complexity of quicksort?": "O(n^2)"
  },
  7: {
    "What is the average-case time complexity of merge sort?": "O(n log n)"
  },
  8: {
    "What data structure is typically used to implement a breadth-first search?": "Queue"
  },
  9: {
    "What is the space complexity of an in-place sorting algorithm?": "O(1)"
  },
  10: {
    "What is the time complexity of accessing an element in an array by its index?": "O(1)"
  },
  11: {
    "What is the primary advantage of a hash table over an array?": "Constant-time average case for insertion and lookup"
  },
  12: {
    "What is the maximum number of nodes in a binary tree of height h?": "2^(h+1) - 1"
  },
  13: {
    "What is the time complexity of the best algorithm for finding the nth Fibonacci number?": "O(log n)"
  },
  14: {
    "How many loops are typically used in a bubble sort algorithm?": "1"
  },
  15: {
    "How many bits are in a byte?": "8"
  },
  16: {
    "What is the result of 0.1 + 0.2 === 0.3 in JavaScript?": "false"
  },
  17: {
    "What is the time complexity of inserting an element at the beginning of an array?": "O(n)"
  },
  18: {
    "What data structure does JavaScript use to implement objects?": "hash table"
  },
  19: {
    "What is the output of console.log(1 + '2' + '2')?": "122"
  },
  20: {
    "What is the worst-case time complexity of quicksort?": "O(n^2)"
  },
  21: {
    "What is the name of the algorithm commonly used for balancing binary search trees?": "AVL"
  },
  22: {
    "What is the maximum number of children a node can have in a binary tree?": "2"
  },
  23: {
    "What is the result of typeof NaN in JavaScript?": "number"
  },
  24: {
    "What is the time complexity of accessing an element in a hash table?": "O(1)"
  },
  25: {
    "What is the name of the problem where two processes are waiting for each other to finish?": "deadlock"
  },
  26: {
    "What is the default prototype of all objects in JavaScript?": "Object.prototype"
  },
  27: {
    "What is the result of [] == [] in JavaScript?": "false"
  },
  28: {
  "What is the time complexity of the best sorting algorithms?": "O(n log n)"
  },
  29: {
    "What is the name of the algorithm used by most browsers for JavaScript's Array.prototype.sort()?": "Timsort"
  },
  30: {
    "What is the output of console.log(2 ** 3 ** 2)?": "512"
  },
  31: {
    "What is the time complexity of bogo sort? (Bogo sort is a sorting algorithm that randomly generates permutations of a list until it finds a sorted order.)": "O(n!)"
  },
  32: {
    "What is the time complexity of binary search?": "O(log n)"
  },
  33: {
    "What does the 'typeof null' return in JavaScript?": "object"
  },
  34: {
    "What is the default return value of a function in JavaScript if no return statement is specified?": "undefined"
  },
  35: {
    "What data structure uses LIFO (Last In, First Out) principle?": "Stack"
  },
  36: {
    "In Python, what keyword is used to define a function?": "def"
  },
  37: {
    "What is the time complexity of binary search?": "O(log n)"
  },
  38: {
    "What protocol is commonly used for secure shell connections?": "SSH"
  },
  39: {
    "In Java, what keyword is used to inherit from a class?": "extends"
  },
  40: {
    "What is the process of converting source code to machine code called?": "Compilation"
  },
  41: {
    "What data structure is typically used to implement a priority queue?": "Heap"
  },
  42: {
    "In Ruby, what symbol is used to define a class method?": "self"
  },
  43: {
    "What sorting algorithm has an average time complexity of O(n log n)?": "Quicksort"
  },
  44: {
    "What is the most common port number for HTTPS?": "443"
  },
  45: {
    "In JavaScript, what method is used to add elements to the end of an array?": "push"
  },
  46: {
    "What is the term for a function that calls itself?": "Recursion"
  },
  47: {
    "What data structure uses FIFO (First In, First Out) principle?": "Queue"
  },
  48: {
    "In Python, what is used to catch exceptions?": "try-except"
  },
  49: {
    "What algorithm is commonly used for finding the shortest path in a graph?": "Dijkstra's"
  },
  50: {
    "What is the process of hiding implementation details in OOP called?": "Encapsulation"
  },
  51: {
    "In Java, what keyword is used to implement an interface?": "implements"
  },
  52: {
    "What is the time complexity of accessing an element in an array by index?": "O(1)"
  },
  53: {
    "What protocol is used to send emails?": "SMTP"
  },
  54: {
    "In Ruby, what symbol is used to define a constant?": "Uppercase"
  },
  55: {
    "What is the name for a type of attack that exploits buffer overflows?": "Buffer overflow"
  },
  56: {
    "In JavaScript, what is used to declare a variable with block scope?": "let"
  },
  57: {
    "What is the process of converting machine code to assembly language called?": "Disassembly"
  },
  58: {
    "What data structure is typically used to implement a trie? (A trie is a data structure that stores and organizes strings, often used to store dictionaries alongside handling spell-check and autocomplete. )": "Tree"
  },
  59: {
    "In Python, what is used to define a class method?": "@classmethod"
  },
  60: {
    "What is the time complexity of inserting into a balanced binary search tree?": "O(log n)"
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