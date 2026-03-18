import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'src', 'extension');
const sharedRoot = path.join(repoRoot, 'src', 'shared');
const distRoot = path.join(repoRoot, 'dist');

const browserConfigs = {
    chrome: {
        outputDir: path.join(distRoot, 'chrome'),
    },
    firefox: {
        outputDir: path.join(distRoot, 'firefox'),
    },
};

const sharedFilter = (sourcePath) => {
    return ![
        '__tests__',
        '.eslintrc.json',
        '.prettierrc.json',
        'jest.config.js',
        'package.json',
    ].some((needle) => sourcePath.includes(needle));
};

function getManifest(browser) {
    const baseManifest = {
        manifest_version: 3,
        name: 'Dorso',
        version: '2.1.0',
        description: 'Gate AI chatbot tabs behind verified programming challenges.',
        permissions: ['storage', 'tabs', 'webNavigation'],
        host_permissions: ['<all_urls>'],
        action: {
            default_popup: 'extension/ui/popup.html',
        },
        content_scripts: [
            {
                matches: ['https://leetcode.com/problems/*'],
                js: ['extension/content/leetcode.js'],
                run_at: 'document_idle',
            },
        ],
        web_accessible_resources: [
            {
                resources: ['extension/assets/*', 'extension/ui/*'],
                matches: ['<all_urls>'],
            },
        ],
    };

    if (browser === 'chrome') {
        return {
            ...baseManifest,
            background: {
                service_worker: 'extension/background/index.js',
                type: 'module',
            },
        };
    }

    return {
        ...baseManifest,
        background: {
            scripts: ['extension/background/index.js'],
            type: 'module',
        },
        browser_specific_settings: {
            gecko: {
                id: 'dorso@gongahkia.com',
            },
        },
    };
}

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

    if (!(await exists(extensionRoot))) {
        throw new Error(`Missing extension source directory: ${extensionRoot}`);
    }

    if (!(await exists(sharedRoot))) {
        throw new Error(`Missing shared source directory: ${sharedRoot}`);
    }

    await rm(config.outputDir, { recursive: true, force: true });
    await mkdir(path.join(config.outputDir, 'extension'), { recursive: true });
    await mkdir(path.join(config.outputDir, 'shared'), { recursive: true });
    await cp(extensionRoot, path.join(config.outputDir, 'extension'), { recursive: true });
    await cp(sharedRoot, path.join(config.outputDir, 'shared'), {
        recursive: true,
        filter: sharedFilter,
    });
    await writeFile(
        path.join(config.outputDir, 'manifest.json'),
        `${JSON.stringify(getManifest(browser), null, 2)}\n`,
        'utf8',
    );

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
