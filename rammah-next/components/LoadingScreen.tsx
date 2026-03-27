"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap-init";
import { ShapeGreen, ShapeOrange, ShapeBlue, ShapeRed } from "./ICRLShapes";

type LoadingScreenProps = {
  onComplete: () => void;
};

const roles = [
  { label: "Engineer", Shape: ShapeGreen },
  { label: "Systematizer", Shape: ShapeOrange },
  { label: "Trainer", Shape: ShapeBlue },
  { label: "Coach", Shape: ShapeRed },
];

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<(HTMLDivElement | null)[]>([]);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);
  const startedPlaybackRef = useRef(false);
  const pendingPlaybackRef = useRef(false);
  const progressRafRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishLoading = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (progressRafRef.current !== null) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    setProgress(100);
    onComplete();
  }, [onComplete]);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || startedPlaybackRef.current) return;

    if (video.readyState < 2) {
      pendingPlaybackRef.current = true;
      return;
    }

    startedPlaybackRef.current = true;
    pendingPlaybackRef.current = false;
    video.currentTime = 0;
    setProgress(0);

    video.play().catch(() => {
      /* fallback timers will finish loading if autoplay fails */
    });

    const tick = () => {
      const currentVideo = videoRef.current;
      if (!currentVideo || completedRef.current) return;

      const duration =
        Number.isFinite(currentVideo.duration) && currentVideo.duration > 0
          ? currentVideo.duration
          : 4.04;
      const nextProgress = Math.max(
        0,
        Math.min(100, Math.round((currentVideo.currentTime / duration) * 100))
      );
      setProgress((prev) => (prev === nextProgress ? prev : nextProgress));

      progressRafRef.current = requestAnimationFrame(tick);
    };

    if (progressRafRef.current !== null) {
      cancelAnimationFrame(progressRafRef.current);
    }
    progressRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      gsap.set(wordsRef.current, { autoAlpha: 0, y: 22, filter: "blur(8px)" });
      gsap.set(videoWrapRef.current, { autoAlpha: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      wordsRef.current.forEach((row, index) => {
        tl.to(
          row,
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.26,
          },
          index * 0.2
        );
      });

      tl.to(
        videoWrapRef.current,
        {
          autoAlpha: 1,
          duration: 0.45,
          ease: "sine.out",
        },
        ">-0.02"
      );
      tl.add(() => {
        startPlayback();
      }, "<");

      tl.to(
        wordsRef.current,
        {
          autoAlpha: 0,
          y: -18,
          duration: 0.42,
          ease: "power2.in",
          stagger: 0.04,
        },
        ">-0.18"
      );
    }, root);

    const video = videoRef.current;
    const handleEnded = () => {
      setProgress(100);
      finishLoading();
    };
    const handleCanPlay = () => {
      if (pendingPlaybackRef.current && !startedPlaybackRef.current) {
        startPlayback();
      }
    };

    video?.addEventListener("ended", handleEnded);
    video?.addEventListener("canplay", handleCanPlay, { once: true });

    fallbackTimerRef.current = setTimeout(() => finishLoading(), 6500);
    hardTimeoutRef.current = setTimeout(() => finishLoading(), 9000);

    return () => {
      ctx.revert();
      video?.removeEventListener("ended", handleEnded);
      video?.removeEventListener("canplay", handleCanPlay);
      if (progressRafRef.current !== null) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
    };
  }, [finishLoading, startPlayback]);

  const circleRadius = 27;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (progress / 100) * circleCircumference;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[10000] bg-black overflow-hidden">
      <div className="relative h-full w-full">
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="mx-auto h-full max-w-[1440px] px-5 md:px-10 flex items-center justify-center md:justify-start">
            <div className="flex flex-col gap-2.5 md:gap-3.5">
              {roles.map(({ label, Shape }, index) => (
                <div
                  key={label}
                  ref={(el) => {
                    wordsRef.current[index] = el;
                  }}
                  className="flex items-center gap-3.5 md:gap-4 text-white"
                >
                  <Shape className="h-7 w-7 md:h-9 md:w-9 shrink-0" />
                  <p
                    className="font-bricolage font-semibold leading-none tracking-[0.01em]"
                    style={{ fontSize: "clamp(1.55rem, 4.6vw, 4.25rem)" }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div ref={videoWrapRef} className="absolute inset-0 z-10 flex items-end justify-center">
          <video
            ref={videoRef}
            src="/videos/ramma_loadingscreen.mp4"
            muted
            playsInline
            preload="auto"
            className="h-[74dvh] sm:h-[80dvh] md:h-[88dvh] lg:h-[90dvh] w-auto object-contain object-bottom"
          />
        </div>

        <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
          <div className="relative h-[66px] w-[66px]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 66 66" fill="none" aria-hidden>
              <circle cx="33" cy="33" r={circleRadius} stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
              <circle
                cx="33"
                cy="33"
                r={circleRadius}
                stroke="#0F3B46"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circleCircumference}
                strokeDashoffset={circleOffset}
                className="transition-[stroke-dashoffset] duration-150 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white font-inter text-[0.78rem] tracking-[0.08em]">
              {String(progress).padStart(2, "0")}
            </span>
          </div>
          <span className="text-[0.55rem] uppercase tracking-[0.28em] text-white/72 font-inter">
            Loading
          </span>
        </div>
      </div>
    </div>
  );
}
