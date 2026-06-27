import { ChallengeProvider } from '../../../shared/core/challenge-provider.js';
import {
    LOCAL_CHALLENGES,
    SOURCE_LABELS,
} from '../../../shared/core/constants.js';

const difficultyMap = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
};

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

class LeetCodeProvider extends ChallengeProvider {
    constructor({ challenges = LOCAL_CHALLENGES } = {}) {
        super('leetcode');
        this.challenges = challenges;
    }

    async getChallenge({ recentSlugs = [], difficulty } = {}) {
        const recent = new Set(
            recentSlugs
                .filter((entry) => entry.source === this.source)
                .slice(0, 30)
                .map((entry) => entry.slug),
        );
        const requestedDifficulty = difficultyMap[difficulty] || null;
        const candidates = this.challenges.filter((challenge) => {
            return !recent.has(challenge.slug)
                && (!requestedDifficulty || challenge.difficulty === requestedDifficulty);
        });
        const pool = candidates.length ? candidates : this.challenges;
        return normalizeChallenge(pool[Math.floor(Math.random() * pool.length)]);
    }

    async verify(challenge, submission) {
        const ok = Boolean(
            submission?.success
            && submission.source === this.source
            && submission.slug === challenge.slug,
        );

        return {
            ok,
            message: ok ? undefined : 'No accepted LeetCode submission matched the assigned problem.',
            expectedSlug: challenge.slug,
            expectedSource: this.source,
        };
    }
}

export {
    LeetCodeProvider,
    normalizeChallenge,
};
export default new LeetCodeProvider();
