import { eq, and, desc } from "drizzle-orm";
import { db, pool } from "./client.js";
import {
  adminUsers,
  offeringCategories,
  offerings,
  siteSettings,
  pages,
  pageSections,
  mediaAssets,
  sectionMediaAssignments,
  globalMediaAssignmentSets,
  globalMediaAssignments,
} from "./schema/index.js";
import { env } from "../config/env.js";
import { hashPassword } from "../shared/crypto/password.js";
import { logger } from "../shared/logger/logger.js";

const categories = [
  {
    name: "Personal Sessions",
    slug: "personal-sessions",
    description: "One-to-one coaching and therapy-style sessions.",
    sortOrder: 10,
  },
  {
    name: "Group Programs",
    slug: "group-programs",
    description: "Workshops, webinars, and learning experiences.",
    sortOrder: 20,
  },
  {
    name: "Corporate",
    slug: "corporate",
    description: "Custom training and organizational programs.",
    sortOrder: 30,
  },
] as const;

const offeringSeeds = [
  {
    categorySlug: "personal-sessions",
    title: "1:1 Coaching",
    slug: "1-1-coaching",
    shortDescription: "Decode your psychological code.",
    longDescription:
      "Not generic advice. ICRL-powered deep-dive to map your patterns and rewire your defaults.",
    offeringType: "coaching",
    attendanceMode: "hybrid",
    bookingMode: "paid",
    durationMinutes: 60,
    capacity: 1,
    requiresPayment: true,
    quoteOnly: false,
    sortOrder: 10,
    displayConfig: {
      backgroundColor: "#ffffff",
      textColor: "#0F3B46",
    },
  },
  {
    categorySlug: "personal-sessions",
    title: "Therapy Sessions",
    slug: "therapy-sessions",
    shortDescription: "Root-cause psychology. Not just symptom management.",
    longDescription:
      "Fix the source, not the surface. Evidence-based support blended with ICRL profiling.",
    offeringType: "therapy_session",
    attendanceMode: "hybrid",
    bookingMode: "paid",
    durationMinutes: 60,
    capacity: 1,
    requiresPayment: true,
    quoteOnly: false,
    sortOrder: 20,
    displayConfig: {
      backgroundColor: "#0F3B46",
      textColor: "#FFFFFF",
    },
  },
  {
    categorySlug: "group-programs",
    title: "Workshops",
    slug: "workshops",
    shortDescription: "1 to 3 days. Lasting change.",
    longDescription:
      "Immersive group experiences using live ICRL profiling and zero filler content.",
    offeringType: "workshop",
    attendanceMode: "hybrid",
    bookingMode: "paid",
    durationMinutes: 180,
    capacity: 30,
    requiresPayment: true,
    quoteOnly: false,
    sortOrder: 30,
    displayConfig: {
      backgroundColor: "#0F172A",
      textColor: "#FFFFFF",
    },
  },
  {
    categorySlug: "corporate",
    title: "Corporate Training",
    slug: "corporate-training",
    shortDescription: "Build teams that understand themselves.",
    longDescription:
      "Custom ICRL programs for organizations, from profiling to leadership development.",
    offeringType: "corporate_training",
    attendanceMode: "hybrid",
    bookingMode: "quote_only",
    durationMinutes: 240,
    capacity: 1,
    requiresPayment: false,
    quoteOnly: true,
    sortOrder: 40,
    displayConfig: {
      backgroundColor: "#02040A",
      textColor: "#F2F2F2",
    },
  },
] as const;

