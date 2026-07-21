import { describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";
import { createWorkerRuntime } from "./runtime.js";

const makeEvent = (index: number): OutboxEvent => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  topic: "test.topic",
  aggregateType: "test",
  aggregateId: String(index),
  payload: {},
  idempotencyKey: `test:${index}`,
  state: "processing",
  attempts: 1,
  availableAt: new Date(0),
  lockedAt: new Date(0),
  lockToken: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  processedAt: null,
  lastError: null,
  createdAt: new Date(0),
});

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

describe("worker runtime", () => {
  it("bounds claims and processing by available concurrency", async () => {
    const queue = [makeEvent(1), makeEvent(2), makeEvent(3)];
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];
    const claim = vi.fn(async ({ limit }: { limit: number }) => queue.splice(0, limit));
    const run = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
    });
    const runtime = createWorkerRuntime({
      claim,
      run,
      runScheduledJobs: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(0),
      sleep: () => new Promise<void>(() => undefined),
      logger,
      batchSize: 10,
      concurrency: 2,
      leaseDurationMs: 5_000,
      pollIntervalMs: 1_000,
      drainTimeoutMs: 50,
    });

    const running = runtime.start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(claim).toHaveBeenCalledWith({ limit: 2, leaseDurationMs: 5_000, now: new Date(0) });
    expect(maximumActive).toBe(2);

    releases.shift()?.();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    expect(maximumActive).toBe(2);
    releases.splice(0).forEach((release) => release());
    await runtime.stop();
    await running;
  });

  it("waits one poll interval after an empty claim", async () => {
    let runtime!: ReturnType<typeof createWorkerRuntime>;
    const sleep = vi.fn(async (milliseconds: number) => {
      if (milliseconds === 750) void runtime.stop();
    });
    runtime = createWorkerRuntime({
      claim: vi.fn().mockResolvedValue([]),
      run: vi.fn(),
      runScheduledJobs: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(0),
      sleep,
      logger,
      batchSize: 10,
      concurrency: 2,
      leaseDurationMs: 5_000,
      pollIntervalMs: 750,
      drainTimeoutMs: 50,
    });

    await runtime.start();

    expect(sleep).toHaveBeenCalledWith(750, expect.any(AbortSignal));
  });

  it("settles rows claimed while shutdown is beginning", async () => {
    let releaseClaim!: (events: OutboxEvent[]) => void;
    const claim = vi.fn(() => new Promise<OutboxEvent[]>((resolve) => { releaseClaim = resolve; }));
    const run = vi.fn(async (_event: OutboxEvent, signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
    });
    const runtime = createWorkerRuntime({
      claim,
      run,
      runScheduledJobs: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(0),
      sleep: vi.fn().mockResolvedValue(undefined),
      logger,
      batchSize: 1,
      concurrency: 1,
      leaseDurationMs: 5_000,
      pollIntervalMs: 1_000,
      drainTimeoutMs: 25,
    });

    const running = runtime.start();
    await vi.waitFor(() => expect(claim).toHaveBeenCalledOnce());
    const stopping = runtime.stop();
    releaseClaim([makeEvent(1)]);
    await stopping;
    await running;

    expect(run).toHaveBeenCalledOnce();
  });

  it("stops new claims, aborts work, and bounds draining", async () => {
    let handlerSignal: AbortSignal | undefined;
    let releaseDeadline!: () => void;
    const claim = vi.fn()
      .mockResolvedValueOnce([makeEvent(1)])
      .mockResolvedValue([]);
    const run = vi.fn((_event: OutboxEvent, signal: AbortSignal) => {
      handlerSignal = signal;
      return new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const sleep = vi.fn(async (milliseconds: number) => {
      if (milliseconds === 20) {
        return new Promise<void>((resolve) => { releaseDeadline = resolve; });
      }
      return new Promise<void>(() => undefined);
    });
    const runtime = createWorkerRuntime({
      claim,
      run,
      runScheduledJobs: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(0),
      sleep,
      logger,
      batchSize: 1,
      concurrency: 1,
      leaseDurationMs: 5_000,
      pollIntervalMs: 1_000,
      drainTimeoutMs: 25,
    });

    const running = runtime.start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    const stopping = runtime.stop();
    await Promise.resolve();
    expect(handlerSignal?.aborted).toBe(false);
    releaseDeadline();
    await stopping;
    await running;

    expect(handlerSignal?.aborted).toBe(true);
    expect(claim).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(20, expect.any(AbortSignal));
    expect(sleep).toHaveBeenCalledWith(5, expect.any(AbortSignal));
  });

  it("lets in-flight work finish during the graceful drain period", async () => {
    let releaseHandler!: () => void;
    let handlerSignal: AbortSignal | undefined;
    const run = vi.fn((_event: OutboxEvent, signal: AbortSignal) => {
      handlerSignal = signal;
      return new Promise<void>((resolve) => { releaseHandler = resolve; });
    });
    const runtime = createWorkerRuntime({
      claim: vi.fn()
        .mockResolvedValueOnce([makeEvent(1)])
        .mockResolvedValue([]),
      run,
      runScheduledJobs: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(0),
      sleep: vi.fn(() => new Promise<void>(() => undefined)),
      logger,
      batchSize: 1,
      concurrency: 1,
      leaseDurationMs: 5_000,
      pollIntervalMs: 1_000,
      drainTimeoutMs: 25,
    });

    const running = runtime.start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    const stopping = runtime.stop();
    await Promise.resolve();
    expect(handlerSignal?.aborted).toBe(false);
    releaseHandler();
    await stopping;
    await running;

    expect(handlerSignal?.aborted).toBe(false);
  });

  it("cancels the drain deadline timer after a fast shutdown", async () => {
    let drainSignal: AbortSignal | undefined;
    const sleep = vi.fn((milliseconds: number, signal?: AbortSignal) => {
      if (milliseconds === 20) {
        drainSignal = signal;
        return Promise.resolve();
      }
      return new Promise<void>(() => undefined);
    });
    const runtime = createWorkerRuntime({
      claim: vi.fn().mockResolvedValue([]),
      run: vi.fn(),
      runScheduledJobs: vi.fn().mockResolvedValue(undefined),
      now: () => new Date(0),
      sleep,
      logger,
      batchSize: 1,
      concurrency: 1,
      leaseDurationMs: 5_000,
      pollIntervalMs: 1_000,
      drainTimeoutMs: 25,
    });

    const running = runtime.start();
    await vi.waitFor(() => expect(sleep).toHaveBeenCalledWith(1_000, expect.any(AbortSignal)));
    await runtime.stop();
    await running;

    expect(drainSignal?.aborted).toBe(true);
  });
});
