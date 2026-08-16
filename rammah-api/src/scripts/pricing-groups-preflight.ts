import { closeDatabase, pool } from "../db/client.js";
import {
  assertPricingGroupsMigrationReady,
  inspectPricingGroupsMigration,
  parseSupportedCurrencies,
} from "../modules/pricing/pricing-groups-preflight.js";
import { isoCountryCodes } from "../shared/geo/countries.js";

const run = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const supportedCurrencies = parseSupportedCurrencies(
      process.env.PAYMENT_SUPPORTED_CURRENCIES ?? "EGP",
    );
    const report = await inspectPricingGroupsMigration(
      client,
      supportedCurrencies,
      isoCountryCodes,
    );

    console.log(JSON.stringify(report, null, 2));
    assertPricingGroupsMigrationReady(report);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(closeDatabase);
