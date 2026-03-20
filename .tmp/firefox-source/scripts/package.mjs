import { existsSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const artifacts = [
  { archive: "rakuzaichi-chrome.zip", dir: resolve(rootDir, "dist", "chrome") },
  { archive: "rakuzaichi-firefox.xpi", dir: resolve(rootDir, "dist", "firefox") }
];

for (const { archive, dir } of artifacts) {
  const archivePath = resolve(rootDir, archive);
  if (existsSync(archivePath)) rmSync(archivePath, { force: true });
  execFileSync("zip", ["-r", archivePath, "."], { cwd: dir, stdio: "inherit" });
}
