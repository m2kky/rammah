"use client";

import { useState } from "react";
import type { PublicPageSection } from "@/lib/api/cms";
import { getRecognitionContent } from "@/lib/api/cms-content";
import styles from "./RecognitionSection.module.css";

export function RecognitionSection({ section }: { section: PublicPageSection | null }) {
  const content = getRecognitionContent(section);
  const [imageFailed, setImageFailed] = useState(false);
  const headingId = `acrl-recognition-${section?.id ?? "fallback"}`;

  return (
    <section className={styles.section} data-recognition aria-labelledby={headingId}>
      <div className={`${styles.inner} ${imageFailed ? styles.withoutPortrait : ""}`}>
        {!imageFailed ? (
          <div className={styles.visual} data-recognition-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.portrait.publicUrl}
              alt={content.portrait.decorative ? "" : content.portrait.altText ?? ""}
              width={content.portrait.width ?? 300}
              height={content.portrait.height ?? 300}
              className={styles.portrait}
              onError={() => setImageFailed(true)}
            />
            <span className={styles.badge}>{content.profileBadge}</span>
          </div>
        ) : null}

        <div className={styles.content}>
          <div className={styles.topline} data-recognition-reveal>
            <span>{content.sectionLabel}</span>
            <span>{content.sourceLabel}</span>
          </div>
          <h2 id={headingId} data-recognition-reveal>{content.name}</h2>
          <p className={styles.statement} data-recognition-reveal>{content.statement}</p>
          <p className={styles.roles} data-recognition-reveal>{content.roles}</p>
          <a
            href={content.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
            data-recognition-reveal
          >
            <span>{content.ctaLabel}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
