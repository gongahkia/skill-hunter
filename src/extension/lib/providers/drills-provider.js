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

function normalizeWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeQuotes(value) {
    return value
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replaceAll("'", '"');
}

function normalizeSemicolons(value) {
    return value.replace(/;+$/g, '');
}

function applyNormalizers(value, normalizers = []) {
    return normalizers.reduce((result, normalizer) => {
        if (normalizer === 'whitespace') {
            return normalizeWhitespace(result);
        }
        if (normalizer === 'quotes') {
            return normalizeQuotes(result);
        }
        if (normalizer === 'semicolons') {
            return normalizeSemicolons(result);
        }
        if (normalizer === 'casing') {
            return result.toLowerCase();
        }
        return result;
    }, String(value ?? ''));
}

function levenshteinDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let i = 1; i <= left.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= right.length; j += 1) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
            );
        }
        previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
}

class DrillsProvider extends ChallengeProvider {
    constructor({ drills = null } = {}) {
        super('drills');
        this.drills = drills;
    }

    async loadDrills() {
        if (this.drills) {
            return this.drills;
        }

        const browserApi = getBrowserApi();
        const response = await fetch(browserApi.runtime.getURL('data/drills.json'));
        if (!response.ok) {
            throw new Error(`Unable to load drills: HTTP ${response.status}`);
        }

        this.drills = await response.json();
        return this.drills;
    }

    async getChallenge({ recentSlugs = [], difficulty } = {}) {
        const drills = await this.loadDrills();
        const recent = new Set(
            recentSlugs
                .filter((entry) => entry.source === this.source)
                .slice(0, 30)
                .map((entry) => entry.slug),
        );
        const allowedDifficulties = difficultyBuckets[difficulty] || null;
        const candidates = drills.filter((drill) => {
            return !recent.has(drill.id)
                && (!allowedDifficulties || allowedDifficulties.has(drill.difficulty));
        });
        const pool = candidates.length ? candidates : drills;
        const drill = pool[Math.floor(Math.random() * pool.length)];

        return {
            ...drill,
            source: this.source,
            source_label: SOURCE_LABELS.drills,
            slug: drill.id,
            title: drill.prompt,
            supports_verification: true,
        };
    }

    async verify(challenge, submission) {
        const normalizers = challenge.normalizers || [];
        const expected = applyNormalizers(challenge.expected, normalizers);
        const actual = applyNormalizers(submission, normalizers);
        const distance = levenshteinDistance(expected, actual);
        const ok = distance <= (challenge.threshold ?? 0);

        return {
            ok,
            message: ok ? undefined : `Expected edit distance <= ${challenge.threshold ?? 0}; received ${distance}.`,
            expectedSlug: challenge.slug || challenge.id,
            expectedSource: this.source,
        };
    }
}

export {
    DrillsProvider,
    applyNormalizers,
    levenshteinDistance,
};
export default new DrillsProvider();
