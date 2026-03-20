import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SAFARI_SOURCE = path.join(ROOT, "dist", "safari");
const PROJECT_LOCATION = path.join(ROOT, "safari");
const PROJECT_ROOT = path.join(PROJECT_LOCATION, "Judgeman");
const EXTENSION_RESOURCES = path.join(PROJECT_ROOT, "Judgeman Extension", "Resources");

function ensureSafariArtifact() {
  if (!fs.existsSync(path.join(SAFARI_SOURCE, "manifest.json"))) {
    throw new Error(`Safari source artifact not found at ${SAFARI_SOURCE}. Run "npm run build:safari" first.`);
  }
}

function syncResourcesIntoProject() {
  fs.rmSync(EXTENSION_RESOURCES, { recursive: true, force: true });
  fs.mkdirSync(EXTENSION_RESOURCES, { recursive: true });
  fs.cpSync(SAFARI_SOURCE, EXTENSION_RESOURCES, { recursive: true });
}

function createProjectIfMissing() {
  if (fs.existsSync(path.join(PROJECT_ROOT, "Judgeman.xcodeproj"))) {
    syncResourcesIntoProject();
    console.log(`Synced Safari extension resources into ${EXTENSION_RESOURCES}`);
    return;
  }

  const result = spawnSync(
    "xcrun",
    [
      "safari-web-extension-converter",
      SAFARI_SOURCE,
      "--project-location",
      PROJECT_LOCATION,
      "--app-name",
      "Judgeman",
      "--bundle-identifier",
      "sg.elit.judgeman",
      "--swift",
      "--macos-only",
      "--copy-resources",
      "--no-open",
      "--no-prompt",
      "--force"
    ],
    {
      cwd: ROOT,
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Safari project generation failed.");
  }

  process.stdout.write(result.stdout);
}

ensureSafariArtifact();
createProjectIfMissing();
