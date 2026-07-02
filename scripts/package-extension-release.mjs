import { execFile } from 'node:child_process';
import { readdir, mkdir, rm, stat } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const distRoot = path.join(repoRoot, 'dist');
const artifactDir = path.join(distRoot, 'artifacts');
const sourceIncludes = [
    '.env.example',
    'README.md',
    'CONTRIBUTING.md',
    'package.json',
    'package-lock.json',
    'artifacts/AMO_SOURCE_README.md',
    'docs/ARCHITECTURE.md',
    'docs/PRIVACY.md',
    'docs/SECURITY.md',
    'schemas',
    'scripts/build-dashboard-validator.mjs',
    'scripts/build-extension.mjs',
    'scripts/package-extension-release.mjs',
    'scripts/validate-packs.mjs',
    'src/extension',
    'src/shared',
];

async function exists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function collectFiles(root, relativePath = '') {
    const absolutePath = path.join(root, relativePath);
    const entries = await readdir(absolutePath, { withFileTypes: true });
    const files = [];

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        if (entry.name === '.DS_Store') {
            continue;
        }

        const childPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
            files.push(...await collectFiles(root, childPath));
            continue;
        }

        if (entry.isFile()) {
            files.push(childPath);
        }
    }

    return files;
}

async function collectIncludedFiles() {
    const files = [];

    for (const includePath of sourceIncludes) {
        const absolutePath = path.join(repoRoot, includePath);

        if (!(await exists(absolutePath))) {
            throw new Error(`Missing release source include: ${includePath}`);
        }

        const stats = await stat(absolutePath);
        if (stats.isDirectory()) {
            files.push(...await collectFiles(repoRoot, includePath));
            continue;
        }

        files.push(includePath);
    }

    return files;
}

async function zipFiles(outputPath, files, cwd) {
    await rm(outputPath, { force: true });
    await execFileAsync('zip', ['-X', '-q', outputPath, ...files], {
        cwd,
        maxBuffer: 1024 * 1024 * 16,
    });
}

async function packageExtension(browser) {
    const outputPath = path.join(artifactDir, `dorso-${packageJson.version}-${browser}.zip`);
    const browserDist = path.join(distRoot, browser);
    const files = await collectFiles(browserDist);

    await zipFiles(outputPath, files, browserDist);
    return path.relative(repoRoot, outputPath);
}

async function packageSource() {
    const outputPath = path.join(artifactDir, `dorso-${packageJson.version}-source.zip`);
    const files = await collectIncludedFiles();

    await zipFiles(outputPath, files, repoRoot);
    return path.relative(repoRoot, outputPath);
}

async function main() {
    await mkdir(artifactDir, { recursive: true });

    const artifacts = [
        await packageExtension('chrome'),
        await packageExtension('firefox'),
        await packageSource(),
    ];

    artifacts.forEach((artifact) => {
        console.log(`Packaged ${artifact}`);
    });
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
