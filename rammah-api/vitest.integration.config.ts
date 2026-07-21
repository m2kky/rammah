import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['src/**/*.unit.test.ts'],
    passWithNoTests: false,
    setupFiles: ['./src/test/setup.ts'],
  },
});
