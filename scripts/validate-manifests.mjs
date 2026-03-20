import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const targets = ["chrome", "firefox", "safari"];

for (const target of targets) {
  const manifestPath = resolve(rootDir, "dist", target, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest for ${target}: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.permissions.includes("activeTab") || manifest.permissions.includes("scripting")) {
    throw new Error(`${target} manifest still includes an unused permission`);
  }
}

console.log("manifests valid");
