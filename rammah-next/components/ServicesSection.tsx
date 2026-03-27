"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import Link from "next/link";

/* ─── config ─── */
const TOTAL_FRAMES = 96;    // 4s clip at 24fps
const FRAME_VERSION = "v4s_3";
const FRAME_PATH   = (n: number) =>
  `/frames/frame${String(n).padStart(4, "0")}.webp?v=${FRAME_VERSION}`;

/* ─── service data ─── */
const services = [
  {
    title: "1:1 Coaching",
    subtitle: "Decode your psychological code.",
    desc: "Not generic advice. ICRL-powered deep-dive to map your patterns and rewire your defaults.",
    bg: "#ffffff",
    text: "#0F3B46",
  },
  {
    title: "Therapy Sessions",
    subtitle: "Root-cause psychology. Not just symptom management.",
    desc: "Fix the source, not the surface. Evidence-based support blended with ICRL profiling.",
    bg: "#0F3B46",
    text: "#FFFFFF",
  },
  {
    title: "Workshops",
    subtitle: "1 to 3 days. Lasting change.",
    desc: "Immersive group experiences using live ICRL profiling and zero filler content.",
    bg: "#0F172A",
    text: "#FFFFFF",
  },
  {
    title: "Corporate Training",
    subtitle: "Build teams that understand themselves.",
    desc: "Custom ICRL programs for organizations — from profiling to leadership development.",
    bg: "#02040A",
    text: "#F2F2F2",
  },
];

const roles = ["Engineer", "Systematizer", "Trainer", "Coach"];

