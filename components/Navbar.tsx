"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShapeBlue, ShapeGreen, ShapeOrange, ShapeRed } from "./ICRLShapes";

const statusMessages = [
  "Profile System Online",
  "ICRL Mapping Active",
  "Engineer Mode Live",
  "System Rewrite Running",
  "Precision Coaching Ready",
];

const menuItems = [
  { label: "About", href: "/about", align: "start" as const },
  { label: "Services", href: "/services", align: "end" as const },
];

const iconShapes = [ShapeGreen, ShapeOrange, ShapeBlue, ShapeRed];

function AnimatedICRLGlyph() {
  const [shapeIndex, setShapeIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShapeIndex((prev) => (prev + 1) % iconShapes.length);
    }, 850);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="relative block h-8 w-8">
      {iconShapes.map((Shape, index) => {
        const isActive = index === shapeIndex;
        return (
          <span
            key={index}
            className={`absolute inset-0 transition-all duration-500 ${isActive
                ? "opacity-100 scale-100 rotate-0"
                : "opacity-0 scale-75 -rotate-6"
              }`}
          >
            <Shape className="h-full w-full" />
          </span>
        );
      })}
    </span>
  );
}

function RollingStatusText() {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((prev) => prev + 1);
    }, 2200);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (index !== statusMessages.length) return;

    const resetTimer = window.setTimeout(() => {
      setIsAnimating(false);
      setIndex(0);
      window.setTimeout(() => setIsAnimating(true), 40);
    }, 700);

    return () => window.clearTimeout(resetTimer);
  }, [index]);

  const list = [...statusMessages, statusMessages[0]];

  return (
    <div className="relative h-6 w-[260px] lg:w-[302px] overflow-hidden">
      <div
        className={`will-change-transform ${isAnimating
            ? "transition-transform duration-700 ease-[cubic-bezier(0.22,0.78,0.2,1)]"
            : ""
          }`}
        style={{ transform: `translateY(-${index * 1.5}rem)` }}
      >
        {list.map((message, messageIndex) => (
          <p
            key={`${message}-${messageIndex}`}
            className="h-6 flex items-center truncate text-white/82 font-inter uppercase tracking-[0.2em] text-[0.62rem] lg:text-[0.7rem]"
          >
            {message}
          </p>
        ))}
      </div>
    </div>
  );
}

type NavbarProps = {
  entryReady: boolean;
};

export default function Navbar({ entryReady }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <>
      <header className="fixed top-5 inset-x-0 z-[80] px-4 md:px-5 pointer-events-none">
        <nav className="pointer-events-auto mx-auto max-w-[1440px] h-[90px] flex items-center gap-3">
          {/* Left ICRL icon */}
          <div
            className={`flex flex-1 items-center justify-start transition-all duration-[920ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
            }`}
            style={{ transitionDelay: entryReady ? "180ms" : "0ms" }}
          >
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Open menu"
                className="group relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-[10px]"
              >
                <span className="absolute inset-0 rounded-full bg-[#0F3B46]/20 blur-[10px] transition-opacity duration-300 group-hover:opacity-100 opacity-90" />
                <span className="absolute inset-0 rounded-full shadow-[0_0_18px_rgba(15,59,70,0.6)]" />
                <span className="relative">
                  <AnimatedICRLGlyph />
                </span>
              </button>

              <div className="hidden md:block">
                <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-black/22 backdrop-blur-[10px] px-3 py-1.5">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[#0F3B46] shadow-[0_0_10px_rgba(15,59,70,0.8)] animate-pulse" />
                  <RollingStatusText />
                </div>
              </div>
            </div>
          </div>

          {/* Center brand */}
          <div
            className={`flex flex-1 justify-start md:justify-center transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-12"
            }`}
            style={{ transitionDelay: entryReady ? "460ms" : "0ms" }}
          >
            <Link
              href="/"
              aria-label="Go to homepage"
              className="text-white font-bricolage font-bold leading-none rounded-full border border-white/15 bg-black/22 backdrop-blur-[10px] px-5 py-2"
              style={{ fontSize: "clamp(2rem, 2.2vw, 2.8rem)" }}
            >
              RAMMAH
            </Link>
          </div>

          {/* Right actions */}
          <div
            className={`flex flex-1 items-center justify-end transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
            }`}
            style={{ transitionDelay: entryReady ? "760ms" : "0ms" }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/25 backdrop-blur-[10px] text-white hover:bg-white/10 transition-colors"
            >
              <span className="relative h-[14px] w-[18px]">
                <span
                  className={`absolute left-0 right-0 h-[1.5px] bg-white transition-transform duration-300 ${menuOpen ? "translate-y-[6px] rotate-45" : "translate-y-0"
                    }`}
                />
                <span
                  className={`absolute left-0 right-0 h-[1.5px] bg-white transition-transform duration-300 ${menuOpen ? "-translate-y-[6px] -rotate-45" : "translate-y-[6px]"
                    }`}
                />
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Fullscreen menu overlay */}
      <div
        className={`fixed inset-0 z-[70] transition-all duration-500 ${menuOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/videos/rammah-vid.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-black/68 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,59,70,0.18)_0%,rgba(0,0,0,0.8)_70%)]" />

        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
          className="absolute top-6 right-6 z-20 inline-flex items-center justify-center h-11 w-11 rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors"
        >
          <span className="text-3xl leading-none">×</span>
        </button>

        <div className="relative z-10 h-full mx-auto max-w-[1440px] px-6 md:px-12 flex items-center">
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14">
            {menuItems.map((item) => (
              <div
                key={item.label}
                className={`${item.align === "start" ? "md:text-left" : "md:text-right"
                  }`}
              >
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="inline-block text-[#F4EBD8] font-bricolage font-bold leading-[0.9] tracking-tight transition-all duration-300 hover:scale-[1.04] hover:tracking-[0.01em]"
                  style={{ fontSize: "clamp(3.2rem, 9vw, 8.4rem)" }}
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
