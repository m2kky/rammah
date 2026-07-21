import { describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";
import { createHandlerRegistry, PermanentJobError } from "./handler-registry.js";
import { calculateRetryDelayMs, createJobRunner } from "./runner.js";

const now = new Date("2026-07-21T12:00:00.000Z");

const event = (overrides: Partial<OutboxEvent> = {}): OutboxEvent => ({
  id: "00000000-0000-4000-8000-000000000001",
  topic: "test.topic",
  aggregateType: "test",
  aggregateId: "aggregate-1",
  payload: { secret: "must-not-be-logged" },
  idempotencyKey: "test.topic:aggregate-1",
  state: "processing",
  attempts: 1,
  availableAt: now,
  lockedAt: now,
  lockToken: "00000000-0000-4000-8000-000000000002",
  processedAt: null,
  lastError: null,
  createdAt: now,
  ...overrides,
});

const setup = (handler: (job: OutboxEvent, context: { signal: AbortSignal }) => Promise<void>) => {
  const repository = {
    claim: vi.fn(),
    complete: vi.fn().mockResolvedValue(event({ state: "completed", lockToken: null })),
    retryOrDeadLetter: vi.fn().mockResolvedValue(event({ state: "queued", lockToken: null })),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const runner = createJobRunner({
    repository,
    handlers: createHandlerRegistry({ "test.topic": handler }),
    now: () => now,
    random: () => 0.5,
    sleep: (milliseconds, signal) => new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, milliseconds);
      signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(signal.reason);
      }, { once: true });
    }),
    logger,
    timeoutMs: 1_000,
    maxAttempts: 4,
    backoffBaseMs: 100,
    backoffMaxMs: 10_000,
  });
  return { repository, logger, runner };
};

describe("job runner", () => {
  it("completes a successful handler with the live lock token", async () => {
    const { repository, runner } = setup(async () => undefined);

    await runner.run(event());

    expect(repository.complete).toHaveBeenCalledWith({
      id: event().id,
      lockToken: event().lockToken,
      processedAt: now,
    });
    expect(repository.retryOrDeadLetter).not.toHaveBeenCalled();
  });

  it("schedules retryable failures with bounded exponential jitter", async () => {
    const { repository, runner } = setup(async () => {
      throw new Error("provider token must not reach logs");
    });

    await runner.run(event({ attempts: 3 }));

    expect(repository.retryOrDeadLetter).toHaveBeenCalledWith({
      id: event().id,
      lockToken: event().lockToken,
      error: "Error: Job handler failed",
      retryAt: new Date(now.getTime() + 400),
      maxAttempts: 4,
      processedAt: now,
    });
    expect(calculateRetryDelayMs(20, 1_000, 5_000, () => 1)).toBe(5_000);
    expect(calculateRetryDelayMs(1, 1_000, 5_000, () => 0)).toBe(800);
  });

  it("dead-letters unknown topics immediately without crashing", async () => {
    const { repository, logger, runner } = setup(async () => undefined);

    await runner.run(event({ topic: "unknown.topic", attempts: 1 }));

    expect(repository.retryOrDeadLetter).toHaveBeenCalledWith(expect.objectContaining({
      maxAttempts: 1,
      error: "No handler registered for topic: unknown.topic",
    }));
    expect(logger.warn).toHaveBeenCalledWith("Worker job failed", expect.objectContaining({
      eventId: event().id,
      topic: "unknown.topic",
      outcome: "dead_letter",
      errorName: PermanentJobError.name,
    }));
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("must-not-be-logged");
    expect(JSON.stringify(repository.retryOrDeadLetter.mock.calls)).not.toContain("provider token");
  });

  it("aborts timed-out handlers and retries before stale completion can acknowledge", async () => {
    vi.useFakeTimers();
    let resolveHandler!: () => void;
    let receivedSignal: AbortSignal | undefined;
    const { repository, logger, runner } = setup((_job, { signal }) => {
      receivedSignal = signal;
      return new Promise<void>((resolve) => { resolveHandler = resolve; });
    });

    const result = runner.run(event());
    await vi.advanceTimersByTimeAsync(1_000);
    await result;

    expect(receivedSignal?.aborted).toBe(true);
    expect(repository.retryOrDeadLetter).toHaveBeenCalledOnce();
    expect(repository.complete).not.toHaveBeenCalled();

    resolveHandler();
    await Promise.resolve();
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("retries an in-flight lease when shutdown aborts its handler", async () => {
    let receivedSignal: AbortSignal | undefined;
    const { repository, logger, runner } = setup((_job, { signal }) => {
      receivedSignal = signal;
      return new Promise<void>(() => undefined);
    });
    const shutdown = new AbortController();

    const result = runner.run(event({ attempts: 4 }), shutdown.signal);
    shutdown.abort(new Error("worker shutdown"));
    await result;

    expect(receivedSignal?.aborted).toBe(true);
    expect(repository.retryOrDeadLetter).toHaveBeenCalledWith(expect.objectContaining({
      id: event().id,
      lockToken: event().lockToken,
      maxAttempts: 5,
    }));
    expect(repository.complete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("Worker job failed", expect.objectContaining({
      outcome: "retry",
    }));
  });
});
