import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../cloudflare/src/worker.js';

class FakeKv {
    constructor() {
        this.values = new Map();
    }

    async get(key, type) {
        const value = this.values.get(key) || null;
        return type === 'json' && value ? JSON.parse(value) : value;
    }

    async put(key, value) {
        this.values.set(key, value);
    }
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

async function sign(secret, body) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    return bytesToBase64Url(new Uint8Array(signature));
}

test('leaderboard accepts signed anonymous score and serves ranked JSON', async () => {
    const repoHash = 'a'.repeat(64);
    const body = JSON.stringify({
        repoHash,
        installIdHash: 'b'.repeat(64),
        score: 88,
        longestRun: 7,
        timestamp: Date.now(),
    });
    const env = {
        CF_HMAC_SECRET: 'test-secret',
        LEADERBOARD: new FakeKv(),
    };
    const postResponse = await worker.fetch(new Request(`https://badge.example.test/leaderboard/${repoHash}.json`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-dorso-signature': await sign(env.CF_HMAC_SECRET, body),
        },
        body,
    }), env);

    assert.equal(postResponse.status, 200);
    const getResponse = await worker.fetch(new Request(`https://badge.example.test/leaderboard/${repoHash}.json`), env);
    const leaderboard = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(leaderboard.repoHash, repoHash);
    assert.deepEqual(leaderboard.entries[0], {
        rank: 1,
        installIdHash: 'b'.repeat(64),
        score: 88,
        longestRun: 7,
        updatedAt: leaderboard.entries[0].updatedAt,
    });
});

test('leaderboard rejects unsigned score writes', async () => {
    const repoHash = 'a'.repeat(64);
    const response = await worker.fetch(new Request(`https://badge.example.test/leaderboard/${repoHash}.json`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-dorso-signature': 'bad',
        },
        body: JSON.stringify({
            repoHash,
            installIdHash: 'b'.repeat(64),
            score: 88,
            longestRun: 7,
            timestamp: Date.now(),
        }),
    }), {
        CF_HMAC_SECRET: 'test-secret',
        LEADERBOARD: new FakeKv(),
    });

    assert.equal(response.status, 401);
});
