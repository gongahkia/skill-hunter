import { dirname, resolve } from "path";
import { existsSync, rmSync } from "fs";
import { execFileSync } from "child_process";

const rootDir = resolve(process.cwd());
const derivedDataPath = resolve(rootDir, "dist", "safari-derived");
const productsDir = resolve(derivedDataPath, "Build", "Products", "Debug");
const appPath = resolve(productsDir, "Rakuzaichi.app");
const archivePath = resolve(rootDir, "rakuzaichi-safari.zip");

rmSync(derivedDataPath, { recursive: true, force: true });
if (existsSync(archivePath)) rmSync(archivePath, { force: true });

execFileSync(
  "xcodebuild",
  [
    "-project",
    resolve(rootDir, "safari", "Rakuzaichi", "Rakuzaichi.xcodeproj"),
    "-scheme",
    "Rakuzaichi",
    "-configuration",
    "Debug",
    "-destination",
    "platform=macOS",
    "-derivedDataPath",
    derivedDataPath,
    "CODE_SIGNING_ALLOWED=NO",
    "build"
  ],
  { cwd: rootDir, stdio: "inherit" }
);

if (!existsSync(appPath)) {
  throw new Error(`Missing built Safari app: ${appPath}`);
}

execFileSync("zip", ["-r", archivePath, "Rakuzaichi.app"], { cwd: dirname(appPath), stdio: "inherit" });
