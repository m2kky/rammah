"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import { type PublicOffering } from "@/lib/api/offerings";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const modeLabel: Record<PublicOffering["bookingMode"], string> = {
  free: "Free booking",
  paid: "Paid booking",
  quote_only: "Quote request",
};

export default function ServicesStack({ offerings }: { offerings: PublicOffering[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {

    // Marquee animations
    gsap.fromTo("[data-marquee-row-1]", 
      { xPercent: -15 },
      {
        xPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-services-marquee]",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );

    gsap.fromTo("[data-marquee-row-2]", 
      { xPercent: 0 },
      {
        xPercent: -15,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-services-marquee]",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Marquee Section */}
      <section data-services-marquee className="py-16 md:py-24 overflow-hidden relative bg-[#f1f4ee] text-[#0f3b46] flex flex-col justify-center border-t border-b border-[#0f3b46]/10">
        <div className="flex flex-col gap-4" style={{ transform: "rotate(-3deg) scale(1.1)", transformOrigin: "center" }}>
          <div className="flex w-max whitespace-nowrap text-[clamp(2rem,6vw,5rem)] font-extrabold leading-none uppercase tracking-[-0.02em]" data-marquee-row-1>
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={`r1-${i}`} className="px-6">Engineer | Systematizer | Trainer | Coach |</span>
            ))}
          </div>
          <div className="flex w-max whitespace-nowrap text-[clamp(2rem,6vw,5rem)] font-extrabold leading-none uppercase tracking-[-0.02em] text-transparent" style={{ WebkitTextStroke: "1.5px #0f3b46" }} data-marquee-row-2>
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={`r2-${i}`} className="px-6">First & Only aCRL Master Trainer in the Middle East |</span>
            ))}
          </div>
        </div>
      </section>

      {offerings.map((offering, index) => {
        const isEven = index % 2 === 0;
        const bg = isEven ? "#ffffff" : "#0F3B46";
        const text = isEven ? "#0F3B46" : "#ffffff";
        const isDark = !isEven;

        return (
          <section
            key={offering.id}
            className="sticky top-0 w-full min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden"
            style={{
              backgroundColor: bg,
              color: text,
              zIndex: index + 10,
            }}
          >
            {/* The Divider / Intro for this card */}
            <div className="absolute top-0 inset-x-0 pt-24 pb-8 md:pt-32 px-5 md:px-8 max-w-[1440px] mx-auto w-full">
              <p 
                className="font-inter text-xs md:text-sm font-semibold uppercase tracking-[0.18em] mb-4"
                style={{ opacity: 0.6 }}
              >
                {String(index + 1).padStart(2, "0")} · {offering.category?.name ?? "Program"}
              </p>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight max-w-4xl">
                {offering.subtitle ?? "A structured Rammah program."}
              </h2>
            </div>

            {/* The Content */}
            <div className="w-full max-w-[1440px] mx-auto px-5 md:px-8 mt-24 md:mt-32">
              <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] items-end">
                
                <div>
                  <h3 className="text-5xl md:text-7xl lg:text-[7.5rem] font-extrabold leading-[0.85] tracking-tight mb-8">
                    {offering.title}
                  </h3>
                  <p 
                    className="max-w-2xl font-inter text-base md:text-lg leading-relaxed"
                    style={{ opacity: 0.8 }}
                  >
                    {offering.description}
                  </p>
                </div>

                <div className="flex flex-col gap-6 lg:items-end">
                  <div className="flex flex-wrap gap-3 lg:justify-end">
                    <span 
                      className="rounded-full border px-5 py-2.5 font-inter text-sm font-semibold"
                      style={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(15,59,70,0.2)" }}
                    >
                      {offering.durationMinutes} min
                    </span>
                    <span 
                      className="rounded-full border px-5 py-2.5 font-inter text-sm font-semibold"
                      style={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(15,59,70,0.2)" }}
                    >
                      {modeLabel[offering.bookingMode]}
                    </span>
                  </div>

                  <Link
                    href={`/services/${offering.slug}`}
                    className={`inline-flex items-center justify-center rounded-full px-8 py-4 font-inter text-sm font-bold transition-all ${
                      isDark 
                        ? "bg-white text-[#0F3B46] btn-fill-hover btn-fill-light" 
                        : "bg-[#0F3B46] text-white btn-fill-hover btn-fill-dark"
                    }`}
                  >
                    Explore Program
                  </Link>
                </div>

              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
