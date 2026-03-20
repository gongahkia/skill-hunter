import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { CHATBOT_MATCH_PATTERNS } from '../src/shared/core/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'src', 'extension');
const sharedRoot = path.join(repoRoot, 'src', 'shared');
const distRoot = path.join(repoRoot, 'dist');
const leetCodePattern = 'https://leetcode.com/problems/*';
const iconPath = 'extension/assets/icons/icon-128.png';
const firefoxAddonId = 'dorso-public-firefox@extensions.gongahkia.com';
const actionIcons = {
    16: 'extension/assets/icons/icon-16.png',
    32: 'extension/assets/icons/icon-32.png',
};

const browserConfigs = {
    chrome: {
        outputDir: path.join(distRoot, 'chrome'),
    },
    firefox: {
        outputDir: path.join(distRoot, 'firefox'),
    },
    safari: {
        outputDir: path.join(distRoot, 'safari'),
    },
};

const sharedFilter = (sourcePath) => {
    return ![
        '__tests__',
        'api',
        '.eslintrc.json',
        '.prettierrc.json',
        'jest.config.js',
        'package.json',
        'package-lock.json',
        'node_modules',
        'adapters',
        'question-manager.js',
        'session-manager.js',
        'logger.js',
        'validator.js',
    ].some((needle) => sourcePath.includes(needle));
};

function getManifest(browser) {
    const baseManifest = {
        manifest_version: 3,
        name: 'Dorso',
        version: '2.1.0',
        description: 'Protect selected AI chatbot sites until a matching LeetCode challenge is solved.',
        permissions: ['storage'],
        host_permissions: [...CHATBOT_MATCH_PATTERNS, leetCodePattern],
        icons: {
            16: actionIcons[16],
            32: actionIcons[32],
            48: 'extension/assets/icons/icon-48.png',
            128: iconPath,
        },
        action: {
            default_popup: 'extension/ui/popup.html',
            default_icon: actionIcons,
        },
        content_scripts: [
            {
                matches: CHATBOT_MATCH_PATTERNS,
                js: ['extension/content/chatbot-gate.js'],
                run_at: 'document_start',
            },
            {
                matches: [leetCodePattern],
                js: ['extension/content/leetcode.js'],
                run_at: 'document_idle',
            },
        ],
    };

    if (browser === 'chrome' || browser === 'safari') {
        return {
            ...baseManifest,
            background: {
                service_worker: 'extension/background/index.js',
            },
        };
    }

    return {
        ...baseManifest,
        background: {
            scripts: ['extension/background/index.js'],
        },
        browser_specific_settings: {
            gecko: {
                id: firefoxAddonId,
                data_collection_permissions: {
                    required: ['none'],
                    optional: [],
                },
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
