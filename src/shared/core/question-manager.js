/**
 * Question Manager - Handles fetching and caching LeetCode problems.
 */

import { LEETCODE_GRAPHQL_ENDPOINT, QUESTION_QUERY } from './constants.js';
import logger from '../utils/logger.js';
import { validateProblemData } from '../utils/validator.js';
import backendClient from '../api/backend-client.js';

class QuestionManager {
    constructor() {
        this.endpoint = LEETCODE_GRAPHQL_ENDPOINT;
        this.cache = new Map();
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    /**
     * Fetch a problem from LeetCode GraphQL API.
     */
    async fetchProblemFromLeetCode(titleSlug) {
        // Check cache first
        const cached = this.cache.get(titleSlug);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            logger.debug('Problem cache hit', { slug: titleSlug });
            return cached.data;
        }

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: QUESTION_QUERY,
                    variables: { titleSlug },
                }),
            });

            const data = await response.json();

            if (data.errors) {
                logger.error('LeetCode GraphQL error', {
                    slug: titleSlug,
                    errors: data.errors,
                });
                throw new Error('Failed to fetch LeetCode question');
            }

            const problem = data.data.question;

            if (problem) {
                validateProblemData(problem);

                // Cache the result
                this.cache.set(titleSlug, {
                    data: problem,
                    timestamp: Date.now(),
                });

                logger.info('Problem fetched from LeetCode', {
                    slug: titleSlug,
                    difficulty: problem.difficulty,
                });

                return problem;
            }

            throw new Error('Problem not found');

        } catch (error) {
            logger.error('Failed to fetch problem from LeetCode', {
                slug: titleSlug,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get a random problem from backend (preferred method).
     * Falls back to LeetCode if backend is unavailable.
     */
    async getRandomProblem() {
        try {
            // Try to get from backend first (uses Redis cache and problem queue)
            const problem = await backendClient.getRandomProblem();

            logger.info('Random problem fetched from backend', {
                slug: problem.slug,
                difficulty: problem.difficulty,
            });

            return problem;

        } catch (error) {
            logger.warn('Backend unavailable, using fallback', {
                error: error.message,
            });

            // Fallback: fetch directly from LeetCode
            // Use a small hardcoded list of problems
            const fallbackSlugs = [
                'two-sum',
                'add-two-numbers',
                'longest-substring-without-repeating-characters',
                'valid-parentheses',
                'merge-two-sorted-lists',
                'maximum-subarray',
                'climbing-stairs',
                'best-time-to-buy-and-sell-stock',
                'single-number',
                'linked-list-cycle',
            ];

            const randomSlug = fallbackSlugs[Math.floor(Math.random() * fallbackSlugs.length)];
            const problem = await this.fetchProblemFromLeetCode(randomSlug);

            // Convert to backend format
            return {
                id: problem.questionId,
                title: problem.title,
                slug: problem.titleSlug,
                content: problem.content,
                difficulty: problem.difficulty,
                exampleTestcases: problem.exampleTestcases || '',
            };
        }
    }

    /**
     * Clear the local cache.
     */
    clearCache() {
        this.cache.clear();
        logger.info('Question cache cleared');
    }
}

export default new QuestionManager();
export { QuestionManager };
