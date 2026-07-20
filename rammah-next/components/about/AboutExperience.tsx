"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import AboutGlobe from "./AboutGlobe";
import { ShapeBlue } from "../aCRLShapes";
import styles from "./AboutExperience.module.css";
import { findPublicSection, type PublicPage } from "@/lib/api/cms";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const stages = [
  {
    number: "01",
    title: "Map the system",
    body: "We surface the hidden rules behind your decisions, relationships, stress responses, and repeated outcomes.",
  },
  {
    number: "02",
    title: "Decode the pattern",
    body: "We separate the trigger from the behavior and identify the loop that keeps rebuilding the same result.",
  },
  {
    number: "03",
    title: "Rewrite the response",
    body: "We replace insight-only advice with a practical operating system you can use under real pressure.",
  },
  {
    number: "04",
    title: "Regional exclusivity",
    body: "Applied for the first time in the Middle East and Arab World by the region's first and only aCRL Master Trainer.",
  },
];

const proof = [
  ["10+", "years in engineering and systems thinking"],
  ["1,500+", "behavioral profiles analyzed"],
  ["22+", "countries reached through training"],
];

export default function AboutExperience({ page }: { page?: PublicPage | null }) {
  const rootRef = useRef<HTMLElement>(null);

  const heroSec = findPublicSection(page, "hero");
  const marqueeSec = findPublicSection(page, "marquee");
  const premiseSec = findPublicSection(page, "premise");
  const methodSec = findPublicSection(page, "method");
  const storySec = findPublicSection(page, "story");
  const reachSec = findPublicSection(page, "reach");
  const ctaSec = findPublicSection(page, "cta");

  const heroKicker = (heroSec?.config?.kicker as string) || "Engineer / Systematizer / Trainer / Coach";
  const heroTitle = heroSec?.title || "Ahmed Rammah";
  const heroBody = heroSec?.body || "I spent years understanding technical systems. Then I turned to the most complex system of all: human behavior.";
  const heroAside = (heroSec?.config?.aside as string) || "Based in Cairo\nWorking globally";

  const marqueeRow1 = (marqueeSec?.config?.row1 as string) || "Engineer | Systematizer | Trainer | Coach |";
  const marqueeRow2 = (marqueeSec?.config?.row2 as string) || "First & Only aCRL Master Trainer in the Middle East |";

  const premiseTitle = premiseSec?.title || "(01) The premise";
  const premiseLead = premiseSec?.body || "Most people do not need more motivation.";
  const premiseStatement = (premiseSec?.config?.statement as string) || "They need to see the invisible system that keeps making the decision before they do.";
  const premiseFoot = (premiseSec?.config?.foot as string) || "aCRL turns that system into a map: structured enough to understand, practical enough to change.";

  const methodTitle = methodSec?.title || "(02) The method";
  const methodLead = methodSec?.body || "One operating system. Three deliberate moves. One exclusive standard.";
  const methodStatement = (methodSec?.config?.statement as string) || "Decode before\nyou change.";
  const methodStages = (methodSec?.config?.stages as any[]) || stages;

  const storyTitle = storySec?.title || "(03) Systems meet people";
  const storyHeadline = storySec?.body || "Built by an engineer. Tested in real human rooms.";
  const storyCopy = (storySec?.config?.copy as string) || "The method was not designed as theory. It grew through coaching, training, facilitation, and more than 1,500 profiles where the same truth kept appearing: behavior becomes less mysterious when its structure is visible.";
  const storyQuote = (storySec?.config?.quote as string) || "“Clarity is not the finish line. It is the point where better choices finally become available.”";

  const reachTitle = reachSec?.title || "(04) The reach";
  const reachHeadline = reachSec?.body || "One language for human patterns. Across borders.";
  const reachPioneer = (reachSec?.config?.pioneerText as string) || "Bringing the aCRL methodology to the Arab World for the first time. The absolute pioneer and sole Master Trainer in the region.";
  const reachStats = (reachSec?.config?.stats as string[][]) || proof;

  const ctaTitle = ctaSec?.title || "(05) Start the work";
  const ctaHeadline = ctaSec?.body || "Your patterns already tell a story. Let's read it properly.";

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
              .from("[data-hero-image]", { autoAlpha: 0, y: 70, scale: 0.94, duration: 1.1 }, "-=0.8");

            gsap.to("[data-hero-image]", {
              yPercent: 14,
              ease: "none",
              scrollTrigger: {
                trigger: "[data-hero]",
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            });

            // 1.5 Marquee Section
            gsap.fromTo("[data-marquee-row-1]", 
              { xPercent: -15 },
              {
                xPercent: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: `.${styles.marqueeSection}`,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1,
                },
              }
            );

            gsap.fromTo("[data-marquee-row-2]", 
              { xPercent: 0 },
              {
                xPercent: -15,
                ease: "none",
                scrollTrigger: {
                  trigger: `.${styles.marqueeSection}`,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1,
                },
              }
            );

            // 2. Belief Section (01 The premise)
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

            const beliefTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: "[data-belief]",
                start: "top top",
                end: "+=150%",
                pin: true,
                scrub: 1,
              },
            });

            beliefTimeline.to("[data-char]", {
              opacity: 1,
              stagger: 0.1,
              ease: "none",
            });

            // 3. Method Section (02 The method)
            const panels = gsap.utils.toArray<HTMLElement>("[data-stage]");
            gsap.set(panels.slice(1), { autoAlpha: 0, y: 50 });

            const methodTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: "[data-method]",
                start: "top top",
                end: "+=220%",
                pin: true,
                scrub: true,
              },
            });

            panels.forEach((panel, index) => {
              if (index === 0) return;
              methodTimeline
                .to(panels[index - 1], { autoAlpha: 0, y: -45, duration: 0.5 })
                .to(panel, { autoAlpha: 1, y: 0, duration: 0.5 }, "<0.15")
                .to("[data-method-progress]", { scaleX: (index + 1) / panels.length, duration: 0.6 }, "<");
            });

            methodTimeline.to({}, { duration: 0.8 });

            // 4. Story Section (03 Systems meet people)
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

            // 5. World Section (04 The reach)
            const globeTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: "[data-world]",
                start: "top top",
                end: "+=150%",
                pin: true,
                scrub: true,
              },
            });
            globeTimeline
              .fromTo("[data-globe]", { scale: 0.62, yPercent: 24 }, { scale: 2.15, yPercent: -4, ease: "none" })
              .from("[data-stat]", { autoAlpha: 0, y: 35, stagger: 0.08, duration: 0.28 }, 0.2);
          }
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <article ref={rootRef} className={styles.page}>
      <section className={styles.hero} data-hero>
        <div className={styles.exclusiveBadgeWrap}>
          <svg viewBox="0 0 100 100" className={styles.rotatingBadge}>
            <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
            <text>
              <textPath href="#circlePath" startOffset="0%" fill="currentColor" fontSize="7.8" letterSpacing="3" fontWeight="600">
                1ST & ONLY aCRL MASTER TRAINER IN THE MIDDLE EAST • 
              </textPath>
            </text>
          </svg>
          <div className={styles.badgeIcon}>
            <ShapeBlue className="w-6 h-6" />
          </div>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow} data-hero-kicker>
              {heroKicker}
            </p>
            <h1 className={styles.heroTitle} aria-label={heroTitle}>
              <span className={styles.lineClip}><span data-hero-line>{heroTitle.split(" ")[0] || "Ahmed"}</span></span>
              <span className={styles.lineClip}><span data-hero-line>{heroTitle.split(" ")[1] || "Rammah"}</span></span>
            </h1>
            <div className={styles.heroBody} data-hero-copy>
              <p>
                {heroBody}
              </p>
              <Link href="/booking" className={`${styles.lightButton} btn-fill-hover btn-fill-light`}>Book a session</Link>
            </div>
          </div>

          <div className={styles.heroPortrait} data-hero-image>
            <Image
              src="/about_hero.png"
              alt="Ahmed Rammah"
              fill
              priority
              sizes="(min-width: 900px) 48vw, 100vw"
              className={styles.portraitImage}
            />
          </div>

          <p className={styles.heroAside} style={{ whiteSpace: "pre-wrap" }}>{heroAside}</p>
        </div>
      </section>

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

      <section className={styles.belief} data-belief>
        <p className={styles.sectionIndex} data-reveal>{premiseTitle}</p>
        <p className={styles.beliefLead} data-reveal>
          {premiseLead}
        </p>
        <h2 className={styles.beliefStatement}>
          {premiseStatement
            .split("")
            .map((char: string, index: number) => (
              <span key={index} data-char style={{ opacity: 0.15 }}>
                {char}
              </span>
            ))}
        </h2>
        <p className={styles.beliefFoot} data-reveal>
          {premiseFoot}
        </p>
      </section>

      <section className={styles.method} data-method>
        <div className={styles.methodTopline}>
          <p className={styles.sectionIndex}>{methodTitle}</p>
          <p>{methodLead}</p>
        </div>
        <div className={styles.methodBody}>
          <div className={styles.methodStatement}>
            <p style={{ whiteSpace: "pre-wrap" }}>{methodStatement}</p>
            <div className={styles.progressTrack}>
              <span data-method-progress />
            </div>
          </div>
          <div className={styles.stageStack}>
            {methodStages.map((stage: any) => (
              <div className={styles.stage} data-stage key={stage.number}>
                <span>{stage.number}</span>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.story} data-parallax-section>
        <div className={styles.storyImageFrame}>
          <Image
            src="/Systems meet people.png"
            alt="Ahmed Rammah during a training session"
            fill
            sizes="(min-width: 900px) 46vw, 100vw"
            className={styles.storyImage}
            data-parallax-image
          />
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.sectionIndex}>{storyTitle}</p>
          <h2>{storyHeadline}</h2>
          <p>
            {storyCopy}
          </p>
          <blockquote>
            {storyQuote}
          </blockquote>
        </div>
      </section>

      <section className={styles.world} data-world>
        <div className={styles.worldHeader}>
          <p className={styles.sectionIndex}>{reachTitle}</p>
          <h2>{reachHeadline}</h2>
          <p className={styles.worldPioneerText}>
            {reachPioneer}
          </p>
        </div>
        <div className={styles.globeWrap} data-globe>
          <AboutGlobe />
        </div>
        <div className={styles.stats}>
          {reachStats.map((stat: string[]) => (
            <div className={styles.stat} data-stat key={stat[0]}>
              <strong>{stat[0]}</strong>
              <span>{stat[1]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.cta}>
        <p className={styles.sectionIndex}>{ctaTitle}</p>
        <h2>{ctaHeadline}</h2>
        <div className={styles.ctaActions}>
          <Link href="/booking" className={`${styles.darkButton} btn-fill-hover btn-fill-dark`}>Book a session</Link>
          <Link href="/services" className={`${styles.textLink} link-arrow-hover`}>Explore the work <span className="arrow" aria-hidden="true">→</span></Link>
        </div>
      </section>
    </article>
  );
}
