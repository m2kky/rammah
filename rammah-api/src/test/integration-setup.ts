import {
  closeTestDatabase,
  connectTestDatabase,
  migrateTestDatabase,
  resetTestDatabase,
} from "./db.js";

export default async function setupIntegrationDatabase(): Promise<() => Promise<void>> {
  const setupContext = await connectTestDatabase();
  try {
    await resetTestDatabase(setupContext);
    await migrateTestDatabase(setupContext);
  } finally {
    await closeTestDatabase(setupContext);
  }

  return async () => {
    const teardownContext = await connectTestDatabase();
    try {
      await resetTestDatabase(teardownContext);
    } finally {
      await closeTestDatabase(teardownContext);
    }
  };
}
