"use client";

import Link from "next/link";
import { useInViewOnce } from "@/lib/useInViewOnce";
import type { PublicPageSection } from "@/lib/api/cms";

export default function AboutSection({ section }: { section?: PublicPageSection | null }) {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.26, "0px 0px -8% 0px");

  const titleText = section?.title || "The Man Behind the Method";
  const headline = (section?.config?.headline as string[]) || ["Not Just a", "Life Coach."];
  const bodyText = section?.body || "Ramah combines 10+ years in IT engineering with deep psychological training — to build systems that actually change behavior, not just mindset.";
  const stats = (section?.config?.stats as { number: string, label: string }[]) || [
    { number: "1,500+", label: "Profiles Analyzed" },
    { number: "1st", label: "aCRL Master Trainer" },
    { number: "22+", label: "Countries" }
  ];

  return (
    <section id="acrl" ref={ref} className="w-full min-h-[100dvh] bg-white flex items-center justify-center overflow-hidden py-20">
      <div
        className={`w-full max-w-[1440px] mx-auto px-4 md:px-8 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
        }`}
      >
        <div className="flex flex-col lg:flex-row items-stretch h-full">
          {/* Left — text content */}
          <div className="flex-1 flex flex-col justify-center gap-5 md:gap-7 px-6 md:px-10 lg:px-14 py-8 md:py-10">
            <p
              className={`text-[#0F3B46] font-bold tracking-[0.2em] uppercase text-xs sm:text-sm mb-4 transition-all duration-700 ease-out ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
              }`}
            >
              {titleText}
            </p>

            <h2
              className="text-[#07313A] font-bricolage font-bold leading-[0.9] tracking-tight mb-8"
              style={{ fontSize: "clamp(3.5rem, 8vw, 6rem)" }}
            >
              <span
                className={`block transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
                }`}
                style={{ transitionDelay: "100ms" }}
              >
                {headline[0]}
              </span>
              <span
                className={`block text-[#0F3B46]/60 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
                }`}
                style={{ transitionDelay: "180ms" }}
              >
                {headline[1]}
              </span>
            </h2>

            <p
              className={`text-[#07313A] font-medium leading-relaxed max-w-xl mb-12 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
              }`}
              style={{
                fontSize: "clamp(1rem, 1.5vw, 1.25rem)",
                transitionDelay: "260ms",
              }}
            >
              {bodyText}
            </p>

            {/* CTA button */}
            <div
              className={`transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? "980ms" : "0ms" }}
            >
              <Link
                href="/about"
                className="btn-fill-hover btn-fill-light inline-flex items-center gap-4 px-6 md:px-8 py-3.5 md:py-4 rounded-full border-4 border-[#0F3B46] bg-white shadow-[0_8px_20px_rgba(15,59,70,0.15)]"
              >
                <span
                  className="text-[#0F3B46] font-bold leading-[0.8]"
                  style={{ fontSize: "clamp(1.1rem, 2.5vw, 3.1rem)" }}
                >
                  Read Full Story
                </span>
                <svg
                  width="51"
                  height="45"
                  viewBox="0 0 51 45"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 md:w-12 h-auto shrink-0"
                >
                  <path
                    d="M50.1213 24.2131C51.2929 23.0415 51.2929 21.142 50.1213 19.9705L31.0294 0.878593C29.8579 -0.29298 27.9584 -0.29298 26.7868 0.878593C25.6152 2.05017 25.6152 3.94966 26.7868 5.12123L43.7574 22.0918L26.7868 39.0624C25.6152 40.2339 25.6152 42.1334 26.7868 43.305C27.9584 44.4766 29.8579 44.4766 31.0294 43.305L50.1213 24.2131ZM0 22.0918V25.0918H48V19.0918H0V22.0918Z"
                    fill="currentColor"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Vertical divider — desktop only */}
          <div
            className={`hidden lg:block w-[3px] bg-[#0F3B46]/20 rounded-full my-8 transition-opacity duration-[900ms] ${
              inView ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: inView ? "860ms" : "0ms" }}
          />

          {/* Right — stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-6 md:gap-12 pl-0 md:pl-12 lg:pl-24 mt-8 md:mt-0">
            <StatCard
              number={stats[0]?.number}
              label={stats[0]?.label}
              inView={inView}
              index={0}
            />
            <StatCard
              number={stats[1]?.number}
              label={stats[1]?.label}
              numberSize="clamp(2rem, 4vw, 4rem)"
              inView={inView}
              index={1}
            />
            <StatCard
              number={stats[2]?.number}
              label={stats[2]?.label}
              inView={inView}
              index={2}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  number,
  label,
  numberSize = "clamp(3rem, 8vw, 8.75rem)",
  inView,
  index,
}: {
  number: string;
  label: string;
  numberSize?: string;
  inView: boolean;
  index: number;
}) {
  return (
    <div
      className={`relative rounded-[28px] md:rounded-[32px] overflow-hidden transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        inView
          ? "opacity-100 translate-x-0"
          : index % 2 === 0
          ? "opacity-0 translate-x-16"
          : "opacity-0 -translate-x-16"
      }`}
      style={{
        minHeight: "clamp(128px, 14vw, 220px)",
        transitionDelay: inView ? `${740 + index * 150}ms` : "0ms",
      }}
    >
      {/* Glassmorphism Layered background */}
      <div className="absolute inset-0 rounded-[28px] md:rounded-[32px] bg-[#0F172A]/70 backdrop-blur-xl border border-[#0F172A]/20" />
      <div className="absolute inset-0 rounded-[28px] md:rounded-[32px] bg-[#0F3B46]/80 backdrop-blur-xl border border-white/10 translate-x-2 md:translate-x-6 shadow-[0_8px_32px_rgba(15,59,70,0.2)]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-6 md:px-8 py-5 md:py-6">
        <p
          className="text-white font-bold leading-[0.8] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          style={{ fontSize: numberSize }}
        >
          {number}
        </p>
        <p
          className="text-white font-semibold leading-[0.8] mt-2 drop-shadow-md"
          style={{ fontSize: "clamp(1rem, 2.5vw, 3rem)" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
