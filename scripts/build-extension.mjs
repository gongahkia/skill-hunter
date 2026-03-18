import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const distRoot = path.join(repoRoot, 'dist');

const browserConfigs = {
  chrome: {
    sourceDir: path.join(srcRoot, 'chrome'),
    outputDir: path.join(distRoot, 'chrome'),
  },
  firefox: {
    sourceDir: path.join(srcRoot, 'firefox'),
    outputDir: path.join(distRoot, 'firefox'),
  },
};

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function buildBrowser(browser) {
  const config = browserConfigs[browser];

  if (!config) {
    throw new Error(`Unsupported browser target: ${browser}`);
  }

  if (!(await exists(config.sourceDir))) {
    throw new Error(`Missing source directory: ${config.sourceDir}`);
  }

  await rm(config.outputDir, { recursive: true, force: true });
  await mkdir(config.outputDir, { recursive: true });
  await cp(config.sourceDir, config.outputDir, { recursive: true });

  console.log(`Built ${browser} extension into ${path.relative(repoRoot, config.outputDir)}`);
}

async function main() {
  const target = process.argv[2] || 'all';
  const browsers = target === 'all' ? Object.keys(browserConfigs) : [target];

  await mkdir(distRoot, { recursive: true });

  for (const browser of browsers) {
    await buildBrowser(browser);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
