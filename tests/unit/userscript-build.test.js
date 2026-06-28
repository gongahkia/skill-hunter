import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import { CHATBOT_TARGETS } from '../../src/shared/core/constants.js';

test('userscript build emits a single inline gate script', () => {
    execFileSync(process.execPath, ['scripts/build-userscript.mjs'], {
        cwd: new URL('../..', import.meta.url),
        stdio: 'pipe',
    });

    const output = fs.readFileSync(new URL('../../dist/userscript/dorso.user.js', import.meta.url), 'utf8');
    assert.match(output, /\/\/ ==UserScript==/);
    assert.match(output, /\/\/ @grant\s+none/);
    assert.match(output, /sessionDurationMs/);
    assert.doesNotMatch(output, /^import\s/m);
    assert.doesNotMatch(output, /^export\s/m);
    assert.equal(output.includes('mcq-big-o-001'), true);
    assert.equal(output.includes('drill-js-map-callback'), true);
    for (const target of CHATBOT_TARGETS) {
        for (const match of target.matches) {
            assert.equal(output.includes(`// @match        ${match}`), true);
        }
    }
});
