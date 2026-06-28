import { ChallengeProvider } from '../../../shared/core/challenge-provider.js';
import { SOURCE_LABELS, STORAGE_KEYS } from '../../../shared/core/constants.js';

const difficultyBuckets = {
    easy: new Set([1, 2]),
    medium: new Set([3]),
    hard: new Set([4, 5]),
};

function getBrowserApi() {
    return globalThis.browser ?? globalThis.chrome;
}

function callbackToPromise(invoker) {
    const browserApi = getBrowserApi();
    return new Promise((resolve, reject) => {
        invoker((result) => {
            const runtimeError = browserApi.runtime?.lastError;
            if (runtimeError) {
                reject(new Error(runtimeError.message || String(runtimeError)));
                return;
            }
            resolve(result);
        });
    });
}

function isPromise(value) {
    return value && typeof value.then === 'function';
}

async function storageGet(key) {
    const browserApi = getBrowserApi();
    const response = browserApi.storage.local.get([key]);
    return isPromise(response)
        ? response
        : callbackToPromise((done) => browserApi.storage.local.get([key], done));
}

async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function normalizeAocAnswerHashes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(Object.entries(value).flatMap(([slug, hash]) => {
        const normalizedSlug = String(slug || '').trim().toLowerCase();
        const normalizedHash = String(hash || '').trim().toLowerCase();
        if (!/^aoc-\d{4}-\d{2}-part-[12]$/.test(normalizedSlug) || !/^[a-f0-9]{64}$/.test(normalizedHash)) {
            return [];
        }
        return [[normalizedSlug, normalizedHash]];
    }));
}

function countSolvedAnswers(html) {
    return (String(html || '').match(/Your puzzle answer was/g) || []).length;
}

function normalizeAocChallenge(item) {
    return {
        source: 'aoc',
        source_label: SOURCE_LABELS.aoc,
        challenge_id: item.id,
        slug: item.id,
        title: `Advent of Code ${item.year} Day ${item.day} Part ${item.part}`,
        url: item.url,
        difficulty: item.difficulty,
        topic_tags: item.tags,
        guidance: 'Open Advent of Code, solve the assigned part there, then verify completion locally in Dorso.',
        selection_mode: 'aoc_session_or_hash',
        supports_verification: true,
        year: item.year,
        day: item.day,
        part: item.part,
    };
}

class AocProvider extends ChallengeProvider {
    constructor({ problems = null } = {}) {
        super('aoc');
        this.problems = problems;
    }

    async loadProblems() {
        if (this.problems) {
            return this.problems;
        }

        const browserApi = getBrowserApi();
        const response = await fetch(browserApi.runtime.getURL('data/aoc-problems.json'));
        if (!response.ok) {
            throw new Error(`Unable to load Advent of Code pack: HTTP ${response.status}`);
        }

        this.problems = await response.json();
        return this.problems;
    }

    async getChallenge({ recentSlugs = [], difficulty } = {}) {
        const problems = await this.loadProblems();
        if (problems.length === 0) {
            throw new Error('No Advent of Code metadata is bundled.');
        }

        const recent = new Set(
            recentSlugs
                .filter((entry) => entry.source === this.source)
                .slice(0, 30)
                .map((entry) => entry.slug),
        );
        const allowedDifficulties = difficultyBuckets[difficulty] || null;
        const candidates = problems.filter((problem) => {
            return !recent.has(problem.id)
                && (!allowedDifficulties || allowedDifficulties.has(problem.difficulty));
        });
        const difficultyFallback = problems.filter((problem) => {
            return !allowedDifficulties || allowedDifficulties.has(problem.difficulty);
        });
        const pool = candidates.length ? candidates : (difficultyFallback.length ? difficultyFallback : problems);

        return normalizeAocChallenge(pool[Math.floor(Math.random() * pool.length)]);
    }

    async verifySession(challenge) {
        let response = null;
        try {
            response = await fetch(challenge.url, {
                credentials: 'include',
                cache: 'no-store',
            });
        } catch {
            return {
                ok: false,
                message: 'Grant Advent of Code permission in the Dorso popup, then retry completion verification.',
                expectedSlug: challenge.slug,
                expectedSource: this.source,
            };
        }

        if (!response.ok) {
            return {
                ok: false,
                message: `Advent of Code returned HTTP ${response.status}. Grant permission and confirm the page opens while logged in.`,
                expectedSlug: challenge.slug,
                expectedSource: this.source,
            };
        }

        const html = await response.text();
        if (/\/auth\/login|\[Log In\]/.test(html)) {
            return {
                ok: false,
                message: 'Log in to Advent of Code, then retry completion verification.',
                expectedSlug: challenge.slug,
                expectedSource: this.source,
            };
        }

        const solvedAnswers = countSolvedAnswers(html);
        const ok = solvedAnswers >= Number(challenge.part || 1);
        return {
            ok,
            message: ok ? undefined : `Advent of Code does not show part ${challenge.part} completed yet.`,
            expectedSlug: challenge.slug,
            expectedSource: this.source,
        };
    }

    async verifyHash(challenge, submission) {
        const stored = await storageGet(STORAGE_KEYS.AOC_ANSWER_HASHES);
        const answerHashes = normalizeAocAnswerHashes(stored?.[STORAGE_KEYS.AOC_ANSWER_HASHES]);
        const expected = answerHashes[challenge.slug];
        if (!expected) {
            return {
                ok: false,
                message: `No local Advent of Code answer hash is saved for ${challenge.slug}.`,
                expectedSlug: challenge.slug,
                expectedSource: this.source,
            };
        }

        const actualHash = await sha256Hex(String(submission ?? '').trim());
        const ok = actualHash === expected;
        return {
            ok,
            message: ok ? undefined : 'Advent of Code local answer hash did not match.',
            expectedSlug: challenge.slug,
            expectedSource: this.source,
        };
    }

    async verify(challenge, submission) {
        if (submission && typeof submission === 'object' && submission.method === 'session') {
            return this.verifySession(challenge);
        }

        const value = submission && typeof submission === 'object' && Object.prototype.hasOwnProperty.call(submission, 'answer')
            ? submission.answer
            : submission;
        return this.verifyHash(challenge, value);
    }
}

export {
    AocProvider,
    countSolvedAnswers,
    normalizeAocAnswerHashes,
    normalizeAocChallenge,
    sha256Hex,
};
export default new AocProvider();
