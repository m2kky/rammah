import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";
import type { ClaimOutboxEventsInput } from "../modules/outbox/outbox.types.js";
import type { Sleep, WorkerLogger } from "./runner.js";

interface WorkerRuntimeDependencies {
  claim(input: ClaimOutboxEventsInput): Promise<OutboxEvent[]>;
  run(event: OutboxEvent, shutdownSignal: AbortSignal): Promise<void>;
  runScheduledJobs(now: Date): Promise<void>;
  now: () => Date;
  sleep: Sleep;
  logger: WorkerLogger;
  batchSize: number;
  concurrency: number;
  leaseDurationMs: number;
  pollIntervalMs: number;
  drainTimeoutMs: number;
}

export const createWorkerRuntime = (dependencies: WorkerRuntimeDependencies) => {
  const handlerAbort = new AbortController();
  const pollAbort = new AbortController();
  const inFlight = new Set<Promise<void>>();
  let accepting = true;
  let loopPromise: Promise<void> | undefined;
  let stopPromise: Promise<void> | undefined;
  let wakeShutdown!: () => void;
  const shutdownWake = new Promise<void>((resolve) => { wakeShutdown = resolve; });

  const launch = (event: OutboxEvent): void => {
    const task = dependencies.run(event, handlerAbort.signal)
      .catch((error: unknown) => {
        dependencies.logger.error("Worker job runner failed unexpectedly", {
          eventId: event.id,
          topic: event.topic,
          errorName: error instanceof Error ? error.constructor.name : "UnknownError",
        });
      })
      .finally(() => { inFlight.delete(task); });
    inFlight.add(task);
  };

  const loop = async (): Promise<void> => {
    while (accepting) {
      const capacity = dependencies.concurrency - inFlight.size;
      if (capacity <= 0) {
        await Promise.race([...inFlight, shutdownWake]);
        continue;
      }

      const currentTime = dependencies.now();
      try {
        await dependencies.runScheduledJobs(currentTime);
        if (!accepting) break;
        const events = await dependencies.claim({
          limit: Math.min(dependencies.batchSize, capacity),
          leaseDurationMs: dependencies.leaseDurationMs,
          now: currentTime,
        });
        events.forEach(launch);
        if (events.length === 0) {
          await Promise.race([
            dependencies.sleep(dependencies.pollIntervalMs, pollAbort.signal).catch(() => undefined),
            shutdownWake,
          ]);
        }
      } catch (error) {
        if (!accepting) break;
        dependencies.logger.error("Worker poll failed", {
          errorName: error instanceof Error ? error.constructor.name : "UnknownError",
        });
        await Promise.race([
          dependencies.sleep(dependencies.pollIntervalMs, pollAbort.signal).catch(() => undefined),
          shutdownWake,
        ]);
      }
    }
  };

  return {
    start(): Promise<void> {
      loopPromise ??= loop();
      return loopPromise;
    },
    stop(): Promise<void> {
      stopPromise ??= Promise.resolve().then(async () => {
        accepting = false;
        pollAbort.abort(new Error("worker shutdown"));
        wakeShutdown();
        const settle = (async () => {
          await loopPromise;
          await Promise.allSettled([...inFlight]);
        })();
        const forcedSettlementMs = Math.max(1, Math.floor(dependencies.drainTimeoutMs / 5));
        const gracefulDrainMs = Math.max(0, dependencies.drainTimeoutMs - forcedSettlementMs);
        const deadline = new AbortController();
        let drained = false;
        try {
          await Promise.race([
            settle.then(() => { drained = true; }),
            dependencies.sleep(gracefulDrainMs, deadline.signal),
          ]);
        } finally {
          deadline.abort(new Error("worker drain settled"));
        }
        if (!drained) {
          handlerAbort.abort(new Error("worker drain deadline exceeded"));
          const forcedDeadline = new AbortController();
          try {
            await Promise.race([
              settle,
              dependencies.sleep(forcedSettlementMs, forcedDeadline.signal),
            ]);
          } finally {
            forcedDeadline.abort(new Error("worker abort settlement finished"));
          }
        }
      });
      return stopPromise;
    },
  };
};
