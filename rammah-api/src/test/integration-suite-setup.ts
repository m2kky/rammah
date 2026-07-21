import { afterAll, beforeAll, beforeEach } from "vitest";
import {
  closeTestDatabase,
  connectTestDatabase,
  getTestDatabase,
  truncateTestData,
} from "./db.js";

beforeAll(async () => {
  await connectTestDatabase();
});

beforeEach(async () => {
  await truncateTestData(getTestDatabase());
});

afterAll(async () => {
  await closeTestDatabase(getTestDatabase());
});
