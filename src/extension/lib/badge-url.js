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

function getLongestRun(state) {
    const longestRun = Number(state?.longestRun || 0);
    return Number.isFinite(longestRun) ? Math.max(0, Math.trunc(longestRun)) : 0;
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
        score: computeCognitiveIndex({
            bypassesThisWeek: Number(dashboardState?.bypassesThisWeek || 0),
        }),
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
