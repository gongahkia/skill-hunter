import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { build as bundle } from "esbuild";

const rootDir = resolve(process.cwd());
const srcDir = resolve(rootDir, "src");
const distDir = resolve(rootDir, "dist");
const requestedTarget = process.argv[2] || "all";
const targets = requestedTarget === "all" ? ["chrome", "firefox", "safari"] : [requestedTarget];

const baseManifest = JSON.parse(readFileSync(resolve(srcDir, "manifest.json"), "utf8"));
const transformersRuntimeFiles = [
  {
    from: resolve(rootDir, "node_modules", "onnxruntime-web", "dist", "ort-wasm-simd-threaded.jsep.mjs"),
    to: "vendor/transformers/ort-wasm-simd-threaded.jsep.mjs"
  },
  {
    from: resolve(rootDir, "node_modules", "onnxruntime-web", "dist", "ort-wasm-simd-threaded.jsep.wasm"),
    to: "vendor/transformers/ort-wasm-simd-threaded.jsep.wasm"
  }
];
const transformersEntry = resolve(rootDir, "node_modules", "@huggingface", "transformers", "dist", "transformers.web.js");
const firefoxBackgroundScripts = [
  "compat.js",
  "logger.js",
  "converters.js",
  "filename.js",
  "storage.js",
  "history.js",
  "vendor/minisearch.js",
  "vault/db.js",
  "vault/dao.js",
  "vault/search-worker.js",
  "vault/search.js",
  "threads/scanner.js",
  "background-core.js"
];

function ensureCleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function writeManifest(target) {
  const manifest = JSON.parse(JSON.stringify(baseManifest));
  if (target === "chrome") {
    manifest.background = { service_worker: "background-sw.js" };
    delete manifest.browser_specific_settings;
    return manifest;
  }

  if (target === "firefox") {
    manifest.background = { scripts: firefoxBackgroundScripts };
    manifest.browser_specific_settings = {
      gecko: {
        id: "rakuzaichi@gabrielongzm.com",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"]
        }
      },
      gecko_android: {
        strict_min_version: "142.0"
      }
    };
    return manifest;
  }

  manifest.background = { scripts: firefoxBackgroundScripts };
  manifest.permissions = manifest.permissions.filter(function(permission) {
    return permission !== "downloads";
  });
  if (manifest.options_ui) delete manifest.options_ui.open_in_tab;
  manifest.browser_specific_settings = {
    safari: {
      strict_min_version: "17.0"
    }
  };
  return manifest;
}

function copyTransformersRuntime(outDir) {
  for (const file of transformersRuntimeFiles) {
    if (!existsSync(file.from)) {
      throw new Error(`Missing Transformers.js runtime file: ${file.from}`);
    }
    const targetPath = resolve(outDir, file.to);
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(file.from, targetPath);
  }
}

async function bundleTransformersRuntime(outDir) {
  if (!existsSync(transformersEntry)) {
    throw new Error(`Missing Transformers.js web entry: ${transformersEntry}`);
  }
  await bundle({
    entryPoints: [transformersEntry],
    outfile: resolve(outDir, "vendor", "transformers", "transformers.bundle.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "eof",
    logLevel: "silent"
  });
}

async function buildTarget(target) {
  const outDir = resolve(distDir, target);
  ensureCleanDir(outDir);
  cpSync(srcDir, outDir, { recursive: true });
  copyTransformersRuntime(outDir);
  await bundleTransformersRuntime(outDir);
  const manifest = writeManifest(target);
  writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

if (!existsSync(srcDir)) {
  throw new Error("Missing src directory");
}

mkdirSync(distDir, { recursive: true });
for (const target of targets) {
  if (!["chrome", "firefox", "safari"].includes(target)) {
    throw new Error(`Unknown build target: ${target}`);
  }
  await buildTarget(target);
}
