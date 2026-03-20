import { cpSync, existsSync, readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const rootDir = resolve(process.cwd());
const safariSource = resolve(rootDir, "dist", "safari");
const safariProjectDir = resolve(rootDir, "safari");
const templateDir = resolve(rootDir, "safari-template");

if (!existsSync(safariSource)) {
  throw new Error("Build the Safari extension bundle before converting it");
}

execFileSync(
  "xcrun",
  [
    "safari-web-extension-converter",
    safariSource,
    "--project-location",
    safariProjectDir,
    "--app-name",
    "Rakuzaichi",
    "--bundle-identifier",
    "com.gabrielongzm.rakuzaichi",
    "--swift",
    "--macos-only",
    "--copy-resources",
    "--no-open",
    "--no-prompt",
    "--force"
  ],
  { cwd: rootDir, stdio: "inherit" }
);

const pbxprojPath = resolve(safariProjectDir, "Rakuzaichi", "Rakuzaichi.xcodeproj", "project.pbxproj");
const onboardingTargets = [
  {
    from: resolve(templateDir, "Main.html"),
    to: resolve(safariProjectDir, "Rakuzaichi", "Rakuzaichi", "Resources", "Base.lproj", "Main.html")
  },
  {
    from: resolve(templateDir, "Style.css"),
    to: resolve(safariProjectDir, "Rakuzaichi", "Rakuzaichi", "Resources", "Style.css")
  },
  {
    from: resolve(templateDir, "Script.js"),
    to: resolve(safariProjectDir, "Rakuzaichi", "Rakuzaichi", "Resources", "Script.js")
  }
];

for (const file of onboardingTargets) {
  cpSync(file.from, file.to);
}

const pbxproj = readFileSync(pbxprojPath, "utf8").replaceAll(
  "PRODUCT_BUNDLE_IDENTIFIER = com.gabrielongzm.Rakuzaichi;",
  "PRODUCT_BUNDLE_IDENTIFIER = com.gabrielongzm.rakuzaichi;"
);
writeFileSync(pbxprojPath, pbxproj);
