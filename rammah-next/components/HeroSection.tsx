"use client";

import type { getHomePageContent } from "@/lib/api/cms-content";
import type { CmsMedia } from "@/lib/api/cms";

type HeroSectionProps = {
  entryReady: boolean;
  content: ReturnType<typeof getHomePageContent>["hero"];
  portrait: CmsMedia;
};

export default function HeroSection({ entryReady, content, portrait }: HeroSectionProps) {
  const { roles, body: bodyText, displayWord } = content;
  return (
    <section className="relative w-full min-h-[100dvh] bg-black overflow-hidden">
      <div
        className={`absolute inset-0 bg-[#0F3B46] transition-opacity duration-700 ${
          entryReady ? "opacity-100" : "opacity-0"
        }`}
      />

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
        {displayWord}
      </div>

      {/* Portrait — centered, fills height */}
      <div className="absolute inset-0 flex justify-center items-end z-10 pointer-events-none">
        {/* Native image supports both seeded local files and arbitrary CMS/R2 origins. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={portrait.publicUrl}
          alt={portrait.decorative ? "" : portrait.altText || content.section?.title || "Ahmed Rammah"}
          width={portrait.width ?? 720}
          height={portrait.height ?? 1280}
          className="h-[86dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"
        />
      </div>

    </section>
  );
}
