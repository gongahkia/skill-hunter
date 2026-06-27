const MAX_STATE_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const CACHE_CONTROL = 'public, max-age=86400';

function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

function base64UrlToString(value) {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return atob(padded);
}

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

function safeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }

    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return diff === 0;
}

async function signState(secret, state) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(state));
    return bytesToBase64Url(new Uint8Array(signature));
}

function parseState(encodedState) {
    const decoded = base64UrlToString(encodedState);
    const state = JSON.parse(decoded);
    const timestamp = Number(state.timestamp);

    if (!Number.isFinite(timestamp)) {
        throw new Error('Invalid timestamp.');
    }

    return {
        score: Number(state.score),
        longestRun: Number(state.longestRun),
        installIdHash: String(state.installIdHash || ''),
        timestamp,
    };
}

function escapeSvgText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function renderBadgeSvg(state) {
    const score = Math.round(clamp(Number(state.score || 0), 0, 100));
    const longestRun = Math.max(0, Math.trunc(Number(state.longestRun || 0)));
    const installIdHash = escapeSvgText(String(state.installIdHash || '').slice(0, 12));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Dorso Cognitive Index badge">
  <rect width="800" height="400" rx="0" fill="#f8f4ec"/>
  <rect x="32" y="32" width="736" height="336" rx="18" fill="#fff8ea" stroke="#dfcab2" stroke-width="2"/>
  <text x="64" y="86" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#191411">Dorso</text>
  <text x="64" y="130" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#9a4516" letter-spacing="2">COGNITIVE INDEX</text>
  <text x="64" y="206" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#191411">${score}</text>
  <rect x="64" y="270" width="220" height="62" rx="12" fill="#f1dfca"/>
  <text x="86" y="295" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#66594d">longest run</text>
  <text x="86" y="321" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#191411">${longestRun}</text>
  <rect x="316" y="270" width="260" height="62" rx="12" fill="#f1dfca"/>
  <text x="338" y="295" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#66594d">install hash</text>
  <text x="338" y="321" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#191411">${installIdHash}</text>
  <path d="M650 72h64v64h-64z" fill="#a14419"/>
  <path d="M666 88h32v32h-32z" fill="#fff8ea"/>
  <text x="568" y="332" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#66594d">signed / cacheable</text>
</svg>`;
}

async function handleBadgeRequest(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/badge\/([^/]+)\.svg$/);
    if (!match) {
        return jsonResponse({ error: 'not_found' }, 404);
    }

    const stateParam = match[1];
    const sig = url.searchParams.get('sig') || '';
    if (!env.CF_HMAC_SECRET) {
        return jsonResponse({ error: 'missing_secret' }, 500);
    }

    const expectedSig = await signState(env.CF_HMAC_SECRET, stateParam);
    if (!safeEqual(expectedSig, sig)) {
        return jsonResponse({ error: 'invalid_signature' }, 401);
    }

    let state;
    try {
        state = parseState(stateParam);
    } catch (error) {
        return jsonResponse({ error: 'invalid_state' }, 400);
    }

    if (Date.now() - state.timestamp > MAX_STATE_AGE_MS) {
        return jsonResponse({ error: 'expired_state' }, 410);
    }

    return new Response(renderBadgeSvg(state), {
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': CACHE_CONTROL,
        },
    });
}

export default {
    fetch(request, env) {
        return handleBadgeRequest(request, env);
    },
};
