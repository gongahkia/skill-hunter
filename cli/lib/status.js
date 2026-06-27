import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_STATUS_PATH = path.join(os.homedir(), 'Downloads', 'dorso', 'status.json');

export function resolveStatusPath(value, env = process.env) {
    const requested = value || env.DORSO_STATUS_PATH || DEFAULT_STATUS_PATH;
    if (requested.startsWith('~')) {
        return path.join(os.homedir(), requested.slice(1));
    }
    return path.resolve(requested);
}

export function parseStatusArgs(argv, env = process.env) {
    const args = [...argv];
    const command = args.shift();
    const options = {
        command,
        mode: 'human',
        watch: false,
        path: env.DORSO_STATUS_PATH || '',
        help: false,
        version: false,
    };

    if (!command || command === '--help' || command === '-h') {
        options.help = true;
        return options;
    }

    if (command === '--version' || command === '-v') {
        options.version = true;
        return options;
    }

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--json') {
            options.mode = 'json';
        } else if (arg === '--prompt') {
            options.mode = 'prompt';
        } else if (arg === '--watch') {
            options.watch = true;
        } else if (arg === '--path') {
            index += 1;
            if (!args[index]) {
                throw new Error('--path requires a value.');
            }
            options.path = args[index];
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    return options;
}

export async function readStatusFile(filePath) {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
}

function getScore(status) {
    const score = Number(status?.cognitiveIndex);
    return Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
}

export function formatPromptStatus(status) {
    return `DRS:${getScore(status)}`;
}

export function formatHumanStatus(status) {
    const parts = [
        `Dorso ${status?.status || 'unknown'}`,
        `CI ${getScore(status)}`,
        `run ${Number(status?.currentRun || 0)}/${Number(status?.longestRun || 0)}`,
    ];

    if (status?.session?.isActive && status.session.expiresAt) {
        parts.push(`until ${status.session.expiresAt}`);
    } else if (status?.challenge?.title) {
        parts.push(status.challenge.title);
    }

    return parts.join(' | ');
}

export function formatStatus(status, mode) {
    if (mode === 'json') {
        return JSON.stringify(status);
    }
    if (mode === 'prompt') {
        return formatPromptStatus(status);
    }
    return formatHumanStatus(status);
}

export function usage() {
    return [
        'Usage: dorso status [--json | --prompt] [--watch] [--path <file>]',
        '       dorso --version',
    ].join('\n');
}
