import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { errorHandlerMiddleware } from "../../middleware/error-handler.js";
import { AppError } from "../../shared/errors/app-error.js";
import { mediaRouter } from "./media.routes.js";
import { mediaService } from "./media.service.js";

vi.mock("../auth/auth.service.js", () => ({
  getAdminFromSession: vi.fn().mockResolvedValue({
    id: "22222222-3333-4444-8555-666666666666",
    email: "admin@example.com",
    role: "admin",
  }),
}));

const assetId = "11111111-2222-4333-8444-555555555555";

const app = express();
app.use(express.json());
app.use("/media-assets", mediaRouter);
app.use(errorHandlerMiddleware);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/media-assets`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

const request = (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, {
  ...init,
  headers: { "content-type": "application/json", ...init?.headers },
});

describe("CMS media routes", () => {
  it("creates an external media asset", async () => {
    vi.spyOn(mediaService, "createExternal").mockResolvedValueOnce({
      id: assetId,
      sourceType: "external",
      processingState: "ready",
    } as Awaited<ReturnType<typeof mediaService.createExternal>>);

    const response = await request("/external", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Homepage video",
        fileName: "hero.mp4",
        mimeType: "video/mp4",
        mediaKind: "video",
        publicUrl: "https://cdn.example.com/hero.mp4",
        altText: null,
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: assetId, sourceType: "external" },
    });
  });

  it("returns named usages when archive is blocked", async () => {
    vi.spyOn(mediaService, "archive").mockRejectedValueOnce(new AppError({
      code: "MEDIA_IN_USE",
      message: "Media cannot be removed while it is still in use.",
      statusCode: 409,
      meta: {
        usages: [{ ownerType: "section", ownerId: assetId, ownerLabel: "Home / Hero" }],
      },
    }));

    const response = await request(`/${assetId}`, { method: "DELETE" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MEDIA_IN_USE", meta: { usages: [{ ownerLabel: "Home / Hero" }] } },
    });
  });

  it("surfaces upload signature failures as 422", async () => {
    vi.spyOn(mediaService, "finalizeUpload").mockRejectedValueOnce(new AppError({
      code: "MEDIA_UPLOAD_INVALID",
      message: "File signature does not match the declared media type.",
      statusCode: 422,
    }));

    const response = await request("/finalize", {
      method: "POST",
      body: JSON.stringify({ assetId }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MEDIA_UPLOAD_INVALID" },
    });
  });

  it("permanently deletes an archived unused asset", async () => {
    vi.spyOn(mediaService, "permanentlyDelete").mockResolvedValueOnce(undefined);

    const response = await request(`/${assetId}/permanent`, { method: "DELETE" });

    expect(response.status).toBe(204);
    expect(mediaService.permanentlyDelete).toHaveBeenCalledWith(assetId, expect.any(Object));
  });
});