const mediaSeeds = [
  {
    key: "homepageHero",
    displayName: "Homepage hero portrait",
    fileName: "hero.png",
    publicUrl: "/hero.png",
    mimeType: "image/png",
    mediaKind: "image",
    altText: "Ahmed Rammah",
    metadata: {},
  },
  {
    key: "loadingVideo",
    displayName: "Loading intro video",
    fileName: "intro-loading.mp4",
    publicUrl: "/videos/intro-loading.mp4",
    mimeType: "video/mp4",
    mediaKind: "video",
    altText: null,
    metadata: {},
  },
  {
    key: "loadingPoster",
    displayName: "Loading intro poster",
    fileName: "intro-loading-poster.jpg",
    publicUrl: "/videos/intro-loading-poster.jpg",
    mimeType: "image/jpeg",
    mediaKind: "image",
    altText: "Ahmed Rammah intro",
    metadata: {},
  },
  {
    key: "aboutHero",
    displayName: "About hero portrait",
    fileName: "about_hero.png",
    publicUrl: "/about_hero.png",
    mimeType: "image/png",
    mediaKind: "image",
    altText: "Ahmed Rammah",
    metadata: {},
  },
  {
    key: "fastCutMobile",
    displayName: "Fast-cut video (mobile)",
    fileName: "about-fastcut-mobile.webm",
    publicUrl: "/videos/about-fastcut-mobile.webm",
    mimeType: "video/webm",
    mediaKind: "video",
    altText: null,
    metadata: {},
  },
  {
    key: "fastCutDesktop",
    displayName: "Fast-cut video (desktop)",
    fileName: "about-fastcut-desktop.webm",
    publicUrl: "/videos/about-fastcut-desktop.webm",
    mimeType: "video/webm",
    mediaKind: "video",
    altText: null,
    metadata: {},
  },
  {
    key: "aboutSupporting",
    displayName: "Systems meet people",
    fileName: "Systems meet people.png",
    publicUrl: "/Systems meet people.png",
    mimeType: "image/png",
    mediaKind: "image",
    altText: "Ahmed Rammah working with people",
    metadata: {},
  },
  {
    key: "acrlRecognitionPortrait",
    displayName: "Ahmed Rammah — official aCRL profile",
    fileName: "acrl-ahmed-rammah.webp",
    publicUrl: "/acrl-ahmed-rammah.webp",
    mimeType: "image/webp",
    mediaKind: "image",
    altText: "Ahmed Sherif Rammah on the official aCRL Academy website",
    width: 300,
    height: 300,
    metadata: {
      sourceUrl: "https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png",
      officialPage: "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/",
    },
  },
  {
    key: "rammahPortrait",
    displayName: "Ahmed Rammah portrait",
    fileName: "RammahPortrait1.png",
    publicUrl: "/RammahPortrait1.png",
    mimeType: "image/png",
    mediaKind: "image",
    altText: "Ahmed Rammah",
    metadata: {},
  },
  {
    key: "corporateParallax",
    displayName: "Corporate training parallax",
    fileName: "hero-final-frame.png",
    publicUrl: "/hero-final-frame.png",
    mimeType: "image/png",
    mediaKind: "image",
    altText: "Ahmed Rammah corporate training",
    metadata: {},
  },
  {
    key: "servicesAnimation",
    displayName: "Services frame animation",
    fileName: "services-frames",
    publicUrl: "/services-frames/frame0001.webp?v=services_v1",
    mimeType: "application/vnd.rammah.animation+json",
    mediaKind: "animation_bundle",
    altText: null,
    metadata: {
      frameCount: 168,
      fileExtension: "webp",
      urlPattern: "/services-frames/frame{frame}.webp?v=services_v1",
    },
  },
] as const;

const globalMediaSeeds = [
  {
    definitionKey: "loadingMatchCut",
    slots: [
      { slotKey: "video", assetKey: "loadingVideo", decorative: true },
      { slotKey: "poster", assetKey: "loadingPoster", decorative: true },
      { slotKey: "matchedHeroFrame", assetKey: "homepageHero", decorative: true },
    ],
  },
  {
    definitionKey: "navigation",
    slots: [
      { slotKey: "desktopMenuVideo", assetKey: "fastCutDesktop", decorative: true },
      { slotKey: "mobileMenuVideo", assetKey: "fastCutMobile", decorative: true },
    ],
  },
  {
    definitionKey: "seo",
    slots: [{ slotKey: "defaultOgImage", assetKey: "homepageHero", decorative: false }],
  },
  {
    definitionKey: "homepage",
    slots: [
      { slotKey: "heroPortrait", assetKey: "homepageHero", decorative: false },
      { slotKey: "servicesAnimation", assetKey: "servicesAnimation", decorative: true },
    ],
  },
  {
    definitionKey: "about",
    slots: [
      { slotKey: "heroImage", assetKey: "aboutHero", decorative: false },
      { slotKey: "desktopFastCutVideo", assetKey: "fastCutDesktop", decorative: true },
      { slotKey: "mobileFastCutVideo", assetKey: "fastCutMobile", decorative: true },
      { slotKey: "supportingImage", assetKey: "aboutSupporting", decorative: false },
    ],
  },
  {
    definitionKey: "corporateTraining",
    slots: [
      { slotKey: "portrait", assetKey: "rammahPortrait", decorative: false },
      { slotKey: "parallaxImage", assetKey: "corporateParallax", decorative: false },
    ],
  },
  {
    definitionKey: "serviceDetail",
    slots: [{ slotKey: "portrait", assetKey: "rammahPortrait", decorative: false }],
  },
] as const;

