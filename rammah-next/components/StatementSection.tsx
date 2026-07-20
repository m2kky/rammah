"use client";
import { ShapeBlue, ShapeGreen, ShapeOrange, ShapeRed } from "@/components/aCRLShapes";
import { useInViewOnce } from "@/lib/useInViewOnce";
import type { PublicPageSection } from "@/lib/api/cms";

const iconFilter = { filter: "brightness(0) invert(1)" };

export default function StatementSection({ section }: { section?: PublicPageSection | null }) {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.32, "0px 0px -10% 0px");
  const titleText = section?.title || "REWRITE YOUR MIND";
  const words = titleText.split(" ");
  const word1 = words[0] || "REWRITE";
  const word2 = words[1] || "YOUR";
  const word3 = words[2] || "MIND";

  return (
    <section
      ref={ref}
      className="w-full min-h-[20.5rem] md:min-h-[100dvh] bg-[#0F3B46] overflow-hidden flex items-start md:items-center justify-center"
    >
      <div className="w-full max-w-[1440px] mx-auto flex flex-col justify-start md:justify-center items-center px-3 md:px-8 pt-3 pb-4 md:py-14">
        <div className="flex flex-col items-center w-full">
          <p
            className={`font-bricolage font-extrabold text-white leading-[0.78] select-none transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
            } text-[7.5rem] sm:text-[9rem] md:text-[13rem] lg:text-[16rem] xl:text-[20rem]`}
          >
            <span className="inline-block" style={{ transform: "scaleX(0.68)", transformOrigin: "center" }}>
              {word1}
            </span>
          </p>

          <p
            className={`font-bricolage font-extrabold text-transparent leading-[0.75] select-none transition-all duration-[1050ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
            } text-[9rem] sm:text-[10.5rem] md:text-[14rem] lg:text-[17rem] xl:text-[21rem]`}
            style={{
              WebkitTextStroke: "clamp(1.4px, 0.18rem, 3px) #ffffff",
              transitionDelay: inView ? "150ms" : "0ms",
            }}
          >
            <span className="inline-block" style={{ transform: "scaleX(0.56)", transformOrigin: "center" }}>
              {word2}
            </span>
          </p>

          <div
            className={`flex justify-center items-center w-full overflow-hidden py-1 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
            }`}
            style={{ transitionDelay: inView ? "320ms" : "0ms" }}
          >
            <div className="flex items-center gap-4 sm:gap-5 md:gap-6">
              <ShapeGreen
                className={`h-10 sm:h-12 md:h-16 lg:h-20 xl:h-24 w-auto origin-center ${
                  inView ? "animate-[acrl-float-a_4.8s_ease-in-out_infinite]" : ""
                }`}
                style={iconFilter}
              />
              <ShapeOrange
                className={`h-10 sm:h-12 md:h-16 lg:h-20 xl:h-24 w-auto origin-center ${
                  inView ? "animate-[acrl-spin-soft_6.8s_linear_infinite]" : ""
                }`}
                style={iconFilter}
              />
              <ShapeBlue
                className={`h-10 sm:h-12 md:h-16 lg:h-20 xl:h-24 w-auto origin-center ${
                  inView ? "animate-[acrl-float-b_5.4s_ease-in-out_infinite]" : ""
                }`}
                style={iconFilter}
              />
              <ShapeRed
                className={`h-10 sm:h-12 md:h-16 lg:h-20 xl:h-24 w-auto origin-center ${
                  inView ? "animate-[acrl-tilt-soft_4.6s_ease-in-out_infinite]" : ""
                }`}
                style={iconFilter}
              />
            </div>
          </div>

          <p
            className={`font-bricolage font-extrabold text-transparent leading-[0.75] select-none transition-all duration-[1050ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
            } text-[9rem] sm:text-[10.5rem] md:text-[14rem] lg:text-[17rem] xl:text-[21rem]`}
            style={{
              WebkitTextStroke: "clamp(1.4px, 0.18rem, 3px) #ffffff",
              transitionDelay: inView ? "420ms" : "0ms",
            }}
          >
            <span className="inline-block" style={{ transform: "scaleX(0.56)", transformOrigin: "center" }}>
              {word3}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
