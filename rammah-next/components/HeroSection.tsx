"use client";

type HeroSectionProps = {
  entryReady: boolean;
};

export default function HeroSection({ entryReady }: HeroSectionProps) {
  return (
    <section className="relative w-full min-h-[100dvh] bg-black overflow-hidden">

      {/* Top bar — roles left, tagline right */}
      <div
        className={`absolute top-[6.8rem] md:top-28 left-0 right-0 z-10 px-5 md:px-10 transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
        }`}
        style={{ transitionDelay: entryReady ? "260ms" : "0ms" }}
      >
        <div className="mx-auto max-w-[1440px] pt-2 md:pt-0 grid grid-cols-[auto_1fr] gap-4 items-start md:flex md:flex-row md:justify-between md:items-start">
        <div className="flex flex-col gap-1">
          {["Engineer", "Systematizer", "Trainer", "Coach"].map((w, index) => (
            <span
              key={w}
              className={`text-white font-bricolageGrotesque font-semibold tracking-widest transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
              }`}
              style={{
                fontSize: "clamp(0.92rem, 4.5vw, 2.2rem)",
                transitionDelay: entryReady ? `${520 + index * 150}ms` : "0ms",
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <p
          className={`text-white font-bricolageGrotesque font-semibold leading-tight max-w-full md:max-w-[42%] text-right md:text-right self-start transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"
          }`}
          style={{
            fontSize: "clamp(0.9rem, 3.55vw, 2rem)",
            transitionDelay: entryReady ? "1180ms" : "0ms",
          }}
        >
          I don&apos;t just coach.{" "}
          I map your psychological system, find the bugs and rewrite the code
        </p>
      </div>
      </div>

      {/* DECODE background text */}
      <div
        className={`absolute bottom-[2%] md:bottom-0 left-0 right-0 text-center font-bricolageGrotesque font-bold text-[#1A5A68] select-none leading-none z-[5] pointer-events-none transition-all duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          entryReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
        style={{
          fontSize: "clamp(4.2rem, 22vw, 18rem)",
          letterSpacing: "-0.1em",
          transitionDelay: entryReady ? "760ms" : "0ms",
        }}
      >
        D E C O D E
      </div>

      {/* Gradient over DECODE */}
      <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />

      {/* Portrait — centered, fills height */}
      <div className="absolute inset-0 flex justify-center items-end z-20 pointer-events-none">
        <img
          src="/hero-final-frame.png"
          alt="Ahmed Ramah"
          className="h-[74dvh] sm:h-[80dvh] md:h-[88dvh] lg:h-[90dvh] w-auto object-contain object-bottom"
        />
      </div>

    </section>
  );
}
