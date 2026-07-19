"use client";

import type { PublicPageSection } from "@/lib/api/cms";

type HeroSectionProps = {
  entryReady: boolean;
  section?: PublicPageSection | null;
};

export default function HeroSection({ entryReady, section }: HeroSectionProps) {
  const roles = (section?.config?.roles as string[]) || ["Engineer", "Systematizer", "Trainer", "Coach"];
  const bodyText = section?.body || "I don't just coach. I map your psychological system, find the bugs and rewrite the code";
  return (
    <section className="relative w-full min-h-[100dvh] bg-[#0F3B46] overflow-hidden">
      {/* White background with blurred elliptical top */}
      <div className={`absolute inset-x-0 top-[48%] sm:top-[46%] md:top-[43%] bottom-0 bg-white transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        entryReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1/4"
      }`} />
      <div className={`absolute left-1/2 top-[28%] sm:top-[26%] md:top-[20%] w-[170%] sm:w-[150%] md:w-[120%] h-[42%] md:h-[52%] bg-white rounded-[50%] blur-[30px] md:blur-[60px] transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        entryReady ? "opacity-100 -translate-x-1/2 translate-y-0" : "opacity-0 -translate-x-1/2 translate-y-1/2"
      }`} />

      {/* Top bar — roles left, tagline right */}
      <div
        className={`absolute top-24 md:top-28 left-0 right-0 z-20 px-4 md:px-10 mix-blend-difference transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
        }`}
        style={{ transitionDelay: entryReady ? "260ms" : "0ms" }}
      >
        <div className="mx-auto max-w-[1440px] pt-1 md:pt-0 grid grid-cols-[auto_1fr] gap-4 items-start md:flex md:flex-row md:justify-between md:items-start">
        <div className="flex flex-col gap-1">
          {roles.map((w, index) => (
            <span
              key={w}
              className={`text-white font-bricolage font-bold leading-[0.92] text-[1.35rem] sm:text-[1.42rem] md:text-[1.85rem] lg:text-[1.85rem] transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
              }`}
              style={{
                transitionDelay: entryReady ? `${520 + index * 150}ms` : "0ms",
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <p
          className={`justify-self-end text-white font-bricolage font-bold leading-[0.98] text-[1.08rem] sm:text-[1.12rem] md:text-[1.55rem] lg:text-[1.8rem] max-w-[12.75rem] sm:max-w-[14rem] md:max-w-[42%] text-right self-start transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"
          }`}
          style={{
            transitionDelay: entryReady ? "1180ms" : "0ms",
            textShadow: "0 2px 14px rgba(0, 0, 0, 0.24)",
          }}
        >
          {bodyText}
        </p>
      </div>
      </div>

      {/* DECODE background text */}
      <div
        className={`absolute -bottom-4 sm:-bottom-5 md:bottom-0 left-0 right-0 text-center font-bricolage font-extrabold text-[#0F3B46] select-none leading-none text-[7.15rem] sm:text-[8.5rem] md:text-[14rem] lg:text-[19rem] xl:text-[21rem] 2xl:text-[24rem] z-[5] pointer-events-none transition-all duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          entryReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
        style={{
          letterSpacing: "0",
          transitionDelay: entryReady ? "760ms" : "0ms",
        }}
      >
        DECODE
      </div>

      {/* Portrait — centered, fills height */}
      <div className="absolute inset-0 flex justify-center items-end z-10 pointer-events-none">
        <img
          src="/hero-final-frame.png"
          alt="Ahmed Ramah"
          className={`h-[72dvh] sm:h-[74dvh] md:h-[90dvh] lg:h-[90dvh] w-auto object-contain object-bottom transition-all duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)] origin-bottom ${
            entryReady ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-12"
          }`}
          style={{ transitionDelay: entryReady ? "150ms" : "0ms" }}
        />
      </div>

    </section>
  );
}
