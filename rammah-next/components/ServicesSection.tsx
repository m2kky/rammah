"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchPublicOfferings } from "@/lib/api/offerings";
import { servicesFallback } from "@/data/servicesFallback";

/* ─── config ─── */
const TOTAL_FRAMES = 192;   // 4s clip at 24fps
const FRAME_VERSION = "v4s_6";
const FRAME_PATH   = (n: number) =>
  `/frames/frame${String(n).padStart(4, "0")}.webp?v=${FRAME_VERSION}`;

const roles = ["Engineer", "Systematizer", "Trainer", "Coach"];

export default function ServicesSection() {
  const [services, setServices] = useState(servicesFallback);
  const router = useRouter();

  const sectionRef     = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);

  const wordRefs       = useRef<(HTMLParagraphElement | null)[]>([]);
  const cardRefs       = useRef<(HTMLDivElement | null)[]>([]);
  const servicePanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const servicePanelContentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const bgRef          = useRef<HTMLDivElement>(null);
  const videoWrapRef   = useRef<HTMLDivElement>(null);
  const cardsColRef    = useRef<HTMLDivElement>(null);

  const mobileRolesRef     = useRef<HTMLDivElement>(null);
  const mobileVideoWrapRef = useRef<HTMLDivElement>(null);
  const mobileCanvasRef    = useRef<HTMLCanvasElement>(null);
  const mobileCardsWrapRef = useRef<HTMLDivElement>(null);
  const mobileDetailsStageRef = useRef<HTMLDivElement>(null);
  const mobileCardRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const mobileDetailRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const mobileDetailContentRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* preloaded Image objects — filled before useGSAP */
  const framesRef = useRef<HTMLImageElement[]>([]);
  const loadedRef = useRef(0);

  const handleBookingLinkClick = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    router.push(`/booking/${slug}`);
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicOfferings(controller.signal)
      .then((offerings) => {
        if (offerings.length > 0) {
          setServices(offerings);
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Using fallback services because offerings API failed.", error);
      });

    return () => controller.abort();
  }, []);

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
            scrub: 2.4,
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

        tl.to(
          cardsColRef.current,
          { autoAlpha: 0, yPercent: -10, scale: 0.98, duration: 0.08, ease: "power2.out" },
          0.36
        );

        const desktopPanels = servicePanelRefs.current.filter(
          (el): el is HTMLDivElement => Boolean(el)
        );
        const desktopPanelContents = servicePanelContentRefs.current.filter(
          (el): el is HTMLDivElement => Boolean(el)
        );

        tl.set(desktopPanels, { yPercent: 105, scale: 1.025, autoAlpha: 1, pointerEvents: "none" }, 0);
        tl.set(desktopPanelContents, { y: 68, autoAlpha: 0 }, 0);

        /* ════════════════════════════════════════════
           PHASE 3  (0.40 → 0.95)  stacked service panels
        ════════════════════════════════════════════ */
        const phaseStart = 0.4;
        const phaseEnd   = 0.96;
        const perService = (phaseEnd - phaseStart) / services.length;

        services.forEach((_, i) => {
          const start = phaseStart + i * perService;
          const contentReveal = start + perService * 0.18;
          const panel = servicePanelRefs.current[i];
          const content = servicePanelContentRefs.current[i];
          const previousPanel = i > 0 ? servicePanelRefs.current[i - 1] : null;
          const previousContent = i > 0 ? servicePanelContentRefs.current[i - 1] : null;

          if (previousContent) {
            tl.to(
              previousContent,
              {
                autoAlpha: 0,
                y: -42,
                duration: perService * 0.2,
                ease: "power1.inOut",
              },
              start
            );
          }

          if (previousPanel) {
            tl.to(
              previousPanel,
              {
                scale: 0.975,
                duration: perService * 0.36,
                ease: "power1.out",
              },
              start
            );
            tl.set(previousPanel, { pointerEvents: "none" }, start);
          }

          if (panel) {
            tl.fromTo(
              panel,
              {
                yPercent: i === 0 ? 22 : 105,
                scale: i === 0 ? 1.01 : 1.025,
              },
              {
                yPercent: 0,
                scale: 1,
                duration: perService * 0.72,
                ease: "power3.out",
              },
              start
            );
            tl.set(panel, { pointerEvents: "auto" }, contentReveal);
          }

          if (content) {
            tl.fromTo(
              content,
              { autoAlpha: 0, y: 68 },
              { autoAlpha: 1, y: 0, duration: perService * 0.44, ease: "power3.out" },
              contentReveal
            );
          }
        });

        /* fade last service before exit */
        const last = services.length - 1;
        if (servicePanelContentRefs.current[last]) {
          tl.to(
            servicePanelContentRefs.current[last],
            { autoAlpha: 0, y: -38, duration: 0.08, ease: "power1.in" },
            0.94
          );
        }
        if (servicePanelRefs.current[last]) {
          tl.set(servicePanelRefs.current[last], { pointerEvents: "none" }, 0.94);
        }

        /* section exits left */
        tl.to(container, { xPercent: -100, duration: 0.07, ease: "power2.in" }, 0.94);
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
            scrub: 1.8,
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

        const mobilePanels = mobileDetailRefs.current.filter(
          (el): el is HTMLDivElement => Boolean(el)
        );
        const mobilePanelContents = mobileDetailContentRefs.current.filter(
          (el): el is HTMLDivElement => Boolean(el)
        );

        tl.set(mobilePanels, { yPercent: 108, scale: 1.025, autoAlpha: 1, pointerEvents: "none" }, 0);
        tl.set(mobilePanelContents, { y: 44, autoAlpha: 0 }, 0);
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

        const phaseStart = 0.5;
        const phaseEnd   = 0.96;
        const perService = (phaseEnd - phaseStart) / services.length;

        services.forEach((_, i) => {
          const start = phaseStart + i * perService;
          const reveal = start + perService * 0.12;

          if (i > 0 && mobileDetailContentRefs.current[i - 1]) {
            tl.to(
              mobileDetailContentRefs.current[i - 1],
              {
                autoAlpha: 0,
                y: -34,
                duration: perService * 0.2,
                ease: "power1.inOut",
              },
              start
            );
            tl.set(mobileDetailRefs.current[i - 1], { pointerEvents: "none" }, start);
          }

          services.forEach((_, j) => {
            if (j === i || j === i - 1) return;
            if (mobileDetailRefs.current[j]) {
              tl.set(mobileDetailRefs.current[j], { yPercent: 108, pointerEvents: "none" }, start);
            }
          });

          if (mobileDetailRefs.current[i]) {
            tl.fromTo(
              mobileDetailRefs.current[i],
              {
                yPercent: i === 0 ? 28 : 108,
                scale: 1.025,
                pointerEvents: "none",
              },
              {
                yPercent: 0,
                scale: 1,
                duration: perService * 0.7,
                ease: "power3.out",
              },
              start
            );
            tl.set(mobileDetailRefs.current[i], { pointerEvents: "auto" }, reveal);
          }
          if (mobileDetailContentRefs.current[i]) {
            tl.fromTo(
              mobileDetailContentRefs.current[i],
              { autoAlpha: 0, y: 44 },
              { autoAlpha: 1, y: 0, duration: perService * 0.42, ease: "power3.out" },
              reveal
            );
          }
        });

        const last = services.length - 1;
        if (mobileDetailContentRefs.current[last]) {
          tl.to(
            mobileDetailContentRefs.current[last],
            { autoAlpha: 0, y: -28, duration: 0.06, ease: "power1.in" },
            0.96
          );
        }
        if (mobileDetailRefs.current[last]) {
          tl.set(mobileDetailRefs.current[last], { pointerEvents: "none" }, 0.96);
        }
      });

      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [services], revertOnUpdate: true }
  );

  /* ─── JSX ─── */
  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative w-full h-[760vh] max-md:h-[680vh]"
    >
      {/* background layer */}
      <div
        ref={bgRef}
        className="absolute inset-0 z-0"
        style={{ backgroundColor: "#000000" }}
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

        {/* ── STACKED SERVICE PANELS ── */}
        <div className="absolute inset-0 z-30 hidden overflow-hidden md:block pointer-events-none">
          {services.map((s, i) => (
            <div
              key={`${s.slug}-desktop-panel`}
              data-service-panel="desktop"
              ref={(el) => { servicePanelRefs.current[i] = el; }}
              className="absolute inset-0 flex items-center overflow-hidden px-6 md:px-16 will-change-transform"
              style={{
                backgroundColor: s.bg,
                color: s.text,
                zIndex: i + 1,
                visibility: "hidden",
              }}
            >
              <div
                ref={(el) => { servicePanelContentRefs.current[i] = el; }}
                className="grid w-full items-end gap-10 will-change-transform lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.36fr)]"
              >
                <div>
                  <p className="font-inter mb-5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                    {String(i + 1).padStart(2, "0")} · Program
                  </p>
                  <h2
                    className="font-bold leading-none"
                    style={{ fontSize: "clamp(3.1rem, 8.2vw, 8.2rem)" }}
                  >
                    {s.title}
                  </h2>
                  <p className="mt-6 max-w-3xl font-inter text-xl leading-tight opacity-90">
                    {s.subtitle}
                  </p>
                  <p className="mt-4 max-w-2xl font-inter text-base leading-7 opacity-72">
                    {s.desc}
                  </p>
                </div>

                <div className="flex flex-col gap-5 lg:items-end">
                  <Link
                    href={`/booking/${s.slug}`}
                    onClick={(event) => handleBookingLinkClick(event, s.slug)}
                    className="pointer-events-auto inline-flex items-center justify-center gap-3 rounded-full border px-8 py-4 font-inter text-sm font-bold transition-transform hover:scale-[1.03]"
                    style={{ borderColor: `${s.text}66`, color: s.text }}
                  >
                    Book Now
                    <svg width="20" height="10" viewBox="0 0 51 21" fill="none" aria-hidden="true">
                      <path
                        d="M50.1 10.9C51.3 9.7 51.3 7.8 50.1 6.6L37-6.5C35.8-7.7 33.9-7.7 32.7-6.5C31.5-5.3 31.5-3.4 32.7-2.2L44.7 9.8 32.7 21.7C31.5 22.9 31.5 24.8 32.7 26 33.9 27.2 35.8 27.2 37 26L50.1 12.9ZM0 11.8H48V7.8H0V11.8Z"
                        fill="currentColor"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── LEFT 50%: role words ── */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 flex flex-col justify-center pl-6 md:pl-16 z-20 max-md:hidden"
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
        </div>

        {/* ── RIGHT 50%: canvas (image sequence) + cards ── */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 flex items-center justify-center z-20 max-md:hidden">

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
                key={s.slug}
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
                key={s.slug}
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
            className="absolute inset-0 z-40 overflow-hidden pointer-events-none"
          >
            {services.map((s, i) => (
              <div
                key={`${s.slug}-mobile-detail`}
                data-service-panel="mobile"
                ref={(el) => { mobileDetailRefs.current[i] = el; }}
                className="absolute inset-0 flex flex-col justify-center px-5 pb-10 pt-28 pointer-events-none will-change-transform"
                style={{
                  backgroundColor: s.bg,
                  color: s.text,
                  zIndex: i + 1,
                  visibility: "hidden",
                }}
              >
                <div ref={(el) => { mobileDetailContentRefs.current[i] = el; }}>
                  <p className="font-inter mb-4 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                    {String(i + 1).padStart(2, "0")} · Program
                  </p>
                  <p
                    className="font-bold leading-none mb-4"
                    style={{ fontSize: "clamp(2.35rem, 14vw, 4rem)" }}
                  >
                    {s.title}
                  </p>
                  <p className="text-base leading-snug mb-3 opacity-90">
                    {s.subtitle}
                  </p>
                  <p className="text-sm leading-relaxed mb-6 opacity-75">
                    {s.desc}
                  </p>
                  <Link
                    href={`/booking/${s.slug}`}
                    onClick={(event) => handleBookingLinkClick(event, s.slug)}
                    className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold pointer-events-auto"
                    style={{ color: s.text, borderColor: `${s.text}66` }}
                  >
                    Book Now →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
