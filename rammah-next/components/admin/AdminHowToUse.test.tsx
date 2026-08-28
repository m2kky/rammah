import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  guideSections,
  searchGuideSections,
} from "@/app/admin/(protected)/how-to-use/how-to-use-content";
import HowToUsePage from "@/app/admin/(protected)/how-to-use/page";
import { adminNavItems } from "./AdminShell";

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

describe("admin how-to page", () => {
  it("is linked immediately after Overview in the admin navigation", () => {
    expect(adminNavItems.slice(0, 2)).toEqual([
      { label: "Overview", href: "/admin" },
      { label: "How to use", href: "/admin/how-to-use" },
    ]);
  });

  it("filters the Arabic guide and resets an empty result", () => {
    render(<HowToUsePage />);

    expect(screen.getByRole("heading", { name: "كيف تستخدم الداشبورد؟" })).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "ابحث في الدليل" });
    fireEvent.change(search, { target: { value: "Early bird" } });
    expect(screen.getByText("الأسعار وPrice groups وEarly bird")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "لا توجد نتيجة بهذا الاسم" } });
    expect(screen.getByRole("status")).toHaveTextContent("لم نجد شرحًا مطابقًا");

    fireEvent.click(screen.getByRole("button", { name: "مسح البحث" }));
    expect(screen.getByText("إضافة Session ثابتة")).toBeInTheDocument();
  });
});
