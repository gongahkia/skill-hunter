import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import {
    CHATBOT_TARGETS,
    DEFAULT_ENABLED_SOURCES,
} from '../../src/shared/core/constants.js';

const browsers = ['chrome', 'firefox', 'safari'];
const requiredFields = [
    'manifest_version',
    'name',
    'version',
    'description',
    'permissions',
    'host_permissions',
    'icons',
    'action',
    'content_scripts',
    'background',
    'content_security_policy',
];
const leetCodePattern = 'https://leetcode.com/problems/*';
const expectedHostPermissions = [
    ...CHATBOT_TARGETS.flatMap((target) => {
        return target.hostnames.map((hostname) => `https://${hostname}/*`);
    }),
    ...(DEFAULT_ENABLED_SOURCES.includes('leetcode') ? [leetCodePattern] : []),
];
const packageJson = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

function readManifest(browser) {
    return JSON.parse(fs.readFileSync(new URL(`../../dist/${browser}/manifest.json`, import.meta.url), 'utf8'));
}

test('generated extension manifests have the expected review shape', async (t) => {
    execFileSync(process.execPath, ['scripts/build-extension.mjs', 'all'], {
        cwd: new URL('../..', import.meta.url),
        stdio: 'pipe',
    });

    for (const browser of browsers) {
        await t.test(`${browser} manifest`, () => {
            const manifest = readManifest(browser);

            for (const field of requiredFields) {
                assert.ok(Object.hasOwn(manifest, field), `${browser} missing ${field}`);
            }

            assert.equal(manifest.version, packageJson.version.split('-')[0]);
            assert.equal(manifest.version_name, packageJson.version);
            assert.deepEqual(manifest.host_permissions, expectedHostPermissions);
            assert.equal(manifest.content_scripts[0].js[0], 'extension/lib/messaging.js');
            assert.equal(manifest.content_scripts[1].js[0], 'extension/lib/messaging.js');

            assert.deepEqual(manifest.content_security_policy, {
                extension_pages: "script-src 'self'; object-src 'self'",
            });
        });
    }
});
