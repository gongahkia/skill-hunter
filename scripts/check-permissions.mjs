import { readFileSync } from "fs";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const snapshotPath = resolve(rootDir, "scripts", "permission-snapshot.json");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const broadHostPatterns = new Set(["<all_urls>", "*://*/*", "http://*/*", "https://*/*"]);

function sorted(list = []) {
  return [...list].sort();
}

function assertEqual(actual, expected, label) {
  const actualJson = JSON.stringify(sorted(actual));
  const expectedJson = JSON.stringify(sorted(expected));
  if (actualJson !== expectedJson) {
    throw new Error(`${label} mismatch\nexpected: ${expectedJson}\nactual:   ${actualJson}`);
  }
}

function assertNarrowHostPermissions(hostPermissions = [], label) {
  for (const pattern of hostPermissions) {
    if (
      broadHostPatterns.has(pattern) ||
      pattern.includes("*://") ||
      pattern.includes("://*") ||
      !pattern.startsWith("https://")
    ) {
      throw new Error(`${label} contains broad or non-HTTPS host permission: ${pattern}`);
    }
  }
}

function assertContentScriptMatches(manifest, label) {
  const scripts = manifest.content_scripts || [];
  for (let index = 0; index < scripts.length; index += 1) {
    assertEqual(scripts[index].matches, manifest.host_permissions, `${label} content_scripts[${index}].matches`);
  }
}

const sourceManifest = JSON.parse(readFileSync(resolve(rootDir, "src", "manifest.json"), "utf8"));
assertEqual(sourceManifest.permissions, snapshot.chrome.permissions, "src permissions");
assertEqual(sourceManifest.host_permissions, snapshot.chrome.host_permissions, "src host_permissions");
assertNarrowHostPermissions(sourceManifest.host_permissions, "src host_permissions");
assertContentScriptMatches(sourceManifest, "src manifest");

for (const [target, expected] of Object.entries(snapshot)) {
  const manifestPath = resolve(rootDir, "dist", target, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assertEqual(manifest.permissions, expected.permissions, `${target} permissions`);
  assertEqual(manifest.host_permissions, expected.host_permissions, `${target} host_permissions`);
  assertNarrowHostPermissions(manifest.host_permissions, `${target} host_permissions`);
  assertContentScriptMatches(manifest, `${target} manifest`);
}

console.log("permission snapshot ok");
