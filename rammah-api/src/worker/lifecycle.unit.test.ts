import { describe, expect, it, vi } from "vitest";
import { createWorkerLifecycle } from "./lifecycle.js";

describe("worker lifecycle", () => {
  it("handles repeated signals idempotently and closes the database after drain", async () => {
    const handlers = new Map<string, () => void>();
    const order: string[] = [];
    const runtime = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => { order.push("stop"); }),
    };
    const lifecycle = createWorkerLifecycle({
      runtime,
      closeDatabase: vi.fn(async () => { order.push("close"); }),
      signals: {
        on: (signal, handler) => { handlers.set(signal, handler); },
        off: (signal, handler) => {
          if (handlers.get(signal) === handler) handlers.delete(signal);
        },
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    });

    const completion = lifecycle.start();
    handlers.get("SIGTERM")?.();
    expect(handlers.get("SIGTERM")).toBeDefined();
    handlers.get("SIGTERM")?.();
    await lifecycle.shutdown("test");
    await completion;

    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(order).toEqual(["stop", "close"]);
  });

  it("still closes the database if runtime shutdown fails", async () => {
    const closeDatabase = vi.fn().mockResolvedValue(undefined);
    const lifecycle = createWorkerLifecycle({
      runtime: {
        start: vi.fn(() => new Promise<void>(() => undefined)),
        stop: vi.fn().mockRejectedValue(new Error("stop failed")),
      },
      closeDatabase,
      signals: { on: vi.fn(), off: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    });

    await expect(lifecycle.shutdown("test")).rejects.toThrow("stop failed");

    expect(closeDatabase).toHaveBeenCalledOnce();
  });
});
