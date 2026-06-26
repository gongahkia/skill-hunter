/**
 * Shared constants for the review-first Dorso public store build.
 */

export const SESSION_DURATION_MS = 15 * 60 * 1000;
export const SESSION_DURATION_MINUTES = 15;

export const INSTALL_ID_PREFIX = 'dorso-install';

export const CHATBOT_TARGETS = [
    {
        id: 'chatgpt',
        label: 'ChatGPT',
        hostnames: ['chatgpt.com'],
        pathPrefixes: ['/'],
        matches: ['https://chatgpt.com/*'],
    },
    {
        id: 'perplexity',
        label: 'Perplexity',
        hostnames: ['www.perplexity.ai'],
        pathPrefixes: ['/'],
        matches: ['https://www.perplexity.ai/*'],
    },
    {
        id: 'gemini',
        label: 'Gemini',
        hostnames: ['gemini.google.com'],
        pathPrefixes: ['/'],
        matches: ['https://gemini.google.com/*'],
    },
    {
        id: 'claude',
        label: 'Claude',
        hostnames: ['claude.ai'],
        pathPrefixes: ['/'],
        matches: ['https://claude.ai/*'],
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        hostnames: ['www.deepseek.com'],
        pathPrefixes: ['/'],
        matches: ['https://www.deepseek.com/*'],
    },
    {
        id: 'copilot',
        label: 'Copilot',
        hostnames: ['copilot.microsoft.com'],
        pathPrefixes: ['/'],
        matches: ['https://copilot.microsoft.com/*'],
    },
    {
        id: 'socrat',
        label: 'Socrat',
        hostnames: ['socrat.ai'],
        pathPrefixes: ['/'],
        matches: ['https://socrat.ai/*'],
    },
    {
        id: 'huggingface-chat',
        label: 'Hugging Face Chat',
        hostnames: ['huggingface.co'],
        pathPrefixes: ['/chat'],
        matches: ['https://huggingface.co/chat*'],
    },
    {
        id: 'writesonic-chat',
        label: 'WriteSonic',
        hostnames: ['writesonic.com'],
        pathPrefixes: ['/chat'],
        matches: ['https://writesonic.com/chat*'],
    },
    {
        id: 'you',
        label: 'You.com',
        hostnames: ['you.com'],
        pathPrefixes: ['/'],
        matches: ['https://you.com/*'],
    },
    {
        id: 'jasper',
        label: 'Jasper',
        hostnames: ['www.jasper.ai'],
        pathPrefixes: ['/'],
        matches: ['https://www.jasper.ai/*'],
    },
];

export const CHATBOT_MATCH_PATTERNS = CHATBOT_TARGETS.flatMap((target) => target.matches);

export const SOURCE_LABELS = {
    leetcode: 'LeetCode',
};

export const LOCAL_CHALLENGES = [
    { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy', topic_tags: ['Array', 'Hash Table'] },
    { slug: 'valid-parentheses', title: 'Valid Parentheses', difficulty: 'Easy', topic_tags: ['Stack', 'String'] },
    { slug: 'merge-two-sorted-lists', title: 'Merge Two Sorted Lists', difficulty: 'Easy', topic_tags: ['Linked List', 'Recursion'] },
    { slug: 'best-time-to-buy-and-sell-stock', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', topic_tags: ['Array', 'Dynamic Programming'] },
    { slug: 'maximum-subarray', title: 'Maximum Subarray', difficulty: 'Medium', topic_tags: ['Array', 'Dynamic Programming'] },
    { slug: 'group-anagrams', title: 'Group Anagrams', difficulty: 'Medium', topic_tags: ['Array', 'Hash Table', 'String'] },
    { slug: 'climbing-stairs', title: 'Climbing Stairs', difficulty: 'Easy', topic_tags: ['Dynamic Programming', 'Math'] },
    { slug: 'binary-tree-level-order-traversal', title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', topic_tags: ['Tree', 'Breadth-First Search'] },
    { slug: 'course-schedule', title: 'Course Schedule', difficulty: 'Medium', topic_tags: ['Graph', 'Topological Sort'] },
    { slug: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', topic_tags: ['Hash Table', 'Sliding Window', 'String'] },
    { slug: 'search-in-rotated-sorted-array', title: 'Search in Rotated Sorted Array', difficulty: 'Medium', topic_tags: ['Array', 'Binary Search'] },
    { slug: 'number-of-islands', title: 'Number of Islands', difficulty: 'Medium', topic_tags: ['Graph', 'Depth-First Search', 'Breadth-First Search'] },
];

export const STORAGE_KEYS = {
    INSTALL_ID: 'installId',
    SESSION_EXPIRES_AT: 'sessionExpiresAt',
    LAST_SOLVED_TIME: 'lastSolvedTime',
    CURRENT_CHALLENGE: 'currentChallenge',
    CHALLENGE_STARTED_AT: 'challengeStartedAt',
    RECENT_CHALLENGE_SLUGS: 'recentChallengeSlugs',
    ENABLED_TARGET_IDS: 'enabledTargetIds',
    IS_PAUSED: 'isPaused',
    UI_MESSAGE: 'uiMessage',
};

export const MESSAGE_ACTIONS = {
    REQUEST_STATE: 'requestState',
    START_CHALLENGE: 'startChallenge',
    SAVE_SETTINGS: 'saveSettings',
    SET_PAUSED: 'setPaused',
    SUBMISSION_RESULT: 'submissionResult',
    CLEAR_UI_MESSAGE: 'clearUiMessage',
};

export function getDefaultEnabledTargetIds() {
    return CHATBOT_TARGETS.map((target) => target.id);
}

export function getChatbotTargetById(targetId) {
    return CHATBOT_TARGETS.find((target) => target.id === targetId) || null;
}

export function getChatbotTargetByUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return CHATBOT_TARGETS.find((target) => {
            if (!target.hostnames.includes(parsedUrl.hostname)) {
                return false;
            }

            return target.pathPrefixes.some((prefix) => parsedUrl.pathname.startsWith(prefix));
        }) || null;
    } catch {
        return null;
    }
}
