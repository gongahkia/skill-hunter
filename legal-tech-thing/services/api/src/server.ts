import { buildApp } from "./app";
import { scrubPii } from "./modules/security/pii-scrubber";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

async function start() {
  const app = buildApp();

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(scrubPii(error), "Failed to start API server");
    process.exit(1);
  }
}

void start();
