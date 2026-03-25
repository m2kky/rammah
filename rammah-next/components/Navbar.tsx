"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const navLinks = [
  { label: "About", href: "/about" },
  { label: "ICRL", href: "/icrl" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useGSAP(() => {
    ScrollTrigger.create({
      start: "top -80",
      onEnter: () =>
        gsap.to(navRef.current, {
          backgroundColor: "#1A1A2E",
          borderBottomColor: "rgba(255,255,255,0.08)",
          duration: 0.4,
          ease: "power2.out",
        }),
      onLeaveBack: () =>
        gsap.to(navRef.current, {
          backgroundColor: "transparent",
          borderBottomColor: "transparent",
          duration: 0.3,
        }),
    });
  });

  // Lock scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <nav
        ref={navRef}
        style={{ backgroundColor: "transparent", borderBottomColor: "transparent" }}
        className="fixed top-0 left-0 right-0 z-[900] h-16 flex items-center border-b transition-colors duration-300"
      >
        <div className="w-full max-w-[1200px] mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-white font-bold text-xl tracking-tight">
            Ramah
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-white/70 hover:text-white transition-colors hover:underline underline-offset-4"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <button className="text-xs border border-white/30 text-white/70 hover:text-white hover:border-white/60 rounded px-3 py-1.5 transition-colors">
              EN / AR
            </button>
            <Link
              href="/booking"
              className="bg-[#2A9D8F] text-white text-sm font-medium rounded-full px-6 py-2.5 hover:bg-[#238579] active:scale-[0.98] transition-all"
            >
              Book a Session
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[800] bg-[#1A1A2E] flex flex-col pt-20 px-8 transition-transform duration-400 ease-in-out ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <nav className="flex flex-col gap-6 text-2xl font-semibold">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-white/80 hover:text-white transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto mb-12 flex flex-col gap-3">
          <button className="border border-white/30 text-white/70 rounded px-4 py-2.5 text-sm w-full">
            EN / AR
          </button>
          <Link
            href="/booking"
            onClick={() => setMenuOpen(false)}
            className="bg-[#2A9D8F] text-white text-sm font-semibold rounded-full px-6 py-3.5 text-center hover:bg-[#238579] transition-colors"
          >
            Book a Session
          </Link>
        </div>
      </div>
    </>
  );
}
