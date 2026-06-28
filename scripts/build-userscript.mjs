import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CHATBOT_DIFFICULTY_MAP,
    CHATBOT_TARGETS,
    SESSION_DURATION_MS,
} from '../src/shared/core/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const mcqQuestions = JSON.parse(await readFile(path.join(repoRoot, 'src/shared/data/mcq.json'), 'utf8'));
const drills = JSON.parse(await readFile(path.join(repoRoot, 'src/shared/data/drills.json'), 'utf8'));
const outputDir = path.join(repoRoot, 'dist/userscript');
const outputPath = path.join(outputDir, 'dorso.user.js');

function getMetadata() {
    const matches = CHATBOT_TARGETS
        .flatMap((target) => target.matches)
        .map((match) => `// @match        ${match}`)
        .join('\n');

    return `// ==UserScript==
// @name         Dorso Gate
// @namespace    https://github.com/gongahkia/dorso
// @version      ${packageJson.version}
// @description  Local Dorso gate for chatbot sites without installing a browser extension.
${matches}
// @run-at       document-start
// @grant        none
// ==/UserScript==`;
}

function userscriptMain(config) {
    'use strict';

    const overlayId = 'dorso-userscript-gate-root';
    const stateKey = 'dorso-userscript-state:v1';
    const recentWindow = 5;
    const difficultyBuckets = {
        easy: new Set([1, 2]),
        medium: new Set([3]),
        hard: new Set([4, 5]),
    };
    let overlayRoot = null;

    function readState() {
        try {
            return JSON.parse(localStorage.getItem(stateKey) || '{}') || {};
        } catch {
            return {};
        }
    }

    function writeState(updates) {
        const nextState = {
            ...readState(),
            ...updates,
        };
        localStorage.setItem(stateKey, JSON.stringify(nextState));
        return nextState;
    }

    function getCurrentTarget() {
        return config.targets.find((target) => {
            return target.hostnames.includes(location.hostname)
                && target.pathPrefixes.some((prefix) => location.pathname.startsWith(prefix));
        }) || null;
    }

    function getDifficulty() {
        return config.difficultyMap[location.hostname] || 'medium';
    }

    function normalizeDifficultyLabel(value) {
        if (value <= 2) {
            return 'Easy';
        }
        if (value >= 4) {
            return 'Hard';
        }
        return 'Medium';
    }

    function normalizeMcqChallenge(question) {
        return {
            source: 'mcq',
            slug: question.id,
            title: question.prompt,
            difficulty: normalizeDifficultyLabel(question.difficulty),
            topic_tags: question.tags || [],
            choices: question.choices || [],
            answerIndex: question.answerIndex,
            guidance: 'Pick the correct answer locally in Dorso.',
            selection_mode: 'bundled_mcq',
        };
    }

    function normalizeDrillChallenge(drill) {
        return {
            ...drill,
            source: 'drills',
            slug: drill.id,
            title: drill.prompt,
            difficulty: normalizeDifficultyLabel(drill.difficulty),
            topic_tags: drill.tags || [],
            guidance: 'Type the expected pattern locally in Dorso.',
            selection_mode: 'bundled_drill',
        };
    }

    function getRecentSlugs(source) {
        const state = readState();
        return new Set((state.recentSlugs || [])
            .filter((entry) => entry.source === source)
            .map((entry) => entry.slug));
    }

    function pickFromPool(items, source, difficulty, normalize) {
        const recent = getRecentSlugs(source);
        const allowed = difficultyBuckets[difficulty] || null;
        const filtered = items.filter((item) => {
            return !recent.has(item.id)
                && (!allowed || allowed.has(item.difficulty));
        });
        const fallback = items.filter((item) => !allowed || allowed.has(item.difficulty));
        const pool = filtered.length ? filtered : (fallback.length ? fallback : items);
        return normalize(pool[Math.floor(Math.random() * pool.length)]);
    }

    function pickChallenge() {
        const difficulty = getDifficulty();
        if (Math.random() < 0.5) {
            return pickFromPool(config.mcq, 'mcq', difficulty, normalizeMcqChallenge);
        }
        return pickFromPool(config.drills, 'drills', difficulty, normalizeDrillChallenge);
    }

    function persistChallenge(force = false) {
        const state = readState();
        if (state.currentChallenge && !force) {
            return state.currentChallenge;
        }

        const challenge = pickChallenge();
        const recentSlugs = [
            {
                source: challenge.source,
                slug: challenge.slug,
                timestamp: Date.now(),
            },
            ...(state.recentSlugs || []).filter((entry) => {
                return entry.source !== challenge.source || entry.slug !== challenge.slug;
            }),
        ].slice(0, recentWindow);

        writeState({
            currentChallenge: challenge,
            challengeStartedAt: Date.now(),
            recentSlugs,
            message: '',
        });
        return challenge;
    }

    function normalizeWhitespace(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function normalizeQuotes(value) {
        return value
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .replaceAll("'", '"');
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
                return result.replace(/;+$/g, '');
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

    function verifyDrill(challenge, submission) {
        const expected = applyNormalizers(challenge.expected, challenge.normalizers || []);
        const actual = applyNormalizers(submission, challenge.normalizers || []);
        return levenshteinDistance(expected, actual) <= (challenge.threshold || 0);
    }

    function createElement(tagName, options = {}) {
        const element = document.createElement(tagName);
        if (options.className) {
            element.className = options.className;
        }
        if (options.text) {
            element.textContent = options.text;
        }
        return element;
    }

    function destroyOverlay() {
        overlayRoot?.remove();
        overlayRoot = null;
        document.documentElement.removeAttribute('data-dorso-userscript-locked');
        document.body?.removeAttribute('data-dorso-userscript-locked');
    }

    function injectPageStyles() {
        if (document.getElementById('dorso-userscript-page-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'dorso-userscript-page-style';
        style.textContent = `
            html[data-dorso-userscript-locked="true"],
            body[data-dorso-userscript-locked="true"] {
                overflow: hidden !important;
            }
        `;
        document.documentElement.append(style);
    }

    function grantAccess() {
        writeState({
            currentChallenge: null,
            sessionExpiresAt: Date.now() + config.sessionDurationMs,
            message: '',
        });
        destroyOverlay();
    }

    function setMessage(message) {
        const state = writeState({ message });
        renderOverlay(state.currentChallenge || persistChallenge(false));
    }

    function appendChallengeForm(card, challenge) {
        if (challenge.source === 'mcq') {
            const form = createElement('form', { className: 'dorso-form' });
            (challenge.choices || []).forEach((choice, index) => {
                const label = createElement('label');
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = 'answer';
                input.value = String(index);
                label.append(input, document.createTextNode(` ${choice}`));
                form.append(label);
            });
            form.append(createElement('button', { text: 'Submit Answer' }));
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const selected = form.querySelector('input[name="answer"]:checked');
                if (!selected) {
                    return;
                }
                if (Number(selected.value) === challenge.answerIndex) {
                    grantAccess();
                    return;
                }
                setMessage('Selected answer did not verify.');
            });
            card.append(form);
            return;
        }

        const form = createElement('form', { className: 'dorso-form' });
        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        form.append(textarea, createElement('button', { text: 'Submit Answer' }));
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (verifyDrill(challenge, textarea.value)) {
                grantAccess();
                return;
            }
            setMessage('Typed answer did not verify.');
        });
        card.append(form);
    }

    function renderOverlay(challenge) {
        const state = readState();
        const target = getCurrentTarget();
        if (!target || Number(state.sessionExpiresAt || 0) > Date.now()) {
            destroyOverlay();
            return;
        }

        injectPageStyles();
        document.documentElement.setAttribute('data-dorso-userscript-locked', 'true');
        document.body?.setAttribute('data-dorso-userscript-locked', 'true');
        if (!overlayRoot) {
            overlayRoot = document.createElement('div');
            overlayRoot.id = overlayId;
            document.documentElement.append(overlayRoot);
        }

        const shadowRoot = overlayRoot.shadowRoot || overlayRoot.attachShadow({ mode: 'open' });
        shadowRoot.replaceChildren();
        const style = createElement('style');
        style.textContent = `
            :host { all: initial; }
            .dorso-backdrop { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: #f4f0e8; color: #191411; font-family: Georgia, "Iowan Old Style", serif; padding: 24px; }
            .dorso-panel { width: min(720px, 100%); background: #fffbf3; border: 1px solid rgba(25, 20, 17, 0.12); border-radius: 18px; box-shadow: 0 16px 40px rgba(54, 34, 20, 0.18); padding: 22px; }
            .dorso-kicker { margin: 0 0 8px; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: #9a4516; }
            h1 { margin: 0; font-size: 1.8rem; line-height: 1.1; }
            h2 { margin: 0 0 8px; font-size: 1.25rem; }
            p { color: #66594d; line-height: 1.5; }
            .dorso-card { margin: 18px 0; padding: 16px; border-radius: 14px; background: #fff8ea; border: 1px solid rgba(25, 20, 17, 0.08); }
            .dorso-form { display: grid; gap: 10px; margin-top: 14px; }
            textarea { width: 100%; border-radius: 12px; border: 1px solid rgba(25, 20, 17, 0.14); padding: 10px; font: inherit; }
            button { border: 0; border-radius: 999px; padding: 10px 14px; background: #a14419; color: #fff8f3; font: inherit; cursor: pointer; }
            .dorso-secondary { background: rgba(25, 20, 17, 0.08); color: #191411; }
            .dorso-actions { display: flex; flex-wrap: wrap; gap: 10px; }
            .dorso-message { padding: 10px 12px; border-radius: 12px; background: #fff1db; color: #713611; }
        `;

        const backdrop = createElement('div', { className: 'dorso-backdrop' });
        const panel = createElement('div', { className: 'dorso-panel' });
        const card = createElement('div', { className: 'dorso-card' });
        const actions = createElement('div', { className: 'dorso-actions' });
        const swapButton = createElement('button', { className: 'dorso-secondary', text: 'Get Another' });
        swapButton.type = 'button';
        swapButton.addEventListener('click', () => {
            renderOverlay(persistChallenge(true));
        });

        card.append(
            createElement('p', { text: 'Assigned challenge' }),
            createElement('h2', { text: challenge.title }),
            createElement('p', { text: `${challenge.source} - ${challenge.difficulty}` }),
            createElement('p', { text: challenge.guidance }),
        );
        appendChallengeForm(card, challenge);
        actions.append(swapButton);
        panel.append(
            createElement('p', { className: 'dorso-kicker', text: 'Selected Site Blocked' }),
            createElement('h1', { text: `Dorso is holding ${target.label} until you solve a challenge.` }),
            createElement('p', { text: 'Solve the assigned challenge to start a local focus session.' }),
        );
        if (state.message) {
            panel.append(createElement('p', { className: 'dorso-message', text: state.message }));
        }
        panel.append(card, actions);
        backdrop.append(panel);
        shadowRoot.append(style, backdrop);
    }

    function render() {
        const target = getCurrentTarget();
        if (!target) {
            return;
        }
        const state = readState();
        if (Number(state.sessionExpiresAt || 0) > Date.now()) {
            destroyOverlay();
            return;
        }
        renderOverlay(persistChallenge(false));
    }

    function whenBodyReady() {
        if (document.body) {
            render();
            return;
        }
        const observer = new MutationObserver(() => {
            if (!document.body) {
                return;
            }
            observer.disconnect();
            render();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    whenBodyReady();
    window.setInterval(render, 5000);
}

const config = {
    version: packageJson.version,
    sessionDurationMs: SESSION_DURATION_MS,
    targets: CHATBOT_TARGETS,
    difficultyMap: CHATBOT_DIFFICULTY_MAP,
    mcq: mcqQuestions,
    drills,
};

await mkdir(outputDir, { recursive: true });
await writeFile(
    outputPath,
    `${getMetadata()}\n(${userscriptMain.toString()})(${JSON.stringify(config)});\n`,
    'utf8',
);

console.log(`Built userscript into ${path.relative(repoRoot, outputPath)}`);
