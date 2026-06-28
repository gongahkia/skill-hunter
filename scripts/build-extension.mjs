import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import {
    CHATBOT_MATCH_PATTERNS,
    CHATBOT_TARGETS,
} from '../src/shared/core/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manifestVersion = packageJson.version.split('-')[0];
const extensionRoot = path.join(repoRoot, 'src', 'extension');
const sharedRoot = path.join(repoRoot, 'src', 'shared');
const distRoot = path.join(repoRoot, 'dist');
const isDevBuild = process.env.DORSO_BUILD_DEV === '1';
const leetCodePattern = 'https://leetcode.com/problems/*';
const iconPath = 'extension/assets/icons/icon-128.png';
const firefoxAddonId = 'dorso-public-firefox@extensions.gongahkia.com';
const badgeConfigPath = path.join('extension', 'lib', 'badge-config.js');
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
const bundleEntries = [
    {
        entry: path.join(extensionRoot, 'background', 'index.js'),
        outfile: path.join('extension', 'background', 'index.js'),
        format: 'esm',
    },
    {
        entry: path.join(extensionRoot, 'content', 'chatbot-gate.js'),
        outfile: path.join('extension', 'content', 'chatbot-gate.js'),
        format: 'iife',
    },
    {
        entry: path.join(extensionRoot, 'content', 'leetcode.js'),
        outfile: path.join('extension', 'content', 'leetcode.js'),
        format: 'iife',
    },
    {
        entry: path.join(extensionRoot, 'ui', 'popup.js'),
        outfile: path.join('extension', 'ui', 'popup.js'),
        format: 'esm',
    },
];

function getHostPermissions() {
    const permissions = CHATBOT_TARGETS.flatMap((target) => {
        return target.hostnames.map((hostname) => `https://${hostname}/*`);
    });
    permissions.push(leetCodePattern);

    return [...new Set(permissions)];
}

function getManifest(browser) {
    const baseManifest = {
        manifest_version: 3,
        name: 'Dorso',
        version: manifestVersion,
        version_name: packageJson.version,
        description: 'Protect selected AI chatbot sites until a coding challenge is solved.',
        permissions: ['storage', 'downloads', 'alarms'],
        optional_host_permissions: ['https://dorso.dev/*', 'https://adventofcode.com/*'],
        host_permissions: getHostPermissions(),
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
                js: ['extension/lib/messaging.js', 'extension/content/chatbot-gate.js'],
                run_at: 'document_start',
            },
            {
                matches: [leetCodePattern],
                js: ['extension/lib/messaging.js', 'extension/content/leetcode.js'],
                run_at: 'document_idle',
            },
        ],
    };

    if (browser === 'chrome' || browser === 'safari') {
        return {
            ...baseManifest,
            content_security_policy: {
                extension_pages: "script-src 'self'; object-src 'self'",
            },
            background: {
                service_worker: 'extension/background/index.js',
                type: 'module',
            },
        };
    }

    return {
        ...baseManifest,
        content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'",
        },
        background: {
            scripts: ['extension/background/index.js'],
            type: 'module',
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

function getBadgeConfigSource() {
    return `globalThis.DorsoBadgeConfig = ${JSON.stringify({
        baseUrl: process.env.DORSO_BADGE_BASE_URL || 'https://dorso.dev',
        hmacSecret: process.env.CF_HMAC_SECRET || '',
    }, null, 4)};\n`;
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function bundleExtensionJs(outputDir) {
    await Promise.all(bundleEntries.map((entry) => {
        return esbuild({
            entryPoints: [entry.entry],
            outfile: path.join(outputDir, entry.outfile),
            bundle: true,
            format: entry.format,
            platform: 'browser',
            target: ['chrome120', 'firefox120', 'safari17'],
            minify: !isDevBuild,
            sourcemap: isDevBuild ? 'external' : false,
            legalComments: 'none',
            treeShaking: true,
        });
    }));
}

async function pruneBundledSources(outputDir) {
    const outputLibDir = path.join(outputDir, 'extension', 'lib');
    await rm(outputLibDir, { recursive: true, force: true });
    await mkdir(outputLibDir, { recursive: true });
    await cp(
        path.join(extensionRoot, 'lib', 'messaging.js'),
        path.join(outputLibDir, 'messaging.js'),
    );
    await rm(path.join(outputDir, 'extension', 'ui', 'share-text.js'), { force: true });
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
    await cp(extensionRoot, path.join(config.outputDir, 'extension'), { recursive: true });
    await bundleExtensionJs(config.outputDir);
    await pruneBundledSources(config.outputDir);
    if (await exists(path.join(sharedRoot, 'data'))) {
        await cp(path.join(sharedRoot, 'data'), path.join(config.outputDir, 'data'), {
            recursive: true,
        });
    }
    await writeFile(
        path.join(config.outputDir, 'manifest.json'),
        `${JSON.stringify(getManifest(browser), null, 2)}\n`,
        'utf8',
    );
    await writeFile(
        path.join(config.outputDir, badgeConfigPath),
        getBadgeConfigSource(),
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
