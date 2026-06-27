#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
    formatStatus,
    parseStatusArgs,
    readStatusFile,
    resolveStatusPath,
    usage,
} from '../lib/status.js';

const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

async function getVersion() {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    return packageJson.version;
}

async function printStatus(options) {
    const statusPath = resolveStatusPath(options.path);
    const status = await readStatusFile(statusPath);
    process.stdout.write(`${formatStatus(status, options.mode)}\n`);
}

async function main(argv) {
    const options = parseStatusArgs(argv);
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return;
    }

    if (options.version) {
        process.stdout.write(`${await getVersion()}\n`);
        return;
    }

    if (options.command !== 'status') {
        throw new Error(`Unknown command: ${options.command}`);
    }

    if (!options.watch) {
        await printStatus(options);
        return;
    }

    for (;;) {
        try {
            await printStatus(options);
        } catch (error) {
            process.stderr.write(`${error.message}\n`);
        }
        await sleep(2000);
    }
}

main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
