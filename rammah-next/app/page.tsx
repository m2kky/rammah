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

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      {!isLoaded && <LoadingScreen onComplete={() => setIsLoaded(true)} />}

      <main className="bg-black min-h-[100dvh] overflow-x-clip">
        <Navbar entryReady={isLoaded} />
        <HeroSection entryReady={isLoaded} />
        <StatementSection />
        <MethodologySection />
        <AboutSection />
        <ServicesSection />
        <CTASection />
      </main>
    </>
  );
}
