import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";
import type {
  CompleteOutboxEventInput,
  RetryOrDeadLetterOutboxEventInput,
} from "../modules/outbox/outbox.types.js";
import { PermanentJobError, type HandlerRegistry } from "./handler-registry.js";

export interface WorkerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

interface JobRepository {
  complete(input: CompleteOutboxEventInput): Promise<OutboxEvent | null>;
  retryOrDeadLetter(input: RetryOrDeadLetterOutboxEventInput): Promise<OutboxEvent | null>;
}

interface JobRunnerDependencies {
  repository: JobRepository;
  handlers: HandlerRegistry;
  now: () => Date;
  random: () => number;
  sleep: Sleep;
  logger: WorkerLogger;
  timeoutMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

class JobTimeoutError extends Error {
  constructor() {
    super("Job handler timed out");
    this.name = "JobTimeoutError";
  }
}

class JobAbortedError extends Error {
  constructor() {
    super("Job handler aborted during worker shutdown");
    this.name = "JobAbortedError";
  }
}

const errorFrom = (error: unknown): Error =>
  error instanceof Error ? error : new Error("Non-error job failure");

const safeStoredError = (error: Error): string =>
  error instanceof PermanentJobError || error instanceof JobTimeoutError || error instanceof JobAbortedError
    ? error.message
    : `${error.constructor.name}: Job handler failed`;

export const calculateRetryDelayMs = (
  attempt: number,
  baseMs: number,
  maximumMs: number,
  random: () => number,
): number => {
  const exponent = Math.max(0, attempt - 1);
  const exponential = Math.min(maximumMs, baseMs * (2 ** exponent));
  const boundedRandom = Math.min(1, Math.max(0, random()));
  return Math.min(maximumMs, Math.round(exponential * (0.8 + (boundedRandom * 0.4))));
};

const executeHandler = async (
  event: OutboxEvent,
  dependencies: JobRunnerDependencies,
  shutdownSignal?: AbortSignal,
): Promise<void> => {
  const handlerController = new AbortController();
  const timeoutController = new AbortController();
  const handler = dependencies.handlers.get(event.topic);
  let rejectForShutdown: ((error: JobAbortedError) => void) | undefined;
  const shutdownPromise = new Promise<never>((_resolve, reject) => {
    rejectForShutdown = reject;
  });
  const onShutdown = () => {
    const error = new JobAbortedError();
    handlerController.abort(error);
    rejectForShutdown?.(error);
  };

  if (shutdownSignal?.aborted) {
    onShutdown();
  } else {
    shutdownSignal?.addEventListener("abort", onShutdown, { once: true });
  }

  const timeoutPromise = dependencies.sleep(dependencies.timeoutMs, timeoutController.signal)
    .then(() => {
      const error = new JobTimeoutError();
      handlerController.abort(error);
      throw error;
    });
  const handlerPromise = Promise.resolve().then(() => handler(event, { signal: handlerController.signal }));

  try {
    await Promise.race([handlerPromise, timeoutPromise, shutdownPromise]);
  } finally {
    timeoutController.abort(new Error("handler settled"));
    shutdownSignal?.removeEventListener("abort", onShutdown);
  }
};

export const createJobRunner = (dependencies: JobRunnerDependencies) => ({
  async run(event: OutboxEvent, shutdownSignal?: AbortSignal): Promise<void> {
    if (!event.lockToken) {
      dependencies.logger.warn("Worker skipped unfenced job", {
        eventId: event.id,
        topic: event.topic,
      });
      return;
    }

    try {
      await executeHandler(event, dependencies, shutdownSignal);
      const completed = await dependencies.repository.complete({
        id: event.id,
        lockToken: event.lockToken,
        processedAt: dependencies.now(),
      });
      dependencies.logger.info(completed ? "Worker job completed" : "Worker job lease lost", {
        eventId: event.id,
        topic: event.topic,
        attempt: event.attempts,
      });
    } catch (caught) {
      const error = errorFrom(caught);
      const permanent = error instanceof PermanentJobError;
      const shutdownAbort = error instanceof JobAbortedError;
      const maxAttempts = permanent
        ? event.attempts
        : shutdownAbort
          ? Math.max(dependencies.maxAttempts, event.attempts + 1)
          : dependencies.maxAttempts;
      const retryDelayMs = calculateRetryDelayMs(
        event.attempts,
        dependencies.backoffBaseMs,
        dependencies.backoffMaxMs,
        dependencies.random,
      );
      const processedAt = dependencies.now();
      const transitioned = await dependencies.repository.retryOrDeadLetter({
        id: event.id,
        lockToken: event.lockToken,
        error: safeStoredError(error),
        retryAt: new Date(processedAt.getTime() + retryDelayMs),
        maxAttempts,
        processedAt,
      });
      const outcome = permanent || event.attempts >= maxAttempts
        ? "dead_letter"
        : "retry";
      dependencies.logger.warn(transitioned ? "Worker job failed" : "Worker job lease lost", {
        eventId: event.id,
        topic: event.topic,
        attempt: event.attempts,
        outcome,
        errorName: error.constructor.name,
      });
    }
  },
});
