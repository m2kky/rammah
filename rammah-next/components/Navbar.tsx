"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShapeBlue, ShapeGreen, ShapeOrange, ShapeRed } from "./aCRLShapes";

import type { CmsMedia, PublicNavigationItem } from "@/lib/api/cms";

const fallbackMenuItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Corporate Training", href: "/services/corporate-training" },
  { label: "Booking", href: "/booking" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

const iconShapes = [ShapeGreen, ShapeOrange, ShapeBlue, ShapeRed];

const roles = ["Engineer", "Systematizer", "Trainer", "Coach"];

function AnimatedaCRLGlyph() {
  const [shapeIndex, setShapeIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShapeIndex((prev) => (prev + 1) % iconShapes.length);
    }, 850);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="relative block h-8 w-8 scale-[0.62] md:scale-90" style={{ filter: "brightness(0) invert(1)" }}>
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
      <span className="relative h-6 w-24 md:w-32 overflow-hidden flex items-center">
        {roles.map((role, index) => {
          const isActive = index === shapeIndex;
          return (
            <span
              key={index}
              className={`absolute inset-0 flex items-center text-xs md:text-sm font-bricolage font-medium tracking-wide transition-all duration-500 ${isActive
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
                }`}
            >
              {role}
            </span>
          );
        })}
      </span>
    </div>
  );
}

type NavbarProps = {
  entryReady: boolean;
  navigation?: PublicNavigationItem[];
  siteName?: string;
  desktopMenuVideo: CmsMedia;
  mobileMenuVideo: CmsMedia;
};

export default function Navbar({
  entryReady,
  navigation = [],
  siteName = "Rammah",
  desktopMenuVideo,
  mobileMenuVideo,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItems = navigation.length > 0
    ? navigation.map((item) => ({ label: item.label, href: item.url }))
    : fallbackMenuItems;

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
      {/* Smooth blur backdrop (Sibling layer) */}
      <div className="fixed top-0 inset-x-0 h-20 md:h-32 z-[79] backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] pointer-events-none" />

      <header className="fixed top-0 inset-x-0 z-[80] pointer-events-none mix-blend-difference">
        <div className="px-2 md:px-6 pt-2 md:pt-4">
          <nav className="pointer-events-auto mx-auto max-w-[1440px] h-9 md:h-16 flex items-center gap-2 text-white">
          {/* Left aCRL icon */}
          <div
            className={`flex flex-1 items-center justify-start transition-all duration-[920ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
            }`}
            style={{ transitionDelay: entryReady ? "180ms" : "0ms" }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-7 w-auto md:h-10 items-center justify-center"
            >
              <AnimatedaCRLGlyph />
            </button>
          </div>

          {/* Center navigation */}
          <div
            className={`flex flex-[2] justify-center transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              entryReady ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-12"
            }`}
            style={{ transitionDelay: entryReady ? "460ms" : "0ms" }}
          >
            <div className="flex items-center text-lg md:text-xl font-bricolage font-bold tracking-[0.2em] leading-none">
              <Link href="/" className="hover:opacity-70 transition-opacity uppercase">{siteName}</Link>
            </div>
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
              aria-controls="site-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="group flex h-10 w-10 flex-col items-center justify-center gap-[4.5px] rounded-full bg-white/5 border border-white/10 transition-all hover:bg-white/15 active:scale-90"
            >
              <span className={`block h-[1.5px] w-[18px] bg-white transition-all duration-300 ease-out ${menuOpen ? "rotate-45 translate-y-[6px]" : "group-hover:-translate-y-[1px]"}`} />
              <span className={`block h-[1.5px] w-[18px] bg-white transition-all duration-300 ease-out ${menuOpen ? "opacity-0 scale-x-0" : "group-hover:-translate-x-[2px]"}`} />
              <span className={`block h-[1.5px] w-[18px] bg-white transition-all duration-300 ease-out ${menuOpen ? "-rotate-45 -translate-y-[6px]" : "group-hover:translate-y-[1px]"}`} />
            </button>
          </div>
        </nav>
        </div>
      </header>

      {/* Fullscreen menu overlay */}
      <div
        id="site-menu"
        inert={!menuOpen}
        className={`fixed inset-0 z-[70] bg-black transition-[opacity,visibility] duration-500 motion-reduce:transition-none ${menuOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src={mobileMenuVideo.publicUrl} type={mobileMenuVideo.mimeType} media="(max-width: 899px)" />
          <source src={desktopMenuVideo.publicUrl} type={desktopMenuVideo.mimeType} />
        </video>
        <div className="absolute inset-0 bg-black/68 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,59,70,0.18)_0%,rgba(0,0,0,0.8)_70%)]" />

        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          <nav aria-label="Main menu" className="mx-auto flex min-h-full max-w-[1280px] flex-col justify-center px-6 pt-20 pb-28 md:px-12 md:pt-28 lg:px-16">
            <ul className="grid grid-cols-1 gap-y-3 min-[900px]:grid-cols-2 min-[900px]:gap-x-12 min-[900px]:gap-y-6">
              {menuItems.map((item) => (
                <li key={item.href} className="min-w-0">
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="inline-block min-h-11 max-w-full rounded-sm py-1.5 text-[clamp(1.75rem,8vw,3rem)] leading-[1.05] font-bricolage font-bold tracking-tight text-[#F4EBD8] [overflow-wrap:anywhere] transition-opacity duration-300 hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none min-[900px]:text-[clamp(2.25rem,4vw,3.75rem)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
