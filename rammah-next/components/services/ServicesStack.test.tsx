import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicOffering } from "@/lib/api/offerings";
import ServicesStack from "./ServicesStack";

vi.mock("@gsap/react", () => ({
  useGSAP: () => undefined,
}));

vi.mock("@/lib/gsap-init", () => ({
  gsap: {
    registerPlugin: vi.fn(),
  },
  ScrollTrigger: {},
}));

const offering: PublicOffering = {
  id: "offering-1",
  slug: "one-to-one-coaching",
  title: "1:1 Coaching",
  subtitle: "Decode your psychological code.",
  description: "A structured coaching program.",
  category: {
    id: "category-1",
    name: "Program",
    slug: "program",
  },
  offeringType: "coaching",
  attendanceMode: "online",
  bookingMode: "paid",
  schedulingMode: "appointment",
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  capacity: 1,
  requiresPayment: true,
  quoteOnly: false,
  colors: {
    background: "#ffffff",
    text: "#0f3b46",
  },
};

describe("ServicesStack mobile scrolling", () => {
  it("uses normal document flow on mobile and sticky cards from md upward", () => {
    render(
      <ServicesStack
        offerings={[offering]}
        marquee={{ row1: "Programs", row2: "Coaching" }}
        listing={{ title: "", body: "" }}
      />,
    );

    const card = screen.getByRole("heading", { name: "1:1 Coaching" }).closest("section");

    expect(card).toHaveClass("relative", "md:sticky", "md:top-0");
    expect(card).not.toHaveClass("sticky", "top-0");
  });
});
