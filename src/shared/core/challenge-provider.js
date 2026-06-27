/**
 * @typedef {'easy' | 'medium' | 'hard'} ChallengeDifficulty
 *
 * @typedef {object} Challenge
 * @property {string} source
 * @property {string} slug
 * @property {string} title
 * @property {string} url
 * @property {ChallengeDifficulty | string | number} difficulty
 *
 * @typedef {object} RecentChallengeSlug
 * @property {string} source
 * @property {string} slug
 *
 * @typedef {object} ChallengeProviderOptions
 * @property {RecentChallengeSlug[]} recentSlugs
 * @property {ChallengeDifficulty} [difficulty]
 *
 * @typedef {object} ChallengeVerificationResult
 * @property {boolean} ok
 * @property {string} [message]
 * @property {string} [expectedSlug]
 * @property {string} [expectedSource]
 *
 * @typedef {object} ChallengeProviderShape
 * @property {string} source
 * @property {(opts: ChallengeProviderOptions) => Promise<Challenge>} getChallenge
 * @property {(challenge: Challenge, submission: unknown) => Promise<ChallengeVerificationResult>} verify
 */

class ChallengeProvider {
    constructor(source) {
        if (!source) {
            throw new Error('ChallengeProvider requires a source.');
        }

        this.source = source;
    }

    async getChallenge(_opts) {
        throw new Error('getChallenge() must be implemented.');
    }

    async verify(_challenge, _submission) {
        throw new Error('verify() must be implemented.');
    }
}

export { ChallengeProvider };