export default function ServicesSection() {
  const sectionRef     = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);

  const wordRefs       = useRef<(HTMLParagraphElement | null)[]>([]);
  const cardRefs       = useRef<(HTMLDivElement | null)[]>([]);
  const titleRefs      = useRef<(HTMLParagraphElement | null)[]>([]);
  const subtitleRefs   = useRef<(HTMLParagraphElement | null)[]>([]);
  const descRefs       = useRef<(HTMLParagraphElement | null)[]>([]);
  const ctaRefs        = useRef<(HTMLAnchorElement | null)[]>([]);

  const bgRef          = useRef<HTMLDivElement>(null);
  const bgSweepRef     = useRef<HTMLDivElement>(null);
  const videoWrapRef   = useRef<HTMLDivElement>(null);
  const cardsColRef    = useRef<HTMLDivElement>(null);

  const mobileRolesRef     = useRef<HTMLDivElement>(null);
  const mobileVideoWrapRef = useRef<HTMLDivElement>(null);
  const mobileCanvasRef    = useRef<HTMLCanvasElement>(null);
  const mobileCardsWrapRef = useRef<HTMLDivElement>(null);
  const mobileDetailsStageRef = useRef<HTMLDivElement>(null);
  const mobileCardRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const mobileDetailRefs   = useRef<(HTMLDivElement | null)[]>([]);

  /* preloaded Image objects — filled before useGSAP */
  const framesRef = useRef<HTMLImageElement[]>([]);
  const loadedRef = useRef(0);

  /* helper: draw image in "contain" mode to avoid any stretch/zoom artifacts */
  const drawImageContain = (
    img: HTMLImageElement,
    canvas: HTMLCanvasElement | null
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* keep canvas pixel size in sync with its CSS size */
    const w = canvas.offsetWidth || img.naturalWidth;
    const h = canvas.offsetHeight || img.naturalHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  };

  /* helper: draw a frame index (0-based) onto the canvas */
  const drawFrame = (index: number, targetCanvas: HTMLCanvasElement | null) => {
    const img = framesRef.current[index];
    if (!img?.complete) return;
    drawImageContain(img, targetCanvas);
  };

  /* helper: liquid-like color sweep from either side */
  const runBgSweep = (
    tl: gsap.core.Timeline,
    start: number,
    color: string,
    duration: number,
    from: "right" | "left" = "right"
  ) => {
    if (!bgRef.current || !bgSweepRef.current) return;
    const moveDirection = from === "right" ? -1 : 1;

    tl.set(
      bgSweepRef.current,
      {
        backgroundColor: color,
        scaleX: 0,
        scaleY: 1.02,
        xPercent: 0,
        skewX: 0,
        autoAlpha: 0.78,
        transformOrigin: from === "right" ? "right center" : "left center",
        filter: "blur(14px)",
      },
      start
    );

    tl.to(
      bgSweepRef.current,
      {
        scaleX: 1.08,
        scaleY: 1,
        xPercent: 4 * moveDirection,
        skewX: 2 * moveDirection,
        duration: duration * 0.68,
        ease: "power2.out",
      },
      start
    );

    tl.to(
      bgSweepRef.current,
      {
        scaleX: 1.01,
        xPercent: 0,
        skewX: 0,
        filter: "blur(8px)",
        duration: duration * 0.16,
        ease: "sine.out",
      },
      start + duration * 0.68
    );
    tl.to(
      bgSweepRef.current,
      { autoAlpha: 0, duration: duration * 0.24, ease: "sine.out" },
      start + duration * 0.76
    );
    tl.to(
      bgRef.current,
      { backgroundColor: color, duration: duration * 0.92, ease: "sine.inOut" },
      start + duration * 0.08
    );
    tl.set(bgSweepRef.current, { scaleX: 0, autoAlpha: 0, skewX: 0, xPercent: 0 }, start + duration + 0.0001);
  };

  /* ─── Preload all frames ─── */
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i);
      img.onload = () => {
        loadedRef.current += 1;
        /* draw first frame as soon as it arrives */
        if (i === 1) {
          drawImageContain(img, canvasRef.current);
          drawImageContain(img, mobileCanvasRef.current);
        }
      };
      imgs.push(img);
    }

    framesRef.current = imgs;
  }, []);

  /* ─── GSAP ─── */
  useGSAP(
    () => {
      if (!sectionRef.current || !containerRef.current) return;
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        const section   = sectionRef.current!;
        const container = containerRef.current!;

        const firstCard = cardRefs.current[0];
        const secondCard = cardRefs.current[1];
        const slotPx =
          firstCard && secondCard
            ? secondCard.offsetTop - firstCard.offsetTop
            : window.innerHeight * 0.18;

        /* pin */
        ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          pin: container,
          pinSpacing: false,
        });

        /* master timeline */
        const tl = gsap.timeline({
          scrollTrigger: {
            id: "servicesTL",
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.95,
          },
        });

        /* ─── canvas frame scrub (first 35% of the scroll) ─── */
        const frameProxy = { frame: 0 };
        ScrollTrigger.create({
          id: "frameScrub",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.95,
          onUpdate: (self) => {
            /* only run during the video phase (0 → 35%) */
            const raw    = Math.min(self.progress / 0.35, 1);
            const idx    = Math.round(raw * (TOTAL_FRAMES - 1));
            if (idx !== frameProxy.frame) {
              frameProxy.frame = idx;
              drawFrame(idx, canvasRef.current);
            }
          },
        });

        /* ════════════════════════════════════════════
           PHASE 1  (0 → 0.15)  role words fade in
        ════════════════════════════════════════════ */
        tl.fromTo(
          wordRefs.current,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.03, duration: 0.12 },
          0
        );

        /* ════════════════════════════════════════════
           PHASE 2  (0.15 → 0.38)  cards push video left
        ════════════════════════════════════════════ */
        tl.fromTo(
          videoWrapRef.current,
          { xPercent: 0 },
          { xPercent: -100, duration: 0.22, ease: "none" },
          0.15
        );
        tl.to(
          wordRefs.current,
          { x: -80, opacity: 0, stagger: 0.02, duration: 0.14 },
          0.15
        );
        tl.fromTo(
          cardsColRef.current,
          { xPercent: 110, opacity: 0 },
          { xPercent: 0, opacity: 1, duration: 0.18, ease: "power2.out" },
          0.18
        );

        /* ════════════════════════════════════════════
           PHASE 2.5  (0.37 → 0.42)  canvas fades out
        ════════════════════════════════════════════ */
        tl.to(
          videoWrapRef.current,
          { opacity: 0, duration: 0.05, ease: "none" },
          0.37
        );

        /* ════════════════════════════════════════════
           PHASE 3  (0.42 → 0.95)  per-service reveals
        ════════════════════════════════════════════ */
        const phaseStart = 0.42;
        const phaseEnd   = 0.95;
        const perService = (phaseEnd - phaseStart) / services.length;

        services.forEach((s, i) => {
          const start         = phaseStart + i * perService;
          const contentReveal = start + perService * 0.12;

          /* hard-reset other service content */
          services.forEach((_, j) => {
          if (j === i) return;
          if (titleRefs.current[j])    tl.set(titleRefs.current[j],    { opacity: 0 }, start);
          if (subtitleRefs.current[j]) tl.set(subtitleRefs.current[j], { opacity: 0, clipPath: "inset(0 100% 0 0)" }, start);
          if (descRefs.current[j])     tl.set(descRefs.current[j],     { opacity: 0, filter: "blur(8px)" }, start);
          if (ctaRefs.current[j])      tl.set(ctaRefs.current[j],      { opacity: 0 }, start);
        });

          /* BG transition from right edge (card side) */
          runBgSweep(
            tl,
            start,
            s.bg,
            perService * 0.54,
            i % 2 === 0 ? "right" : "left"
          );

          /* card slides off right */
          if (cardRefs.current[i]) {
            tl.to(
              cardRefs.current[i],
              {
                xPercent: 114,
                opacity: 0,
                scale: 0.985,
                duration: perService * 0.34,
                ease: "power2.inOut",
              },
              start
            );
          }

          /* remaining cards shift up */
          const shiftY = -(i + 1) * slotPx;
          for (let j = i + 1; j < services.length; j++) {
            if (cardRefs.current[j]) {
              tl.to(
                cardRefs.current[j],
                { y: shiftY, duration: perService * 0.36, ease: "power2.inOut" },
                start
              );
            }
          }

          /* content reveals */
          if (titleRefs.current[i]) {
            tl.fromTo(titleRefs.current[i],
              { opacity: 0, x: 60 },
              { opacity: 1, x: 0, color: s.text, duration: perService * 0.34, ease: "power2.out" },
              contentReveal);
          }
          if (subtitleRefs.current[i]) {
            tl.fromTo(subtitleRefs.current[i],
              { clipPath: "inset(0 100% 0 0)", opacity: 1 },
              { clipPath: "inset(0 0% 0 0)", color: s.text, duration: perService * 0.3, ease: "power2.out" },
              contentReveal + perService * 0.2);
          }
          if (descRefs.current[i]) {
            tl.fromTo(descRefs.current[i],
              { opacity: 0, filter: "blur(8px)" },
              { opacity: 1, filter: "blur(0px)", color: s.text, duration: perService * 0.32, ease: "power1.out" },
              contentReveal + perService * 0.36);
          }
          if (ctaRefs.current[i]) {
            tl.fromTo(ctaRefs.current[i],
              { y: 24, opacity: 0 },
              { y: 0, opacity: 1, color: s.text, borderColor: s.text + "4D", duration: perService * 0.28, ease: "power2.out" },
              contentReveal + perService * 0.5);
          }
        });

        /* fade last service before exit */
        const last = services.length - 1;
        [titleRefs, subtitleRefs, descRefs, ctaRefs].forEach((r) => {
          if (r.current[last]) tl.to(r.current[last], { opacity: 0, duration: 0.03 }, 0.93);
        });

        /* section exits left */
        tl.to(container, { xPercent: -100, duration: 0.07, ease: "power2.in" }, 0.93);
      });

      /* mobile: roles top + frame-sequence middle + cards stack, then service-by-service reveal */
      mm.add("(max-width: 767px)", () => {
        const section   = sectionRef.current!;
        const container = containerRef.current!;

        ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          pin: container,
          pinSpacing: false,
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            id: "servicesMobileTL",
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.4,
          },
        });

        const mobileFrameProxy = { frame: 0 };
        ScrollTrigger.create({
          id: "frameScrubMobile",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.9,
          onUpdate: (self) => {
            const raw = Math.min(self.progress / 0.42, 1);
            const idx = Math.round(raw * (TOTAL_FRAMES - 1));
            if (idx !== mobileFrameProxy.frame) {
              mobileFrameProxy.frame = idx;
              drawFrame(idx, mobileCanvasRef.current);
            }
          },
        });

        tl.set(mobileDetailRefs.current, { autoAlpha: 0, y: 20 }, 0);
        tl.set(mobileDetailsStageRef.current, { autoAlpha: 1 }, 0);

        tl.fromTo(
          mobileRolesRef.current,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.14, ease: "power2.out" },
          0
        );
        tl.fromTo(
          mobileVideoWrapRef.current,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.14, ease: "power2.out" },
          0.06
        );
        tl.fromTo(
          mobileCardRefs.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.05, duration: 0.14, ease: "power2.out" },
          0.1
        );

        tl.to(
          mobileCardRefs.current,
          { y: -42, opacity: 0, stagger: 0.08, duration: 0.22, ease: "power2.out" },
          0.28
        );
        tl.to(
          mobileCardsWrapRef.current,
          { autoAlpha: 0, y: -18, duration: 0.16, ease: "power2.out" },
          0.44
        );
        tl.to(
          mobileRolesRef.current,
          { autoAlpha: 0, y: -20, duration: 0.18, ease: "power2.out" },
          0.43
        );
        tl.to(
          mobileVideoWrapRef.current,
          { autoAlpha: 0, y: -12, duration: 0.18, ease: "power2.out" },
          0.43
        );

        const phaseStart = 0.52;
        const phaseEnd   = 0.95;
        const perService = (phaseEnd - phaseStart) / services.length;

        services.forEach((s, i) => {
          const start = phaseStart + i * perService;
          const reveal = start + perService * 0.12;

          services.forEach((_, j) => {
            if (j === i) return;
            if (mobileDetailRefs.current[j]) {
              tl.set(mobileDetailRefs.current[j], { autoAlpha: 0, y: 20 }, start);
            }
          });

          runBgSweep(tl, start, s.bg, perService * 0.5, i % 2 === 0 ? "right" : "left");

          if (mobileDetailRefs.current[i]) {
            tl.fromTo(
              mobileDetailRefs.current[i],
              { autoAlpha: 0, y: 28 },
              { autoAlpha: 1, y: 0, duration: perService * 0.48, ease: "power2.out" },
              reveal
            );
          }
        });

        const last = services.length - 1;
        if (mobileDetailRefs.current[last]) {
          tl.to(mobileDetailRefs.current[last], { autoAlpha: 0, duration: 0.05 }, 0.96);
        }
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  /* ─── JSX ─── */
  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative w-full h-[600vh] max-md:h-[540vh]"
    >
      {/* background layer */}
      <div
        ref={bgRef}
        className="absolute inset-0 z-0"
        style={{ backgroundColor: "#000000" }}
      />
      <div
        ref={bgSweepRef}
        className="absolute inset-0 z-0 scale-x-0 origin-right pointer-events-none"
        style={{ backgroundColor: "#000000", filter: "blur(12px)" }}
      />

      {/* sticky container */}
      <div
        ref={containerRef}
        className="relative w-full h-screen overflow-hidden"
      >
        {/* label */}
        <p className="absolute top-8 left-6 md:left-16 text-[#0F3B46] text-xs font-bold tracking-[0.2em] uppercase z-20">
          SERVICES
        </p>

        {/* scroll hint */}
        <p className="absolute bottom-8 left-6 md:left-16 text-white/30 text-sm tracking-widest z-20 max-md:hidden">
          Scroll to Discover ———
        </p>

        {/* ── LEFT 50%: role words + per-service content ── */}
        <div
          className="absolute inset-y-0 left-0 w-1/2 flex flex-col justify-center pl-6 md:pl-16 z-20 max-md:hidden"
        >
          {/* Phase 1: role words */}
          {roles.map((word, i) => (
            <p
              key={word}
              ref={(el) => { wordRefs.current[i] = el; }}
              className="font-bold leading-none"
              style={{ fontSize: "clamp(2rem, 5vw, 5rem)", color: "#ffffff", opacity: 0 }}
            >
              {word}
            </p>
          ))}

          {/* Phase 3: per-service content, absolutely stacked */}
          {services.map((s, i) => (
            <div
              key={s.title}
              className="absolute inset-y-0 left-0 w-full flex flex-col justify-center pl-6 md:pl-16 pointer-events-none"
            >
              <p
                ref={(el) => { titleRefs.current[i] = el; }}
                className="font-bold leading-none mb-4 pointer-events-auto"
                style={{ fontSize: "clamp(3rem, 8vw, 8rem)", color: s.text, opacity: 0 }}
              >
                {s.title}
              </p>
              <p
                ref={(el) => { subtitleRefs.current[i] = el; }}
                className="text-sm md:text-lg mb-3 pointer-events-auto"
                style={{ color: s.text, opacity: 0, clipPath: "inset(0 100% 0 0)" }}
              >
                {s.subtitle}
              </p>
              <p
                ref={(el) => { descRefs.current[i] = el; }}
                className="text-sm leading-relaxed max-w-md mb-6 pointer-events-auto"
                style={{ color: s.text, opacity: 0, filter: "blur(8px)" }}
              >
                {s.desc}
              </p>
              <Link
                href="/booking"
                ref={(el) => { ctaRefs.current[i] = el; }}
                className="inline-flex items-center gap-3 rounded-full border px-8 py-3 text-sm font-semibold hover:bg-current/10 transition-colors pointer-events-auto w-fit"
                style={{ color: s.text, borderColor: s.text + "4D", opacity: 0 }}
              >
                Book Now
                <svg width="20" height="10" viewBox="0 0 51 21" fill="none">
                  <path
                    d="M50.1 10.9C51.3 9.7 51.3 7.8 50.1 6.6L37-6.5C35.8-7.7 33.9-7.7 32.7-6.5C31.5-5.3 31.5-3.4 32.7-2.2L44.7 9.8 32.7 21.7C31.5 22.9 31.5 24.8 32.7 26 33.9 27.2 35.8 27.2 37 26L50.1 12.9ZM0 11.8H48V7.8H0V11.8Z"
                    fill="currentColor"
                  />
                </svg>
              </Link>
            </div>
          ))}
        </div>

        {/* ── RIGHT 50%: canvas (image sequence) + cards ── */}
        <div className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-center z-20 max-md:hidden">

          {/* canvas wrap — animates left into left half during phase 2 */}
          <div
            ref={videoWrapRef}
            className="absolute inset-0 pr-6 xl:pr-10"
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ display: "block", mixBlendMode: "lighten" }}
            />
          </div>

          {/* cards column */}
          <div
            ref={cardsColRef}
            className="absolute right-6 xl:right-10 top-1/2 -translate-y-1/2 flex flex-col gap-4 w-[min(430px,38vw)]"
            style={{ opacity: 0 }}
          >
            {services.map((s, i) => (
              <div
                key={s.title}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="relative flex items-center rounded-[28px] overflow-hidden px-8 py-4 border border-white/10"
                style={{ height: "15vh", backgroundColor: s.bg }}
              >
                <p
                  className="relative z-10 font-bricolageGrotesque leading-[0.8em] font-semibold"
                  style={{ color: s.text, fontSize: "clamp(1.2rem, 2.3vw, 2.4rem)" }}
                >
                  {s.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── MOBILE: roles top, scroll-scrub frames middle, cards then service-by-service reveal ── */}
        <div className="md:hidden relative z-20 h-full w-full px-5 pt-20 pb-8">
          <div ref={mobileRolesRef} className="relative z-20 mt-8">
            {roles.map((word) => (
              <p
                key={word}
                className="font-bold leading-[0.9] text-white"
                style={{ fontSize: "clamp(2rem, 10.2vw, 3.6rem)" }}
              >
                {word}
              </p>
            ))}
          </div>

          <div
            ref={mobileVideoWrapRef}
            className="relative z-10 mt-4 mx-auto w-full max-w-[360px]"
          >
            <canvas
              ref={mobileCanvasRef}
              className="w-full aspect-[5/6] block"
            />
          </div>

          <div
            ref={mobileCardsWrapRef}
            className="absolute left-5 right-5 bottom-6 z-30 flex flex-col gap-3"
          >
            {services.map((s, i) => (
              <div
                key={s.title}
                ref={(el) => { mobileCardRefs.current[i] = el; }}
                className="rounded-2xl px-5 py-4 border border-white/10"
                style={{ backgroundColor: s.bg }}
              >
                <p
                  className="font-semibold leading-[0.95]"
                  style={{ color: s.text, fontSize: "clamp(1.2rem, 6.4vw, 2rem)" }}
                >
                  {s.title}
                </p>
              </div>
            ))}
          </div>

          <div
            ref={mobileDetailsStageRef}
            className="absolute left-5 right-5 bottom-20 min-h-[250px] z-40"
          >
            {services.map((s, i) => (
              <div
                key={`${s.title}-mobile-detail`}
                ref={(el) => { mobileDetailRefs.current[i] = el; }}
                className="absolute inset-0 opacity-0 pointer-events-none"
              >
                <p
                  className="font-bold leading-none mb-3"
                  style={{ color: s.text, fontSize: "clamp(2rem, 11vw, 3.2rem)" }}
                >
                  {s.title}
                </p>
                <p
                  className="text-sm mb-3"
                  style={{ color: s.text, opacity: 0.9 }}
                >
                  {s.subtitle}
                </p>
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{ color: s.text, opacity: 0.78 }}
                >
                  {s.desc}
                </p>
                <Link
                  href="/booking"
                  className="inline-flex items-center gap-2 rounded-full border px-6 py-2 text-sm font-semibold pointer-events-auto"
                  style={{ color: s.text, borderColor: `${s.text}66` }}
                >
                  Book Now →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
