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

async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function getProblemNumber(id) {
    return Number(id.replace(/^pe-/, ''));
}

function normalizeEulerChallenge(item) {
    const problemNumber = getProblemNumber(item.id);
    return {
        source: 'euler',
        source_label: SOURCE_LABELS.euler,
        challenge_id: item.id,
        slug: item.id,
        title: `Project Euler Problem ${problemNumber}`,
        url: item.url,
        difficulty: item.difficulty,
        topic_tags: item.tags,
        guidance: 'Open Project Euler to read the problem, then enter the numeric answer locally.',
        selection_mode: 'link_out_hash',
        supports_verification: true,
    };
}

class EulerProvider extends ChallengeProvider {
    constructor({ answers = null } = {}) {
        super('euler');
        this.answers = answers;
    }

    async loadAnswers() {
        if (this.answers) {
            return this.answers;
        }

        const browserApi = getBrowserApi();
        const response = await fetch(browserApi.runtime.getURL('data/euler-answers.json'));
        if (!response.ok) {
            throw new Error(`Unable to load Project Euler answers: HTTP ${response.status}`);
        }

        this.answers = await response.json();
        return this.answers;
    }

    async getChallenge({ recentSlugs = [], difficulty } = {}) {
        const answers = await this.loadAnswers();
        if (answers.length === 0) {
            throw new Error('No Project Euler answer hashes are bundled.');
        }

        const recent = new Set(
            recentSlugs
                .filter((entry) => entry.source === this.source)
                .slice(0, 30)
                .map((entry) => entry.slug),
        );
        const allowedDifficulties = difficultyBuckets[difficulty] || null;
        const candidates = answers.filter((answer) => {
            return !recent.has(answer.id)
                && (!allowedDifficulties || allowedDifficulties.has(answer.difficulty));
        });
        const difficultyFallback = answers.filter((answer) => {
            return !allowedDifficulties || allowedDifficulties.has(answer.difficulty);
        });
        const pool = candidates.length ? candidates : (difficultyFallback.length ? difficultyFallback : answers);

        return normalizeEulerChallenge(pool[Math.floor(Math.random() * pool.length)]);
    }

    async verify(challenge, submission) {
        const answers = await this.loadAnswers();
        const expected = answers.find((answer) => answer.id === challenge.slug);
        const actualHash = await sha256Hex(String(submission ?? '').trim());
        const ok = Boolean(expected && actualHash === expected.answerHash);

        return {
            ok,
            message: ok ? undefined : 'Project Euler answer hash did not match.',
            expectedSlug: challenge.slug,
            expectedSource: this.source,
        };
    }
}

export {
    EulerProvider,
    normalizeEulerChallenge,
    sha256Hex,
};
export default new EulerProvider();
