"use client";

import { useInViewOnce } from "@/lib/useInViewOnce";

export default function AboutSection() {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.26, "0px 0px -8% 0px");

  return (
    <section ref={ref} className="w-full min-h-[100dvh] px-4 md:px-6 pt-24 md:pt-28 pb-4 md:pb-6 flex">
      <div
        className={`w-full max-w-[1440px] mx-auto rounded-[34px] md:rounded-[40px] bg-white overflow-hidden flex-1 min-h-[calc(100dvh-7rem)] md:min-h-[calc(100dvh-8.5rem)] transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
        }`}
      >
        <div className="flex flex-col lg:flex-row items-stretch h-full">
          {/* Left — text content */}
          <div className="flex-1 flex flex-col justify-center gap-5 md:gap-7 px-6 md:px-10 lg:px-14 py-8 md:py-10 lg:py-14">
            <p
              className={`text-[#0F3B46] font-bold leading-[0.8] transition-all duration-[950ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{
                fontSize: "clamp(1.15rem, 2.8vw, 3rem)",
                transitionDelay: inView ? "220ms" : "0ms",
              }}
            >
              The Man Behind the Method
            </p>

            <p
              className="text-[#0F172A] font-bold leading-[0.85]"
              style={{ fontSize: "clamp(1.6rem, 6.4vw, 6.8rem)" }}
            >
              <span
                className={`block transition-all duration-[1050ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{ transitionDelay: inView ? "420ms" : "0ms" }}
              >
                Not Just a
              </span>
              <span
                className={`block transition-all duration-[1050ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{ transitionDelay: inView ? "610ms" : "0ms" }}
              >
                Life Coach.
              </span>
            </p>

            <p
              className={`text-black tracking-[0.06em] leading-[1.5] max-w-[608px] transition-all duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{
                fontSize: "clamp(0.875rem, 1.8vw, 1.5rem)",
                transitionDelay: inView ? "820ms" : "0ms",
              }}
            >
              Ramah combines 10+ years in IT engineering with deep psychological
              training — to build systems that actually change behavior, not just
              mindset.
            </p>

            {/* CTA button */}
            <div
              className={`transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: inView ? "980ms" : "0ms" }}
            >
              <a
                href="/about"
                className="inline-flex items-center gap-4 px-6 md:px-8 py-3.5 md:py-4 rounded-full border-4 border-[#0F3B46] bg-white hover:bg-[#0F3B46]/5 transition-colors"
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
                    fill="#0F3B46"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Vertical divider — desktop only */}
          <div
            className={`hidden lg:block w-[3px] bg-[#0F3B46] rounded-full my-8 transition-opacity duration-[900ms] ${
              inView ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: inView ? "860ms" : "0ms" }}
          />

          {/* Right — stat cards */}
          <div className="flex flex-col gap-4 md:gap-5 px-6 md:px-10 lg:px-14 py-8 md:py-10 lg:py-14 lg:w-[44%]">
            <StatCard number="1,500+" label="Profiles Analyzed" inView={inView} index={0} />
            <StatCard number="1st" label="ICRL Master Trainer" numberSize="clamp(2rem, 4vw, 4rem)" inView={inView} index={1} />
            <StatCard number="22+" label="Countries" inView={inView} index={2} />
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
      {/* Layered background */}
      <div className="absolute inset-0 rounded-[28px] md:rounded-[32px] bg-[#0F172A]" />
      <div className="absolute inset-0 rounded-[28px] md:rounded-[32px] bg-[#0F3B46] translate-x-2 md:translate-x-6" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-6 md:px-8 py-5 md:py-6">
        <p
          className="text-white font-bold leading-[0.8]"
          style={{ fontSize: numberSize }}
        >
          {number}
        </p>
        <p
          className="text-white font-semibold leading-[0.8] mt-2"
          style={{ fontSize: "clamp(1rem, 2.5vw, 3rem)" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
