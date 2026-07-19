"use client";

import Link from "next/link";
import { useInViewOnce } from "@/lib/useInViewOnce";
import type { PublicPageSection } from "@/lib/api/cms";

export default function CTASection({ section }: { section?: PublicPageSection | null }) {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.24, "0px 0px -6% 0px");
  const titleText = (section?.title as string) || "Meet Ahmed Ramah";
  const bodyText = (section?.body as string) || "from engineering code to decoding the human mind.";
  const ctaText = (section?.config?.ctaText as string) || "Get Free 1 to 1";
  const subscribeTitle = (section?.config?.subscribeTitle as string) || "Subscribe for Free Courses & More";

  return (
    <section id="contact" ref={ref} className="w-full bg-black">
      {/* Full-screen split CTA */}
      <div
        className="relative grid min-h-[100dvh] w-full grid-rows-[0.48fr_0.52fr] overflow-hidden transition-all duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          clipPath: inView
            ? "inset(0% 0% 0% 0% round 0px)"
            : "inset(14% 10% 14% 10% round 32px)",
          opacity: inView ? 1 : 0.24,
          transform: inView ? "translateY(0px) scale(1)" : "translateY(42px) scale(0.96)",
        }}
      >
        <div className="relative flex flex-col items-center justify-center gap-6 bg-[#0F3B46] px-6 py-14 md:gap-8 md:px-16">
          <div
            className="absolute inset-x-0 top-0 h-px origin-left bg-white/35 transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: inView ? "scaleX(1)" : "scaleX(0)",
              transitionDelay: inView ? "180ms" : "0ms",
            }}
          />
          <p
            className={`text-[#D9D9D9] text-center leading-[1.2] max-w-[1126px] transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-12 blur-sm"
            }`}
            style={{
              fontSize: "clamp(1.15rem, 2.7vw, 2.6rem)",
              transitionDelay: inView ? "360ms" : "0ms",
            }}
          >
            {titleText}
            <br />
            {bodyText}
          </p>

          <Link
            href="/booking"
            className={`btn-fill-hover btn-fill-light inline-flex items-center gap-4 px-6 md:px-8 py-3 md:py-4 rounded-full border-[5px] border-[#0F3B46] bg-white transition-all duration-[950ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-90"
            }`}
            style={{ transitionDelay: inView ? "560ms" : "0ms" }}
          >
            <span
              className="text-[#0F3B46] font-bold leading-[0.8]"
              style={{ fontSize: "clamp(1rem, 2.2vw, 2.8rem)" }}
            >
              {ctaText}
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

        <div className="flex flex-col items-center justify-center gap-5 bg-white px-6 py-14 md:gap-6 md:px-16">
          <p
            className={`text-[#07313A] font-inter text-center leading-[1.1] transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
            style={{
              fontSize: "clamp(1.3rem, 3.5vw, 3.3rem)",
              transitionDelay: inView ? "480ms" : "0ms",
            }}
          >
            {subscribeTitle.split("Courses").length > 1 
              ? <>{subscribeTitle.split("Courses")[0]}<br />Courses{subscribeTitle.split("Courses")[1]}</>
              : subscribeTitle}
          </p>

          {/* Email input row */}
          <div
            className={`flex flex-col sm:flex-row items-center gap-3 w-full max-w-[500px] transition-all duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: inView ? "690ms" : "0ms" }}
          >
            <div className="flex-1 w-full">
              <label className="text-red-600 text-sm font-semibold font-inter block mb-1">
                Email*
              </label>
              <input
                type="email"
                placeholder="your-email@domain.com"
                className="w-full rounded-full border border-[#0F3B46] px-6 py-3 text-sm text-[#07313A] font-inter outline-none focus:ring-2 focus:ring-[#0F3B46]/30"
              />
            </div>
            <button className="btn-fill-hover btn-fill-dark flex items-center gap-2 rounded-full border-2 border-white bg-[#0F3B46] text-white px-6 py-3 shrink-0">
              <span className="text-sm md:text-base font-semibold leading-[0.8]">
                submit
              </span>
              <svg
                width="26"
                height="15"
                viewBox="0 0 26 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-auto"
              >
                <path
                  d="M24.7131 8.2168C25.1117 7.83449 25.1249 7.20147 24.7426 6.80289L18.5125 0.307758C18.1302 -0.0908159 17.4972 -0.104004 17.0986 0.278302C16.7 0.660607 16.6869 1.29363 17.0692 1.69221L22.607 7.46566L16.8335 13.0035C16.4349 13.3858 16.4218 14.0188 16.8041 14.4174C17.1864 14.8159 17.8194 14.8291 18.218 14.4468L24.7131 8.2168ZM0.020874 6.99512L0 7.9949L24 8.4949L24.0209 7.49512L24.0417 6.49533L0.0417 5.99533L0.020874 6.99512Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
