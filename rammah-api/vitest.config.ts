import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.unit.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    passWithNoTests: false,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah_test',
      ADMIN_SESSION_SECRET: 'unit-test-secret-only',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.test.ts'],
    },
  },
});