const seedManagedMedia = async () => {
  const assetIds = new Map<string, string>();
  for (const asset of mediaSeeds) {
    const [existing] = await db.select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.sourceType, "external"), eq(mediaAssets.publicUrl, asset.publicUrl)))
      .limit(1);
    const values = {
      displayName: asset.displayName,
      fileName: asset.fileName,
      publicUrl: asset.publicUrl,
      mimeType: asset.mimeType,
      mediaKind: asset.mediaKind,
      sourceType: "external" as const,
      storageKey: null,
      altText: asset.altText,
      sizeBytes: 0,
      width: "width" in asset ? asset.width : null,
      height: "height" in asset ? asset.height : null,
      metadata: asset.metadata,
      processingState: "ready" as const,
      processingError: null,
      status: "published" as const,
      updatedAt: new Date(),
    };
    const [saved] = existing
      ? await db.update(mediaAssets).set(values).where(eq(mediaAssets.id, existing.id)).returning({ id: mediaAssets.id })
      : await db.insert(mediaAssets).values(values).returning({ id: mediaAssets.id });
    assetIds.set(asset.key, saved.id);
  }

  for (const group of globalMediaSeeds) {
    let [assignmentSet] = await db.select({ id: globalMediaAssignmentSets.id })
      .from(globalMediaAssignmentSets)
      .where(and(
        eq(globalMediaAssignmentSets.definitionKey, group.definitionKey),
        eq(globalMediaAssignmentSets.status, "published"),
      ))
      .limit(1);
    if (!assignmentSet) {
      const [latest] = await db.select({ version: globalMediaAssignmentSets.version })
        .from(globalMediaAssignmentSets)
        .where(eq(globalMediaAssignmentSets.definitionKey, group.definitionKey))
        .orderBy(desc(globalMediaAssignmentSets.version))
        .limit(1);
      [assignmentSet] = await db.insert(globalMediaAssignmentSets).values({
        definitionKey: group.definitionKey,
        version: (latest?.version ?? 0) + 1,
        status: "published",
        publishedAt: new Date(),
      }).returning({ id: globalMediaAssignmentSets.id });
    }

    for (const slot of group.slots) {
      const mediaAssetId = assetIds.get(slot.assetKey);
      if (!mediaAssetId) throw new Error(`Missing seeded media asset ${slot.assetKey}`);
      await db.insert(globalMediaAssignments).values({
        assignmentSetId: assignmentSet.id,
        slotKey: slot.slotKey,
        mediaAssetId,
        sortOrder: 0,
        decorative: slot.decorative,
      }).onConflictDoUpdate({
        target: [
          globalMediaAssignments.assignmentSetId,
          globalMediaAssignments.slotKey,
          globalMediaAssignments.sortOrder,
        ],
        set: { mediaAssetId, decorative: slot.decorative, updatedAt: new Date() },
      });
    }
  }

  return assetIds;
};

