"use client";
import { useEffect, useRef, useState } from "react";
import { ShapeBlue, ShapeGreen, ShapeOrange, ShapeRed } from "@/components/ICRLShapes";
import { useInViewOnce } from "@/lib/useInViewOnce";

const REWRITE_COLOR = "#1ECBE6";
const TEXT_COLOR = "#EAF6FB";
const REWRITE_PATH_COUNT = 7;

function buildAnimatedSvgMarkup(raw: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "image/svg+xml");
  const svg = doc.documentElement;

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Rewrite Your Mind");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("class", "w-[min(98vw,1260px)] h-auto select-none");

  const paths = Array.from(svg.querySelectorAll("path"));
  paths.forEach((path, index) => {
    const strokeColor = index < REWRITE_PATH_COUNT ? REWRITE_COLOR : TEXT_COLOR;
    path.setAttribute("data-stroke", strokeColor);
    path.setAttribute("fill", "transparent");
    path.setAttribute("stroke", strokeColor);
    path.setAttribute("stroke-width", index < REWRITE_PATH_COUNT ? "2.8" : "2.4");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
  });

  return new XMLSerializer().serializeToString(svg);
}

export default function StatementSection() {
  const { ref, inView } = useInViewOnce<HTMLElement>(0.32, "0px 0px -10% 0px");
  const [svgMarkup, setSvgMarkup] = useState("");
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/REWRITE.svg")
      .then((res) => res.text())
      .then((raw) => {
        if (!mounted) return;
        setSvgMarkup(buildAnimatedSvgMarkup(raw));
      })
      .catch(() => {
        if (!mounted) return;
        setSvgMarkup("");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!svgMarkup || !svgHostRef.current) return;

    const pathNodes = Array.from(
      svgHostRef.current.querySelectorAll("path")
    ) as SVGPathElement[];

    const timeoutIds: number[] = [];

    pathNodes.forEach((path) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.fill = "transparent";
      path.style.opacity = "1";
      path.style.transition = "none";
    });

    if (!inView) {
      return;
    }

    pathNodes.forEach((path, index) => {
      const delay = 70 + index * 32;
      const drawDuration = index < REWRITE_PATH_COUNT ? 930 : 860;
      const fillDelay = delay + Math.round(drawDuration * 0.72);
      const fillColor = path.getAttribute("data-stroke") ?? TEXT_COLOR;

      path.style.transition = `stroke-dashoffset ${drawDuration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, fill 380ms cubic-bezier(0.22,1,0.36,1) ${fillDelay}ms`;

      requestAnimationFrame(() => {
        path.style.strokeDashoffset = "0";
      });

      const timeoutId = window.setTimeout(() => {
        path.style.fill = fillColor;
      }, fillDelay);

      timeoutIds.push(timeoutId);
    });

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [svgMarkup, inView]);

  return (
    <section
      ref={ref}
      className="w-full min-h-[100dvh] pt-24 md:pt-28 bg-black overflow-hidden flex items-center justify-center"
    >
      <div className="w-full min-h-[calc(100dvh-7rem)] md:min-h-[calc(100dvh-8.5rem)] max-w-[1600px] mx-auto flex flex-col justify-center items-center gap-7 md:gap-10 py-8 md:py-10 px-4 md:px-8">
        <div
          className={`w-full flex justify-center transition-all duration-[980ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
          }`}
          ref={svgHostRef}
          dangerouslySetInnerHTML={svgMarkup ? { __html: svgMarkup } : undefined}
        >
          {!svgMarkup ? (
            <span className="text-white/30 text-sm tracking-[0.2em] uppercase">Rewrite Your Mind</span>
          ) : null}
        </div>

        <div
          className={`flex justify-center items-center w-full overflow-hidden py-1 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
          }`}
          style={{ transitionDelay: inView ? "320ms" : "0ms" }}
        >
          <div className="flex items-center gap-4 sm:gap-5 md:gap-6">
            <ShapeGreen
              className={`h-10 sm:h-11 md:h-12 lg:h-14 w-auto origin-center ${
                inView ? "animate-[icrl-float-a_4.8s_ease-in-out_infinite]" : ""
              }`}
            />
            <ShapeOrange
              className={`h-10 sm:h-11 md:h-12 lg:h-14 w-auto origin-center ${
                inView ? "animate-[icrl-spin-soft_6.8s_linear_infinite]" : ""
              }`}
            />
            <ShapeBlue
              className={`h-10 sm:h-11 md:h-12 lg:h-14 w-auto origin-center ${
                inView ? "animate-[icrl-float-b_5.4s_ease-in-out_infinite]" : ""
              }`}
            />
            <ShapeRed
              className={`h-10 sm:h-11 md:h-12 lg:h-14 w-auto origin-center ${
                inView ? "animate-[icrl-tilt-soft_4.6s_ease-in-out_infinite]" : ""
              }`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
