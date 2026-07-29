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
import {
  findPublicSection,
  type PublicNavigationItem,
  type PublicPage,
} from "@/lib/api/cms";
import { getHomePageContent } from "@/lib/api/cms-content";

export default function HomeClient({
  page,
  navigation,
  siteName,
  footer,
}: {
  page: PublicPage | null;
  navigation: PublicNavigationItem[];
  siteName: string;
  footer: React.ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const content = getHomePageContent(page);

  return (
    <>
      {!isLoaded && <LoadingScreen onComplete={() => setIsLoaded(true)} />}

      <main className="bg-black min-h-[100dvh] overflow-x-clip">
        <Navbar entryReady={isLoaded} navigation={navigation} siteName={siteName} />
        <HeroSection entryReady={isLoaded} content={content.hero} />
        <StatementSection content={content.statement} />
        <AboutSection section={findPublicSection(page, "about_preview")} />
        <MethodologySection section={findPublicSection(page, "methodology")} />
        <ServicesSection content={content.services} />
        <CTASection section={findPublicSection(page, "cta")} />
        {footer}
      </main>
    </>
  );
}
