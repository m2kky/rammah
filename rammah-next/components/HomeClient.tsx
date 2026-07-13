"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StatementSection from "@/components/StatementSection";
import MethodologySection from "@/components/MethodologySection";
import AboutSection from "@/components/AboutSection";
import CTASection from "@/components/CTASection";
import ServicesSection from "@/components/ServicesSection";
import LoadingScreen from "@/components/LoadingScreen";
import { findPublicSection, type PublicPage } from "@/lib/api/cms";

export default function HomeClient({ page, footer }: { page: PublicPage | null; footer: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      {!isLoaded && <LoadingScreen onComplete={() => setIsLoaded(true)} />}

      <main className="bg-black min-h-[100dvh] overflow-x-clip">
        <Navbar entryReady={isLoaded} />
        <HeroSection entryReady={isLoaded} section={findPublicSection(page, "hero")} />
        <StatementSection section={findPublicSection(page, "statement")} />
        <AboutSection section={findPublicSection(page, "about_preview")} />
        <MethodologySection section={findPublicSection(page, "methodology")} />
        <ServicesSection />
        <CTASection section={findPublicSection(page, "cta")} />
        {footer}
      </main>
    </>
  );
}
