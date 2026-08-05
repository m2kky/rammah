import {
  closeTestDatabase,
  configureIntegrationTestEnvironment,
  connectTestDatabase,
  migrateTestDatabase,
  resetTestDatabase,
} from "../test/db.js";

const databaseUrl = configureIntegrationTestEnvironment(process.env);
const context = await connectTestDatabase(process.env);

try {
  await resetTestDatabase(context, process.env);
  await migrateTestDatabase(context, process.env);
  console.log(`Test database reset and migrated at ${new URL(databaseUrl).host}.`);
} finally {
  await closeTestDatabase(context, process.env);
}
