import { readFileSync } from "fs";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const snapshotPath = resolve(rootDir, "scripts", "permission-snapshot.json");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

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

for (const [target, expected] of Object.entries(snapshot)) {
  const manifestPath = resolve(rootDir, "dist", target, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assertEqual(manifest.permissions, expected.permissions, `${target} permissions`);
  assertEqual(manifest.host_permissions, expected.host_permissions, `${target} host_permissions`);
}

console.log("permission snapshot ok");
