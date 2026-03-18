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
export const SESSION_DURATION_MINUTES = 15;

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
    topicTags {
      name
      slug
    }
  }
}
`;

// Backend API configuration
export const BACKEND_API_URL = 'http://localhost:8000/api/v1';

export const VERIFIED_SOURCES = ['leetcode', 'codeforces'];
export const PRACTICE_SOURCES = ['codewars', 'exercism'];

export const SOURCE_LABELS = {
    leetcode: 'LeetCode',
    codeforces: 'Codeforces',
    codewars: 'Codewars',
    exercism: 'Exercism',
};

// Storage keys
export const STORAGE_KEYS = {
    SESSION_EXPIRES_AT: 'sessionExpiresAt',
    LAST_SOLVED_TIME: 'lastSolvedTime',
    PENDING_REDIRECT_URL: 'pendingRedirectUrl',
    PENDING_TAB_ID: 'pendingTabId',
    CURRENT_CHALLENGE: 'currentChallenge',
    CHALLENGE_STARTED_AT: 'challengeStartedAt',
    CHALLENGE_SOURCE: 'challengeSource',
    LAST_SUBMITTED_SOLUTION: 'lastSubmittedSolution',
    LAST_QUESTION_SLUG: 'lastQuestionSlug',
    EXTENSION_ID: 'extensionId',
    USER_STATS: 'userStats',
    USER_PREFERENCES: 'userPreferences',
    USER_IDENTITIES: 'userIdentities',
    PRACTICE_DECK: 'practiceDeck',
    LAST_ACCESS_URL: 'lastAccessUrl',
    LAST_ACCESS_LOGGED_AT: 'lastAccessLoggedAt',
    UI_MESSAGE: 'uiMessage',
};

// Message actions
export const MESSAGE_ACTIONS = {
    REQUEST_STATE: 'requestState',
    REFRESH_STATE: 'refreshState',
    START_CHALLENGE: 'startChallenge',
    OPEN_CURRENT_CHALLENGE: 'openCurrentChallenge',
    RESTORE_PENDING_TAB: 'restorePendingTab',
    SAVE_PREFERENCES: 'savePreferences',
    SAVE_IDENTITIES: 'saveIdentities',
    VERIFY_CODEFORCES: 'verifyCodeforces',
    LOG_CHATBOT_ACCESS: 'logChatbotAccess',
    SUBMISSION_RESULT: 'submissionResult',
    UPDATE_UI_MESSAGE: 'updateUiMessage',
};
