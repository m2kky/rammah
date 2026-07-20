"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import type { PublicPageSection } from "@/lib/api/cms";

export default function MethodologySection({ section }: { section?: PublicPageSection | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const titleText = section?.title || "Systems over motivation.";
  const titleWords = titleText.split(" ");
  const lastWord = titleWords.length > 1 ? titleWords.pop() : "";
  const restTitle = titleWords.join(" ");
  const bodyText = section?.body || "The Architecture of Change";
  const steps = (section?.config?.steps as { title: string, desc: string }[]) || [
    { title: "1. MAP", desc: "I scan your psychological system. Uncovering deep patterns, hidden loops, and the root structure of your current operating model." },
    { title: "2. DEBUG", desc: "We locate the exact errors in the code. The limiting beliefs, the fears, and the emotional bottlenecks that are crashing your progress." },
    { title: "3. REWRITE", desc: "We deploy the new system. Installing robust mental models, unshakeable confidence, and extreme clarity to scale your life to the next tier." }
  ];
  const stepNumbers = ["01", "02", "03"];
  const formatStepTitle = (title?: string) => title?.replace(/^\d+\.\s*/, "") || "";

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // --- Step 1: MAP ---
  const bg1 = useTransform(scrollYProgress, [0, 0.1, 0.25, 0.33], ["rgba(34,211,238,0)", "rgba(34,211,238,0.15)", "rgba(34,211,238,0.15)", "rgba(34,211,238,0)"]);
  const border1 = useTransform(scrollYProgress, [0, 0.1, 0.25, 0.33], ["rgba(255,255,255,0.2)", "rgba(34,211,238,1)", "rgba(34,211,238,1)", "rgba(255,255,255,0.2)"]);
  const textOpacity1 = useTransform(scrollYProgress, [0, 0.1, 0.25, 0.33], [0, 1, 1, 0]);
  const textY1 = useTransform(scrollYProgress, [0, 0.1, 0.25, 0.33], [20, 0, 0, -20]);

  // --- Step 2: DEBUG ---
  const bg2 = useTransform(scrollYProgress, [0.33, 0.43, 0.58, 0.66], ["rgba(34,211,238,0)", "rgba(34,211,238,0.15)", "rgba(34,211,238,0.15)", "rgba(34,211,238,0)"]);
  const border2 = useTransform(scrollYProgress, [0.33, 0.43, 0.58, 0.66], ["rgba(255,255,255,0.2)", "rgba(34,211,238,1)", "rgba(34,211,238,1)", "rgba(255,255,255,0.2)"]);
  const textOpacity2 = useTransform(scrollYProgress, [0.33, 0.43, 0.58, 0.66], [0, 1, 1, 0]);
  const textY2 = useTransform(scrollYProgress, [0.33, 0.43, 0.58, 0.66], [20, 0, 0, -20]);

  // --- Step 3: REWRITE ---
  const bg3 = useTransform(scrollYProgress, [0.66, 0.76, 0.9, 1], ["rgba(34,211,238,0)", "rgba(34,211,238,0.15)", "rgba(34,211,238,0.15)", "rgba(34,211,238,0.15)"]);
  const border3 = useTransform(scrollYProgress, [0.66, 0.76, 0.9, 1], ["rgba(255,255,255,0.2)", "rgba(34,211,238,1)", "rgba(34,211,238,1)", "rgba(34,211,238,1)"]);
  const textOpacity3 = useTransform(scrollYProgress, [0.66, 0.76, 0.9, 1], [0, 1, 1, 1]);
  const textY3 = useTransform(scrollYProgress, [0.66, 0.76, 0.9, 1], [20, 0, 0, 0]);

  return (
    <section ref={containerRef} className="relative w-full h-[320vh] bg-[#02040A]">
      <div className="sticky top-0 h-screen w-full flex flex-col md:flex-row items-center justify-center overflow-hidden px-6 lg:px-20">
        
        {/* Left Side: Dynamic Text */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col justify-center relative z-20">
          <p className="text-white/50 text-sm md:text-base tracking-[0.2em] uppercase font-semibold mb-6">
            {bodyText}
          </p>
          <h2 className="text-white text-5xl md:text-7xl font-bricolage font-bold mb-12">
            {restTitle} <br />
            <span className="text-white/30">{lastWord}</span>
          </h2>

          <div className="relative h-[200px]">
            {/* TEXT 1 */}
            <motion.div 
              style={{ opacity: textOpacity1, y: textY1 }}
              className="absolute top-0 left-0"
            >
              <h3 className="text-cyan-400 text-3xl font-bricolage font-bold mb-4">
                <span className="mr-3 text-white/25">{stepNumbers[0]}</span>
                {formatStepTitle(steps[0]?.title)}
              </h3>
              <p className="text-white/70 text-lg md:text-xl font-medium max-w-md">
                {steps[0]?.desc}
              </p>
            </motion.div>

            {/* TEXT 2 */}
            <motion.div 
              style={{ opacity: textOpacity2, y: textY2 }}
              className="absolute top-0 left-0"
            >
              <h3 className="text-cyan-400 text-3xl font-bricolage font-bold mb-4">
                <span className="mr-3 text-white/25">{stepNumbers[1]}</span>
                {formatStepTitle(steps[1]?.title)}
              </h3>
              <p className="text-white/70 text-lg md:text-xl font-medium max-w-md">
                {steps[1]?.desc}
              </p>
            </motion.div>

            {/* TEXT 3 */}
            <motion.div 
              style={{ opacity: textOpacity3, y: textY3 }}
              className="absolute top-0 left-0"
            >
              <h3 className="text-cyan-400 text-3xl font-bricolage font-bold mb-4">
                <span className="mr-3 text-white/25">{stepNumbers[2]}</span>
                {formatStepTitle(steps[2]?.title)}
              </h3>
              <p className="text-white/70 text-lg md:text-xl font-medium max-w-md">
                {steps[2]?.desc}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Right Side: 3D Stacked Layers */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full relative flex items-center justify-center">

          {/* Isometric Container */}
          <div className="relative w-[200px] h-[200px] md:w-[350px] md:h-[350px] ml-0 md:ml-10">
            <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(-45deg)' }}>
              
              {/* Layer 1: MAP (Top) */}
              <motion.div 
                className="absolute inset-0 overflow-hidden backdrop-blur-md"
                style={{ 
                  translateZ: 120, 
                  backgroundColor: bg1, 
                  borderColor: border1,
                  borderWidth: '2px',
                  boxShadow: useTransform(scrollYProgress, [0, 0.1, 0.25, 0.33], ["none", "0 20px 60px rgba(34,211,238,0.3)", "0 20px 60px rgba(34,211,238,0.3)", "none"])
                }}
              >
                <span className="absolute -bottom-8 -right-3 select-none font-bricolage text-[7rem] md:text-[12rem] font-black leading-none text-white/10">
                  {stepNumbers[0]}
                </span>
              </motion.div>
              
              {/* Layer 2: DEBUG (Middle) */}
              <motion.div 
                className="absolute inset-0 overflow-hidden backdrop-blur-md"
                style={{ 
                  translateZ: 0, 
                  backgroundColor: bg2, 
                  borderColor: border2,
                  borderWidth: '2px',
                  boxShadow: useTransform(scrollYProgress, [0.33, 0.43, 0.58, 0.66], ["none", "0 20px 60px rgba(34,211,238,0.3)", "0 20px 60px rgba(34,211,238,0.3)", "none"])
                }}
              >
                <span className="absolute -bottom-8 -right-3 select-none font-bricolage text-[7rem] md:text-[12rem] font-black leading-none text-white/10">
                  {stepNumbers[1]}
                </span>
              </motion.div>

              {/* Layer 3: REWRITE (Bottom) */}
              <motion.div 
                className="absolute inset-0 overflow-hidden backdrop-blur-md"
                style={{ 
                  translateZ: -120, 
                  backgroundColor: bg3, 
                  borderColor: border3,
                  borderWidth: '2px',
                  boxShadow: useTransform(scrollYProgress, [0.66, 0.76, 0.9, 1], ["none", "0 20px 60px rgba(34,211,238,0.3)", "0 20px 60px rgba(34,211,238,0.3)", "none"])
                }}
              >
                <span className="absolute -bottom-8 -right-3 select-none font-bricolage text-[7rem] md:text-[12rem] font-black leading-none text-white/10">
                  {stepNumbers[2]}
                </span>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
