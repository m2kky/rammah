import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";
import { PermanentJobError } from "./handler-registry.js";

const mocks = vi.hoisted(() => ({ processAnimationBundle: vi.fn() }));

vi.mock("../modules/cms/animation-bundle.service.js", () => ({
  processAnimationBundle: mocks.processAnimationBundle,
}));

import { productHandlers } from "./product-handlers.js";

const assetId = "00000000-0000-4000-8000-000000000004";
const event = (payload: Record<string, unknown>): OutboxEvent => ({
  id: "00000000-0000-4000-8000-000000000001",
  topic: "cms.media.animation_bundle.process",
  aggregateType: "media_asset",
  aggregateId: assetId,
  payload,
  idempotencyKey: `cms.media.animation_bundle.process:${assetId}`,
  state: "processing",
  attempts: 1,
  availableAt: new Date(),
  lockedAt: new Date(),
  lockToken: "00000000-0000-4000-8000-000000000003",
  processedAt: null,
  lastError: null,
  createdAt: new Date(),
});

describe("CMS worker handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("processes animation bundles with the worker abort signal", async () => {
    const signal = new AbortController().signal;

    await productHandlers["cms.media.animation_bundle.process"]!(event({ assetId }), { signal });

    expect(mocks.processAnimationBundle).toHaveBeenCalledWith(assetId, signal);
  });

  it("rejects malformed animation payloads permanently", async () => {
    await expect(productHandlers["cms.media.animation_bundle.process"]!(
      event({}),
      { signal: new AbortController().signal },
    )).rejects.toBeInstanceOf(PermanentJobError);
  });
});
