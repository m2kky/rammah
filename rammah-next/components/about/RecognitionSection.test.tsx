import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicPageSection } from "@/lib/api/cms";
import { RecognitionSection } from "./RecognitionSection";

const section: PublicPageSection = {
  id: "recognition-id",
  sectionType: "recognition",
  title: "(04) Official recognition",
  body: "Officially listed by aCRL.",
  config: {
    name: "Ahmed Sherif Rammah",
    roles: "Supervisor · Master Trainer",
    sourceLabel: "acrl-academy.eu",
    profileBadge: "Official profile",
    cta: { label: "View official profile", url: "https://example.test/ahmed" },
  },
  media: {},
  sortOrder: 60,
};

describe("RecognitionSection", () => {
  it("renders factual copy and a safe new-tab CTA", () => {
    render(<RecognitionSection section={section} />);

    expect(screen.getByRole("heading", { name: "Ahmed Sherif Rammah" })).toBeVisible();
    expect(screen.getByRole("link", { name: /View official profile/ })).toHaveAttribute(
      "href",
      "https://example.test/ahmed",
    );
    expect(screen.getByRole("link", { name: /View official profile/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: /View official profile/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("keeps the text and CTA usable when the portrait fails", () => {
    render(<RecognitionSection section={section} />);
    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ahmed Sherif Rammah" })).toBeVisible();
    expect(screen.getByRole("link", { name: /View official profile/ })).toBeVisible();
  });
});
