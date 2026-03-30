import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "judgeman_v4", "src");
const ICONS_DIR = path.join(SOURCE_DIR, "icons");
const DIST_DIR = path.join(ROOT, "dist");
const CONFIG_DIR = path.join(ROOT, "judgeman_v4", "config");
const FIREFOX_ADDON_ID =
  process.env.JUDGEMAN_FIREFOX_ADDON_ID || "judgeman@gongahkia.github.io";
const FIREFOX_STRICT_MIN_VERSION =
  process.env.JUDGEMAN_FIREFOX_STRICT_MIN_VERSION || "140.0";
const FIREFOX_ANDROID_STRICT_MIN_VERSION =
  process.env.JUDGEMAN_FIREFOX_ANDROID_STRICT_MIN_VERSION || "142.0";
const COPY_FILES = [
  "browserApi.js",
  "logger.js",
  "citationAdapters.js",
  "citationLinker.js",
  "caseToolkit.js",
  "contentApp.js",
  "contentScript.js",
  "extractor.js",
  "panel.css",
  "popup.css",
  "popup.html",
  "popup.js"
];
const TARGETS = new Set(["chrome", "firefox", "safari"]);

function loadBaseManifest() {
  const manifestPath = path.join(CONFIG_DIR, "manifest.base.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function ensureIcons() {
  const required = [
    "judgeman-16.png",
    "judgeman-32.png",
    "judgeman-48.png",
    "judgeman-128.png",
    "judgeman-512.png",
    "judgeman-1024.png"
  ];

  for (const fileName of required) {
    const iconPath = path.join(ICONS_DIR, fileName);
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Missing icon asset: ${iconPath}. Run "npm run icons" first.`);
    }
  }
}

function cleanTargetDir(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
}

function copySourceFiles(targetDir) {
  for (const fileName of COPY_FILES) {
    fs.copyFileSync(path.join(SOURCE_DIR, fileName), path.join(targetDir, fileName));
  }

  fs.cpSync(ICONS_DIR, path.join(targetDir, "icons"), { recursive: true });
}

function createChromeManifest() {
  return loadBaseManifest();
}

function createFirefoxManifest() {
  const manifest = loadBaseManifest();
  manifest.browser_specific_settings = {
    gecko: {
      id: FIREFOX_ADDON_ID,
      strict_min_version: FIREFOX_STRICT_MIN_VERSION,
      data_collection_permissions: {
        required: ["none"]
      }
    },
    gecko_android: {
      strict_min_version: FIREFOX_ANDROID_STRICT_MIN_VERSION
    }
  };
  return manifest;
}

function createSafariManifest() {
  return loadBaseManifest();
}

function writeManifest(targetDir, manifest) {
  fs.writeFileSync(
    path.join(targetDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

function buildTarget(target) {
  const targetDir = path.join(DIST_DIR, target);
  cleanTargetDir(targetDir);
  copySourceFiles(targetDir);

  if (target === "chrome") {
    writeManifest(targetDir, createChromeManifest());
  } else if (target === "firefox") {
    writeManifest(targetDir, createFirefoxManifest());
  } else if (target === "safari") {
    writeManifest(targetDir, createSafariManifest());
  } else {
    throw new Error(`Unknown build target: ${target}`);
  }

  return targetDir;
}

function main() {
  ensureIcons();

  const arg = process.argv[2] || "all";
  const requested = arg === "all" ? [...TARGETS] : [arg];

  for (const target of requested) {
    if (!TARGETS.has(target)) {
      throw new Error(`Unsupported target "${target}". Expected one of: all, chrome, firefox, safari.`);
    }
    const targetDir = buildTarget(target);
    console.log(`Built ${target} artifact at ${targetDir}`);
  }
}

main();
