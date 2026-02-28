import { PrismaClient } from "@prisma/client";

import { runNightlyFeedbackAggregation } from "../modules/feedback/nightly-thresholds";
import { scrubPii } from "../modules/security/pii-scrubber";

const prisma = new PrismaClient();

async function main() {
  const result = await runNightlyFeedbackAggregation(prisma);

  console.log(
    "Completed nightly feedback aggregation",
    scrubPii({
      profilesScanned: result.profilesScanned,
      profilesUpdated: result.profilesUpdated,
      lookbackDays: result.lookbackDays
    })
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed nightly feedback aggregation",
      scrubPii({
        error
      })
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
