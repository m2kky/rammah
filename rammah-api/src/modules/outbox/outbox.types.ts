export const OUTBOX_STATES = [
  "queued",
  "processing",
  "completed",
  "dead_letter",
] as const;

export type OutboxState = (typeof OUTBOX_STATES)[number];
export type OutboxTopic = string;
export type OutboxPayload = Record<string, unknown>;

export const MAX_OUTBOX_ERROR_LENGTH = 2000;

export interface EnqueueOutboxEventInput {
  topic: OutboxTopic;
  aggregateType: string;
  aggregateId: string;
  payload: OutboxPayload;
  idempotencyKey: string;
  availableAt?: Date;
}

export interface ClaimOutboxEventsInput {
  limit: number;
  leaseDurationMs: number;
  now?: Date;
}

export interface CompleteOutboxEventInput {
  id: string;
  lockToken: string;
  processedAt?: Date;
}

export interface RetryOrDeadLetterOutboxEventInput {
  id: string;
  lockToken: string;
  error: string;
  retryAt: Date;
  maxAttempts: number;
  processedAt?: Date;
}
