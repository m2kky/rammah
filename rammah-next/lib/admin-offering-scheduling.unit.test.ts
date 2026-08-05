import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync(
  new URL("../components/admin/AdminOfferingEditor.tsx", import.meta.url),
  "utf8",
);
const adminApiSource = readFileSync(new URL("./api/admin.ts", import.meta.url), "utf8");
const publicApiSource = readFileSync(new URL("./api/offerings.ts", import.meta.url), "utf8");

describe("admin Offering scheduling controls", () => {
  it("exposes the persisted scheduling contract in API types", () => {
    expect(adminApiSource).toContain(
      'schedulingMode: "appointment" | "scheduled_program";',
    );
    expect(adminApiSource).toContain("durationMinutes: number | null;");
    expect(adminApiSource).toContain("bufferBeforeMinutes: number;");
    expect(adminApiSource).toContain("bufferAfterMinutes: number;");
    expect(publicApiSource).toContain("durationMinutes: number | null;");
  });

  it("shows separate scheduling and commercial booking choices", () => {
    expect(editorSource).toContain("Scheduling type");
    expect(editorSource).toContain("Appointment slots");
    expect(editorSource).toContain("Scheduled program");
    expect(editorSource).toContain("Payment behavior");
  });

  it("submits duration and buffers according to the selected scheduling mode", () => {
    expect(editorSource).toContain("schedulingMode: state.schedulingMode");
    expect(editorSource).toContain('state.schedulingMode === "appointment"');
    expect(editorSource).toContain("bufferBeforeMinutes: toNumber");
    expect(editorSource).toContain("bufferAfterMinutes: toNumber");
  });
});
