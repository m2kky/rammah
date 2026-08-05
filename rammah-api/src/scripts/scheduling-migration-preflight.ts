import { closeDatabase, pool } from "../db/client.js";
import { inspectLegacySchedulingMigration } from "../modules/scheduling/scheduling-migration-preflight.js";

const run = async () => {
  const report = await inspectLegacySchedulingMigration(pool);

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(closeDatabase);
