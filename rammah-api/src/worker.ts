import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";
import {
  claimOutboxEvents,
  completeOutboxEvent,
  enqueueOutboxEvent,
  retryOrDeadLetterOutboxEvent,
} from "./modules/outbox/outbox.repository.js";
import { logger } from "./shared/logger/logger.js";
import { createHandlerRegistry } from "./worker/handler-registry.js";
import { createWorkerLifecycle } from "./worker/lifecycle.js";
import { productHandlers } from "./worker/product-handlers.js";
import { createJobRunner, type Sleep } from "./worker/runner.js";
import { createWorkerRuntime } from "./worker/runtime.js";
import { createDurableScheduler } from "./worker/scheduler.js";
import { scheduledJobs } from "./worker/scheduled-jobs.js";

const sleep: Sleep = (milliseconds, signal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason);
    return;
  }
  const onAbort = () => {
    clearTimeout(timeout);
    reject(signal?.reason);
  };
  const timeout = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, milliseconds);
  signal?.addEventListener("abort", onAbort, { once: true });
});

const repository = {
  claim: claimOutboxEvents,
  complete: completeOutboxEvent,
  retryOrDeadLetter: retryOrDeadLetterOutboxEvent,
};

const handlers = createHandlerRegistry(productHandlers);
const scheduler = createDurableScheduler({
  enqueue: enqueueOutboxEvent,
  definitions: scheduledJobs,
});
const runner = createJobRunner({
  repository,
  handlers,
  now: () => new Date(),
  random: Math.random,
  sleep,
  logger,
  timeoutMs: env.JOB_TIMEOUT_SECONDS * 1_000,
  maxAttempts: env.JOB_MAX_ATTEMPTS,
  backoffBaseMs: env.JOB_BACKOFF_BASE_MS,
  backoffMaxMs: env.JOB_BACKOFF_MAX_MS,
});
const runtime = createWorkerRuntime({
  claim: repository.claim,
  run: runner.run,
  runScheduledJobs: scheduler.runDue,
  now: () => new Date(),
  sleep,
  logger,
  batchSize: env.WORKER_BATCH_SIZE,
  concurrency: env.WORKER_CONCURRENCY,
  leaseDurationMs: env.JOB_LEASE_SECONDS * 1_000,
  pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
  drainTimeoutMs: env.WORKER_DRAIN_TIMEOUT_MS,
});
const lifecycle = createWorkerLifecycle({
  runtime,
  closeDatabase,
  signals: process,
  logger,
});

logger.info("Worker started", {
  environment: env.NODE_ENV,
  concurrency: env.WORKER_CONCURRENCY,
  batchSize: env.WORKER_BATCH_SIZE,
});

void lifecycle.start().catch(async (error: unknown) => {
  logger.error("Worker stopped unexpectedly", {
    errorName: error instanceof Error ? error.constructor.name : "UnknownError",
  });
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
