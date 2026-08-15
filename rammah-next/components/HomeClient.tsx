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
  type PublicGlobalMedia,
} from "@/lib/api/cms";
import { getGlobalMedia, getHomePageContent, getHomepageMedia } from "@/lib/api/cms-content";

export default function HomeClient({
  page,
  navigation,
  siteName,
  footer,
  globalMedia,
}: {
  page: PublicPage | null;
  navigation: PublicNavigationItem[];
  siteName: string;
  footer: React.ReactNode;
  globalMedia: PublicGlobalMedia | null;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const content = getHomePageContent(page);
  const sharedMedia = getGlobalMedia(globalMedia);
  const homepageMedia = getHomepageMedia(globalMedia);

  return (
    <>
      {!isLoaded && <LoadingScreen onComplete={() => setIsLoaded(true)} video={sharedMedia.loadingVideo} poster={sharedMedia.loadingPoster} />}

      <main className="bg-black min-h-[100dvh] overflow-x-clip">
        <Navbar entryReady={isLoaded} navigation={navigation} siteName={siteName} desktopMenuVideo={sharedMedia.desktopMenuVideo} mobileMenuVideo={sharedMedia.mobileMenuVideo} />
        <HeroSection entryReady={isLoaded} content={content.hero} portrait={homepageMedia.heroPortrait} />
        <StatementSection content={content.statement} />
        <AboutSection section={findPublicSection(page, "about_preview")} />
        <MethodologySection section={findPublicSection(page, "methodology")} />
        <ServicesSection content={content.services} animation={homepageMedia.servicesAnimation} />
        <CTASection section={findPublicSection(page, "cta")} />
        {footer}
      </main>
    </>
  );
}