const seed = async () => {
  logger.info("Seeding base data");

  const [existingSettings] = await db
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .limit(1);

  if (!existingSettings) {
    await db.insert(siteSettings).values({
      siteName: "Ahmed Ramah Coaching Platform",
      defaultLocale: "en",
      bookingDefaultTimezone: "Africa/Cairo",
    });
  }

  if (env.ADMIN_SEED_EMAIL && env.ADMIN_SEED_PASSWORD) {
    const passwordHash = await hashPassword(env.ADMIN_SEED_PASSWORD);

    await db
      .insert(adminUsers)
      .values({
        name: env.ADMIN_SEED_NAME,
        email: env.ADMIN_SEED_EMAIL.toLowerCase(),
        passwordHash,
        role: "owner",
        status: "active",
      })
      .onConflictDoUpdate({
        target: adminUsers.email,
        set: {
          name: env.ADMIN_SEED_NAME,
          role: "owner",
          status: "active",
          updatedAt: new Date(),
        },
      });
  }

  const categoryBySlug = new Map<string, string>();

  for (const category of categories) {
    const [savedCategory] = await db
      .insert(offeringCategories)
      .values({
        ...category,
        status: "published",
      })
      .onConflictDoUpdate({
        target: offeringCategories.slug,
        set: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          status: "published",
          updatedAt: new Date(),
        },
      })
      .returning({
        id: offeringCategories.id,
        slug: offeringCategories.slug,
      });

    categoryBySlug.set(savedCategory.slug, savedCategory.id);
  }

  for (const offering of offeringSeeds) {
    const categoryId = categoryBySlug.get(offering.categorySlug);

    if (!categoryId) {
      throw new Error(`Missing category for ${offering.categorySlug}`);
    }

    await db
      .insert(offerings)
      .values({
        categoryId,
        title: offering.title,
        slug: offering.slug,
        shortDescription: offering.shortDescription,
        longDescription: offering.longDescription,
        offeringType: offering.offeringType,
        attendanceMode: offering.attendanceMode,
        bookingMode: offering.bookingMode,
        durationMinutes: offering.durationMinutes,
        capacity: offering.capacity,
        requiresPayment: offering.requiresPayment,
        quoteOnly: offering.quoteOnly,
        sortOrder: offering.sortOrder,
        displayConfig: offering.displayConfig,
        status: "published",
      })
      .onConflictDoUpdate({
        target: offerings.slug,
        set: {
          categoryId,
          title: offering.title,
          shortDescription: offering.shortDescription,
          longDescription: offering.longDescription,
          offeringType: offering.offeringType,
          attendanceMode: offering.attendanceMode,
          bookingMode: offering.bookingMode,
          durationMinutes: offering.durationMinutes,
          capacity: offering.capacity,
          requiresPayment: offering.requiresPayment,
          quoteOnly: offering.quoteOnly,
          sortOrder: offering.sortOrder,
          displayConfig: offering.displayConfig,
          status: "published",
          updatedAt: new Date(),
        },
      });
  }

  const seedPages = [
    {
      slug: "home",
      title: "Home",
      template: "home",
      sections: [
        { sectionType: "hero", title: "Ahmed Rammah", body: "I don't just coach. I map your psychological system, find the bugs and rewrite the code", config: { roles: ["Engineer", "Systematizer", "Trainer", "Coach"] }, sortOrder: 10 },
        { sectionType: "statement", title: "REWRITE YOUR MIND", body: null, config: {}, sortOrder: 20 },
        { sectionType: "methodology", title: "Systems over motivation.", body: "The Architecture of Change", config: { steps: [{ title: "1. MAP", desc: "I scan your psychological system. Uncovering deep patterns, hidden loops, and the root structure of your current operating model." }, { title: "2. DEBUG", desc: "We locate the exact errors in the code. The limiting beliefs, the fears, and the emotional bottlenecks that are crashing your progress." }, { title: "3. REWRITE", desc: "We deploy the new system. Installing robust mental models, unshakeable confidence, and extreme clarity to scale your life to the next tier." }] }, sortOrder: 30 },
        { sectionType: "about_preview", title: "The Man Behind the Method", body: "Ramah combines 10+ years in IT engineering with deep psychological training — to build systems that actually change behavior, not just mindset.", config: { headline: ["Not Just a", "Life Coach."], stats: [{ number: "1,500+", label: "Profiles Analyzed" }, { number: "1st", label: "aCRL Master Trainer" }, { number: "22+", label: "Countries" }] }, sortOrder: 40 },
        { sectionType: "services", title: "SERVICES", body: null, config: {}, sortOrder: 50 },
        { sectionType: "cta", title: "Meet Ahmed Ramah", body: "from engineering code to decoding the human mind.", config: { ctaText: "Get Free 1 to 1", subscribeTitle: "Subscribe for Free Courses & More" }, sortOrder: 60 }
      ]
    },
    {
      slug: "about",
      title: "About Ahmed Rammah",
      template: "about",
      sections: [
        { sectionType: "hero", title: "Ahmed Rammah", body: "I spent years understanding technical systems. Then I turned to the most complex system of all: human behavior.", config: { kicker: "Engineer / Systematizer / Trainer / Coach", aside: "Based in Cairo\nWorking globally" }, sortOrder: 10 },
        { sectionType: "marquee", title: null, body: null, config: { row1: "Engineer | Systematizer | Trainer | Coach |", row2: "First & Only aCRL Master Trainer in the Middle East |" }, sortOrder: 20 },
        { sectionType: "premise", title: "(01) The premise", body: "Most people do not need more motivation.", config: { statement: "They need to see the invisible system that keeps making the decision before they do.", foot: "aCRL turns that system into a map: structured enough to understand, practical enough to change." }, sortOrder: 30 },
        { sectionType: "method", title: "(02) The method", body: "One operating system. Three deliberate moves. One exclusive standard.", config: { statement: "Decode before\nyou change.", stages: [{ number: "01", title: "Map the system", body: "We surface the hidden rules behind your decisions, relationships, stress responses, and repeated outcomes." }, { number: "02", title: "Decode the pattern", body: "We separate the trigger from the behavior and identify the loop that keeps rebuilding the same result." }, { number: "03", title: "Rewrite the response", body: "We replace insight-only advice with a practical operating system you can use under real pressure." }, { number: "04", title: "Regional exclusivity", body: "Applied for the first time in the Middle East and Arab World by the region's first and only aCRL Master Trainer." }] }, sortOrder: 40 },
        { sectionType: "story", title: "(03) Systems meet people", body: "Built by an engineer. Tested in real human rooms.", config: { copy: "The method was not designed as theory. It grew through coaching, training, facilitation, and more than 1,500 profiles where the same truth kept appearing: behavior becomes less mysterious when its structure is visible.", quote: "“Clarity is not the finish line. It is the point where better choices finally become available.”" }, sortOrder: 50 },
        { sectionType: "recognition", title: "(04) Official recognition", body: "Officially listed among aCRL® Cooperation & Project Partners — Middle East.", config: { name: "Ahmed Sherif Rammah", roles: "Supervisor aCRL® Middle East · Master Trainer aCRL®", sourceLabel: "acrl-academy.eu", profileBadge: "Official profile", cta: { label: "View Ahmed on aCRL® Academy", url: "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah" } }, sortOrder: 60 },
        { sectionType: "reach", title: "(05) The reach", body: "One language for human patterns. Across borders.", config: { pioneerText: "Bringing the aCRL methodology to the Arab World for the first time. The absolute pioneer and sole Master Trainer in the region.", stats: [["10+", "years in engineering and systems thinking"], ["1,500+", "behavioral profiles analyzed"], ["22+", "countries reached through training"]] }, sortOrder: 70 },
        { sectionType: "cta", title: "(06) Start the work", body: "Your patterns already tell a story. Let's read it properly.", config: {}, sortOrder: 80 }
      ]
    },
    {
      slug: "corporate-training",
      title: "Corporate Training & Consultancy",
      template: "corporate",
      sections: [
        { sectionType: "hero", title: "Change the operating system.", body: "Stop giving your teams motivational speeches. Give them a robust behavioral framework they can execute under pressure.", config: { kicker: "Corporate Training & Consultancy" }, sortOrder: 10 },
        { sectionType: "marquee", title: null, body: null, config: { row1: "Performance | Systems | Culture | Alignment |", row2: "Decision-making | Leadership | Communication | Strategy |" }, sortOrder: 20 },
        { sectionType: "hidden_variable", title: null, body: "Companies invest heavily in strategy, software, and market positioning.", config: { statement: "But the actual ceiling of your growth is rarely an operational flaw—it is the psychological capacity of your team to handle friction, communicate without ego, and execute together." }, sortOrder: 30 },
        { sectionType: "premise", title: "(01) The Corporate Reality", body: "Most corporate training fails because it targets symptoms, not systems.", config: { cards: [{ title: "The Old Way", body: "Standard workshops provide generic advice, fleeting inspiration, and temporary alignment. Employees return to their desks and immediately revert to their default behavioral patterns because the underlying system was never diagnosed or altered." }, { title: "The aCRL Approach", body: "We treat corporate culture as an engineering problem. Using the Advanced Cognitive Response Loop (aCRL), we decode the exact structural patterns causing friction in your team, and install a new, measurable operating system for communication and decision-making." }] }, sortOrder: 40 },
        { sectionType: "delivery", title: "(02) Delivery Framework", body: "How we rewrite team dynamics.", config: { stages: [{ number: "01", title: "Diagnostic Phase", body: "We do not start with slides. We start by auditing your team's current operating system, identifying behavioral bottlenecks, communication silos, and decision-making friction." }, { number: "02", title: "System Design", body: "Based on the diagnostic, we map a tailored aCRL framework for your company. We align behavioral targets with your actual KPIs and business objectives." }, { number: "03", title: "The Intervention", body: "Intensive, scenario-based training that replaces outdated motivation tactics with structural behavioral change. We train your teams to decode themselves and each other." }, { number: "04", title: "Sustained Integration", body: "Follow-up mapping and leadership coaching to ensure the new operating system becomes the default culture, not just a temporary spike in enthusiasm." }] }, sortOrder: 50 },
        { sectionType: "story", title: "(03) The ROI of Clarity", body: "When invisible rules become visible, friction disappears.", config: { copy: "Teams do not underperform because they lack talent. They underperform because they are running conflicting behavioral operating systems. We install a shared language that instantly reduces misunderstandings and accelerates execution.", quote: "“A team that understands its own system can solve any business problem. A team that doesn't will make every business problem personal.”" }, sortOrder: 60 },
        { sectionType: "metrics", title: "(04) The Impact", body: "Measurable structural shifts.", config: { metrics: [["Alignment", "Shared behavioral language"], ["Friction", "Reduced communication silos"], ["Decisions", "Faster, systemic problem solving"]] }, sortOrder: 70 },
        { sectionType: "cta", title: "(05) Start the Engagement", body: "Ready to upgrade your team's OS?", config: {}, sortOrder: 80 }
      ]
    },
    {
      slug: "services",
      title: "Services",
      template: "services",
      sections: [
        { sectionType: "hero", title: "Services", body: null, config: {}, sortOrder: 10 },
        { sectionType: "marquee", title: null, body: null, config: {}, sortOrder: 20 },
        { sectionType: "listing_intro", title: null, body: null, config: {}, sortOrder: 30 }
      ]
    },
    {
      slug: "contact",
      title: "Contact",
      template: "contact",
      sections: [
        { sectionType: "hero", title: "Start with context.", body: "Send the problem, the pattern, or the program you want to build. The reply can route you to a session, quote, or the right next step.", config: {}, sortOrder: 10 },
        { sectionType: "details", title: null, body: null, config: {}, sortOrder: 20 },
        { sectionType: "cta", title: null, body: null, config: {}, sortOrder: 30 }
      ]
    }
  ];

  for (const page of seedPages) {
    const [savedPage] = await db
      .insert(pages)
      .values({
        slug: page.slug,
        title: page.title,
        template: page.template,
        status: "published",
      })
      .onConflictDoUpdate({
        target: pages.slug,
        set: {
          title: page.title,
          template: page.template,
          status: "published",
          updatedAt: new Date(),
        },
      })
      .returning({ id: pages.id });

    for (const section of page.sections) {
      const [existingSection] = await db
        .select({ id: pageSections.id })
        .from(pageSections)
        .where(
          and(
            eq(pageSections.pageId, savedPage.id),
            eq(pageSections.sectionType, section.sectionType)
          )
        );

      if (existingSection) {
        await db
          .update(pageSections)
          .set({
            title: section.title,
            body: section.body,
            config: section.config,
            sortOrder: section.sortOrder,
            status: "published",
            updatedAt: new Date(),
          })
          .where(eq(pageSections.id, existingSection.id));
      } else {
        await db.insert(pageSections).values({
          pageId: savedPage.id,
          sectionType: section.sectionType,
          title: section.title,
          body: section.body,
          config: section.config,
          sortOrder: section.sortOrder,
          status: "published",
        });
      }
    }
  }

  const assetIds = await seedManagedMedia();
  const [recognitionSection] = await db
    .select({ id: pageSections.id })
    .from(pageSections)
    .innerJoin(pages, eq(pages.id, pageSections.pageId))
    .where(and(
      eq(pages.slug, "about"),
      eq(pageSections.sectionType, "recognition"),
    ))
    .limit(1);
  const recognitionPortraitId = assetIds.get("acrlRecognitionPortrait");

  if (!recognitionSection || !recognitionPortraitId) {
    throw new Error("Missing seeded aCRL recognition section or portrait");
  }

  await db.insert(sectionMediaAssignments).values({
    pageSectionId: recognitionSection.id,
    slotKey: "portrait",
    mediaAssetId: recognitionPortraitId,
    sortOrder: 0,
    decorative: false,
  }).onConflictDoNothing();

  const publishedOfferings = await db
    .select({ slug: offerings.slug, title: offerings.title })
    .from(offerings)
    .where(eq(offerings.status, "published"));

  logger.info("Seed completed", {
    offerings: publishedOfferings,
    adminSeeded: Boolean(env.ADMIN_SEED_EMAIL && env.ADMIN_SEED_PASSWORD),
  });
};

seed()
  .catch((error) => {
    logger.error("Seed failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
