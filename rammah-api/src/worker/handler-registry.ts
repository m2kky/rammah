import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";

export interface JobHandlerContext {
  signal: AbortSignal;
}

export type JobHandler = (event: OutboxEvent, context: JobHandlerContext) => Promise<void>;

export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

export interface HandlerRegistry {
  get(topic: string): JobHandler;
}

export const createHandlerRegistry = (
  handlers: Readonly<Record<string, JobHandler>>,
): HandlerRegistry => ({
  get(topic) {
    const handler = handlers[topic];
    if (!handler) {
      throw new PermanentJobError(`No handler registered for topic: ${topic}`);
    }
    return handler;
  },
});
