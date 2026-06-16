import { existsSync, mkdirSync, rmSync } from "fs";
import { cpSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const stagingDir = resolve(rootDir, "dist", "firefox-source");
const archivePath = resolve(rootDir, "rakuzaichi-firefox-source.zip");

const includePaths = [
  "package.json",
  "package-lock.json",
  "Makefile",
  "README.md",
  "PRIVACY.md",
  "docs",
  "scripts",
  "src",
  "test"
];

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

for (const item of includePaths) {
  cpSync(resolve(rootDir, item), resolve(stagingDir, item), { recursive: true });
}

if (existsSync(archivePath)) {
  rmSync(archivePath, { force: true });
}

execFileSync("zip", ["-r", archivePath, "."], { cwd: stagingDir, stdio: "inherit" });
