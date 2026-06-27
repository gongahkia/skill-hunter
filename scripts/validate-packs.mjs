import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = path.join(repoRoot, 'schemas');
const dataDir = path.join(repoRoot, 'src', 'shared', 'data');
const ajvBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'ajv.cmd' : 'ajv');

const dataFiles = (await readdir(dataDir))
    .filter((file) => file.endsWith('.json'))
    .sort();

if (dataFiles.length === 0) {
    throw new Error(`No challenge packs found in ${path.relative(repoRoot, dataDir)}`);
}

for (const dataFile of dataFiles) {
    const packName = dataFile.replace(/\.json$/, '');
    const schemaPath = path.join(schemaDir, `${packName}.schema.json`);
    const dataPath = path.join(dataDir, dataFile);

    if (!existsSync(schemaPath)) {
        throw new Error(`Missing schema for ${path.relative(repoRoot, dataPath)}`);
    }

    execFileSync(ajvBin, [
        'validate',
        '--spec=draft2020',
        '-s',
        schemaPath,
        '-d',
        dataPath,
    ], {
        cwd: repoRoot,
        stdio: 'inherit',
    });
}
