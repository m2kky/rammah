import type { WorkerLogger } from "./runner.js";

type WorkerSignal = "SIGTERM" | "SIGINT";

interface SignalSource {
  on(signal: WorkerSignal, handler: () => void): unknown;
  off(signal: WorkerSignal, handler: () => void): unknown;
}

interface Runtime {
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface WorkerLifecycleDependencies {
  runtime: Runtime;
  closeDatabase(): Promise<void>;
  signals: SignalSource;
  logger: WorkerLogger;
}

export const createWorkerLifecycle = (dependencies: WorkerLifecycleDependencies) => {
  let shutdownPromise: Promise<void> | undefined;
  const onSigterm = () => { void shutdown("SIGTERM"); };
  const onSigint = () => { void shutdown("SIGINT"); };

  const removeSignalHandlers = () => {
    dependencies.signals.off("SIGTERM", onSigterm);
    dependencies.signals.off("SIGINT", onSigint);
  };

  const shutdown = (reason: string): Promise<void> => {
    shutdownPromise ??= (async () => {
      dependencies.logger.info("Worker shutdown started", { reason });
      try {
        try {
          await dependencies.runtime.stop();
        } finally {
          await dependencies.closeDatabase();
        }
      } finally {
        removeSignalHandlers();
      }
      dependencies.logger.info("Worker shutdown completed", { reason });
    })();
    return shutdownPromise;
  };

  return {
    shutdown,
    start(): Promise<void> {
      dependencies.signals.on("SIGTERM", onSigterm);
      dependencies.signals.on("SIGINT", onSigint);
      return dependencies.runtime.start().then(() => shutdown("runtime completed"));
    },
  };
};
