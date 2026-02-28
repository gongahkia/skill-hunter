import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputDir = path.resolve(process.cwd(), "input");
const outputDir = path.resolve(process.cwd(), "output");
const apiBaseUrl = (process.env.FUN_FUN_CLOTH_API_URL ?? "http://127.0.0.1:4014").replace(/\/$/, "");

async function run() {
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const files = (await readdir(inputDir)).filter((name) => name.endsWith(".policy.dsl"));
  let processed = 0;

  for (const fileName of files) {
    const dsl = await readFile(path.join(inputDir, fileName), "utf8");
    const response = await fetch(`${apiBaseUrl}/compile`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ dsl })
    });

    const payload = await response.json().catch(() => ({}));
    const outputPath = path.join(outputDir, `${fileName.replace(/\.policy\.dsl$/, "")}.compiled.json`);

    await writeFile(
      outputPath,
      JSON.stringify(
        {
          sourceFile: fileName,
          compiledAt: new Date().toISOString(),
          ok: response.ok,
          payload
        },
        null,
        2
      ),
      "utf8"
    );

    processed += 1;
  }

  console.log(`[fun-fun-cloth/worker-compiler] processed ${processed} file(s)`);
}

await run();
