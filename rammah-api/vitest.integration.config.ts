import { defineConfig } from 'vitest/config';
import { configureIntegrationTestEnvironment } from './src/test/db.js';

const testDatabaseUrl = configureIntegrationTestEnvironment(process.env);

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['src/**/*.unit.test.ts'],
    passWithNoTests: false,
    globalSetup: ['./src/test/integration-setup.ts'],
    setupFiles: ['./src/test/setup.ts', './src/test/integration-suite-setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      NODE_ENV: 'test',
      TEST_DATABASE_URL: testDatabaseUrl,
      DATABASE_URL: testDatabaseUrl,
      ADMIN_SESSION_SECRET: 'integration-test-secret-only',
      FRONTEND_ORIGIN: 'http://127.0.0.1:3000',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_MODE: 'test',
      KASHIER_MERCHANT_ID: 'MID-TEST',
      KASHIER_API_KEY: 'integration-kashier-api-key',
      KASHIER_SECRET: 'integration-kashier-secret',
      KASHIER_CALLBACK_URL: 'http://127.0.0.1:4000/api/v1/payments/webhooks/kashier',
      KASHIER_RETURN_URL: 'http://127.0.0.1:3000/booking/payment/return',
      EMAIL_PROVIDER: 'mock',
      REQUEST_LOG_LEVEL: 'error',
    },
  },
});
