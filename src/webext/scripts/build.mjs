import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const distRoot = path.join(packageRoot, 'dist');
const srcRoot = path.join(packageRoot, 'src');

const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const version = pkg.version;

const entryPoints = {
  background: path.join(srcRoot, 'background', 'index.ts'),
  content: path.join(srcRoot, 'content', 'index.ts'),
  popup: path.join(srcRoot, 'popup', 'index.ts'),
  options: path.join(srcRoot, 'options', 'index.ts'),
};

const browserTargets = ['chrome', 'firefox', 'safari'];
const googleApiOrigins = [
  'https://accounts.google.com/*',
  'https://oauth2.googleapis.com/*',
  'https://www.googleapis.com/*',
];
const googleEditorOrigins = [
  'https://docs.google.com/document/*',
  'https://docs.google.com/spreadsheets/*',
  'https://docs.google.com/presentation/*',
];

function createManifest(target) {
  const permissions = ['storage', 'scripting', 'activeTab'];
  if (target === 'chrome' || target === 'firefox') {
    permissions.push('identity');
  }

  const base = {
    manifest_version: 3,
    name: 'Owl Tags',
    version,
    description:
      'Scan, highlight, export, mark, and archive tagged annotations in Google Docs, Sheets, and Slides.',
    homepage_url: 'https://github.com/gongahkia/owl',
    action: {
      default_title: 'Owl Tags',
      default_popup: 'popup.html',
    },
    options_page: 'options.html',
    permissions,
    host_permissions: googleApiOrigins,
    optional_host_permissions: googleEditorOrigins,
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  };

  if (target === 'firefox') {
    base.background = {
      scripts: ['background.js'],
    };
    base.browser_specific_settings = {
      gecko: {
        id: 'owl-tags@gongahkia',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['authenticationInfo', 'websiteContent'],
          optional: [],
        },
      },
    };
  }

  if (target === 'chrome') {
    base.background = {
      service_worker: 'background.js',
    };
  }

  if (target === 'safari') {
    base.background = {
      scripts: ['background.js'],
      service_worker: 'background.js',
      preferred_environment: ['service_worker', 'document'],
    };
    delete base.optional_host_permissions;
    base.host_permissions = [...googleApiOrigins, ...googleEditorOrigins];
  }

  return base;
}

async function copyStaticAssets(outputDir) {
  await cp(path.join(srcRoot, 'popup', 'popup.html'), path.join(outputDir, 'popup.html'));
  await cp(path.join(srcRoot, 'popup', 'popup.css'), path.join(outputDir, 'popup.css'));
  await cp(path.join(srcRoot, 'options', 'options.html'), path.join(outputDir, 'options.html'));
  await cp(path.join(srcRoot, 'options', 'options.css'), path.join(outputDir, 'options.css'));
  await cp(path.join(packageRoot, 'assets', 'icons'), path.join(outputDir, 'icons'), {
    recursive: true,
  });
}

for (const target of browserTargets) {
  const outputDir = path.join(distRoot, target);
  await mkdir(outputDir, { recursive: true });

  await esbuild.build({
    bundle: true,
    entryPoints,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outdir: outputDir,
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'info',
  });

  await copyStaticAssets(outputDir);
  await writeFile(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(createManifest(target), null, 2) + '\n'
  );
}
