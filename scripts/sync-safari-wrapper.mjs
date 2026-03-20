import { cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'dist', 'safari');
const targetDir = path.join(
    repoRoot,
    'safari',
    'DorsoSafari',
    'Dorso Safari',
    'Dorso Safari Extension',
    'Resources',
);

async function ensureExists(targetPath, label) {
    try {
        await stat(targetPath);
    } catch {
        throw new Error(`Missing ${label}: ${targetPath}`);
    }
}

async function main() {
    await ensureExists(sourceDir, 'Safari extension build');
    await ensureExists(targetDir, 'Safari wrapper resources directory');

    await cp(sourceDir, targetDir, {
        force: true,
        recursive: true,
    });

    console.log(`Synced ${path.relative(repoRoot, sourceDir)} into ${path.relative(repoRoot, targetDir)}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
