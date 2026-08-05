import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.regression.test.ts"],
    passWithNoTests: false,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      NODE_ENV: "test",
      TZ: "UTC",
      DATABASE_URL: "postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah_test",
      ADMIN_SESSION_SECRET: "regression-test-secret-only",
    },
  },
});
