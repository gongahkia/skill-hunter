import { ChallengeProvider } from '../../../shared/core/challenge-provider.js';
import { SOURCE_LABELS } from '../../../shared/core/constants.js';

const difficultyBuckets = {
    easy: new Set([1, 2]),
    medium: new Set([3]),
    hard: new Set([4, 5]),
};

function getBrowserApi() {
    return globalThis.browser ?? globalThis.chrome;
}

function normalizeMcqChallenge(item) {
    return {
        ...item,
        source: 'mcq',
        source_label: SOURCE_LABELS.mcq,
        slug: item.id,
        title: item.prompt,
        url: '',
        topic_tags: item.tags,
        guidance: 'Pick the correct answer locally in Dorso.',
        selection_mode: 'bundled_mcq',
        supports_verification: true,
    };
}

class McqProvider extends ChallengeProvider {
    constructor({ questions = null } = {}) {
        super('mcq');
        this.questions = questions;
    }

    async loadQuestions() {
        if (this.questions) {
            return this.questions;
        }

        const browserApi = getBrowserApi();
        const response = await fetch(browserApi.runtime.getURL('data/mcq.json'));
        if (!response.ok) {
            throw new Error(`Unable to load MCQ pack: HTTP ${response.status}`);
        }

        this.questions = await response.json();
        return this.questions;
    }

    async getChallenge({ recentSlugs = [], difficulty } = {}) {
        const questions = await this.loadQuestions();
        const recent = new Set(
            recentSlugs
                .filter((entry) => entry.source === this.source)
                .slice(0, 30)
                .map((entry) => entry.slug),
        );
        const allowedDifficulties = difficultyBuckets[difficulty] || null;
        const candidates = questions.filter((question) => {
            return !recent.has(question.id)
                && (!allowedDifficulties || allowedDifficulties.has(question.difficulty));
        });
        const difficultyFallback = questions.filter((question) => {
            return !allowedDifficulties || allowedDifficulties.has(question.difficulty);
        });
        const pool = candidates.length ? candidates : (difficultyFallback.length ? difficultyFallback : questions);

        return normalizeMcqChallenge(pool[Math.floor(Math.random() * pool.length)]);
    }

    async verify(challenge, submission) {
        const ok = submission === challenge.answerIndex;

        return {
            ok,
            message: ok ? undefined : 'Selected answer does not match the assigned MCQ.',
            expectedSlug: challenge.slug || challenge.id,
            expectedSource: this.source,
        };
    }
}

export {
    McqProvider,
    normalizeMcqChallenge,
};
export default new McqProvider();
