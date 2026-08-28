import { describe, expect, it } from "vitest";
import {
  guideSections,
  searchGuideSections,
} from "@/app/admin/(protected)/how-to-use/how-to-use-content";

const workflowIds = [
  "create-appointment-offering",
  "add-fixed-session",
  "create-one-off-program",
  "create-course-program",
  "split-weekday-availability",
  "date-overrides",
  "minimum-advance-days",
  "attendance-and-locations",
  "capacity",
  "booking-modes",
  "pricing",
  "booking-operations",
  "payment-operations",
  "quote-operations",
  "booking-form-fields",
  "email-operations",
  "create-cms-page",
  "edit-section-media",
  "media-library",
  "legal-pages",
  "blog-and-seo",
  "navigation",
  "site-settings",
  "calendar-meet",
  "preview-and-publish",
  "safe-rollback",
];

describe("admin how-to content", () => {
  it("covers every approved workflow and enabled admin destination", () => {
    const entries = guideSections.flatMap((section) => section.entries);
    const ids = new Set(entries.map((entry) => entry.id));

    expect(workflowIds.every((id) => ids.has(id))).toBe(true);
    expect([
      "offerings",
      "availability",
      "locations",
      "programs",
      "form-fields",
      "sessions",
      "bookings",
      "payments",
      "quotes",
      "emails",
      "cms",
      "integrations",
    ].every((term) => entries.some((entry) => entry.aliases.includes(term)))).toBe(true);
  });

  it("finds entries using Arabic and English aliases", () => {
    expect(searchGuideSections("سعة").flatMap((section) => section.entries).map((entry) => entry.id)).toContain("capacity");
    expect(searchGuideSections("Early bird").flatMap((section) => section.entries).map((entry) => entry.id)).toContain("pricing");
  });
});
