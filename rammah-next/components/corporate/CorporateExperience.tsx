"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import CorporateQuoteForm from "./CorporateQuoteForm";
import styles from "./CorporateExperience.module.css";
import { findPublicSection, type PublicPage } from "@/lib/api/cms";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const stages = [
  {
    number: "01",
    title: "Diagnostic Phase",
    body: "We do not start with slides. We start by auditing your team's current operating system, identifying behavioral bottlenecks, communication silos, and decision-making friction.",
  },
  {
    number: "02",
    title: "System Design",
    body: "Based on the diagnostic, we map a tailored aCRL framework for your company. We align behavioral targets with your actual KPIs and business objectives.",
  },
  {
    number: "03",
    title: "The Intervention",
    body: "Intensive, scenario-based training that replaces outdated motivation tactics with structural behavioral change. We train your teams to decode themselves and each other.",
  },
  {
    number: "04",
    title: "Sustained Integration",
    body: "Follow-up mapping and leadership coaching to ensure the new operating system becomes the default culture, not just a temporary spike in enthusiasm.",
  },
];

const metrics = [
  ["Alignment", "Shared behavioral language"],
  ["Friction", "Reduced communication silos"],
  ["Decisions", "Faster, systemic problem solving"],
];

export default function CorporateExperience({ page }: { page?: PublicPage | null }) {
  const rootRef = useRef<HTMLElement>(null);

  const heroSec = findPublicSection(page, "hero");
  const marqueeSec = findPublicSection(page, "marquee");
  const hiddenSec = findPublicSection(page, "hidden_variable");
  const premiseSec = findPublicSection(page, "premise");
  const deliverySec = findPublicSection(page, "delivery");
  const storySec = findPublicSection(page, "story");
  const metricsSec = findPublicSection(page, "metrics");
  const ctaSec = findPublicSection(page, "cta");

  const heroKicker = (heroSec?.config?.kicker as string) || "Corporate Training & Consultancy";
  const heroTitleLines = heroSec?.title ? heroSec.title.split("\n") : ["Change the", "operating", "system."];
  const heroBody = heroSec?.body || "Stop giving your teams motivational speeches. Give them a robust behavioral framework they can execute under pressure.";

  const marqueeRow1 = (marqueeSec?.config?.row1 as string) || "Performance | Systems | Culture | Alignment |";
  const marqueeRow2 = (marqueeSec?.config?.row2 as string) || "Decision-making | Leadership | Communication | Strategy |";

  const hiddenLead = hiddenSec?.body || "Companies invest heavily in strategy, software, and market positioning.";
  const hiddenStatement = (hiddenSec?.config?.statement as string) || "But the actual ceiling of your growth is rarely an operational flaw—it is the psychological capacity of your team to handle friction, communicate without ego, and execute together.";

  const premiseTitle = premiseSec?.title || "(01) The Corporate Reality";
  const premiseLead = premiseSec?.body || "Most corporate training fails because it targets symptoms, not systems.";
  const premiseCards = (premiseSec?.config?.cards as any[]) || [
    { title: "The Old Way", body: "Standard workshops provide generic advice, fleeting inspiration, and temporary alignment. Employees return to their desks and immediately revert to their default behavioral patterns because the underlying system was never diagnosed or altered." },
    { title: "The aCRL Approach", body: "We treat corporate culture as an engineering problem. Using the Advanced Cognitive Response Loop (aCRL), we decode the exact structural patterns causing friction in your team, and install a new, measurable operating system for communication and decision-making." }
  ];

  const deliveryTitle = deliverySec?.title || "(02) Delivery Framework";
  const deliveryLead = deliverySec?.body || "How we rewrite team dynamics.";
  const deliveryStages = (deliverySec?.config?.stages as any[]) || stages;

  const storyTitle = storySec?.title || "(03) The ROI of Clarity";
  const storyHeadline = storySec?.body || "When invisible rules become visible, friction disappears.";
  const storyCopy = (storySec?.config?.copy as string) || "Teams do not underperform because they lack talent. They underperform because they are running conflicting behavioral operating systems. We install a shared language that instantly reduces misunderstandings and accelerates execution.";
  const storyQuote = (storySec?.config?.quote as string) || "“A team that understands its own system can solve any business problem. A team that doesn't will make every business problem personal.”";

  const metricsTitle = metricsSec?.title || "(04) The Impact";
  const metricsHeadline = metricsSec?.body || "Measurable structural shifts.";
  const metricsList = (metricsSec?.config?.metrics as string[][]) || metrics;

  const ctaTitle = ctaSec?.title || "(05) Start the Engagement";
  const ctaHeadline = ctaSec?.body || "Ready to upgrade your team's OS?";

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 900px)",
          mobile: "(max-width: 899px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean;
            mobile: boolean;
            reduceMotion: boolean;
          };

          if (!reduceMotion) {
            // 1. Hero Section
            gsap
              .timeline({ defaults: { ease: "power3.out" } })
              .from("[data-hero-kicker]", { autoAlpha: 0, y: 18, duration: 0.55 })
              .from("[data-hero-line]", { autoAlpha: 0, yPercent: 110, stagger: 0.1, duration: 0.9 }, "-=0.2")
              .from("[data-hero-copy]", { autoAlpha: 0, y: 24, duration: 0.7 }, "-=0.45")
              .from("[data-hero-image]", { autoAlpha: 0, y: 40, scale: 0.96, duration: 1.1 }, "-=0.8");

            if (desktop) {
              gsap.to("[data-hero-image]", {
                yPercent: 10,
                ease: "none",
                scrollTrigger: {
                  trigger: "[data-hero]",
                  start: "top top",
                  end: "bottom top",
                  scrub: true,
                },
              });
            }

            // 2. Marquee Section
            gsap.fromTo("[data-marquee-row-1]", 
              { xPercent: 0 },
              {
                xPercent: -15,
                ease: "none",
                scrollTrigger: {
                  trigger: `.${styles.marqueeSection}`,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              }
            );

            gsap.fromTo("[data-marquee-row-2]", 
              { xPercent: -15 },
              {
                xPercent: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: `.${styles.marqueeSection}`,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              }
            );

            // 2.8 Hidden Variable Reveal
            gsap.from("[data-hidden-reveal]", {
              autoAlpha: 0,
              y: 40,
              duration: 1.2,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-hidden-variable]",
                start: "top 72%",
              },
            });

            const hiddenTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: "[data-hidden-variable]",
                start: "top top",
                end: "+=150%",
                pin: true,
                scrub: 1,
              },
            });

            hiddenTimeline.to("[data-hidden-char]", {
              opacity: 1,
              stagger: 0.1,
              ease: "none",
            })
            .to("[data-hidden-cta]", {
              opacity: 1,
              y: -10,
              duration: 4,
              ease: "power2.out",
            });

            // 2.5 The Premise Text Reveal
            gsap.from("[data-reveal]", {
              autoAlpha: 0,
              y: 45,
              stagger: 0.12,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-belief]",
                start: "top 72%",
              },
            });

            // 3. The Method Section (Sticky Scroll)
            const panels = gsap.utils.toArray<HTMLElement>("[data-stage]");
            gsap.set(panels.slice(1), { autoAlpha: 0, y: 50 });

            const methodTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: "[data-method]",
                start: "top top",
                end: "+=250%",
                pin: true,
                scrub: true,
              },
            });

            panels.forEach((panel, index) => {
              if (index === 0) return;
              methodTimeline
                .to(panels[index - 1], { autoAlpha: 0, y: -45, duration: 0.5 })
                .to(panel, { autoAlpha: 1, y: 0, duration: 0.5 }, "<0.15")
                .to("[data-method-progress]", { scaleY: (index + 1) / panels.length, duration: 0.6 }, "<");
            });

            methodTimeline.to({}, { duration: 0.8 });

            // 4. Parallax Story Section
            gsap.fromTo(
              "[data-parallax-image]",
              { yPercent: -9, scale: 1.08 },
              {
                yPercent: 9,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: "[data-parallax-section]",
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            );

            gsap.from("[data-parallax-reveal]", {
              autoAlpha: 0,
              y: 45,
              stagger: 0.15,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-parallax-section]",
                start: "top 65%",
              },
            });

            // 5. Metrics Fade In
            gsap.from("[data-impact-reveal]", {
              autoAlpha: 0,
              y: 35,
              stagger: 0.1,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-metrics-section]",
                start: "top 75%",
              },
            });

            gsap.from("[data-metric]", {
              autoAlpha: 0,
              y: 35,
              stagger: 0.1,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-metrics-section]",
                start: "top 60%",
              },
            });
          }
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <article ref={rootRef} className={styles.page}>
      
      {/* 1. Hero */}
      <section className={styles.hero} data-hero>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow} data-hero-kicker>
              {heroKicker}
            </p>
            <h1 className={styles.heroTitle}>
              {heroTitleLines.map((line: string, i: number) => (
                <span className={styles.lineClip} key={i}><span data-hero-line>{line}</span></span>
              ))}
            </h1>
            <div className={styles.heroBody} data-hero-copy>
              <p>
                {heroBody}
              </p>
              <button 
                onClick={() => document.getElementById("quote-section")?.scrollIntoView({ behavior: "smooth" })}
                className={styles.lightButton}
              >
                Request Corporate Quote
              </button>
            </div>
          </div>

          <div className={styles.heroImageWrap} data-hero-image>
            <Image
              src="/RammahPortrait1.png"
              alt="Corporate Training with Ahmed Rammah"
              fill
              priority
              sizes="(min-width: 900px) 45vw, 100vw"
              className={styles.heroImage}
            />
          </div>
        </div>
      </section>

      {/* 2. Marquee */}
      <section className={styles.marqueeSection}>
        <div className={styles.marqueeContainer}>
          <div className={styles.marqueeRow} data-marquee-row-1>
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={`r1-${i}`}>{marqueeRow1}</span>
            ))}
          </div>
          <div className={`${styles.marqueeRow} ${styles.marqueeOutline}`} data-marquee-row-2>
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={`r2-${i}`}>{marqueeRow2}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 2.8 The Hidden Variable */}
      <section className={styles.hiddenVariable} data-hidden-variable>
        <p className={styles.hiddenLead} data-hidden-reveal>
          {hiddenLead}
        </p>
        <h2 className={styles.hiddenStatement}>
          {hiddenStatement
            .split("")
            .map((char: string, index: number) => (
              <span key={index} data-hidden-char style={{ opacity: 0.15 }}>
                {char}
              </span>
            ))}
        </h2>
        <div data-hidden-cta style={{ opacity: 0, marginTop: "60px", transform: "translateY(10px)" }}>
          <button 
            onClick={() => document.getElementById("quote-section")?.scrollIntoView({ behavior: "smooth" })}
            className={styles.lightButton}
          >
            Fix the System
          </button>
        </div>
      </section>

      {/* 3. The Problem / Premise */}
      <section className={styles.premise} data-belief>
        <p className={styles.sectionIndex} data-reveal>{premiseTitle}</p>
        <h2 className={styles.premiseLead} data-reveal>
          {premiseLead}
        </h2>
        
        <div className={styles.premiseGrid}>
          {premiseCards.map((card: any, idx: number) => (
            <div className={styles.premiseCard} data-reveal key={idx}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. The Method / Delivery */}
      <section className={styles.delivery} data-method>
        <div className={styles.deliveryHeader}>
          <p className={styles.sectionIndex}>{deliveryTitle}</p>
          <h2>{deliveryLead}</h2>
        </div>
        
        <div className={styles.deliveryBody}>
          <div className={styles.deliveryProgress}>
            <span data-method-progress />
          </div>
          
          <div className={styles.stageStack}>
            {deliveryStages.map((stage: any) => (
              <div className={styles.stage} data-stage key={stage.number}>
                <span>{stage.number}</span>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4.5 Parallax Story / Proof */}
      <section className={styles.parallaxSection} data-parallax-section>
        <div className={styles.parallaxImageFrame}>
          <Image
            src="/hero-final-frame.png"
            alt="Corporate Leadership Training"
            fill
            sizes="(min-width: 900px) 46vw, 100vw"
            className={styles.parallaxImage}
            data-parallax-image
          />
        </div>
        <div className={styles.parallaxCopy}>
          <p className={styles.sectionIndex} data-parallax-reveal>{storyTitle}</p>
          <h2 data-parallax-reveal>{storyHeadline}</h2>
          <p data-parallax-reveal>
            {storyCopy}
          </p>
          <blockquote data-parallax-reveal>
            {storyQuote}
          </blockquote>
        </div>
      </section>

      {/* 4.8 Metrics Section */}
      <section className={styles.metricsSection} data-metrics-section>
        <div className={styles.metricsHeader}>
          <p className={styles.sectionIndex} data-impact-reveal>{metricsTitle}</p>
          <h2 data-impact-reveal>{metricsHeadline}</h2>
        </div>
        <div className={styles.metricsGrid}>
          {metricsList.map((stat: string[]) => (
            <div className={styles.metricCard} data-metric key={stat[0]}>
              <strong>{stat[0]}</strong>
              <span>{stat[1]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 5. CTA / Quote Form */}
      <section id="quote-section" className={styles.cta}>
        <p className={styles.sectionIndex}>{ctaTitle}</p>
        <h2>{ctaHeadline}</h2>
        
        <div className="mt-12 w-full flex justify-center">
          <CorporateQuoteForm />
        </div>
      </section>

    </article>
  );
}
