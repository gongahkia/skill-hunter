import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiBaseUrl = (process.env.SUN_AND_MOON_API_URL ?? "http://127.0.0.1:4013").replace(/\/$/, "");
const snapshotDir = path.resolve(process.cwd(), "data", "snapshots");

async function run() {
  await mkdir(snapshotDir, { recursive: true });

  const listResponse = await fetch(`${apiBaseUrl}/cases`);
  const listPayload = (await listResponse.json()) as {
    items: Array<{ id: string; name: string }>;
  };

  let materialized = 0;

  for (const item of listPayload.items) {
    const chronologyResponse = await fetch(`${apiBaseUrl}/cases/${item.id}/chronology`);
    const chronologyPayload = await chronologyResponse.json();

    const outputPath = path.join(snapshotDir, `${item.id}.timeline.json`);
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          caseName: item.name,
          chronology: chronologyPayload
        },
        null,
        2
      ),
      "utf8"
    );

    materialized += 1;
  }

  console.log(`[sun-and-moon/worker-timeline] materialized ${materialized} snapshot(s)`);
}

await run();
