/**
 * Shared constants for the review-first Dorso public store build.
 */

export const SESSION_DURATION_MS = 15 * 60 * 1000;
export const SESSION_DURATION_MINUTES = 15;
export const SESSION_DURATION_MINUTE_OPTIONS = [5, 15, 30, 60];
export const SESSION_DURATION_MS_OPTIONS = SESSION_DURATION_MINUTE_OPTIONS.map((minutes) => minutes * 60 * 1000);

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

export const CHATBOT_DIFFICULTY_MAP = {
    'chatgpt.com': 'medium',
    'www.perplexity.ai': 'easy',
    'gemini.google.com': 'medium',
    'claude.ai': 'hard',
    'www.deepseek.com': 'medium',
    'copilot.microsoft.com': 'medium',
    'socrat.ai': 'easy',
    'huggingface.co': 'medium',
    'writesonic.com': 'easy',
    'you.com': 'easy',
    'www.jasper.ai': 'easy',
};

export const SOURCE_LABELS = {
    mcq: 'MCQ',
    drills: 'Drills',
    leetcode: 'LeetCode',
    aoc: 'Advent of Code',
    euler: 'Project Euler',
};

export const CHALLENGE_SOURCES = [
    { id: 'mcq', label: SOURCE_LABELS.mcq, tags: ['fundamentals', 'offline'], difficulties: ['easy', 'medium', 'hard'], enabledByDefault: true },
    { id: 'drills', label: SOURCE_LABELS.drills, tags: ['type-from-memory', 'offline'], difficulties: ['easy', 'medium', 'hard'], enabledByDefault: true },
    { id: 'leetcode', label: SOURCE_LABELS.leetcode, tags: ['algorithms', 'link-out'], difficulties: ['easy', 'medium', 'hard'], enabledByDefault: false },
    { id: 'aoc', label: SOURCE_LABELS.aoc, tags: ['advent-of-code', 'link-out'], difficulties: ['easy', 'medium', 'hard'], enabledByDefault: false },
    { id: 'euler', label: SOURCE_LABELS.euler, tags: ['project-euler', 'link-out'], difficulties: ['easy', 'medium', 'hard'], enabledByDefault: false },
];

export const DEFAULT_ENABLED_SOURCES = ['mcq', 'drills'];

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
    FIRST_STORAGE_WRITE_TIMESTAMP: 'firstStorageWriteTimestamp',
    SESSION_EXPIRES_AT: 'sessionExpiresAt',
    LAST_SOLVED_TIME: 'lastSolvedTime',
    CURRENT_CHALLENGE: 'currentChallenge',
    CHALLENGE_STARTED_AT: 'challengeStartedAt',
    LAST_SOLVE_RECEIPT: 'lastSolveReceipt',
    RECENT_CHALLENGE_SLUGS: 'recentChallengeSlugs',
    STREAK_STATE: 'streakState',
    SOLVE_METRICS: 'solveMetrics',
    ENABLED_TARGET_IDS: 'enabledTargetIds',
    ENABLED_SOURCES: 'ENABLED_SOURCES',
    PER_TARGET_RULES: 'PER_TARGET_RULES',
    CLI_STATUS_EXPORT_ENABLED: 'CLI_STATUS_EXPORT_ENABLED',
    CLI_STATUS_EXPORT_PATH: 'CLI_STATUS_EXPORT_PATH',
    CLI_STATUS_LAST_EXPORTED_AT: 'CLI_STATUS_LAST_EXPORTED_AT',
    CLI_STATUS_EXPORT_ERROR: 'CLI_STATUS_EXPORT_ERROR',
    AI_FAST: 'AI_FAST',
    LEADERBOARD_REPO_URL: 'LEADERBOARD_REPO_URL',
    SESSION_DURATION_MS_PREF: 'SESSION_DURATION_MS_PREF',
    EMERGENCY_BYPASSES_PER_WEEK: 'EMERGENCY_BYPASSES_PER_WEEK',
    BYPASS_WEEK_START: 'BYPASS_WEEK_START',
    BYPASSES_USED_THIS_WEEK: 'BYPASSES_USED_THIS_WEEK',
    WHAT_I_ASKED: 'WHAT_I_ASKED',
    AOC_ANSWER_HASHES: 'AOC_ANSWER_HASHES',
    LAST_LC_SUBMISSION_TIMESTAMP: 'LAST_LC_SUBMISSION_TIMESTAMP',
    MESSAGE_FAILURE_COUNT: 'messageFailureCount',
    IS_PAUSED: 'isPaused',
    ONBOARDING_COMPLETED: 'onboardingCompleted',
    UI_MESSAGE: 'uiMessage',
};

export const MESSAGE_ACTIONS = {
    REQUEST_STATE: 'requestState',
    START_CHALLENGE: 'startChallenge',
    SAVE_SETTINGS: 'saveSettings',
    SET_PAUSED: 'setPaused',
    EMERGENCY_BYPASS: 'emergencyBypass',
    EXPORT_CLI_STATUS: 'exportCliStatus',
    START_AI_FAST: 'startAiFast',
    EXPORT_AI_FAST_ICS: 'exportAiFastIcs',
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

export function getChatbotDifficultyByUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return CHATBOT_DIFFICULTY_MAP[parsedUrl.hostname] || 'medium';
    } catch {
        return 'medium';
    }
}
