import { computeCognitiveIndex } from '../../shared/core/atrophy.js';

function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}

function stringToBase64Url(value) {
    return bytesToBase64Url(new TextEncoder().encode(value));
}

async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function signBadgeState(secret, encodedState) {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(encodedState));
    return bytesToBase64Url(new Uint8Array(signature));
}

function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || 'https://dorso.dev').replace(/\/+$/, '');
}

function normalizeRepoUrl(repoUrl) {
    const parsedUrl = new URL(String(repoUrl || '').trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Repository URL must use HTTP or HTTPS.');
    }

    parsedUrl.hash = '';
    parsedUrl.search = '';
    return parsedUrl.toString().replace(/\/$/, '').replace(/\.git$/, '');
}

function getLongestRun(state) {
    const longestRun = Number(state?.longestRun || 0);
    return Number.isFinite(longestRun) ? Math.max(0, Math.trunc(longestRun)) : 0;
}

function getSourceDiversityRatio(state) {
    return new Set(state?.enabledSources || []).size > 1 ? 1 : 0;
}

function getBadgeScore(state) {
    return computeCognitiveIndex({
        solvesInLast7d: Number(state?.currentRun || 0),
        currentRun: Number(state?.currentRun || 0),
        averageTimeToSolveMs: Number(state?.solveReceipt?.timeToSolveMs),
        sourceDiversityRatio: getSourceDiversityRatio(state),
        bypassesThisWeek: Number(state?.bypassesThisWeek || 0),
    });
}

export async function createLeaderboardSubmission({
    dashboardState,
    repoUrl,
    secret,
    baseUrl = 'https://dorso.dev',
    timestamp = Date.now(),
} = {}) {
    if (!secret) {
        return {
            available: false,
            reason: 'Leaderboard signing unavailable in this build.',
        };
    }

    const normalizedRepoUrl = normalizeRepoUrl(repoUrl);
    const repoHash = await sha256Hex(normalizedRepoUrl);
    const body = JSON.stringify({
        repoHash,
        installIdHash: await sha256Hex(String(dashboardState?.installId || 'unknown-install')),
        score: getBadgeScore(dashboardState),
        longestRun: getLongestRun(dashboardState),
        timestamp,
    });

    return {
        available: true,
        repoHash,
        endpoint: `${normalizeBaseUrl(baseUrl)}/leaderboard/${repoHash}.json`,
        body,
        sig: await signBadgeState(secret, body),
    };
}

export async function createBadgeEmbeds({
    dashboardState,
    secret,
    baseUrl = 'https://dorso.dev',
    timestamp = Date.now(),
} = {}) {
    if (!secret) {
        return {
            available: false,
            reason: 'Badge signing unavailable in this build.',
        };
    }

    const canonicalState = {
        score: getBadgeScore(dashboardState),
        longestRun: getLongestRun(dashboardState),
        installIdHash: await sha256Hex(String(dashboardState?.installId || 'unknown-install')),
        timestamp,
    };
    const encodedState = stringToBase64Url(JSON.stringify(canonicalState));
    const sig = await signBadgeState(secret, encodedState);
    const imageUrl = `${normalizeBaseUrl(baseUrl)}/badge/${encodedState}.svg?sig=${sig}`;

    return {
        available: true,
        state: canonicalState,
        encodedState,
        sig,
        imageUrl,
        markdown: `![Dorso Cognitive Index](${imageUrl})`,
        html: `<img src="${imageUrl}" alt="Dorso Cognitive Index">`,
    };
}
