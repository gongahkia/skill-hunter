// ----- CONST DEFINITIONS -----

const LLM_REGEX = /chatgpt\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|deepseek\.com|you\.com|jasper\.ai|copilot\.microsoft\.com|writesonic\.com\/chat|socrat\.ai|huggingface\.co\/chat/;
const RESETTIME = 15 * 60 * 1000;
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
  },
  61: {
    "What is the process of finding and fixing bugs called?": "Debugging"
  },
  62: {
    "What is the name for a program that translates assembly language to machine code?": "Assembler"
  },
  63: {
    "What data structure is used to implement undo functionality?": "Stack"
  },
  64: {
    "What is the term for a variable that can be accessed from any function?": "Global"
  },
  65: {
    "What is the most common HTTP method for retrieving data?": "GET"
  },
  66: {
    "What is the process of converting high-level language to machine code called?": "Compilation"
  },
  67: {
    "What is the name for a function with no side effects?": "Pure"
  },
  68: {
    "What is the default access modifier in Java?": "Package-private"
  },
  69: {
    "What is the term for a program that can modify or replicate itself?": "Virus"
  },
  70: {
    "What is the name for a type of loop that always executes at least once?": "Do-while"
  },
  71: {
    "What is the process of combining software components called?": "Integration"
  },
  72: {
    "What is the term for a piece of code that runs independently within a program?": "Thread"
  },
  73: {
    "What is the name for a program that appears legitimate but contains malware?": "Trojan"
  },
  74: {
    "What is the term for a function that takes another function as an argument?": "Higher-order"
  },
  75: {
    "What is the process of converting object instances to byte streams called?": "Serialization"
  },
  76: {
    "What is the name for a type of programming language that uses tags?": "Markup"
  },
  77: {
    "What is the term for a variable whose value cannot be changed after initialization?": "Constant"
  },
  78: {
    "What is the name for a type of attack that injects malicious scripts into websites?": "XSS"
  },
  79: {
    "What is the term for a function that is defined inside another function?": "Closure"
  },
  80: {
    "What is the process of breaking a program into modules called?": "Modularization"
  },
  81: {
    "What is the name for a type of error that occurs during program execution?": "Runtime"
  },
  82: {
    "What is the term for a program that replicates itself across a network?": "Worm"
  },
  83: {
    "What is the name for a type of database that uses tables and rows?": "Relational"
  },
  84: {
    "What is the term for a function that doesn't return a value?": "Void"
  },
  85: {
    "What is the name for a type of attack that overwhelms a system with traffic?": "DDoS"
  },
  86: {
    "What is the term for a variable that is accessible only within a specific function?": "Local"
  },
  87: {
    "What is the name for a type of loop that repeats a specific number of times?": "For"
  },
  88: {
    "What is the term for a program that automatically gathers information from websites?": "Scraper"
  },
  89: {
    "What is the name for a type of sort that repeatedly steps through a list?": "Bubble sort"
  },
  90: {
    "What is the term for a function that calls itself?": "Recursive"
  },
  91: {
    "What is the name for a type of database that doesn't use tables?": "NoSQL"
  },
  92: {
    "What is the term for a program that translates high-level language to machine code?": "Compiler"
  },
  93: {
    "What is the name for a type of error that violates syntax rules?": "Syntax"
  },
  94: {
    "What is the term for a variable that can hold multiple values of the same type?": "Array"
  },
  95: {
    "What is the name for a type of attack that exploits incorrect assumptions about user input?": "Injection"
  },
  96: {
    "What is the term for a program that emulates a computer system?": "Virtual machine"
  },
  97: {
    "What is the name for a type of programming that uses mathematical functions?": "Functional"
  },
  98: {
    "What is the term for a program that automatically builds and tests code?": "CI/CD"
  },
  99: {
    "What is the name for a type of error that produces incorrect output?": "Logic"
  },
  100: {
    "What is the term for a program that manages other programs? Give the acronym. (Hint: It's 2 letters)": "OS"
  },
  101: {
    "What data structure uses a hash function to compute an index?": "Hash table"
  },
  102: {
    "What is the worst-case time complexity of quicksort?": "O(n^2)"
  },
  103: {
    "What deployment strategy updates all instances simultaneously?": "All-at-once"
  },
  104: {
    "What data structure represents hierarchical relationships?": "Tree"
  },
  105: {
    "What algorithm finds the shortest path in a weighted graph? Remove the 's from the name.": "Dijkstra"
  },
  106: {
    "What is the process of gradually shifting traffic to a new version?": "Canary deployment"
  },
  107: {
    "Are Python lists mutable or immutable? Capitalize your answer.": "Mutable"
  },
  108: {
    "What sorting algorithm has O(n log n) time complexity in all cases?": "Mergesort"
  },
  109: {
    "What is the practice of frequent, automated software releases?": "Continuous deployment"
  },
  110: {
    "What data structure allows fast insertion and deletion at both ends? Use the shorthand name.": "Deque"
  },
  111: {
    "What algorithm is used for finding strongly connected components in a graph? Remove the 's from the name.": "Kosaraju"
  },
  112: {
    "What deployment strategy keeps both old and new versions running?": "Blue-green deployment"
  },
  113: {
    "What data structure is used to implement a priority queue?": "Heap"
  },
  114: {
    "What is the time complexity of binary search?": "O(log n)"
  },
  115: {
    "What is the practice of running multiple copies of an application?": "Horizontal scaling"
  },
  116: {
    "What data structure represents a collection of disjoint sets?": "Union-find"
  },
  117: {
    "What algorithm is used for topological sorting of a graph? Remove the 's from the name.": "Kahn"
  },
  118: {
    "What is the process of rolling back to a previous version called?": "Rollback"
  },
  119: {
    "What data structure is used to implement a trie?": "Tree"
  },
  120: {
    "What is the best-case time complexity of bubble sort?": "O(n)"
  },
  121: {
    "What is the practice of deploying to a subset of users first?": "Staged rollout"
  },
  122: {
    "What data structure uses FIFO principle?": "Queue"
  },
  123: {
    "What algorithm is used for finding the minimum spanning tree of a graph? Remove the 's from the name.": "Kruskal"
  },
  124: {
    "What is the practice of deploying during low-traffic periods?": "Off-peak deployment"
  },
  125: {
    "What data structure is used to implement an LRU cache?": "Hash table"
  },
  126: {
    "What is the time complexity of counting sort?": "O(n+k)"
  },
  127: {
    "What is the practice of deploying small, frequent updates?": "Continuous delivery"
  },
  128: {
    "What data structure is used to implement a graph?": "Adjacency list"
  },
  129: {
    "What algorithm is used for string pattern matching?": "KMP"
  },
  130: {
    "What is the practice of deploying to multiple regions simultaneously?": "Multi-region deployment"
  },
  131: {
    "What data structure is used to implement a cache with O(1) operations?": "LRU cache"
  },
  132: {
    "What is the space complexity of merge sort?": "O(n)"
  },
  133: {
    "What is the practice of deploying in containers?": "Containerization"
  },
  134: {
    "What data structure is used to implement a suffix tree?": "Tree"
  },
  135: {
    "What algorithm is used for finding the longest common subsequence?": "Dynamic programming"
  },
  136: {
    "What is the practice of deploying to a copy of the production environment?": "Staging"
  },
  137: {
    "What data structure is used to implement a bloom filter?": "Bit array"
  },
  138: {
    "What is the time complexity of heapify operation?": "O(log n)"
  },
  139: {
    "What is the practice of deploying different versions to different users?": "A/B testing"
  },
  140: {
    "What data structure is used to implement a skip list?": "Linked list"
  },
  141: {
    "What algorithm is used for finding the convex hull of a set of points?": "Graham scan"
  },
  142: {
    "What is the practice of deploying updates without downtime?": "Zero-downtime deployment"
  },
  143: {
    "What data structure is used to implement a segment tree?": "Tree"
  },
  144: {
    "What is the average-case time complexity of quicksort?": "O(n log n)"
  },
  145: {
    "What is the practice of deploying to a subset of servers first?": "Rolling deployment"
  },
  146: {
    "What data structure is used to implement a disjoint set?": "Tree"
  },
  147: {
    "What algorithm is used for finding the shortest path in a DAG?": "Topological sort"
  },
  148: {
    "What is the practice of deploying in isolated environments?": "Sandboxing"
  },
  149: {
    "What data structure is used to implement a B-tree?": "Tree"
  },
  150: {
    "What is the time complexity of radix sort?": "O(d(n+k))"
  }
};

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
    const questionKeys = Object.keys(QUESTIONS);
    const randomKey = questionKeys[Math.floor(Math.random() * questionKeys.length)];
    const questionObj = QUESTIONS[randomKey];
    const question = Object.keys(questionObj)[0];
    const answer = questionObj[question];
    return Promise.resolve({question: question, answer: answer, id: randomKey});
  } else if (request.action === "checkAnswer") {
    const correctAnswer = QUESTIONS[request.id][request.question];
    const isCorrect = request.userAnswer.trim() === correctAnswer.trim();
    return Promise.resolve({isCorrect: isCorrect});
  } else if (request.action === "redirectToOriginal") {
    return browser.storage.local.get(['originalUrl']).then((result) => {
      if (result.originalUrl) {
        return browser.tabs.create({ url: result.originalUrl });
      }
    });
  }
});