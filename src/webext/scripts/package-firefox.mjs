import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const submissionRoot = path.join(packageRoot, 'submission', 'firefox');
const distFirefoxRoot = path.join(packageRoot, 'dist', 'firefox');
const sourceStageName = 'owl-tags-firefox-source';

const packageJson = JSON.parse(
  await readFile(path.join(packageRoot, 'package.json'), 'utf8')
);
const version = packageJson.version;
const extensionArchive = `owl-tags-firefox-${version}.zip`;
const sourceArchive = `owl-tags-firefox-source-${version}.zip`;

const SOURCE_ITEMS = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vitest.config.ts',
  'FIREFOX_REVIEW.md',
  'FIREFOX_REVIEW_NOTES.md',
  'scripts',
  'src',
  'tests',
  'assets/icons',
];

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
    child.on('error', reject);
  });
}

async function ensureCleanDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

async function copyIntoStage(stageRoot, relativePath) {
  const sourcePath = path.join(packageRoot, relativePath);
  const destPath = path.join(stageRoot, relativePath);
  const sourceStat = await stat(sourcePath);

  if (sourceStat.isDirectory()) {
    await mkdir(path.dirname(destPath), { recursive: true });
    await cp(sourcePath, destPath, { recursive: true });
    return;
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  await cp(sourcePath, destPath);
}

async function writeSourceFileList() {
  const lines = [
    '# Firefox Source Submission File List',
    '',
    ...SOURCE_ITEMS.map((item) => `- ${item}`),
    '',
  ];

  await writeFile(path.join(submissionRoot, 'firefox-source-files.md'), lines.join('\n'));
}

async function packageExtension() {
  await run(
    'npx',
    [
      'web-ext',
      'build',
      '--source-dir',
      distFirefoxRoot,
      '--artifacts-dir',
      submissionRoot,
      '--filename',
      extensionArchive,
      '--overwrite-dest',
    ],
    packageRoot
  );
}

async function packageSource() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'owl-firefox-source-'));
  const stageRoot = path.join(tempRoot, sourceStageName);

  await mkdir(stageRoot, { recursive: true });
  for (const item of SOURCE_ITEMS) {
    await copyIntoStage(stageRoot, item);
  }

  await run('zip', ['-qr', path.join(submissionRoot, sourceArchive), sourceStageName], tempRoot);
  await rm(tempRoot, { recursive: true, force: true });
}

async function writeArtifactManifest() {
  const files = await readdir(submissionRoot);
  const lines = [
    '# Firefox Submission Artifacts',
    '',
    `Upload to AMO as version file: \`${extensionArchive}\``,
    `Upload to AMO as source code: \`${sourceArchive}\``,
    'Paste reviewer notes from `FIREFOX_REVIEW_NOTES.md`.',
    '',
    'Current contents:',
    '',
    ...files.sort().map((file) => `- ${file}`),
    '',
  ];

  await writeFile(path.join(submissionRoot, 'README.md'), lines.join('\n'));
}

await ensureCleanDir(submissionRoot);
await run('npm', ['run', 'check'], packageRoot);
await run('npm', ['test'], packageRoot);
await run('npm', ['run', 'build'], packageRoot);
await run('npm', ['run', 'lint:firefox'], packageRoot);
await packageExtension();
await packageSource();
await cp(path.join(packageRoot, 'FIREFOX_REVIEW_NOTES.md'), path.join(submissionRoot, 'firefox-review-notes.md'));
await writeSourceFileList();
await writeArtifactManifest();
