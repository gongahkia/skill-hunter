import { existsSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const archivePath = resolve(rootDir, "rakuzaichi-firefox.xpi");
const sourceDir = resolve(rootDir, "dist", "firefox");

if (existsSync(archivePath)) {
  rmSync(archivePath, { force: true });
}

execFileSync("zip", ["-r", archivePath, "."], { cwd: sourceDir, stdio: "inherit" });
