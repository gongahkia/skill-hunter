/**
 * Local challenge manager for the public store build.
 * Dorso links out to the official source rather than rehosting statements.
 */

import { SOURCE_LABELS } from './constants.js';
import logger from '../utils/logger.js';

const LOCAL_CHALLENGES = [
    {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        topic_tags: ['Array', 'Hash Table'],
    },
    {
        slug: 'valid-parentheses',
        title: 'Valid Parentheses',
        difficulty: 'Easy',
        topic_tags: ['Stack', 'String'],
    },
    {
        slug: 'merge-two-sorted-lists',
        title: 'Merge Two Sorted Lists',
        difficulty: 'Easy',
        topic_tags: ['Linked List', 'Recursion'],
    },
    {
        slug: 'best-time-to-buy-and-sell-stock',
        title: 'Best Time to Buy and Sell Stock',
        difficulty: 'Easy',
        topic_tags: ['Array', 'Dynamic Programming'],
    },
    {
        slug: 'maximum-subarray',
        title: 'Maximum Subarray',
        difficulty: 'Medium',
        topic_tags: ['Array', 'Dynamic Programming'],
    },
    {
        slug: 'group-anagrams',
        title: 'Group Anagrams',
        difficulty: 'Medium',
        topic_tags: ['Array', 'Hash Table', 'String'],
    },
    {
        slug: 'climbing-stairs',
        title: 'Climbing Stairs',
        difficulty: 'Easy',
        topic_tags: ['Dynamic Programming', 'Math'],
    },
    {
        slug: 'binary-tree-level-order-traversal',
        title: 'Binary Tree Level Order Traversal',
        difficulty: 'Medium',
        topic_tags: ['Tree', 'Breadth-First Search'],
    },
    {
        slug: 'course-schedule',
        title: 'Course Schedule',
        difficulty: 'Medium',
        topic_tags: ['Graph', 'Topological Sort'],
    },
    {
        slug: 'longest-substring-without-repeating-characters',
        title: 'Longest Substring Without Repeating Characters',
        difficulty: 'Medium',
        topic_tags: ['Hash Table', 'Sliding Window', 'String'],
    },
    {
        slug: 'search-in-rotated-sorted-array',
        title: 'Search in Rotated Sorted Array',
        difficulty: 'Medium',
        topic_tags: ['Array', 'Binary Search'],
    },
    {
        slug: 'number-of-islands',
        title: 'Number of Islands',
        difficulty: 'Medium',
        topic_tags: ['Graph', 'Depth-First Search', 'Breadth-First Search'],
    },
];

function normalizeChallenge(problem) {
    return {
        source: 'leetcode',
        source_label: SOURCE_LABELS.leetcode,
        challenge_id: problem.slug,
        title: problem.title,
        slug: problem.slug,
        url: `https://leetcode.com/problems/${problem.slug}/description/`,
        difficulty: problem.difficulty,
        topic_tags: problem.topic_tags,
        guidance: 'Open the official LeetCode page to read the full prompt and submit your solution there.',
        selection_mode: 'curated_local',
        supports_verification: true,
    };
}

class QuestionManager {
    getRandomProblem(excludedSlugs = []) {
        const excluded = new Set(excludedSlugs || []);
        const candidates = LOCAL_CHALLENGES.filter((challenge) => !excluded.has(challenge.slug));
        const pool = candidates.length ? candidates : LOCAL_CHALLENGES;
        const problem = pool[Math.floor(Math.random() * pool.length)];

        logger.info('Local challenge selected', {
            slug: problem.slug,
            difficulty: problem.difficulty,
        });

        return normalizeChallenge(problem);
    }
}

export default new QuestionManager();
export { QuestionManager };
