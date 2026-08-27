import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeClient from "./HomeClient";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/HeroSection", () => ({ default: () => null }));
vi.mock("@/components/StatementSection", () => ({ default: () => null }));
vi.mock("@/components/MethodologySection", () => ({ default: () => null }));
vi.mock("@/components/AboutSection", () => ({ default: () => null }));
vi.mock("@/components/CTASection", () => ({ default: () => null }));
vi.mock("@/components/ServicesSection", () => ({ default: () => null }));
vi.mock("@/components/LoadingScreen", () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>Intro</button>
  ),
}));
vi.mock("@/lib/api/cms-content", () => {
  const media = {
    id: "media",
    mediaKind: "image",
    mimeType: "image/webp",
    publicUrl: "/media.webp",
    altText: "",
    decorative: true,
    width: 300,
    height: 300,
    metadata: {},
  };

  return {
    getGlobalMedia: () => ({
      loadingVideo: media,
      loadingPoster: media,
      desktopMenuVideo: media,
      mobileMenuVideo: media,
    }),
    getHomepageMedia: () => ({ heroPortrait: media, servicesAnimation: media }),
    getHomePageContent: () => ({ hero: {}, statement: {}, services: {} }),
  };
});

const renderHome = () => render(
  <HomeClient
    page={null}
    navigation={[]}
    siteName="Ahmed Rammah"
    footer={null}
    globalMedia={null}
  />,
);

describe("HomeClient intro session", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("plays on the first visit and skips a same-tab remount", () => {
    const first = renderHome();
    expect(screen.getByRole("button", { name: "Intro" })).toBeVisible();

    first.unmount();
    renderHome();
    expect(screen.queryByRole("button", { name: "Intro" })).not.toBeInTheDocument();
  });

  it("plays again for a fresh tab session", () => {
    sessionStorage.setItem("rammah:intro-played", "1");
    sessionStorage.clear();

    renderHome();
    expect(screen.getByRole("button", { name: "Intro" })).toBeVisible();
  });

  it("plays when session storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    renderHome();
    expect(screen.getByRole("button", { name: "Intro" })).toBeVisible();
  });
});
