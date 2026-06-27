import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

test('generated package versions stay in sync', () => {
    execFileSync(process.execPath, ['scripts/build-extension.mjs', 'all'], {
        cwd: new URL('../..', import.meta.url),
        stdio: 'pipe',
    });

    const packageVersion = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
    const manifestVersion = packageVersion.split('-')[0];
    for (const browser of ['chrome', 'firefox', 'safari']) {
        const manifest = JSON.parse(fs.readFileSync(new URL(`../../dist/${browser}/manifest.json`, import.meta.url), 'utf8'));
        assert.equal(manifest.version, manifestVersion, `${browser} manifest version mismatch`);
        assert.equal(manifest.version_name, packageVersion, `${browser} manifest version_name mismatch`);
    }

    const wranglerToml = fs.readFileSync(new URL('../../cloudflare/wrangler.toml', import.meta.url), 'utf8');
    const versionMatch = wranglerToml.match(/^version\s*=\s*"([^"]+)"/m);
    if (versionMatch) {
        assert.equal(versionMatch[1], packageVersion, 'cloudflare worker version mismatch');
    }
});
