import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const BUILD_SCRIPT_PATH = path.join(ROOT, "scripts", "build-extension.mjs");
const DIST_FIREFOX_DIR = path.join(ROOT, "dist", "firefox");
const SUBMISSION_DIR = path.join(ROOT, "submission", "firefox");
const REQUIRED_SOURCE_INCLUDE = [
  "Makefile",
  "package.json",
  "package-lock.json",
  "DOC.md",
  path.join("scripts", "build-extension.mjs"),
  path.join("scripts", "generate-icons.py"),
  path.join("scripts", "package-firefox-submission.mjs"),
  path.join("judgeman_v4", "config"),
  path.join("judgeman_v4", "src"),
  "tests"
];
const OPTIONAL_SOURCE_INCLUDE = ["AUDIT.md", "README2.md"];

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureZipAvailable() {
  try {
    execFileSync("zip", ["-v"], { stdio: "ignore" });
  } catch (error) {
    throw new Error('Missing "zip" command. Install zip before packaging Firefox submission artifacts.');
  }
}

function resetDir(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function zipDirectoryContents(sourceDir, outputPath) {
  fs.rmSync(outputPath, { force: true });
  run("zip", ["-qr", outputPath, "."], { cwd: sourceDir });
}

function copyIntoStage(stageDir) {
  for (const relativePath of REQUIRED_SOURCE_INCLUDE) {
    const sourcePath = path.join(ROOT, relativePath);
    const destinationPath = path.join(stageDir, relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing required source path for AMO source package: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

    if (fs.statSync(sourcePath).isDirectory()) {
      fs.cpSync(sourcePath, destinationPath, {
        recursive: true,
        filter(source, dest) {
          const relative = path.relative(ROOT, source);
          if (!relative || relative.startsWith("submission")) {
            return !relative.startsWith("submission");
          }
          if (relative === "node_modules") return false;
          if (relative.includes(`${path.sep}__pycache__`)) return false;
          if (relative.endsWith(".pyc")) return false;
          if (relative === "dist") return false;
          return true;
        }
      });
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  }

  for (const relativePath of OPTIONAL_SOURCE_INCLUDE) {
    const sourcePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Skipping optional source path (not found): ${relativePath}`);
      continue;
    }

    const destinationPath = path.join(stageDir, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function createSourceReadme(stageDir, extensionZipName, sourceZipName, manifest) {
  const readmePath = path.join(stageDir, "AMO_SOURCE_README.md");
  const contents = `# Firefox AMO Source Package

This archive contains the source used to generate the AMO upload package for Judgeman ${manifest.version}.

## Files Generated for Submission

- Add-on upload: \`submission/firefox/${extensionZipName}\`
- Source-code upload: \`submission/firefox/${sourceZipName}\`

## Rebuild Steps

\`\`\`bash
npm install
npm run icons
npm run build:firefox
npm run package:firefox
\`\`\`

## Exact Firefox Add-on ID

\`${manifest.browser_specific_settings?.gecko?.id || "unknown"}\`

## Expected Firefox Build Output

The generated extension package is built from the contents of \`dist/firefox\`, with \`manifest.json\` at the archive root.
`;
  fs.writeFileSync(readmePath, contents, "utf8");
}

function createAmoMetadata(manifest) {
  return {
    categories: {
      firefox: ["other"]
    },
    summary: {
      "en-US": manifest.description
    },
    homepage: {
      "en-US": "https://github.com/gongahkia/judgeman"
    },
    support_url: {
      "en-US": "https://github.com/gongahkia/judgeman/issues"
    }
  };
}

function main() {
  ensureZipAvailable();

  run(process.execPath, [BUILD_SCRIPT_PATH, "firefox"], { cwd: ROOT });

  const packageJson = readJson(PACKAGE_JSON_PATH);
  const manifest = readJson(path.join(DIST_FIREFOX_DIR, "manifest.json"));
  const version = manifest.version || packageJson.version;
  const extensionZipName = `judgeman-firefox-${version}.zip`;
  const sourceZipName = `judgeman-firefox-source-${version}.zip`;
  const extensionZipPath = path.join(SUBMISSION_DIR, extensionZipName);
  const sourceZipPath = path.join(SUBMISSION_DIR, sourceZipName);
  const amoMetadataPath = path.join(SUBMISSION_DIR, "amo-metadata.json");
  const tempStageDir = fs.mkdtempSync(path.join(os.tmpdir(), "judgeman-firefox-source-"));

  resetDir(SUBMISSION_DIR);
  zipDirectoryContents(DIST_FIREFOX_DIR, extensionZipPath);

  try {
    copyIntoStage(tempStageDir);
    createSourceReadme(tempStageDir, extensionZipName, sourceZipName, manifest);
    zipDirectoryContents(tempStageDir, sourceZipPath);
  } finally {
    fs.rmSync(tempStageDir, { recursive: true, force: true });
  }

  fs.writeFileSync(
    amoMetadataPath,
    `${JSON.stringify(createAmoMetadata(manifest), null, 2)}\n`,
    "utf8"
  );

  console.log(`Created AMO upload package: ${extensionZipPath}`);
  console.log(`Created AMO source package: ${sourceZipPath}`);
  console.log(`Created optional AMO metadata file: ${amoMetadataPath}`);
}

main();
