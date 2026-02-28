import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputDir = path.resolve(process.cwd(), "input");
const outputDir = path.resolve(process.cwd(), "output");
const apiBaseUrl = (process.env.ORDER_STAMP_API_URL ?? "http://127.0.0.1:4012").replace(/\/$/, "");

async function run() {
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const files = (await readdir(inputDir)).filter((name) => name.endsWith(".txt"));
  let processed = 0;

  for (const fileName of files) {
    const filePath = path.join(inputDir, fileName);
    const text = await readFile(filePath, "utf8");

    const response = await fetch(`${apiBaseUrl}/detect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, maxFindings: 50 })
    });

    const payload = await response.json().catch(() => ({}));

    const reportPath = path.join(outputDir, `${fileName.replace(/\.txt$/, "")}.report.json`);
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          sourceFile: fileName,
          scannedAt: new Date().toISOString(),
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

  console.log(`[order-stamp/worker-detection] processed ${processed} file(s)`);
}

await run();
