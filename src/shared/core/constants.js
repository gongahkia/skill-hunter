/**
 * Shared constants for Dorso browser extension.
 * Used across Chrome and Firefox implementations.
 */

// AI Chatbot blacklist regex
export const LLM_REGEX = /chatgpt\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|deepseek\.com|you\.com|jasper\.ai|copilot\.microsoft\.com|writesonic\.com\/chat|socrat\.ai|huggingface\.co\/chat/;

// Chatbot mapping for friendly names
export const CHATBOT_MAP = {
    'chatgpt.com': 'ChatGPT',
    'perplexity.ai': 'Perplexity',
    'gemini.google.com': 'Gemini',
    'claude.ai': 'Claude',
    'deepseek.com': 'DeepSeek',
    'you.com': 'You.com',
    'jasper.ai': 'Jasper',
    'copilot.microsoft.com': 'Copilot',
    'writesonic.com': 'WriteSonic',
    'socrat.ai': 'Socrat',
    'huggingface.co': 'HuggingFace'
};

// Session duration (15 minutes in milliseconds)
export const SESSION_DURATION_MS = 15 * 60 * 1000;

// LeetCode API configuration
export const LEETCODE_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';
export const QUESTION_QUERY = `
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

// Backend API configuration
export const BACKEND_API_URL = 'http://localhost:8000/api/v1';

// Storage keys
export const STORAGE_KEYS = {
    LAST_SOLVED_TIME: 'lastSolvedTime',
    ORIGINAL_URL: 'originalUrl',
    LAST_SUBMITTED_SOLUTION: 'lastSubmittedSolution',
    LAST_QUESTION_SLUG: 'lastQuestionSlug',
    EXTENSION_ID: 'extensionId',
    USER_STATS: 'userStats',
};

// Message actions
export const MESSAGE_ACTIONS = {
    GET_RANDOM_QUESTION: 'getRandomQuestion',
    OPEN_LEETCODE_QUESTION: 'openLeetCodeQuestion',
    REDIRECT_TO_ORIGINAL: 'redirectToOriginal',
    UPDATE_POPUP: 'updatePopup',
    SUBMISSION_RESULT: 'submissionResult',
    SUBMISSION_SUCCESS: 'submissionSuccess',
    CHECK_SESSION: 'checkSession',
};
