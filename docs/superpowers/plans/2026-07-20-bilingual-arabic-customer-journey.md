# Bilingual Arabic Customer Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete public Rammah customer journey in English and Arabic while preserving existing English URLs and sharing one trusted booking, pricing, payment, provider, and operational state.

**Architecture:** Existing unprefixed routes remain English and mirrored `/ar` routes render the same locale-aware components in RTL. Express receives an explicit `en | ar` locale, joins additive per-resource translation tables, and snapshots the customer locale on submissions; business entities are never duplicated by language. Arabic stays behind `AR_PUBLIC_ENABLED=false` through G0-G5 and the signed staging soak, is enabled during the controlled production release, and is then validated by G6 canary with an independent disable path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Express, Zod, Drizzle ORM, PostgreSQL, Vitest, Testing Library, Playwright, existing GSAP/Motion stack, Resend, Kashier, Google Calendar.

## Global Constraints

- Complete `REPO-01` through `REPO-05`, `SEC-01` through `SEC-07`, and `TEST-01`, `TEST-02`, `TEST-04`, and `TEST-05` from `docs/05-project-plan/Production-Readiness-Execution-Plan.md` before Task 1.
- Complete `TEST-09` before Task 5 so clean/upgrade migration commands and destructive-migration checks exist.
- Complete `TEST-10` before Task 8 so OpenAPI drift checks exist before localized contracts are added.
- Complete `FEAT-01`, `FEAT-02`, and `FEAT-08` before Task 10 so quote, contact, and newsletter have real public/admin modules.
- Complete `FEAT-10` and `FEAT-13` before Task 9 so localization targets the final pricing/offering lifecycle contract rather than an incomplete one.
- Complete `SEC-10` and `SEC-11` before Task 10 so retention/deletion rules and immutable consent evidence exist before localized consent is accepted.
- Complete `JOB-01` through `JOB-03` and `FEAT-06` before Task 11 so customer email is delivered through the transactional outbox worker and the approved payment-failure/recovery journey exists.
- Complete `FEAT-07`, `FEAT-11`, and `FEAT-12` before Task 15 so bilingual authoring reuses the approved media/rich-text workflows and the complete admin control plane.
- Preserve every existing English URL; Arabic public URLs use `/ar`.
- `/admin` stays English but edits both locales.
- Supported public locales are exactly `en` and `ar`; human Arabic formatting uses `ar-EG`.
- Do not auto-redirect from browser language, IP, country, or `Accept-Language`.
- Do not duplicate offerings, prices, slots, holds, bookings, payments, or provider records by locale.
- Do not trust locale for authentication, price, capacity, payment, or callback verification.
- No silent English fallback inside a published Arabic page or required Arabic email.
- Store money in integer minor units and timestamps in the existing machine format; locale changes display only.
- Arabic is controlled by `AR_PUBLIC_ENABLED`; it defaults to `false` and production preflight blocks unsafe enablement.
- All schema work is additive first; do not remove existing English columns in this plan.
- Every code task follows red-green-refactor and ends with a focused commit.
- The approved design is `docs/superpowers/specs/2026-07-20-bilingual-arabic-customer-journey-design.md`.

---

## File and Responsibility Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Shared backend locale | `rammah-api/src/shared/i18n/public-locale.ts` | Strict locale schema and type for routes/services/jobs |
| Shared frontend locale | `rammah-next/lib/i18n/locales.ts`, `request-locale.ts` | Locale type, direction, formatting locale, trusted path classification |
| UI dictionaries | `rammah-next/lib/i18n/messages/**` | Typed static customer-facing copy and stable API-error mapping |
| Request/document locale | `rammah-next/proxy.ts`, `app/layout.tsx`, `components/i18n/LocaleProvider.tsx` | Server-rendered document `lang`/`dir` and client locale context |
| Route mapping | `rammah-next/lib/i18n/route-map.ts`, `components/i18n/LanguageSwitcher.tsx` | Safe static/resource/token route switching |
| Translation schema | `rammah-api/src/db/schema/index.ts`, Drizzle migration/backfill scripts | Additive localized content and customer-locale snapshots |
| Translation repositories | `rammah-api/src/modules/localization/**` | Locale-aware joins, published counterpart lookup, completeness checks |
| Public APIs | CMS, offerings, booking, payment, quote, contact, newsletter routes/services | Explicit locale contract and trusted locale persistence |
| Email locale | email service/repository and worker handler | Select required template using stored customer locale |
| Shared public UI | `rammah-next/components/**`, `features/public/**`, `app/ar/**` | One business UI rendered in English or Arabic |
| Admin authoring | `AdminCms.tsx`, offering/form/email editors and admin API | Locale tabs, preview, validation, independent publish state |
| SEO | route metadata, `sitemap.ts`, `robots.ts` | Canonical, reciprocal hreflang, locale sitemap, noindex protections |
| Release safety | preflight, Playwright, docs/runbooks | Content gates, parity, staging enablement, rollback, canary |

## Milestone Dependencies

```text
Task 1 locale contract
  -> Task 2 messages/formatters
  -> Task 3 document locale
  -> Task 4 route switching

Task 1
  -> Task 5 CMS translation schema
  -> Task 6 catalog/customer locale schema
  -> Task 7 English backfill verification
  -> Task 8 localized CMS repositories/APIs
  -> Task 9 localized catalog/form repositories/APIs
  -> Task 10 trusted submission locale snapshots
  -> Task 11 trusted payment-return/email locale

Tasks 2-4 + 8-11
  -> Task 12 locale-explicit public clients/components
  -> Task 13 shared page modules and Arabic route tree
  -> Task 14 RTL/motion/accessibility

Tasks 5-11
  -> Task 15 admin translation workflow

Tasks 12-15
  -> Task 16 SEO/preflight/content gates
  -> Task 17 bilingual E2E/staging/release
```

### Task 1: Establish the strict locale contract against the approved requirements

**Files:**
- Create: `rammah-api/src/shared/i18n/public-locale.ts`
- Create: `rammah-api/src/shared/i18n/public-locale.unit.test.ts`
- Modify: `rammah-api/src/config/env.ts`
- Modify: `rammah-api/.env.example`
- Create: `rammah-api/src/shared/i18n/public-locale-feature.ts`
- Create: `rammah-api/src/shared/i18n/public-locale-feature.unit.test.ts`
- Modify: `rammah-api/src/app.ts`
- Create: `rammah-next/lib/i18n/locales.ts`
- Create: `rammah-next/lib/i18n/locales.test.ts`
- Create: `rammah-next/lib/i18n/public-feature.ts`
- Create: `rammah-next/lib/i18n/public-feature.test.ts`
- Modify: `rammah-next/.env.example`
- Verify: `docs/02-requirements/FRS.md`
- Verify: `docs/02-requirements/NFR.md`

**Interfaces:**
- Consumes: Zod from the API and TypeScript only in the frontend.
- Produces: backend `publicLocaleSchema`, `publicLocaleQuerySchema`, `PublicLocale`, `isPublicLocale`; frontend `publicLocales`, `PublicLocale`, `isPublicLocale`, `directionForLocale`, `intlLocaleFor`; server-only `AR_PUBLIC_ENABLED=false` contracts and deterministic guards available before any Arabic endpoint or route is added.

- [ ] **Step 1: Write the failing backend locale tests**

```ts
import { describe, expect, it } from "vitest";
import {
  isPublicLocale,
  publicLocaleQuerySchema,
  publicLocaleSchema,
} from "./public-locale.js";

describe("public locale contract", () => {
  it.each(["en", "ar"])("accepts %s", (locale) => {
    expect(publicLocaleSchema.parse(locale)).toBe(locale);
    expect(isPublicLocale(locale)).toBe(true);
  });

  it.each(["AR", "ar-EG", "fr", "", null, undefined])("rejects %s", (locale) => {
    expect(publicLocaleSchema.safeParse(locale).success).toBe(false);
    expect(isPublicLocale(locale)).toBe(false);
  });

  it("defaults an omitted public read locale to English", () => {
    expect(publicLocaleQuerySchema.parse({})).toEqual({ locale: "en" });
    expect(publicLocaleQuerySchema.parse({ locale: "ar" })).toEqual({ locale: "ar" });
  });
});
```

- [ ] **Step 2: Run the backend test and verify the module is missing**

Run: `npm --prefix rammah-api run test:unit -- src/shared/i18n/public-locale.unit.test.ts`

Expected: FAIL because `./public-locale.js` cannot be resolved.

- [ ] **Step 3: Implement the backend locale contract**

```ts
import { z } from "zod";

export const publicLocales = ["en", "ar"] as const;
export const publicLocaleSchema = z.enum(publicLocales);
export const publicLocaleQuerySchema = z.object({
  locale: publicLocaleSchema.default("en"),
});

export type PublicLocale = z.infer<typeof publicLocaleSchema>;

export const isPublicLocale = (value: unknown): value is PublicLocale =>
  typeof value === "string" && publicLocales.includes(value as PublicLocale);
```

Keep omission-to-English only for backward-compatible public GET reads. A supplied unsupported value must be normalized by the validation middleware to HTTP `400` with stable code `UNSUPPORTED_LOCALE`; never silently turn `AR`, `ar-EG`, or an unknown locale into English. Public mutation schemas in Task 10 require an explicit locale.

- [ ] **Step 4: Write the failing frontend locale tests**

```ts
import { describe, expect, it } from "vitest";
import {
  directionForLocale,
  intlLocaleFor,
  isPublicLocale,
  publicLocales,
} from "./locales";

describe("frontend locales", () => {
  it("defines the exact launch locale set", () => {
    expect(publicLocales).toEqual(["en", "ar"]);
  });

  it("maps direction and Intl locale", () => {
    expect(directionForLocale("en")).toBe("ltr");
    expect(directionForLocale("ar")).toBe("rtl");
    expect(intlLocaleFor("en")).toBe("en");
    expect(intlLocaleFor("ar")).toBe("ar-EG");
  });

  it("does not normalize unsupported input", () => {
    expect(isPublicLocale("AR")).toBe(false);
    expect(isPublicLocale("fr")).toBe(false);
  });
});
```

- [ ] **Step 5: Run the frontend test and verify the module is missing**

Run: `npm --prefix rammah-next run test:unit -- lib/i18n/locales.test.ts`

Expected: FAIL because `./locales` cannot be resolved.

- [ ] **Step 6: Implement the frontend locale contract**

```ts
export const publicLocales = ["en", "ar"] as const;
export type PublicLocale = (typeof publicLocales)[number];

export const isPublicLocale = (value: unknown): value is PublicLocale =>
  typeof value === "string" && publicLocales.includes(value as PublicLocale);

export const directionForLocale = (locale: PublicLocale) =>
  locale === "ar" ? "rtl" : "ltr";

export const intlLocaleFor = (locale: PublicLocale) =>
  locale === "ar" ? "ar-EG" : "en";
```

- [ ] **Step 7: Write failing feature-flag contract tests**

Backend tests require strict `true | false` parsing, a default of `false`, English availability while disabled, and stable `ARABIC_PUBLIC_DISABLED` behavior for Arabic. Frontend tests require the same server-only default and must prove the variable is not exposed as `NEXT_PUBLIC_*`.

Run:

```powershell
npm --prefix rammah-api run test:unit -- src/shared/i18n/public-locale-feature.unit.test.ts
```

Expected: FAIL because the feature contract does not exist.

- [ ] **Step 8: Implement the feature flag before any Arabic route/API work**

```ts
const booleanFromEnv = z.enum(["true", "false"]).transform((value) => value === "true");
AR_PUBLIC_ENABLED: booleanFromEnv.default(false),
```

```ts
export function assertArabicPublicEnabled(locale: PublicLocale, enabled = env.AR_PUBLIC_ENABLED) {
  if (locale === "ar" && !enabled) {
    throw new AppError({ code: "ARABIC_PUBLIC_DISABLED", message: "Arabic public access is disabled.", statusCode: 404 });
  }
}
```

The Next helper reads only `process.env.AR_PUBLIC_ENABLED`; never create a `NEXT_PUBLIC_AR_PUBLIC_ENABLED` variable. Tasks 3, 8-10, 12-13, and 16 consume this guard as they expose new surfaces. Token-bearing status/payment/recovery and verified provider callback/email processing get the in-flight exception defined in Task 11, not a second flag.

Extend `createApp` now—not in Task 16—with optional `{ arabicPublicEnabled?: boolean }` dependency injection for deterministic tests; production defaults to validated `env.AR_PUBLIC_ENABLED`. Public route factories receive the resolved value instead of mutating process-global state.

- [ ] **Step 9: Verify the approved bilingual requirements remain the implementation contract**

Confirm the current `FR-006` through `FR-009` retain these exact obligations:

```markdown
### FR-006 Bilingual Public Launch

The production public website supports English and Arabic, preserves unprefixed English URLs, uses `/ar` for Arabic, and performs no automatic IP/browser-language redirect.

### FR-007 Complete Arabic Customer Journey

Arabic shall cover navigation, public content, offerings, blog, legal pages, contact, quote, newsletter, free and paid booking, payment return and recovery, booking status, thank-you states, validation, errors, and customer transactional emails.

### FR-008 Shared Business State

English and Arabic resolve to the same offering, price, availability, hold, booking, payment, calendar, and provider records; locale changes presentation and the trusted stored customer communication preference only.

### FR-009 English Admin with Bilingual Authoring

The first bilingual release shall keep the admin interface in English while allowing authorized admins to edit, preview, publish, unpublish, and audit English and Arabic content independently.
```

Confirm the current `NFR-080` through `NFR-083` retain these exact obligations:

```markdown
### NFR-080 Bilingual Route Stability

Existing English URLs shall remain stable. Arabic public URLs shall use `/ar`; neither IP nor browser language shall trigger an automatic redirect.

### NFR-081 Arabic RTL Quality

Arabic pages shall render server-side with `lang="ar"` and `dir="rtl"`, preserve logical keyboard and screen-reader order, avoid horizontal overflow, and pass the same accessibility and performance gates as English.

### NFR-082 Timezone and Locale Display

API timestamps remain machine-readable; the business timezone defaults to `Africa/Cairo`; public dates, times, and money use the approved English locale or `ar-EG` without changing stored timezone, currency, minor-unit, identifier, or provider values.

### NFR-083 Locale Parity and Isolation

Both locales produce identical price, capacity, booking, payment, and provider state; machine values are directionally isolated in Arabic; missing required Arabic content fails closed rather than falling back silently.
```

- [ ] **Step 10: Run focused and type checks**

Run:

```powershell
npm --prefix rammah-api run test:unit -- src/shared/i18n/public-locale.unit.test.ts
npm --prefix rammah-api run test:unit -- src/shared/i18n/public-locale-feature.unit.test.ts
npm --prefix rammah-api run typecheck
npm --prefix rammah-next run test:unit -- lib/i18n/locales.test.ts
npm --prefix rammah-next run test:unit -- lib/i18n/public-feature.test.ts
npm --prefix rammah-next run typecheck
```

Expected: all four commands PASS.

- [ ] **Step 11: Commit the locale and early feature-gate contract**

```powershell
git add rammah-api/src/config/env.ts rammah-api/.env.example rammah-api/src/app.ts rammah-api/src/shared/i18n rammah-next/lib/i18n/locales.ts rammah-next/lib/i18n/locales.test.ts rammah-next/lib/i18n/public-feature.ts rammah-next/lib/i18n/public-feature.test.ts rammah-next/.env.example
git commit -m "feat(i18n): define locale and feature-gate contract"
```

### Task 2: Add typed customer messages, formatters, and bidi isolation

**Files:**
- Create: `rammah-next/lib/i18n/messages/types.ts`
- Create: `rammah-next/lib/i18n/messages/en.ts`
- Create: `rammah-next/lib/i18n/messages/ar.ts`
- Create: `rammah-next/lib/i18n/get-messages.ts`
- Create: `rammah-next/lib/i18n/formatters.ts`
- Create: `rammah-next/lib/i18n/messages/messages.test.ts`
- Create: `rammah-next/lib/i18n/formatters.test.ts`

**Interfaces:**
- Consumes: `PublicLocale`, `intlLocaleFor` from Task 1.
- Produces: `Messages`, `getMessages(locale)`, `formatPublicDate`, `formatPublicDateTime`, `formatPublicMoney`, `isolateLtr`.

- [ ] **Step 1: Write failing dictionary and formatter tests**

```ts
import { describe, expect, it } from "vitest";
import { getMessages } from "../get-messages";

const flatten = (value: object, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof nested === "object" && nested !== null
      ? flatten(nested, path)
      : [path];
  });

describe("message catalogs", () => {
  it("has exact key parity", () => {
    expect(flatten(getMessages("ar"))).toEqual(flatten(getMessages("en")));
  });

  it("contains no empty Arabic customer copy", () => {
    const values = JSON.stringify(getMessages("ar"));
    expect(values).not.toContain('\"\"');
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { formatPublicMoney, isolateLtr } from "./formatters";

describe("localized formatting", () => {
  it("does not change minor-unit value", () => {
    const en = formatPublicMoney(125000, "EGP", "en");
    const ar = formatPublicMoney(125000, "EGP", "ar");
    expect(en).toContain("1,250");
    expect(ar).toMatch(/١٬٢٥٠|1,250/);
  });

  it("isolates machine text from RTL context", () => {
    expect(isolateLtr("user@example.com")).toBe("\u2066user@example.com\u2069");
  });
});
```

- [ ] **Step 2: Run tests and verify missing modules**

Run: `npm --prefix rammah-next run test:unit -- lib/i18n/messages/messages.test.ts lib/i18n/formatters.test.ts`

Expected: FAIL because message and formatter modules do not exist.

- [ ] **Step 3: Define the complete initial message contract**

```ts
export type Messages = {
  common: {
    languageName: string;
    switchToLanguage: string;
    loading: string;
    retry: string;
    continue: string;
    back: string;
    close: string;
    submit: string;
    required: string;
    unavailable: string;
    switchLanguageWarning: string;
    stayHere: string;
    switchAndClear: string;
  };
  forms: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
    message: string;
    consent: string;
    submitted: string;
    submissionFailed: string;
  };
  navigation: {
    home: string;
    about: string;
    services: string;
    blog: string;
    contact: string;
    book: string;
    openMenu: string;
    closeMenu: string;
    privacy: string;
    terms: string;
  };
  contact: {
    title: string;
    send: string;
    received: string;
  };
  quote: {
    title: string;
    companyName: string;
    targetAudience: string;
    participantCount: string;
    preferredDates: string;
    locationPreference: string;
    send: string;
    received: string;
  };
  newsletter: {
    title: string;
    subscribe: string;
    subscribed: string;
    confirmTitle: string;
    confirmed: string;
    unsubscribe: string;
    unsubscribed: string;
  };
  booking: {
    title: string;
    selectOffering: string;
    selectMode: string;
    selectDate: string;
    selectSlot: string;
    yourDetails: string;
    reviewPrice: string;
    confirmFree: string;
    continueToPayment: string;
    holdExpires: string;
    confirmed: string;
    pending: string;
    failed: string;
    cancelled: string;
    statusReference: string;
    online: string;
    offline: string;
    hybrid: string;
    noSlots: string;
    summary: string;
  };
  payment: {
    title: string;
    processing: string;
    paid: string;
    failed: string;
    expired: string;
    retry: string;
    doNotClose: string;
    supportReference: string;
  };
  status: {
    title: string;
    reference: string;
    lookup: string;
    view: string;
    updatedAt: string;
  };
  errors: {
    VALIDATION_ERROR: string;
    NOT_FOUND: string;
    CONFLICT: string;
    RATE_LIMITED: string;
    SLOT_UNAVAILABLE: string;
    HOLD_EXPIRED: string;
    PAYMENT_NOT_VERIFIED: string;
    LOCALIZED_CONTENT_NOT_FOUND: string;
    ARABIC_PUBLIC_DISABLED: string;
    UNSUPPORTED_LOCALE: string;
    NETWORK_ERROR: string;
    UNKNOWN_ERROR: string;
  };
};
```

- [ ] **Step 4: Add complete English and Arabic catalogs**

```ts
import type { Messages } from "./types";

export const enMessages: Messages = {
  common: { languageName: "English", switchToLanguage: "العربية", loading: "Loading…", retry: "Try again", continue: "Continue", back: "Back", close: "Close", submit: "Submit", required: "Required", unavailable: "This content is not available.", switchLanguageWarning: "Changing language will clear the information entered on this form.", stayHere: "Stay here", switchAndClear: "Change language and clear form" },
  forms: { fullName: "Full name", email: "Email", phone: "Phone", country: "Country", message: "Message", consent: "I agree to the stated privacy terms.", submitted: "Your request was received.", submissionFailed: "We could not submit your request. Please try again." },
  navigation: { home: "Home", about: "About", services: "Services", blog: "Blog", contact: "Contact", book: "Book", openMenu: "Open menu", closeMenu: "Close menu", privacy: "Privacy policy", terms: "Terms and conditions" },
  contact: { title: "Contact us", send: "Send message", received: "Your message was received." },
  quote: { title: "Request a corporate quote", companyName: "Company name", targetAudience: "Target audience", participantCount: "Expected participants", preferredDates: "Preferred dates", locationPreference: "Location preference", send: "Send quote request", received: "Your quote request was received." },
  newsletter: { title: "Newsletter", subscribe: "Subscribe", subscribed: "Check your email to confirm your subscription.", confirmTitle: "Confirm subscription", confirmed: "Your subscription is confirmed.", unsubscribe: "Unsubscribe", unsubscribed: "You have been unsubscribed." },
  booking: { title: "Book a session", selectOffering: "Choose a service", selectMode: "Choose attendance mode", selectDate: "Choose a date", selectSlot: "Choose a time", yourDetails: "Your details", reviewPrice: "Review price", confirmFree: "Confirm booking", continueToPayment: "Continue to payment", holdExpires: "This slot is held until", confirmed: "Booking confirmed", pending: "Payment is still processing", failed: "Payment was not completed", cancelled: "Booking cancelled", statusReference: "Booking reference", online: "Online", offline: "In person", hybrid: "Online or in person", noSlots: "No available times match your selection.", summary: "Booking summary" },
  payment: { title: "Complete payment", processing: "We are verifying your payment.", paid: "Payment confirmed", failed: "Payment failed", expired: "This payment attempt expired", retry: "Start a new payment attempt", doNotClose: "Do not close this page while verification is in progress.", supportReference: "Support reference" },
  status: { title: "Booking status", reference: "Booking reference", lookup: "Find booking", view: "View booking status", updatedAt: "Last updated" },
  errors: { VALIDATION_ERROR: "Check the highlighted fields.", NOT_FOUND: "The requested item was not found.", CONFLICT: "The selected option is no longer available.", RATE_LIMITED: "Too many attempts. Please wait and try again.", SLOT_UNAVAILABLE: "This time is no longer available.", HOLD_EXPIRED: "Your temporary slot hold expired.", PAYMENT_NOT_VERIFIED: "Payment has not been verified yet.", LOCALIZED_CONTENT_NOT_FOUND: "This content is not published in the selected language.", ARABIC_PUBLIC_DISABLED: "The Arabic website is not available yet.", UNSUPPORTED_LOCALE: "This language is not supported.", NETWORK_ERROR: "Check your connection and try again.", UNKNOWN_ERROR: "Something went wrong. Use the reference shown if you contact support." },
};
```

```ts
import type { Messages } from "./types";

export const arMessages: Messages = {
  common: { languageName: "العربية", switchToLanguage: "English", loading: "جارٍ التحميل…", retry: "حاول مرة أخرى", continue: "متابعة", back: "رجوع", close: "إغلاق", submit: "إرسال", required: "مطلوب", unavailable: "هذا المحتوى غير متاح حاليًا.", switchLanguageWarning: "تغيير اللغة سيحذف البيانات التي أدخلتها في هذا النموذج.", stayHere: "البقاء هنا", switchAndClear: "تغيير اللغة وحذف البيانات" },
  forms: { fullName: "الاسم بالكامل", email: "البريد الإلكتروني", phone: "رقم الهاتف", country: "الدولة", message: "الرسالة", consent: "أوافق على شروط الخصوصية الموضحة.", submitted: "تم استلام طلبك.", submissionFailed: "تعذر إرسال طلبك. حاول مرة أخرى." },
  navigation: { home: "الرئيسية", about: "عن أحمد", services: "الخدمات", blog: "المقالات", contact: "تواصل معنا", book: "احجز", openMenu: "فتح القائمة", closeMenu: "إغلاق القائمة", privacy: "سياسة الخصوصية", terms: "الشروط والأحكام" },
  contact: { title: "تواصل معنا", send: "إرسال الرسالة", received: "تم استلام رسالتك." },
  quote: { title: "اطلب عرضًا للشركات", companyName: "اسم الشركة", targetAudience: "الفئة المستهدفة", participantCount: "العدد المتوقع للمشاركين", preferredDates: "المواعيد المفضلة", locationPreference: "مكان التنفيذ المفضل", send: "إرسال طلب العرض", received: "تم استلام طلب العرض." },
  newsletter: { title: "النشرة البريدية", subscribe: "اشترك", subscribed: "راجع بريدك لتأكيد الاشتراك.", confirmTitle: "تأكيد الاشتراك", confirmed: "تم تأكيد اشتراكك.", unsubscribe: "إلغاء الاشتراك", unsubscribed: "تم إلغاء اشتراكك." },
  booking: { title: "احجز جلسة", selectOffering: "اختر الخدمة", selectMode: "اختر طريقة الحضور", selectDate: "اختر التاريخ", selectSlot: "اختر الموعد", yourDetails: "بياناتك", reviewPrice: "مراجعة السعر", confirmFree: "تأكيد الحجز", continueToPayment: "المتابعة إلى الدفع", holdExpires: "الموعد محجوز مؤقتًا حتى", confirmed: "تم تأكيد الحجز", pending: "الدفع ما زال قيد التحقق", failed: "لم تكتمل عملية الدفع", cancelled: "تم إلغاء الحجز", statusReference: "مرجع الحجز", online: "أونلاين", offline: "حضوري", hybrid: "أونلاين أو حضوري", noSlots: "لا توجد مواعيد متاحة مطابقة لاختيارك.", summary: "ملخص الحجز" },
  payment: { title: "إتمام الدفع", processing: "جارٍ التحقق من عملية الدفع.", paid: "تم تأكيد الدفع", failed: "فشلت عملية الدفع", expired: "انتهت صلاحية محاولة الدفع", retry: "بدء محاولة دفع جديدة", doNotClose: "لا تغلق هذه الصفحة أثناء التحقق من الدفع.", supportReference: "مرجع الدعم" },
  status: { title: "حالة الحجز", reference: "مرجع الحجز", lookup: "البحث عن الحجز", view: "عرض حالة الحجز", updatedAt: "آخر تحديث" },
  errors: { VALIDATION_ERROR: "راجع الحقول الموضحة.", NOT_FOUND: "العنصر المطلوب غير موجود.", CONFLICT: "الاختيار لم يعد متاحًا.", RATE_LIMITED: "عدد المحاولات كبير. انتظر قليلًا ثم حاول مرة أخرى.", SLOT_UNAVAILABLE: "هذا الموعد لم يعد متاحًا.", HOLD_EXPIRED: "انتهت مدة الحجز المؤقت للموعد.", PAYMENT_NOT_VERIFIED: "لم يتم التحقق من الدفع بعد.", LOCALIZED_CONTENT_NOT_FOUND: "هذا المحتوى غير منشور باللغة المختارة.", ARABIC_PUBLIC_DISABLED: "النسخة العربية غير متاحة حاليًا.", UNSUPPORTED_LOCALE: "هذه اللغة غير مدعومة.", NETWORK_ERROR: "تحقق من الاتصال بالإنترنت وحاول مرة أخرى.", UNKNOWN_ERROR: "حدث خطأ. استخدم المرجع الظاهر عند التواصل مع الدعم." },
};
```

- [ ] **Step 5: Add dictionary selection and formatters**

```ts
import type { PublicLocale } from "./locales";
import { arMessages } from "./messages/ar";
import { enMessages } from "./messages/en";

export const getMessages = (locale: PublicLocale) =>
  locale === "ar" ? arMessages : enMessages;
```

```ts
import { intlLocaleFor, type PublicLocale } from "./locales";

export const formatPublicDate = (value: string | Date, locale: PublicLocale, timeZone: string) =>
  new Intl.DateTimeFormat(intlLocaleFor(locale), { dateStyle: "medium", timeZone }).format(new Date(value));

export const formatPublicDateTime = (value: string | Date, locale: PublicLocale, timeZone: string) =>
  new Intl.DateTimeFormat(intlLocaleFor(locale), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));

export const formatPublicMoney = (amountMinor: number, currency: string, locale: PublicLocale) =>
  new Intl.NumberFormat(intlLocaleFor(locale), { style: "currency", currency }).format(amountMinor / 100);

export const isolateLtr = (value: string) => `\u2066${value}\u2069`;
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
npm --prefix rammah-next run test:unit -- lib/i18n/messages/messages.test.ts lib/i18n/formatters.test.ts
npm --prefix rammah-next run typecheck
```

Expected: PASS with exact English/Arabic key parity.

- [ ] **Step 7: Commit messages and formatters**

```powershell
git add rammah-next/lib/i18n
git commit -m "feat(i18n): add typed bilingual customer messages"
```

### Task 3: Render trusted server-side document language and direction

**Files:**
- Create: `rammah-next/lib/i18n/request-locale.ts`
- Create: `rammah-next/lib/i18n/request-locale.test.ts`
- Create: `rammah-next/proxy.ts`
- Create: `rammah-next/components/i18n/LocaleProvider.tsx`
- Create: `rammah-next/components/i18n/LocaleProvider.test.tsx`
- Create: `rammah-next/app/ar/layout.tsx`
- Modify: `rammah-next/app/layout.tsx`

**Interfaces:**
- Consumes: `PublicLocale`, `directionForLocale`, `getMessages`.
- Produces: `INTERNAL_LOCALE_HEADER`, `localeFromPathname(pathname)`, `readInternalLocale(value)`, `LocaleProvider`, `usePublicLocale`, server-rendered correct document attributes.

- [ ] **Step 1: Write failing request-locale tests**

```ts
import { describe, expect, it } from "vitest";
import { localeFromPathname, readInternalLocale } from "./request-locale";

describe("request locale", () => {
  it.each([["/", "en"], ["/services", "en"], ["/ar", "ar"], ["/ar/booking/status/token", "ar"]] as const)(
    "maps %s to %s",
    (path, expected) => expect(localeFromPathname(path)).toBe(expected),
  );

  it("defaults an untrusted internal header to English", () => {
    expect(readInternalLocale("fr")).toBe("en");
    expect(readInternalLocale(null)).toBe("en");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm --prefix rammah-next run test:unit -- lib/i18n/request-locale.test.ts`

Expected: FAIL because `request-locale.ts` does not exist.

- [ ] **Step 3: Implement the pure request locale resolver**

```ts
import { isPublicLocale, type PublicLocale } from "./locales";

export const INTERNAL_LOCALE_HEADER = "x-rammah-public-locale";

export const localeFromPathname = (pathname: string): PublicLocale =>
  pathname === "/ar" || pathname.startsWith("/ar/") ? "ar" : "en";

export const readInternalLocale = (value: string | null): PublicLocale =>
  isPublicLocale(value) ? value : "en";
```

- [ ] **Step 4: Add the request-boundary header**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { INTERNAL_LOCALE_HEADER, localeFromPathname } from "@/lib/i18n/request-locale";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INTERNAL_LOCALE_HEADER, localeFromPathname(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

- [ ] **Step 5: Write the failing locale-provider test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider, usePublicLocale } from "./LocaleProvider";

function Probe() {
  const { locale, direction, messages } = usePublicLocale();
  return <span>{`${locale}:${direction}:${messages.common.continue}`}</span>;
}

describe("LocaleProvider", () => {
  it("provides Arabic context", () => {
    render(<LocaleProvider locale="ar"><Probe /></LocaleProvider>);
    expect(screen.getByText("ar:rtl:متابعة")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implement the client locale provider**

```tsx
"use client";

import { createContext, useContext, useMemo } from "react";
import { getMessages } from "@/lib/i18n/get-messages";
import { directionForLocale, type PublicLocale } from "@/lib/i18n/locales";

type LocaleContextValue = {
  locale: PublicLocale;
  direction: "ltr" | "rtl";
  messages: ReturnType<typeof getMessages>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: PublicLocale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, direction: directionForLocale(locale), messages: getMessages(locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function usePublicLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("usePublicLocale must be used inside LocaleProvider");
  return value;
}
```

- [ ] **Step 7: Replace the root layout with a locale-aware server layout**

Retain the existing fonts and metadata, add `Noto_Sans_Arabic`, then use this body structure:

```tsx
import { headers } from "next/headers";
import { Noto_Sans_Arabic } from "next/font/google";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { directionForLocale } from "@/lib/i18n/locales";
import { INTERNAL_LOCALE_HEADER, readInternalLocale } from "@/lib/i18n/request-locale";

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = readInternalLocale(requestHeaders.get(INTERNAL_LOCALE_HEADER));
  const direction = directionForLocale(locale);

  return (
    <html lang={locale} dir={direction} className={`${bricolageGrotesque.variable} ${inter.variable} ${dancingScript.variable} ${notoArabic.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LocaleProvider locale={locale}>
          {children}
          <FloatingCTA />
        </LocaleProvider>
      </body>
    </html>
  );
}
```

`app/ar/layout.tsx` must be a transparent typed boundary:

```tsx
export default function ArabicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 8: Run focused tests, lint, and build**

Run:

```powershell
npm --prefix rammah-next run test:unit -- lib/i18n/request-locale.test.ts components/i18n/LocaleProvider.test.tsx
npm --prefix rammah-next run lint
npm --prefix rammah-next run typecheck
npm --prefix rammah-next run build
```

Expected: all commands PASS; server-rendered `/` has `lang=en dir=ltr`, and a temporary `/ar` route has `lang=ar dir=rtl`.

- [ ] **Step 9: Commit document locale support**

```powershell
git add rammah-next/proxy.ts rammah-next/app/layout.tsx rammah-next/app/ar/layout.tsx rammah-next/components/i18n rammah-next/lib/i18n/request-locale.ts rammah-next/lib/i18n/request-locale.test.ts
git commit -m "feat(i18n): render trusted document locale and direction"
```

### Task 4: Add deterministic route mapping and the language switcher

**Files:**
- Create: `rammah-next/lib/i18n/route-map.ts`
- Create: `rammah-next/lib/i18n/route-map.test.ts`
- Create: `rammah-next/components/i18n/LanguageSwitcher.tsx`
- Create: `rammah-next/components/i18n/LanguageSwitcher.test.tsx`

**Interfaces:**
- Consumes: `PublicLocale`, locale context, current pathname.
- Produces: `LocalizedRouteTargets`, `staticLocalizedPath(pathname, targetLocale)`, `resourceLocalizedPath(kind, slug, locale)`, `safeLocalizedQuery(routeKind, searchParams)`, and the standalone `<LanguageSwitcher targets />` primitive. Task 12 wires it after all existing English callers can pass locale safely.

- [ ] **Step 1: Write failing route-map tests**

```ts
import { describe, expect, it } from "vitest";
import { resourceLocalizedPath, staticLocalizedPath } from "./route-map";

describe("localized route map", () => {
  it.each([
    ["/", "ar", "/ar"],
    ["/about", "ar", "/ar/about"],
    ["/ar/contact", "en", "/contact"],
    ["/terms", "ar", "/ar/terms-and-conditions"],
  ] as const)("maps %s to %s", (path, locale, expected) => {
    expect(staticLocalizedPath(path, locale)).toBe(expected);
  });

  it("builds resource routes from the translated slug", () => {
    expect(resourceLocalizedPath("service", "تدريب-الشركات", "ar")).toBe("/ar/services/%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8-%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA");
    expect(resourceLocalizedPath("blog", "clarity", "en")).toBe("/blog/clarity");
  });

  it("preserves only route-owned recovery tokens and never tracking params", () => {
    expect(safeLocalizedQuery("payment_return", new URLSearchParams("booking=safe&utm_source=x"))).toBe("booking=safe");
    expect(safeLocalizedQuery("newsletter_confirm", new URLSearchParams("token=signed&email=pii@example.com"))).toBe("token=signed");
    expect(safeLocalizedQuery("thank_you", new URLSearchParams("type=contact&next=https://evil.test"))).toBe("type=contact");
  });
});
```

- [ ] **Step 2: Implement the explicit route map**

```ts
import type { PublicLocale } from "./locales";

export type LocalizedRouteTargets = Record<PublicLocale, string | null>;
export type LocalizedResourceKind = "service" | "booking" | "blog";

const staticRoutes: LocalizedRouteTargets[] = [
  { en: "/", ar: "/ar" },
  { en: "/about", ar: "/ar/about" },
  { en: "/services", ar: "/ar/services" },
  { en: "/blog", ar: "/ar/blog" },
  { en: "/contact", ar: "/ar/contact" },
  { en: "/booking", ar: "/ar/booking" },
  { en: "/thank-you", ar: "/ar/thank-you" },
  { en: "/privacy-policy", ar: "/ar/privacy-policy" },
  { en: "/terms-and-conditions", ar: "/ar/terms-and-conditions" },
  { en: "/newsletter/confirm", ar: "/ar/newsletter/confirm" },
  { en: "/newsletter/unsubscribe", ar: "/ar/newsletter/unsubscribe" },
];

const aliases: Record<string, string> = {
  "/privacy": "/privacy-policy",
  "/terms": "/terms-and-conditions",
  "/ar/privacy": "/ar/privacy-policy",
  "/ar/terms": "/ar/terms-and-conditions",
};

export function staticLocalizedPath(pathname: string, targetLocale: PublicLocale) {
  const canonical = aliases[pathname] ?? pathname;
  const pair = staticRoutes.find((item) => item.en === canonical || item.ar === canonical);
  return pair?.[targetLocale] ?? null;
}

export function resourceLocalizedPath(kind: LocalizedResourceKind, slug: string, locale: PublicLocale) {
  const prefix = locale === "ar" ? "/ar" : "";
  const segment = kind === "blog" ? "blog" : kind === "booking" ? "booking" : "services";
  return `${prefix}/${segment}/${encodeURIComponent(slug)}`;
}

const queryAllowlist = {
  payment_return: ["booking"],
  newsletter_confirm: ["token"],
  newsletter_unsubscribe: ["token"],
  thank_you: ["type"],
} as const;

export function safeLocalizedQuery(kind: keyof typeof queryAllowlist, input: URLSearchParams) {
  const output = new URLSearchParams();
  for (const key of queryAllowlist[kind]) {
    const value = input.get(key);
    if (value) output.set(key, value);
  }
  if (kind === "thank_you" && !["contact", "booking", "default"].includes(output.get("type") ?? "")) output.delete("type");
  return output.toString();
}
```

- [ ] **Step 3: Write the failing language-switcher tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "./LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  it("links Arabic to the supplied counterpart", () => {
    render(<LocaleProvider locale="en"><LanguageSwitcher targets={{ en: "/services/clarity", ar: "/ar/services/الوضوح" }} /></LocaleProvider>);
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute("href", "/ar/services/الوضوح");
  });

  it("does not promise an unpublished counterpart", () => {
    render(<LocaleProvider locale="en"><LanguageSwitcher targets={{ en: "/blog/post", ar: null }} /></LocaleProvider>);
    expect(screen.queryByRole("link", { name: "العربية" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Implement the accessible switcher**

```tsx
"use client";

import Link from "next/link";
import type { LocalizedRouteTargets } from "@/lib/i18n/route-map";
import { usePublicLocale } from "./LocaleProvider";

export function LanguageSwitcher({ targets }: { targets: LocalizedRouteTargets }) {
  const { locale, messages } = usePublicLocale();
  const targetLocale = locale === "en" ? "ar" : "en";
  const href = targets[targetLocale];
  if (!href) return null;
  return (
    <Link href={href} hrefLang={targetLocale} lang={targetLocale} aria-label={messages.common.switchToLanguage}>
      {messages.common.switchToLanguage}
    </Link>
  );
}
```

- [ ] **Step 5: Keep route switching primitive-only at this checkpoint**

Do not change `PublicFrame` or `Navbar` in this task: doing so would make their props required before all current English callers are migrated. The switcher receives an already-approved counterpart URL and optional output from `safeLocalizedQuery`; it never guesses a dynamic slug, copies arbitrary query parameters, or carries email/PII/tracking values. Task 12 updates every existing English caller first, then wires the required props and navigation.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
npm --prefix rammah-next run test:unit -- lib/i18n/route-map.test.ts components/i18n/LanguageSwitcher.test.tsx
npm --prefix rammah-next run typecheck
```

Expected: PASS; an unpublished counterpart renders no language link.

- [ ] **Step 7: Commit route switching**

```powershell
git add rammah-next/lib/i18n/route-map.ts rammah-next/lib/i18n/route-map.test.ts rammah-next/components/i18n
git commit -m "feat(i18n): add deterministic language switching"
```

### Task 5: Add CMS and editorial translation tables

**Files:**
- Modify: `rammah-api/src/db/schema/index.ts`
- Create: `rammah-api/src/test/localization/cms-translation-schema.integration.test.ts`
- Create (generated): `rammah-api/drizzle/*_bilingual_cms_translations.sql`; Drizzle owns the next unused numeric prefix at execution time.
- Modify: `rammah-api/drizzle/meta/_journal.json`
- Modify: `docs/03-architecture/ERD.md`
- Modify: `docs/03-architecture/Data-Dictionary.md`

**Interfaces:**
- Consumes: base CMS/media/blog tables and `contentStatusEnum`.
- Produces: typed CMS translation tables with parent/locale and locale/slug uniqueness.

- [ ] **Step 1: Write failing schema integration assertions**

```ts
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

describe("CMS translation schema", () => {
  it("has all locale-aware CMS tables", async () => {
    const result = await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'site_setting_translations', 'navigation_item_translations',
          'translation_working_copies',
          'media_asset_translations', 'page_translations',
          'page_section_translations', 'legal_page_translations', 'legal_page_translation_revisions',
          'seo_metadata_translations', 'blog_category_translations',
          'blog_post_translations'
        )
      order by table_name
    `);
    expect(result.rows).toHaveLength(11);
  });
});
```

- [ ] **Step 2: Run against the migrated test database and verify failure**

Run: `npm --prefix rammah-api run test:integration -- src/test/localization/cms-translation-schema.integration.test.ts`

Expected: FAIL because zero translation tables exist.

- [ ] **Step 3: Add the shared schema helper and exact CMS tables**

Add a database-enforced locale enum and helper near the existing timestamp helpers:

```ts
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const publicLocaleEnum = pgEnum("public_locale", ["en", "ar"]);
export const translationResourceTypeEnum = pgEnum("translation_resource_type", [
  "site_settings", "navigation_item", "media_asset", "page", "page_section",
  "legal_page", "seo_metadata", "offering_category", "offering",
  "offline_location", "booking_form_field", "email_template", "blog_category", "blog_post",
]);
const localeCode = () => publicLocaleEnum("locale").notNull();
const translationLifecycle = () => ({
  status: contentStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
});
```

Add these definitions after their parent tables are declared:

```ts
export const translationWorkingCopies = pgTable("translation_working_copies", {
  id: id(),
  resourceType: translationResourceTypeEnum("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  locale: localeCode(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  status: contentStatusEnum("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  scheduledByAdminId: uuid("scheduled_by_admin_id").references(() => adminUsers.id),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({
  resourceLocaleUnique: uniqueIndex("translation_working_copies_resource_locale_unique").on(t.resourceType, t.resourceId, t.locale),
  scheduleIdx: index("translation_working_copies_schedule_idx").on(t.status, t.scheduledFor),
  editableStateCheck: check("translation_working_copies_editable_state_check", sql`${t.status} in ('draft', 'scheduled')`),
}));

export const siteSettingTranslations = pgTable("site_setting_translations", {
  id: id(),
  siteSettingsId: uuid("site_settings_id").notNull().references(() => siteSettings.id, { onDelete: "cascade" }),
  locale: localeCode(),
  siteName: varchar("site_name", { length: 180 }).notNull(),
  ...translationLifecycle(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("site_setting_translations_parent_locale_unique").on(t.siteSettingsId, t.locale) }));

export const navigationItemTranslations = pgTable("navigation_item_translations", {
  id: id(),
  navigationItemId: uuid("navigation_item_id").notNull().references(() => navigationItems.id, { onDelete: "cascade" }),
  locale: localeCode(), label: varchar("label", { length: 120 }).notNull(), url: text("url").notNull(),
  ...translationLifecycle(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("navigation_item_translations_parent_locale_unique").on(t.navigationItemId, t.locale), localeStatusIdx: index("navigation_item_translations_locale_status_idx").on(t.locale, t.status) }));

export const mediaAssetTranslations = pgTable("media_asset_translations", {
  id: id(), mediaAssetId: uuid("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  locale: localeCode(), altText: text("alt_text"), isDecorative: boolean("is_decorative").notNull().default(false),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewedByAdminId: uuid("reviewed_by_admin_id").references(() => adminUsers.id),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("media_asset_translations_parent_locale_unique").on(t.mediaAssetId, t.locale) }));

export const pageTranslations = pgTable("page_translations", {
  id: id(), pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }), locale: localeCode(),
  slug: varchar("slug", { length: 180 }).notNull(), title: varchar("title", { length: 220 }).notNull(),
  ...translationLifecycle(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("page_translations_parent_locale_unique").on(t.pageId, t.locale), localeSlugUnique: uniqueIndex("page_translations_locale_slug_unique").on(t.locale, t.slug), localeStatusIdx: index("page_translations_locale_status_idx").on(t.locale, t.status) }));

export const pageSectionTranslations = pgTable("page_section_translations", {
  id: id(), pageSectionId: uuid("page_section_id").notNull().references(() => pageSections.id, { onDelete: "cascade" }), locale: localeCode(),
  title: text("title"), body: text("body"), config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("page_section_translations_parent_locale_unique").on(t.pageSectionId, t.locale), localeStatusIdx: index("page_section_translations_locale_status_idx").on(t.locale, t.status) }));

export const legalPageTranslations = pgTable("legal_page_translations", {
  id: id(), legalPageId: uuid("legal_page_id").notNull().references(() => legalPages.id, { onDelete: "cascade" }), locale: localeCode(),
  slug: varchar("slug", { length: 180 }).notNull(), title: varchar("title", { length: 220 }).notNull(), body: text("body").notNull(),
  version: varchar("version", { length: 40 }).notNull(), contentHash: varchar("content_hash", { length: 64 }).notNull(),
  publishedRevisionId: uuid("published_revision_id").references((): AnyPgColumn => legalPageTranslationRevisions.id, { onDelete: "restrict" }), ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("legal_page_translations_parent_locale_unique").on(t.legalPageId, t.locale), localeSlugUnique: uniqueIndex("legal_page_translations_locale_slug_unique").on(t.locale, t.slug) }));

export const legalPageTranslationRevisions = pgTable("legal_page_translation_revisions", {
  id: id(), legalPageTranslationId: uuid("legal_page_translation_id").notNull().references(() => legalPageTranslations.id, { onDelete: "restrict" }),
  locale: localeCode(), slug: varchar("slug", { length: 180 }).notNull(), title: varchar("title", { length: 220 }).notNull(), body: text("body").notNull(),
  version: varchar("version", { length: 40 }).notNull(), contentHash: varchar("content_hash", { length: 64 }).notNull(), publishedAt: timestamp("published_at", { withTimezone: true }).notNull(), createdAt: createdAt(),
}, (t) => ({ translationVersionUnique: uniqueIndex("legal_page_translation_revisions_version_unique").on(t.legalPageTranslationId, t.version), contentHashIdx: index("legal_page_translation_revisions_hash_idx").on(t.contentHash) }));

export const seoMetadataTranslations = pgTable("seo_metadata_translations", {
  id: id(), seoMetadataId: uuid("seo_metadata_id").notNull().references(() => seoMetadata.id, { onDelete: "cascade" }), locale: localeCode(),
  metaTitle: varchar("meta_title", { length: 220 }), metaDescription: text("meta_description"), canonicalUrl: text("canonical_url"),
  ...translationLifecycle(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("seo_metadata_translations_parent_locale_unique").on(t.seoMetadataId, t.locale) }));

export const blogCategoryTranslations = pgTable("blog_category_translations", {
  id: id(), blogCategoryId: uuid("blog_category_id").notNull().references(() => blogCategories.id, { onDelete: "cascade" }), locale: localeCode(),
  name: varchar("name", { length: 160 }).notNull(), slug: varchar("slug", { length: 180 }).notNull(),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("blog_category_translations_parent_locale_unique").on(t.blogCategoryId, t.locale), localeSlugUnique: uniqueIndex("blog_category_translations_locale_slug_unique").on(t.locale, t.slug) }));

export const blogPostTranslations = pgTable("blog_post_translations", {
  id: id(), blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }), locale: localeCode(),
  title: varchar("title", { length: 220 }).notNull(), slug: varchar("slug", { length: 180 }).notNull(), excerpt: text("excerpt"), body: text("body").notNull(),
  ...translationLifecycle(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("blog_post_translations_parent_locale_unique").on(t.blogPostId, t.locale), localeSlugUnique: uniqueIndex("blog_post_translations_locale_slug_unique").on(t.locale, t.slug), localeStatusIdx: index("blog_post_translations_locale_status_idx").on(t.locale, t.status, t.publishedAt) }));
```

- [ ] **Step 4: Generate and inspect the forward migration**

Run:

```powershell
npm --prefix rammah-api run db:generate -- --name bilingual_cms_translations
```

Expected: the next journal-assigned migration contains the `public_locale` and `translation_resource_type` enums, eleven `CREATE TABLE` statements (ten typed CMS/revision tables plus the shared working-copy store), all foreign keys including the post-create legal published-revision pointer, four locale/slug unique indexes (`page`, `legal_page`, `blog_category`, `blog_post`), immutable legal revision/version constraints, working-copy schedule/state constraints, lifecycle indexes, and no `DROP` statement. Because `legal_page_translations` and its revision table reference each other, the generated migration creates both tables first and adds the `published_revision_id` foreign key afterward. Keep the prefix produced by Drizzle and update the journal through Drizzle; never manually renumber an applied migration.

- [ ] **Step 5: Apply migrations and run the schema test**

Run:

```powershell
npm --prefix rammah-api run db:migrate:test
npm --prefix rammah-api run test:integration -- src/test/localization/cms-translation-schema.integration.test.ts
```

Expected: migration succeeds and the test reports eleven tables.

- [ ] **Step 6: Commit the CMS schema**

```powershell
git add rammah-api/src/db/schema/index.ts rammah-api/src/test/localization/cms-translation-schema.integration.test.ts rammah-api/drizzle docs/03-architecture/ERD.md docs/03-architecture/Data-Dictionary.md
git commit -m "feat(i18n): add CMS translation schema"
```

### Task 6: Add catalog translations and trusted customer-locale snapshots

**Files:**
- Modify: `rammah-api/src/db/schema/index.ts`
- Create: `rammah-api/src/test/localization/customer-locale-schema.integration.test.ts`
- Create (generated): `rammah-api/drizzle/*_bilingual_catalog_customer_locale.sql`; Drizzle owns the next unused numeric prefix after Task 5.
- Modify: `rammah-api/drizzle/meta/_journal.json`
- Modify: `docs/03-architecture/ERD.md`
- Modify: `docs/03-architecture/Data-Dictionary.md`

**Interfaces:**
- Consumes: Task 5 schema helper and base catalog/form/email/customer tables.
- Produces: catalog translation tables and immutable/defaulted `customerLocale` fields.

- [ ] **Step 1: Write the failing schema behavior test**

```ts
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

describe("catalog and customer locale schema", () => {
  it("has five live catalog/form/email translations plus email revisions and shared media", async () => {
    const result = await db.execute(sql`select count(*)::int as count from information_schema.tables where table_schema='public' and table_name in ('offering_category_translations','offering_translations','offline_location_translations','booking_form_field_translations','email_template_translations','email_template_translation_revisions','media_asset_translations')`);
    expect(result.rows[0]).toMatchObject({ count: 7 });
  });

  it("defaults historical customer locale to en", async () => {
    const result = await db.execute(sql`select column_name, column_default, is_nullable from information_schema.columns where table_name='bookings' and column_name='customer_locale'`);
    expect(result.rows[0]).toMatchObject({ column_name: "customer_locale", is_nullable: "NO" });
    expect(String(result.rows[0]?.column_default)).toContain("en");
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm --prefix rammah-api run test:integration -- src/test/localization/customer-locale-schema.integration.test.ts`

Expected: FAIL because translation tables and `customer_locale` are missing.

- [ ] **Step 3: Add exact catalog translation definitions**

```ts
export const offeringCategoryTranslations = pgTable("offering_category_translations", {
  id: id(), offeringCategoryId: uuid("offering_category_id").notNull().references(() => offeringCategories.id, { onDelete: "cascade" }), locale: localeCode(),
  name: varchar("name", { length: 160 }).notNull(), slug: varchar("slug", { length: 180 }).notNull(), description: text("description"),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("offering_category_translations_parent_locale_unique").on(t.offeringCategoryId, t.locale), localeSlugUnique: uniqueIndex("offering_category_translations_locale_slug_unique").on(t.locale, t.slug) }));

export const offeringTranslations = pgTable("offering_translations", {
  id: id(), offeringId: uuid("offering_id").notNull().references(() => offerings.id, { onDelete: "cascade" }), locale: localeCode(),
  title: varchar("title", { length: 220 }).notNull(), slug: varchar("slug", { length: 180 }).notNull(), shortDescription: text("short_description"), longDescription: text("long_description"),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("offering_translations_parent_locale_unique").on(t.offeringId, t.locale), localeSlugUnique: uniqueIndex("offering_translations_locale_slug_unique").on(t.locale, t.slug), localeStatusIdx: index("offering_translations_locale_status_idx").on(t.locale, t.status) }));

export const offlineLocationTranslations = pgTable("offline_location_translations", {
  id: id(), offlineLocationId: uuid("offline_location_id").notNull().references(() => offlineLocations.id, { onDelete: "cascade" }), locale: localeCode(),
  name: varchar("name", { length: 180 }).notNull(), addressLine1: text("address_line_1").notNull(), addressLine2: text("address_line_2"), city: varchar("city", { length: 120 }), instructions: text("instructions"),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("offline_location_translations_parent_locale_unique").on(t.offlineLocationId, t.locale) }));

export const bookingFormFieldTranslations = pgTable("booking_form_field_translations", {
  id: id(), bookingFormFieldId: uuid("booking_form_field_id").notNull().references(() => bookingFormFields.id, { onDelete: "cascade" }), locale: localeCode(),
  label: varchar("label", { length: 220 }).notNull(), options: jsonb("options").$type<Array<{ label: string; value: string }>>().notNull().default([]),
  ...translationLifecycle(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("booking_form_field_translations_parent_locale_unique").on(t.bookingFormFieldId, t.locale), localeStatusIdx: index("booking_form_field_translations_locale_status_idx").on(t.locale, t.status) }));

export const emailTemplateTranslations = pgTable("email_template_translations", {
  id: id(), emailTemplateId: uuid("email_template_id").notNull().references(() => emailTemplates.id, { onDelete: "cascade" }), locale: localeCode(),
  subject: text("subject").notNull(), body: text("body").notNull(), contentHash: varchar("content_hash", { length: 64 }).notNull(), publishedRevisionId: uuid("published_revision_id").references((): AnyPgColumn => emailTemplateTranslationRevisions.id, { onDelete: "restrict" }), ...translationLifecycle(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ parentLocaleUnique: uniqueIndex("email_template_translations_parent_locale_unique").on(t.emailTemplateId, t.locale), localeStatusIdx: index("email_template_translations_locale_status_idx").on(t.locale, t.status) }));

export const emailTemplateTranslationRevisions = pgTable("email_template_translation_revisions", {
  id: id(), emailTemplateTranslationId: uuid("email_template_translation_id").notNull().references(() => emailTemplateTranslations.id, { onDelete: "restrict" }),
  locale: localeCode(), subject: text("subject").notNull(), body: text("body").notNull(), contentHash: varchar("content_hash", { length: 64 }).notNull(), publishedAt: timestamp("published_at", { withTimezone: true }).notNull(), createdAt: createdAt(),
}, (t) => ({ translationHashUnique: uniqueIndex("email_template_translation_revisions_hash_unique").on(t.emailTemplateTranslationId, t.contentHash) }));
```

- [ ] **Step 4: Add customer locale columns to the exact base tables**

Add this field to `bookings`, `quoteRequests`, `contactInquiries`, `newsletterSubscribers`, and `emailDeliveries`:

```ts
customerLocale: publicLocaleEnum("customer_locale").notNull().default("en"),
```

Do not add locale to `payments`; payment locale is read through `payments.bookingId -> bookings.customerLocale`.

Add immutable render provenance to `emailDeliveries` (and to the outbox payload schema owned by `JOB-01/03`):

```ts
templateTranslationRevisionId: uuid("template_translation_revision_id").references((): AnyPgColumn => emailTemplateTranslationRevisions.id, { onDelete: "restrict" }),
templateContentHash: varchar("template_content_hash", { length: 64 }),
```

The migration adds the revision foreign key after `email_template_translation_revisions` exists. Existing historical deliveries may remain null; every newly enqueued localized customer email must set locale, revision ID, and hash together.

- [ ] **Step 5: Generate and inspect the second additive migration**

Run: `npm --prefix rammah-api run db:generate -- --name bilingual_catalog_customer_locale`

Expected: six `CREATE TABLE` statements (five live translations plus immutable email revisions), post-create live-template and delivery revision foreign keys, five additive `customer_locale` columns with non-null English defaults, and nullable provenance fields for historical email deliveries; no drops or destructive type changes.

- [ ] **Step 6: Apply migrations and run tests**

Run:

```powershell
npm --prefix rammah-api run db:migrate:test
npm --prefix rammah-api run test:integration -- src/test/localization/customer-locale-schema.integration.test.ts
npm --prefix rammah-api run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit catalog and snapshot schema**

```powershell
git add rammah-api/src/db/schema/index.ts rammah-api/src/test/localization/customer-locale-schema.integration.test.ts rammah-api/drizzle docs/03-architecture/ERD.md docs/03-architecture/Data-Dictionary.md
git commit -m "feat(i18n): add catalog translations and customer locale"
```

### Task 7: Backfill and verify English translations without changing responses

**Files:**
- Create: `rammah-api/src/scripts/backfill-english-translations.ts`
- Create: `rammah-api/src/scripts/verify-english-translations.ts`
- Create: `rammah-api/src/test/localization/english-backfill.integration.test.ts`
- Modify: `rammah-api/package.json`

**Interfaces:**
- Consumes: translation tables from Tasks 5-6 and current English base columns.
- Produces: restartable `db:backfill:i18n:en`, read-only `db:verify:i18n:en`, verified one-to-one English translation coverage.

- [ ] **Step 1: Write a failing restartability/parity integration test**

```ts
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { offerings, offeringTranslations, pages, pageTranslations } from "../../db/schema/index.js";
import { runEnglishTranslationBackfill } from "../../scripts/backfill-english-translations.js";

describe("English translation backfill", () => {
  it("is restartable and preserves every base English field", async () => {
    await runEnglishTranslationBackfill(db);
    await runEnglishTranslationBackfill(db);
    const basePages = await db.select().from(pages);
    const translatedPages = await db.select().from(pageTranslations);
    const baseOfferings = await db.select().from(offerings);
    const translatedOfferings = await db.select().from(offeringTranslations);
    expect(translatedPages).toHaveLength(basePages.length);
    expect(translatedOfferings).toHaveLength(baseOfferings.length);
    expect(translatedPages.every((row) => row.locale === "en")).toBe(true);
    expect(canonicalizeEnglishTranslations(translatedPages)).toEqual(canonicalizeBasePages(basePages));
  });

  it("preserves nullable media alt text instead of manufacturing filename alt", async () => {
    const asset = await seedMediaAsset({ altText: null });
    await runEnglishTranslationBackfill(db);
    expect(await readMediaTranslation(asset.id, "en")).toMatchObject({ altText: null, reviewedAt: null });
  });

  it("fails when an existing conflicting translation differs from the base row", async () => {
    await seedConflictingEnglishPageTranslation();
    await expect(runEnglishTranslationBackfill(db)).rejects.toMatchObject({ code: "ENGLISH_BACKFILL_CONFLICT" });
  });
});
```

- [ ] **Step 2: Run and verify the missing export failure**

Run: `npm --prefix rammah-api run test:integration -- src/test/localization/english-backfill.integration.test.ts`

Expected: FAIL because `runEnglishTranslationBackfill` does not exist.

- [ ] **Step 3: Implement one transactional, conflict-safe backfill**

Implement `runEnglishTranslationBackfill(database)` with one `database.transaction` and explicit typed mappings for all 14 parent resources. Each mapping copies the existing localized columns exactly, sets `locale: sql\`'en'\``, preserves nulls, stable ordering, status/publication timestamps, and computes canonical SHA-256 hashes for legal/email revisions. An existing `(parent, en)` conflict is read back and compared field-by-field; an exact match is a restartable no-op, while any mismatch aborts the transaction with `ENGLISH_BACKFILL_CONFLICT`. Example for pages and offerings:

```ts
import { pathToFileURL } from "node:url";

export async function runEnglishTranslationBackfill(database: typeof db) {
  const backfillStartedAt = new Date();
  await database.transaction(async (tx) => {
    await tx.insert(pageTranslations).select(
      tx.select({
        pageId: pages.id,
        locale: sql<"en">`'en'`,
        slug: pages.slug,
        title: pages.title,
        status: pages.status,
        publishedAt: pages.publishedAt,
      }).from(pages),
    ).onConflictDoNothing();

    await tx.insert(offeringTranslations).select(
      tx.select({
        offeringId: offerings.id,
        locale: sql<"en">`'en'`,
        title: offerings.title,
        slug: offerings.slug,
        shortDescription: offerings.shortDescription,
        longDescription: offerings.longDescription,
        status: offerings.status,
      }).from(offerings),
    ).onConflictDoNothing();

    await tx.insert(siteSettingTranslations).select(
      tx.select({ siteSettingsId: siteSettings.id, locale: sql<"en">`'en'`, siteName: siteSettings.siteName, status: sql<"published">`'published'`, publishedAt: sql<Date>`${backfillStartedAt}` }).from(siteSettings),
    ).onConflictDoNothing();

    await tx.insert(navigationItemTranslations).select(
      tx.select({ navigationItemId: navigationItems.id, locale: sql<"en">`'en'`, label: navigationItems.label, url: navigationItems.url, status: navigationItems.status }).from(navigationItems),
    ).onConflictDoNothing();

    await tx.insert(mediaAssetTranslations).select(
      tx.select({ mediaAssetId: mediaAssets.id, locale: sql<"en">`'en'`, altText: mediaAssets.altText, isDecorative: sql<boolean>`false`, reviewedAt: sql<Date | null>`null`, status: mediaAssets.status }).from(mediaAssets),
    ).onConflictDoNothing();

    await tx.insert(pageSectionTranslations).select(
      tx.select({ pageSectionId: pageSections.id, locale: sql<"en">`'en'`, title: pageSections.title, body: pageSections.body, config: pageSections.config, status: pageSections.status }).from(pageSections),
    ).onConflictDoNothing();

    for (const legal of await tx.select().from(legalPages)) {
      const contentHash = canonicalSha256({ slug: legal.slug, title: legal.title, body: legal.body, version: legal.version });
      await upsertExactEnglishLegalTranslation(tx, { legalPageId: legal.id, locale: "en", slug: legal.slug, title: legal.title, body: legal.body, version: legal.version, contentHash, status: legal.status, publishedAt: legal.publishedAt });
    }

    await tx.insert(seoMetadataTranslations).select(
      tx.select({ seoMetadataId: seoMetadata.id, locale: sql<"en">`'en'`, metaTitle: seoMetadata.metaTitle, metaDescription: seoMetadata.metaDescription, canonicalUrl: seoMetadata.canonicalUrl, status: sql<"published">`'published'`, publishedAt: sql<Date>`${backfillStartedAt}` }).from(seoMetadata),
    ).onConflictDoNothing();

    await tx.insert(offeringCategoryTranslations).select(
      tx.select({ offeringCategoryId: offeringCategories.id, locale: sql<"en">`'en'`, name: offeringCategories.name, slug: offeringCategories.slug, description: offeringCategories.description, status: offeringCategories.status }).from(offeringCategories),
    ).onConflictDoNothing();

    await tx.insert(offlineLocationTranslations).select(
      tx.select({ offlineLocationId: offlineLocations.id, locale: sql<"en">`'en'`, name: offlineLocations.name, addressLine1: offlineLocations.addressLine1, addressLine2: offlineLocations.addressLine2, city: offlineLocations.city, instructions: offlineLocations.instructions, status: offlineLocations.status }).from(offlineLocations),
    ).onConflictDoNothing();

    await tx.insert(bookingFormFieldTranslations).select(
      tx.select({ bookingFormFieldId: bookingFormFields.id, locale: sql<"en">`'en'`, label: bookingFormFields.label, options: bookingFormFields.options, status: bookingFormFields.status }).from(bookingFormFields),
    ).onConflictDoNothing();

    for (const template of await tx.select().from(emailTemplates)) {
      const contentHash = canonicalSha256({ subject: template.subject, body: template.body });
      await upsertExactEnglishEmailTranslation(tx, { emailTemplateId: template.id, locale: "en", subject: template.subject, body: template.body, contentHash, status: template.status });
    }

    await tx.insert(blogCategoryTranslations).select(
      tx.select({ blogCategoryId: blogCategories.id, locale: sql<"en">`'en'`, name: blogCategories.name, slug: blogCategories.slug, status: blogCategories.status }).from(blogCategories),
    ).onConflictDoNothing();

    await tx.insert(blogPostTranslations).select(
      tx.select({ blogPostId: blogPosts.id, locale: sql<"en">`'en'`, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt, body: blogPosts.body, status: blogPosts.status, publishedAt: blogPosts.publishedAt }).from(blogPosts),
    ).onConflictDoNothing();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runEnglishTranslationBackfill(db).then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

Keep these statements explicit; do not replace them with dynamic table-name SQL. This preserves Drizzle typing and reviewable field mapping.

After inserting each live English legal/email translation, insert an immutable revision from the copied values and update `publishedRevisionId` to that exact revision inside the same transaction. A published live row without a revision pointer is a failed backfill. Scheduled base rows preserve `scheduledFor`; archived/draft rows remain non-public. The test also compares a golden set of pre-migration English public API payloads with the translation-backed assemblers, allowing only the newly documented `locale`, `resourceId`, and `availableLocales` metadata.

- [ ] **Step 4: Add a read-only field-parity and integrity verifier**

`verifyEnglishTranslations(database)` returns named failures and exits non-zero for any of these conditions:

- missing or extra English translation rows, orphan rows, duplicate parent/locale pairs, or locale/slug collisions after NFC normalization;
- any mismatch in every copied scalar/JSON field, including null versus empty string, exact booking-option order/value set, status, `publishedAt`, and `scheduledFor`;
- media alt text changed to a filename, a null manufactured into copy, or a launch asset lacking explicit reviewed alt/decorative provenance;
- legal/email live hashes that do not match canonical content, missing immutable revision rows, or a published pointer that does not resolve to the copied English revision;
- a difference in the golden English list/detail/settings/navigation/legal/offering/form/email response suite beyond approved localization metadata.

The verifier prints stable JSON objects shaped as `{ code, resource, resourceId, field?, expected?, actual? }`; empty failures are success. Task 16 separately blocks public enablement until launch media is marked either reviewed localized alt text or intentionally decorative.

- [ ] **Step 5: Add package scripts and run twice**

```json
{
  "db:backfill:i18n:en": "tsx src/scripts/backfill-english-translations.ts",
  "db:verify:i18n:en": "tsx src/scripts/verify-english-translations.ts"
}
```

Run:

```powershell
npm --prefix rammah-api run db:backfill:i18n:en
npm --prefix rammah-api run db:backfill:i18n:en
npm --prefix rammah-api run db:verify:i18n:en
npm --prefix rammah-api run test:integration -- src/test/localization/english-backfill.integration.test.ts
```

Expected: both backfills exit 0, verification prints `English localization backfill verified`, and the integration test PASSes.

- [ ] **Step 6: Commit the backfill**

```powershell
git add rammah-api/src/scripts/backfill-english-translations.ts rammah-api/src/scripts/verify-english-translations.ts rammah-api/src/test/localization/english-backfill.integration.test.ts rammah-api/package.json
git commit -m "feat(i18n): backfill and verify English translations"
```

### Task 8: Serve localized CMS, blog, legal, navigation, and SEO content

**Files:**
- Create: `rammah-api/src/modules/localization/localized-resource.types.ts`
- Create: `rammah-api/src/modules/localization/public-cms-localization.repository.ts`
- Create: `rammah-api/src/modules/localization/public-cms-localization.service.ts`
- Create: `rammah-api/src/modules/localization/public-cms-localization.integration.test.ts`
- Modify: `rammah-api/src/modules/cms/public-cms.routes.ts`
- Modify: `rammah-api/src/modules/openapi/openapi.routes.ts`
- Modify: `docs/03-architecture/API-Design.md`
- Modify: `docs/03-architecture/Backend-Architecture.md`
- Modify: `docs/03-architecture/Error-Handling-Strategy.md`

**Interfaces:**
- Consumes: Task 1 `PublicLocale`, Tasks 5-7 translated CMS data.
- Produces: `LocalizedResourceMeta`, slug-based detail reads, stable-key static page/legal reads, `listPublicNavigation(locale, location?)`, `listPublicBlogPosts(locale, categorySlug?)`, and `getPublicBlogPost(locale, slug)`.

- [ ] **Step 1: Write the failing localized CMS integration tests**

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";
import { seedLocalizedCmsFixture } from "../../test/factories/localized-cms.js";

const app = createApp();

describe("localized public CMS", () => {
  it("returns the requested Arabic translation and counterpart slugs", async () => {
    const fixture = await seedLocalizedCmsFixture();
    const response = await request(app).get(`/api/v1/public/cms/pages/${encodeURIComponent(fixture.arSlug)}?locale=ar`);
    expect(response.status).toBe(200);
    expect(response.headers["content-language"]).toBe("ar");
    expect(response.body.data).toMatchObject({
      resourceId: fixture.pageId,
      locale: "ar",
      slug: fixture.arSlug,
      title: "عن رماح",
      availableLocales: { en: fixture.enSlug, ar: fixture.arSlug },
    });
  });

  it("does not fall back to English for a missing Arabic translation", async () => {
    const fixture = await seedLocalizedCmsFixture({ publishArabic: false });
    const response = await request(app).get(`/api/v1/public/cms/pages/${fixture.enSlug}?locale=ar`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("LOCALIZED_CONTENT_NOT_FOUND");
  });

  it("resolves a fixed static route by the base English key while returning Arabic copy", async () => {
    const fixture = await seedLocalizedCmsFixture({ enSlug: "about", arSlug: "عن-أحمد" });
    const response = await request(app).get("/api/v1/public/cms/pages/by-key/about?locale=ar");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ resourceId: fixture.pageId, locale: "ar", slug: "عن-أحمد" });
  });

  it("does not expose a published translation when its base resource is not published", async () => {
    const fixture = await seedLocalizedCmsFixture({ baseStatus: "draft", translationStatus: "published" });
    const response = await request(app).get(`/api/v1/public/cms/pages/${fixture.arSlug}?locale=ar`);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm --prefix rammah-api run test:integration -- src/modules/localization/public-cms-localization.integration.test.ts`

Expected: FAIL because locale is ignored and translated fixtures/services are absent.

- [ ] **Step 3: Define the localized resource response contract**

```ts
import type { PublicLocale } from "../../shared/i18n/public-locale.js";

export type AvailableLocaleSlugs = Record<PublicLocale, string | null>;

export type LocalizedResourceMeta = {
  resourceId: string;
  locale: PublicLocale;
  slug: string;
  availableLocales: AvailableLocaleSlugs;
};
```

- [ ] **Step 4: Implement locale/status/slug constrained repository reads**

For every localized query, join the base and requested translation on parent ID, require base `status = 'published'` and any effective base publication time to have passed wherever the base table owns lifecycle, require translation `status = 'published'` and any effective translation publication time to have passed, and look up by `(locale, slug)`. Statusless `site_settings` relies on the published translation; statusless `seo_metadata` also requires its owning page/offering/blog/legal resource to be effectively published. The page query must use this exact shape:

```ts
export async function findPublishedPage(locale: PublicLocale, slug: string) {
  const rows = await db
    .select({
      resourceId: pages.id,
      template: pages.template,
      slug: pageTranslations.slug,
      title: pageTranslations.title,
      publishedAt: pageTranslations.publishedAt,
    })
    .from(pages)
    .innerJoin(pageTranslations, eq(pageTranslations.pageId, pages.id))
    .where(and(
      eq(pages.status, "published"),
      eq(pageTranslations.locale, locale),
      eq(pageTranslations.slug, slug),
      eq(pageTranslations.status, "published"),
    ))
    .limit(1);
  return rows[0] ?? null;
}
```

Add exported repository functions with these exact signatures:

```ts
listPublishedNavigation(locale: PublicLocale, location?: string): Promise<LocalizedNavigationRow[]>;
findPublishedPage(locale: PublicLocale, slug: string): Promise<LocalizedPageRow | null>;
findPublishedPageByBaseKey(locale: PublicLocale, baseKey: string): Promise<LocalizedPageRow | null>;
listPublishedPageSections(pageId: string, locale: PublicLocale): Promise<LocalizedPageSectionRow[]>;
findPublishedLegalPage(locale: PublicLocale, slug: string): Promise<LocalizedLegalRow | null>;
findPublishedLegalPageByBaseKey(locale: PublicLocale, baseKey: string): Promise<LocalizedLegalRow | null>;
listPublishedBlogPosts(locale: PublicLocale, categorySlug?: string): Promise<LocalizedBlogSummaryRow[]>;
findPublishedBlogPost(locale: PublicLocale, slug: string): Promise<LocalizedBlogPostRow | null>;
findLocalizedSeo(resourceType: string, resourceId: string, locale: PublicLocale): Promise<LocalizedSeoRow | null>;
findAvailableLocaleSlugs(resourceType: "page" | "legal" | "blog_post", resourceId: string): Promise<AvailableLocaleSlugs>;
```

Repository ownership is explicit: navigation uses `navigationItemTranslations`; page/page sections use `pageTranslations` and `pageSectionTranslations`; legal uses `legalPageTranslations`; blog list/detail use `blogPostTranslations` and `blogCategoryTranslations`; SEO uses `seoMetadataTranslations`. For fixed route identities only, `findPublishedPageByBaseKey` matches the immutable English base `pages.slug` and `findPublishedLegalPageByBaseKey` matches `legalPages.slug`, then joins the requested published translation. Dynamic content continues to resolve by the requested locale's translated slug. No raw dynamic table names and no legacy-column fallback are allowed after Task 7 verification.

Legal public reads are the exception to mutable live-row projection: require base `legal_pages.status='published'`, require the live translation to be effectively published, follow `legal_page_translations.published_revision_id`, and return title/body/version/hash from that immutable revision. A missing/dangling revision pointer fails closed. Available counterpart slugs are emitted only for effectively published translation/revision pairs. Integration fixtures cover every resource family with base `draft`, `scheduled`, `archived`, and translation `draft`/future-scheduled combinations.

- [ ] **Step 5: Implement service assembly and stable not-found behavior**

```ts
const localizedNotFound = () => new AppError({
  code: "LOCALIZED_CONTENT_NOT_FOUND",
  message: "Localized content was not found.",
  statusCode: httpStatus.notFound,
});

export async function getPublicPage(locale: PublicLocale, slug: string) {
  const page = await findPublishedPage(locale, slug);
  if (!page) throw localizedNotFound();
  return {
    ...page,
    locale,
    availableLocales: await findAvailableLocaleSlugs("page", page.resourceId),
    seo: await findLocalizedSeo("page", page.resourceId, locale),
    sections: await listPublishedPageSections(page.resourceId, locale),
  };
}

export async function getPublicPageByKey(locale: PublicLocale, baseKey: string) {
  const page = await findPublishedPageByBaseKey(locale, baseKey);
  if (!page) throw localizedNotFound();
  return assembleLocalizedPage(page, locale);
}
```

Extract the duplicated page response construction into `assembleLocalizedPage`. Implement `getPublicLegalPageByKey`, slug-based legal/blog detail assembly, and list assembly with the same explicit fields and their own resource type. List functions return only requested-locale rows.

- [ ] **Step 6: Validate locale on every public CMS route and set Content-Language**

```ts
const localeQuerySchema = publicLocaleQuerySchema;

publicCmsRouter.get(
  "/pages/:slug",
  validateRequest({ params: slugParamsSchema, query: localeQuerySchema }),
  async (req, res, next) => {
    try {
      const { locale } = req.query as z.infer<typeof localeQuerySchema>;
      const data = await getPublicPage(locale, req.params.slug);
      res.setHeader("Content-Language", locale);
      res.status(httpStatus.ok).json({ data });
    } catch (error) {
      next(error);
    }
  },
);
```

Apply this exact route-to-service contract:

| Route | Service | Response language |
| --- | --- | --- |
| `GET /settings?locale=` | `getPublicSiteSettings(locale)` | requested locale |
| `GET /navigation?locale=&location=` | `listPublicNavigation(locale, location)` | requested locale |
| `GET /legal/by-key/:baseKey?locale=` | `getPublicLegalPageByKey(locale, baseKey)` | requested locale |
| `GET /legal/:slug?locale=` | `getPublicLegalPage(locale, slug)` | requested locale |
| `GET /pages/by-key/:baseKey?locale=` | `getPublicPageByKey(locale, baseKey)` | requested locale |
| `GET /pages/:slug?locale=` | `getPublicPage(locale, slug)` | requested locale |
| `GET /blog/posts?locale=&categorySlug=` | `listPublicBlogPosts(locale, categorySlug)` | requested locale |
| `GET /blog/posts/:slug?locale=` | `getPublicBlogPost(locale, slug)` | requested locale |

Register both `/by-key/:baseKey` routes before their `/:slug` routes so Express never interprets `by-key` as content. Every row uses `publicLocaleQuerySchema` and sets `Content-Language`. Update OpenAPI with `locale` enum `[en, ar]`, default `en`, response locale, available locale slugs, and `LOCALIZED_CONTENT_NOT_FOUND`.

Immediately after locale parsing, every Arabic CMS/navigation/blog/legal/settings discovery read calls Task 1's injected guard. This keeps Task 8's direct API checkpoint closed while the flag is false; authenticated preview is not routed through these public endpoints.

- [ ] **Step 7: Run CMS tests, OpenAPI check, and typecheck**

Run:

```powershell
npm --prefix rammah-api run test:integration -- src/modules/localization/public-cms-localization.integration.test.ts
npm --prefix rammah-api run openapi:check
npm --prefix rammah-api run typecheck
```

Expected: PASS; English response fixture remains byte-equivalent for visible content after removing the new metadata fields.

- [ ] **Step 8: Commit localized CMS APIs**

```powershell
git add rammah-api/src/modules/localization rammah-api/src/modules/cms/public-cms.routes.ts rammah-api/src/modules/openapi/openapi.routes.ts docs/03-architecture/API-Design.md docs/03-architecture/Backend-Architecture.md docs/03-architecture/Error-Handling-Strategy.md
git commit -m "feat(i18n): serve localized public CMS content"
```

### Task 9: Serve localized offerings, locations, and booking-form definitions

**Files:**
- Create: `rammah-api/src/modules/localization/public-offering-localization.repository.ts`
- Create: `rammah-api/src/modules/localization/public-offering-localization.integration.test.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.routes.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.service.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.repository.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.mapper.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.types.ts`
- Modify: `rammah-api/src/modules/availability/public-availability-slots.routes.ts`
- Modify: `rammah-api/src/modules/availability/availability-slots.service.ts`
- Modify: `rammah-api/src/modules/availability/availability-slots.repository.ts`
- Modify: `rammah-api/src/modules/sessions/public-sessions.routes.ts`
- Modify: `rammah-api/src/modules/sessions/public-sessions.service.ts`
- Modify: `rammah-api/src/modules/sessions/public-sessions.repository.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.routes.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.service.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.repository.ts`
- Modify: `rammah-api/src/modules/openapi/openapi.routes.ts`
- Modify: `docs/03-architecture/API-Design.md`
- Modify: `docs/03-architecture/Booking-Architecture.md`

**Interfaces:**
- Consumes: Tasks 5-7 catalog translations and `PublicLocale`.
- Produces: locale-aware `listPublicOfferings(locale)`, `getPublicOfferingBySlug(locale, slug)`, `getPublicOfferingBookingConfig(locale, offeringId)`, availability/session projections, and price-preview display fields.

- [ ] **Step 1: Write failing catalog parity and missing-translation tests**

```ts
it("returns one business offering with Arabic display fields and unchanged price", async () => {
  const fixture = await seedLocalizedOfferingFixture();
  const en = await request(app).get(`/api/v1/public/offerings/${fixture.enSlug}?locale=en`);
  const ar = await request(app).get(`/api/v1/public/offerings/${encodeURIComponent(fixture.arSlug)}?locale=ar`);
  expect(ar.status).toBe(200);
  expect(ar.body.data).toMatchObject({ id: fixture.offeringId, locale: "ar", title: "جلسة الوضوح" });
  expect(ar.body.data.prices).toEqual(en.body.data.prices);
  expect(ar.body.data.durationMinutes).toBe(en.body.data.durationMinutes);
  expect(ar.body.data.capacity).toBe(en.body.data.capacity);
});

it("excludes an offering with no published requested translation", async () => {
  await seedLocalizedOfferingFixture({ publishArabic: false });
  const response = await request(app).get("/api/v1/public/offerings?locale=ar");
  expect(response.body.data).toEqual([]);
});

it("localizes sessions, locations, availability, and price display without changing machine values", async () => {
  const fixture = await seedLocalizedOfferingFixture({ withSessionAndLocation: true });
  const [en, ar] = await readBookingDiscoveryPair(fixture);
  expect(ar.session.offering.title).toBe("جلسة الوضوح");
  expect(ar.session.location.name).toBe("مقر القاهرة");
  expect(ar.availability.offering.title).toBe("جلسة الوضوح");
  expect(ar.price.offering.title).toBe("جلسة الوضوح");
  expect(pickDiscoveryMachineState(ar)).toEqual(pickDiscoveryMachineState(en));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm --prefix rammah-api run test:integration -- src/modules/localization/public-offering-localization.integration.test.ts`

Expected: FAIL because offering reads use base English columns.

- [ ] **Step 3: Add locale-aware repository row types and joins**

```ts
export type LocalizedOfferingRow = {
  id: string;
  locale: PublicLocale;
  slug: string;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  offeringType: string;
  attendanceMode: string;
  bookingMode: string;
  durationMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  displayConfig: { backgroundColor?: string; textColor?: string };
};
```

The offering list/detail query must require base offering/category/location/form records to be published/active, inner-join `offeringTranslations` for the requested locale and effective published status, left-join an effective published same-locale `offeringCategoryTranslations`, and select prices from the unchanged published `offeringPrices` table. A published translation never overrides a draft, scheduled, archived, or disabled base record. Booking config must join:

```ts
bookingFormFields
  -> bookingFormFieldTranslations on field id + requested locale + published
offlineLocations
  -> offlineLocationTranslations on location id + requested locale
```

Return option labels from the translation row while preserving stable option `value` strings.

Availability, session, and price-preview inputs require locale and join the same published `offeringTranslations`; sessions also join `offlineLocationTranslations`. Dates, capacity, IDs, country resolution, currency, minor units, discount/tax fields, and generated timestamps remain unchanged.

- [ ] **Step 4: Change service signatures and response metadata**

```ts
export const listPublicOfferings = (locale: PublicLocale) => repository.list(locale);
export const getPublicOfferingBySlug = async (locale: PublicLocale, slug: string) => {
  const offering = await repository.findBySlug(locale, slug);
  if (!offering) throw localizedOfferingNotFound();
  return { ...mapPublicOffering(offering), locale, availableLocales: await repository.findAvailableSlugs(offering.id) };
};
export const getPublicOfferingBookingConfig = async (locale: PublicLocale, offeringId: string) => ({
  offering: await repository.findById(locale, offeringId),
  fields: await repository.listFormFields(locale, offeringId),
  locations: await repository.listLocations(locale, offeringId),
});
```

- [ ] **Step 5: Validate route locale and update OpenAPI**

Use `publicLocaleQuerySchema` on list, detail, booking-config, availability, and session GET routes; add `locale: publicLocaleSchema` to price-preview POST input. Set `Content-Language`. Document localized slugs/fields and explicitly document that IDs, prices, duration, capacity, modes, dates, country resolution, and availability configuration are shared.

All Arabic catalog/discovery/availability/session/price-preview routes call Task 1's injected guard after parsing and before service work. Token-bearing continuation exceptions are introduced only in Task 11 and never apply to anonymous discovery.

- [ ] **Step 6: Run tests and contract checks**

Run:

```powershell
npm --prefix rammah-api run test:integration -- src/modules/localization/public-offering-localization.integration.test.ts
npm --prefix rammah-api run openapi:check
npm --prefix rammah-api run typecheck
```

Expected: PASS with English/Arabic machine-field parity.

- [ ] **Step 7: Commit localized catalog reads**

```powershell
git add rammah-api/src/modules/localization/public-offering-localization* rammah-api/src/modules/offerings rammah-api/src/modules/availability rammah-api/src/modules/sessions rammah-api/src/modules/pricing rammah-api/src/modules/openapi/openapi.routes.ts docs/03-architecture/API-Design.md docs/03-architecture/Booking-Architecture.md
git commit -m "feat(i18n): localize public offerings and booking forms"
```

### Task 10: Persist trusted customer locale on every public submission

**Files:**
- Create: `rammah-api/src/modules/consent/consent-receipt.ts`
- Create: `rammah-api/src/modules/consent/consent-receipt.unit.test.ts`
- Create: `rammah-api/src/modules/consent/public-consent.routes.ts`
- Create: `rammah-api/src/modules/consent/public-consent.service.ts`
- Modify: `rammah-api/src/app.ts`
- Modify: `rammah-api/src/modules/openapi/openapi.routes.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.routes.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.service.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.repository.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.routes.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.service.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.repository.ts`
- Modify: `rammah-api/src/modules/quote-requests/public-quote-requests.routes.ts`
- Modify: `rammah-api/src/modules/quote-requests/public-quote-requests.service.ts`
- Modify: `rammah-api/src/modules/quote-requests/public-quote-requests.repository.ts`
- Modify: `rammah-api/src/modules/contact-inquiries/public-contact-inquiries.routes.ts`, `.service.ts`, and `.repository.ts` created by `FEAT-08`
- Modify: `rammah-api/src/modules/newsletter/public-newsletter.routes.ts`, `.service.ts`, and `.repository.ts` created by `FEAT-02`
- Create: `rammah-api/src/modules/localization/customer-locale-submissions.integration.test.ts`
- Modify: `rammah-next/lib/api/bookings.ts`
- Create: `rammah-next/lib/api/consent.ts`
- Modify: `rammah-next/components/BookingFlow.tsx`
- Modify: `rammah-next/components/ContactForm.tsx`
- Modify: `rammah-next/components/NewsletterForm.tsx` delivered by `FEAT-02`
- Modify: `rammah-next/components/corporate/CorporateQuoteForm.tsx`
- Modify: `rammah-next/components/NewsletterForm.tsx` delivered by `FEAT-02`
- Modify: `docs/03-architecture/Booking-Architecture.md`
- Modify: `docs/04-ux-and-flows/Booking-Flow.md`

**Interfaces:**
- Consumes: `publicLocaleSchema`, translated form fields, existing trusted booking/payment state.
- Produces: `customerLocale: PublicLocale` snapshots for booking/lead/subscriber records, server-owned booking-answer labels, and a signed consent receipt that binds acceptance to an immutable legal revision without a render/submit race.

- [ ] **Step 1: Write failing end-to-end repository tests for all submission types**

```ts
it.each([
  ["free booking", submitArabicFreeBooking, "bookings"],
  ["paid booking", submitArabicPaidBooking, "bookings"],
  ["quote", submitArabicQuote, "quote_requests"],
  ["contact", submitArabicContact, "contact_inquiries"],
  ["newsletter", submitArabicNewsletter, "newsletter_subscribers"],
] as const)("persists ar for %s", async (_name, submit, table) => {
  const id = await submit();
  const row = await readCustomerLocale(table, id);
  expect(row.customerLocale).toBe("ar");
});

it("takes the answer label from the Arabic field definition, not the client", async () => {
  const booking = await submitArabicFreeBooking({ answerLabel: "FORGED LABEL" });
  const answers = await readBookingAnswers(booking.id);
  expect(answers[0].labelSnapshot).toBe("مكان الميلاد الأصلي");
});

it("rejects an option value outside the exact stable base option set", async () => {
  const response = await submitArabicFreeBooking({ answers: [{ fieldId: selectField.id, fieldKey: selectField.key, value: "forged-option" }] });
  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe("INVALID_BOOKING_FIELD_VALUE");
  expect(await countBookingsForRequest(response.body.requestId)).toBe(0);
});

it("stores the exact legal revision presented even when a newer revision publishes before submit", async () => {
  const receiptA = await issueConsentReceipt({ locale: "ar", legalKey: "privacy-policy", purpose: "contact" });
  await publishPrivacyRevisionB();
  const inquiry = await submitArabicContact({ acceptedPrivacy: true, consentReceipt: receiptA });
  expect(await readConsentEvidence("contact_inquiry", inquiry.id)).toMatchObject({ locale: "ar", legalKey: "privacy-policy", version: "2026-07-a", contentHash: legalHashA });
});

it.each(["expired", "bad-signature", "wrong-locale", "wrong-purpose", "unknown-revision"])("rejects a %s consent receipt atomically", async (kind) => {
  const response = await submitContactWithReceiptFixture(kind);
  expect(response.status).toBe(422);
  expect(await countContactWrites(response.body.requestId)).toBe(0);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm --prefix rammah-api run test:integration -- src/modules/localization/customer-locale-submissions.integration.test.ts`

Expected: FAIL because schemas reject/ignore locale and labels remain client-authored.

- [ ] **Step 3: Add locale to submission schemas and service inputs**

Add this required field to free booking, paid booking, quote, contact, and newsletter bodies:

```ts
locale: publicLocaleSchema,
```

New Arabic bookings/leads/subscriptions and Arabic consent-notice issuance call Task 1's injected guard before any repository write. English continues normally. Task 11 defines the narrow signed-token/provider continuation exceptions; a caller cannot select an exception with an input flag.

Contact, quote, newsletter, and any booking form that requires privacy acceptance expose `acceptedPrivacy: z.literal(true)` plus an opaque `consentReceipt: z.string()` issued by the server. Do not accept a raw legal document ID, locale, version, or content hash from the browser.

Remove `label` from the public booking answer schema. The accepted answer is:

```ts
const bookingAnswerSchema = z.object({
  fieldId: z.string().uuid(),
  fieldKey: z.string().trim().min(1).max(120),
  value: z.string().trim().max(4000).nullable().optional(),
});
```

- [ ] **Step 4: Resolve and snapshot server-owned field definitions**

```ts
const definitions = await bookingFormRepository.findPublishedDefinitions({
  offeringId: hold.offeringId,
  locale: input.locale,
  fieldIds: input.answers.map((answer) => answer.fieldId),
});

const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
const answerSnapshots = input.answers.map((answer) => {
  const definition = definitionById.get(answer.fieldId);
  if (!definition || definition.fieldKey !== answer.fieldKey) {
    throw new AppError({ code: "INVALID_BOOKING_FIELD", message: "Booking field is invalid.", statusCode: 422 });
  }
  return { fieldId: definition.id, fieldKeySnapshot: definition.fieldKey, labelSnapshot: definition.label, value: answer.value ?? null };
});
```

For select/radio/multi-select definitions, validate submitted values against the exact stable base option-value set inside the same transaction; translated labels may differ but values, uniqueness, and order may not. Reject unknown, duplicated, reordered machine values or a field whose published translation options do not exactly match the base definition. The booking insert and answer inserts remain in the same transaction and write `customerLocale: input.locale`.

- [ ] **Step 5: Issue and verify immutable consent receipts**

Add `GET /api/v1/public/consent-notices/:legalKey?locale=&purpose=` with allowlisted legal keys/purposes. In one service read it resolves the immutable published requested-locale legal revision, returns the exact localized title/body/version the form must render plus an opaque short-lived HMAC-signed receipt containing `{ legalRevisionId, legalKey, locale, purpose, contentHash, issuedAt, expiresAt }`. Set `Cache-Control: private, no-store`; do not log the receipt. `rammah-next/lib/api/consent.ts` supplies this response to contact, quote, newsletter, and consent-bearing booking forms before they allow the checkbox.

Arabic consent-notice issuance is a new-journey surface and calls the early feature guard; disabling Arabic cannot mint new Arabic submission receipts.

On submission, verify signature, expiry, purpose, input locale, and the referenced revision/hash; then store that exact revision as consent evidence in the same transaction as the customer record. Publishing revision B after the customer viewed revision A must not rewrite their evidence or cause the valid A receipt to resolve to B. Logs and analytics never contain the receipt.

If the receipt expires before submit, return stable `CONSENT_RECEIPT_EXPIRED`; the frontend fetches and displays the current notice, clears only the consent checkbox/receipt, and asks the customer to accept again without discarding unrelated form fields. It never refreshes a receipt invisibly behind an already-checked box.

- [ ] **Step 6: Persist locale in every repository insert and keep the checkpoint green**

Add `customerLocale: input.locale` to booking, quote, contact, newsletter, and initial email-delivery/outbox snapshot writes. Duplicate newsletter subscribe keeps the original consent evidence and updates locale only through the approved resubscribe/confirm flow. Because mutation locale becomes required here, update every current English frontend submission caller in this same task to send `locale: "en"`; Task 12 replaces that compatibility literal with trusted locale context. The checkpoint must not leave the English site unable to submit.

- [ ] **Step 7: Run adversarial submission tests and full critical suites**

Run:

```powershell
npm --prefix rammah-api run test:integration -- src/modules/localization/customer-locale-submissions.integration.test.ts
npm --prefix rammah-api run test:unit -- src/modules/consent/consent-receipt.unit.test.ts
npm --prefix rammah-api run test:integration -- src/modules/bookings src/modules/payments
npm --prefix rammah-api run typecheck
npm --prefix rammah-next run typecheck
```

Expected: PASS; forged label and unsupported locale return `422`/`400` without a booking write.

- [ ] **Step 8: Commit trusted locale snapshots**

```powershell
git add rammah-api/src/app.ts rammah-api/src/modules/openapi/openapi.routes.ts rammah-api/src/modules/consent rammah-api/src/modules/bookings rammah-api/src/modules/payments rammah-api/src/modules/quote-requests rammah-api/src/modules/contact-inquiries rammah-api/src/modules/newsletter rammah-api/src/modules/localization/customer-locale-submissions.integration.test.ts rammah-next/lib/api/bookings.ts rammah-next/lib/api/consent.ts rammah-next/components/BookingFlow.tsx rammah-next/components/ContactForm.tsx rammah-next/components/corporate/CorporateQuoteForm.tsx rammah-next/components/NewsletterForm.tsx docs/03-architecture/Booking-Architecture.md docs/04-ux-and-flows/Booking-Flow.md
git commit -m "feat(i18n): persist trusted customer locale snapshots"
```

### Task 11: Derive payment returns and customer email from stored locale

**Files:**
- Modify: `rammah-api/src/modules/payments/public-payments.service.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.repository.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.routes.ts`
- Modify: `rammah-api/src/modules/payments/kashier.adapter.ts`
- Modify: `rammah-api/src/modules/emails/email.service.ts`
- Modify: `rammah-api/src/modules/emails/email.repository.ts`
- Modify: `rammah-api/src/worker/handlers/email-delivery.handler.ts` created by `JOB-03`
- Create: `rammah-api/src/shared/i18n/formatters.ts`
- Create: `rammah-api/src/shared/i18n/bidi.ts`
- Create: `rammah-api/src/shared/i18n/formatters.unit.test.ts`
- Create: `rammah-api/src/modules/localization/payment-email-locale.integration.test.ts`
- Modify: `docs/03-architecture/Payment-Architecture.md`
- Modify: `docs/03-architecture/Email-Notification-Architecture.md`

**Interfaces:**
- Consumes: trusted `bookings.customerLocale`, email template translations, payment callback verification/finalization from `SEC-01/02`.
- Produces: a discriminated verified callback result, stored-locale return/status routing, stored-locale Kashier display, immutable email revision snapshots, and backend-only locale format/bidi helpers.

- [ ] **Step 1: Write failing trusted-return and missing-template tests**

```ts
it("ignores callback locale and redirects from the matched Arabic booking", async () => {
  const payment = await seedVerifiedPayment({ customerLocale: "ar" });
  const response = await request(app).get(`${validKashierCallback(payment)}&locale=en`);
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/^https:\/\/[^/]+\/ar\/booking\/payment\/return\?/);
});

it("does not silently send English when required Arabic template is missing", async () => {
  const job = await seedBookingEmailJob({ customerLocale: "ar", publishArabicTemplate: false });
  await expect(runEmailJob(job.id)).rejects.toMatchObject({ code: "LOCALIZED_EMAIL_TEMPLATE_NOT_FOUND" });
  expect(await readEmailDelivery(job.deliveryId)).toMatchObject({ customerLocale: "ar", status: "failed" });
});

it.each(["invalid-signature", "unknown-payment", "booking-mismatch", "replay"])("never derives redirect data from an %s callback", async (kind) => {
  const response = await invokeCallbackFixture(kind, { locale: "ar", booking: "forged" });
  expect(response.headers.location ?? "").not.toContain("forged");
  expect(await readUnexpectedPaymentMutation()).toBeNull();
});

it("finishes an in-flight Arabic payment and email after Arabic discovery is disabled", async () => {
  const payment = await seedVerifiedPayment({ customerLocale: "ar", beforeDisable: true });
  const disabledApp = createApp({ arabicPublicEnabled: false });
  const callback = await request(disabledApp).get(validKashierCallback(payment));
  expect(callback.headers.location).toContain("/ar/booking/payment/return");
  await expect(runEmailJob(payment.emailJobId)).resolves.toBeDefined();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm --prefix rammah-api run test:integration -- src/modules/localization/payment-email-locale.integration.test.ts`

Expected: FAIL because return URL is English-only and email templates are not locale-aware.

- [ ] **Step 3: Return locale only from the trusted payment/booking lookup**

Extend the trusted payment projection with `customerLocale: bookings.customerLocale`. Never read locale, booking token, or redirect path from raw callback query. Model the result as a discriminated union:

```ts
type PaymentCallbackResult =
  | { kind: "matched"; publicToken: string; customerLocale: PublicLocale; paymentId: string; state: PaymentState }
  | { kind: "unmatched"; reason: "invalid_signature" | "unknown_payment" | "booking_mismatch" | "replay" };
```

```ts
const buildReturnUrl = (publicToken: string | null, locale: PublicLocale) => {
  const configured = new URL(env.KASHIER_RETURN_URL ?? "http://localhost:3000/booking/payment/return");
  configured.pathname = locale === "ar" ? "/ar/booking/payment/return" : "/booking/payment/return";
  configured.search = "";
  if (publicToken) configured.searchParams.set("booking", publicToken);
  return configured.toString();
};
```

The callback route calls `buildReturnUrl(result.publicToken, result.customerLocale)` only in the `matched` branch after verified event processing returns the stored record. The `unmatched` branch uses one configured, constant-origin generic failure URL with no customer token or query-derived value. Test invalid signature, unknown payment, booking mismatch, duplicate/replay, and both callback-before-return/return-before-callback orderings.

- [ ] **Step 4: Derive Kashier display language from the stored booking locale**

Replace the adapter's hardcoded `display: "en"` with the provider-supported English/Arabic display value selected from `bookings.customerLocale`. Verify the exact Arabic value against the current official Kashier contract and sandbox fixture during implementation; fail closed if the provider no longer supports it. Locale may alter provider presentation and return URL only—it must not enter signature/hash inputs, amount, currency, merchant reference, order identity, or state verification. Retain golden signature tests for both locale values.

- [ ] **Step 5: Snapshot an immutable localized email revision at enqueue time**

```ts
export async function getRequiredTemplate(key: string, locale: PublicLocale) {
  const rows = await db
    .select({ revisionId: emailTemplateTranslationRevisions.id, contentHash: emailTemplateTranslationRevisions.contentHash, subject: emailTemplateTranslationRevisions.subject, body: emailTemplateTranslationRevisions.body })
    .from(emailTemplates)
    .innerJoin(emailTemplateTranslations, eq(emailTemplateTranslations.emailTemplateId, emailTemplates.id))
    .innerJoin(emailTemplateTranslationRevisions, eq(emailTemplateTranslationRevisions.id, emailTemplateTranslations.publishedRevisionId))
    .where(and(eq(emailTemplates.key, key), eq(emailTemplates.status, "published"), eq(emailTemplateTranslations.locale, locale), eq(emailTemplateTranslations.status, "published")))
    .limit(1);
  const template = rows[0];
  if (!template) throw new AppError({ code: "LOCALIZED_EMAIL_TEMPLATE_NOT_FOUND", message: "Localized email template is not published.", statusCode: 422 });
  return template;
}
```

The business transaction resolves the currently published immutable revision and writes an outbox payload containing `{ templateRevisionId, templateContentHash, customerLocale, resourceType, resourceId, recipientEmail, variables }`. Variables are an allowlisted immutable snapshot containing localized offering/location display values and machine date/money/reference values; no rendered HTML is stored. Dedupe identity includes event/resource, recipient, locale, and revision ID.

On every retry the worker loads that exact immutable revision ID, verifies the stored hash, and renders the snapshotted variables; it never resolves the mutable currently published template. Missing/mismatched revisions dead-letter with operator visibility. This guarantees a retry cannot silently change wording or language after an admin republishes a template.

Backend `formatters.ts` owns `en`/`ar-EG` date, Cairo timezone, and currency rendering; `bidi.ts` owns text isolation and safe `<bdi>` helpers. Do not import frontend utilities into the API. HTML email sets `lang`/`dir`, escapes customer/CMS values, wraps email/phone/reference/money/provider text with `<bdi dir="ltr">`, and uses locale-correct status/payment/legal/unsubscribe links; plain text uses Unicode isolation for machine values.

- [ ] **Step 6: Define flag disable semantics for in-flight Arabic journeys**

`AR_PUBLIC_ENABLED=false` blocks Arabic navigation/sitemap/indexable content, new Arabic leads, new holds, new bookings, and new unauthenticated discovery. It must not strand an already-created Arabic customer record: signed newsletter confirmation/unsubscribe, token-bearing booking status, payment frame/return/recovery, best-effort hold release, verified provider callbacks/webhooks, reconciliation, and queued/retried customer email remain available and derive locale only from stored records. These exception routes resolve/verify the signed token first and never become searchable or listed. Add explicit disable-mid-checkout, disable-before-callback, disable-before-newsletter-token, and disable-before-email-retry tests.

- [ ] **Step 7: Run payment replay, callback, adapter, formatter, and email suites**

Run:

```powershell
npm --prefix rammah-api run test:integration -- src/modules/localization/payment-email-locale.integration.test.ts
npm --prefix rammah-api run test:integration -- src/modules/payments src/modules/emails
npm --prefix rammah-api run test:unit -- src/shared/i18n/formatters.unit.test.ts
npm --prefix rammah-api run typecheck
```

Expected: PASS, including forged replay tests from `SEC-01`; locale cannot alter payment evidence or state.

- [ ] **Step 8: Commit trusted return/email locale**

```powershell
git add rammah-api/src/modules/payments rammah-api/src/modules/emails rammah-api/src/worker rammah-api/src/shared/i18n rammah-api/src/modules/localization/payment-email-locale.integration.test.ts docs/03-architecture/Payment-Architecture.md docs/03-architecture/Email-Notification-Architecture.md
git commit -m "feat(i18n): localize trusted payment returns and email"
```

### Task 12: Make frontend API clients and customer components locale-explicit

**Files:**
- Modify: `rammah-next/lib/api/cms.ts`
- Modify: `rammah-next/lib/api/offerings.ts`
- Modify: `rammah-next/lib/api/bookings.ts`
- Create: `rammah-next/lib/api/public-error.ts`
- Create: `rammah-next/lib/api/localized-api.test.ts`
- Modify: `rammah-next/components/PublicFrame.tsx`
- Modify: `rammah-next/components/Navbar.tsx`
- Modify: `rammah-next/components/Footer.tsx`
- Modify: `rammah-next/components/HomeClient.tsx`
- Modify: `rammah-next/components/HeroSection.tsx`
- Modify: `rammah-next/components/AboutSection.tsx`
- Modify: `rammah-next/components/MethodologySection.tsx`
- Modify: `rammah-next/components/StatementSection.tsx`
- Modify: `rammah-next/components/ServicesSection.tsx`
- Modify: `rammah-next/components/LoadingScreen.tsx`
- Modify: `rammah-next/components/FloatingCTA.tsx`
- Modify: `rammah-next/components/ContactForm.tsx`
- Modify: `rammah-next/components/CTASection.tsx`
- Modify: `rammah-next/components/corporate/CorporateQuoteForm.tsx`
- Modify: `rammah-next/components/BookingFlow.tsx`
- Modify: `rammah-next/components/BookingLanding.tsx`
- Modify: `rammah-next/components/BookingPaymentFrame.tsx`
- Modify: `rammah-next/components/BookingStatus.tsx`
- Modify: `rammah-next/components/LegalDocument.tsx`
- Modify: `rammah-next/components/about/AboutExperience.tsx`
- Modify: `rammah-next/components/about/AboutGlobe.tsx`
- Modify: `rammah-next/components/services/ServicesStack.tsx`
- Modify: `rammah-next/components/corporate/CorporateExperience.tsx`
- Modify: `rammah-next/app/page.tsx`
- Modify: `rammah-next/app/about/page.tsx`
- Modify: `rammah-next/app/services/page.tsx`
- Modify: `rammah-next/app/services/[slug]/page.tsx`
- Modify: `rammah-next/app/services/corporate-training/page.tsx`
- Modify: `rammah-next/app/blog/page.tsx`
- Modify: `rammah-next/app/blog/[slug]/page.tsx`
- Modify: `rammah-next/app/contact/page.tsx`
- Modify: `rammah-next/app/privacy-policy/page.tsx`
- Modify: `rammah-next/app/terms-and-conditions/page.tsx`
- Modify: `rammah-next/app/privacy/page.tsx`
- Modify: `rammah-next/app/terms/page.tsx`
- Modify: `rammah-next/app/thank-you/page.tsx`
- Modify: `rammah-next/app/newsletter/confirm/page.tsx` created by `FEAT-02`
- Modify: `rammah-next/app/newsletter/unsubscribe/page.tsx` created by `FEAT-02`
- Modify: `rammah-next/app/booking/page.tsx`
- Modify: `rammah-next/app/booking/[slug]/page.tsx`
- Modify: `rammah-next/app/booking/status/page.tsx`
- Modify: `rammah-next/app/booking/status/[publicToken]/page.tsx`
- Modify: `rammah-next/app/booking/payment/[publicToken]/page.tsx`
- Modify: `rammah-next/app/booking/payment/return/page.tsx`
- Create: `rammah-next/components/booking/BookingFlow.locale.test.tsx`
- Create: `rammah-next/components/i18n/LocaleChangeGuard.tsx`
- Create: `rammah-next/components/i18n/LocaleChangeGuard.test.tsx`
- Modify: `docs/03-architecture/Frontend-Architecture.md`

**Interfaces:**
- Consumes: Tasks 1-4 frontend locale primitives/messages/routes and Tasks 8-11 locale-aware APIs.
- Produces: `PublicApiError`, all public API methods require `PublicLocale`; all submissions send locale; every existing English route is migrated before props become required; customer-facing components use locale context/messages/formatters; dirty forms guard language changes without persisting PII.

- [ ] **Step 1: Write failing API-client locale tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicPageByKey } from "./cms";
import { fetchPublicOffering } from "./offerings";
import { submitFreeBooking } from "./bookings";

describe("localized API clients", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds locale to CMS and offering reads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await fetchPublicPageByKey("about", "ar");
    await fetchPublicOffering("جلسة-الوضوح", "ar");
    expect(String(fetchMock.mock.calls[0][0])).toContain("locale=ar");
    expect(String(fetchMock.mock.calls[1][0])).toContain("locale=ar");
  });

  it("sends locale in booking submissions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { id: "booking" } }), { status: 201 }));
    await submitFreeBooking({ locale: "ar", holdId: "00000000-0000-0000-0000-000000000001", customer: { fullName: "أحمد", email: "a@example.com" }, timezone: "Africa/Cairo", answers: [] });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ locale: "ar" });
  });
});
```

- [ ] **Step 2: Run and verify signature failures**

Run: `npm --prefix rammah-next run test:unit -- lib/api/localized-api.test.ts`

Expected: FAIL because current clients do not accept locale.

- [ ] **Step 3: Change every public read signature to require locale**

Use this exact query helper:

```ts
const withLocale = (path: string, locale: PublicLocale) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}locale=${encodeURIComponent(locale)}`;
};
```

Use one structured public error instead of generic fetch errors:

```ts
import { enMessages } from "@/lib/i18n/messages/en";
import type { Messages } from "@/lib/i18n/messages/types";

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: keyof Messages["errors"],
    public readonly requestId: string | null,
  ) {
    super(code);
  }
}

const publicErrorCodes = new Set<keyof Messages["errors"]>(
  Object.keys(enMessages.errors) as Array<keyof Messages["errors"]>,
);

const toPublicErrorCode = (value: unknown): keyof Messages["errors"] =>
  typeof value === "string" && publicErrorCodes.has(value as keyof Messages["errors"])
    ? value as keyof Messages["errors"]
    : "UNKNOWN_ERROR";

export async function readPublicResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { data?: T; error?: { code?: string }; requestId?: string } | null;
  if (!response.ok || payload?.data === undefined) {
    throw new PublicApiError(response.status, toPublicErrorCode(payload?.error?.code), payload?.requestId ?? response.headers.get("x-request-id"));
  }
  return payload.data;
}
```

Route loaders translate `LOCALIZED_CONTENT_NOT_FOUND`/`404` to `notFound()` and let other failures reach the localized route error boundary; they never return English fallback content for Arabic.

Required signatures:

```ts
fetchPublicSiteSettings(locale: PublicLocale): Promise<PublicSiteSettings | null>;
fetchPublicNavigation(locale: PublicLocale, location?: string): Promise<PublicNavigationItem[]>;
fetchPublicLegalPage(slug: string, locale: PublicLocale): Promise<PublicLegalPage>;
fetchPublicLegalPageByKey(baseKey: string, locale: PublicLocale): Promise<PublicLegalPage>;
fetchPublicPage(slug: string, locale: PublicLocale): Promise<PublicPage>;
fetchPublicPageByKey(baseKey: string, locale: PublicLocale): Promise<PublicPage>;
fetchPublicBlogPosts(locale: PublicLocale): Promise<PublicBlogPost[]>;
fetchPublicBlogPost(slug: string, locale: PublicLocale): Promise<PublicBlogPost>;
fetchPublicOfferings(locale: PublicLocale, signal?: AbortSignal): Promise<ServiceCard[]>;
fetchPublicOffering(slug: string, locale: PublicLocale, signal?: AbortSignal): Promise<PublicOffering>;
fetchPublicOfferingBookingConfig(offeringId: string, locale: PublicLocale, signal?: AbortSignal): Promise<BookingConfig>;
fetchPublicAvailability(input: AvailabilityQuery, locale: PublicLocale, signal?: AbortSignal): Promise<AvailabilityResult>;
fetchPublicSessions(input: SessionsQuery, locale: PublicLocale, signal?: AbortSignal): Promise<PublicSessionsResult>;
previewPublicPrice(input: PricePreviewInput, locale: PublicLocale, signal?: AbortSignal): Promise<PricePreview>;
```

Extend localized response types with `resourceId`, `locale`, and `availableLocales` exactly as the API returns them.

- [ ] **Step 4: Require locale in every public submission input**

```ts
export type LocalizedSubmission = { locale: PublicLocale };

export type CreateBookingInput = LocalizedSubmission & {
  holdId: string;
  attendanceMode?: "online" | "offline" | "hybrid";
  locationId?: string | null;
  customer: { fullName: string; email: string; phone?: string | null };
  countryCode?: string | null;
  timezone: string;
  answers: Array<{ fieldId: string; fieldKey: string; value?: string | null }>;
};
```

Apply `LocalizedSubmission` to paid booking, quote, contact, and newsletter inputs. Add `acceptedPrivacy: true` and the opaque signed `consentReceipt` only to flows whose approved schema requires consent; never send a raw legal version/ID/hash. Remove client-supplied booking answer labels.

- [ ] **Step 5: Write a failing Arabic booking component test**

```tsx
it("renders Arabic booking labels and submits the same machine values", async () => {
  render(<LocaleProvider locale="ar"><BookingFlow initialOffering={fixtureOffering} /></LocaleProvider>);
  expect(screen.getByRole("heading", { name: "احجز جلسة" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "تأكيد الحجز" }));
  expect(submitFreeBookingMock).toHaveBeenCalledWith(expect.objectContaining({
    locale: "ar",
    holdId: fixtureHold.id,
    timezone: "Africa/Cairo",
  }));
});

it("warns before a language switch clears a dirty form and releases an active hold", async () => {
  renderArabicDirtyBookingWithSwitcher();
  await userEvent.click(screen.getByRole("link", { name: "English" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("تغيير اللغة سيحذف البيانات");
  await userEvent.click(screen.getByRole("button", { name: "تغيير اللغة وحذف البيانات" }));
  expect(releaseSlotHoldMock).toHaveBeenCalledWith(fixtureHold.id);
  expect(navigateMock).toHaveBeenCalledWith("/booking/clarity-session");
});
```

- [ ] **Step 6: Replace hardcoded public copy and Intl locale usage**

In each listed public component:

```tsx
const { locale, messages } = usePublicLocale();
```

Use `messages` for static labels/errors/actions, CMS/API data for localized content, and `formatPublicDate`, `formatPublicDateTime`, and `formatPublicMoney` for display. Replace every public `new Intl.*("en", ...)` call. Wrap email, phone, UUID, payment/booking reference output with `<bdi dir="ltr">` and `isolateLtr` only for plain-text email generation.

Forms register dirty/active-hold state with `LocaleChangeGuard`. A clean journey switches immediately. A dirty contact/quote/newsletter/booking form opens a localized accessible confirmation; cancel keeps all state, confirm clears in-memory customer data, best-effort releases an active hold, and navigates to the explicit counterpart. Never put customer-entered PII in the URL, `localStorage`, analytics, or the locale-switch event.

The submit handlers pass `locale`; state machines, hold IDs, timestamps, price minor units, currencies, and provider references are unchanged.

In the same step, change `PublicFrame` to require `locale` and `routeTargets`, fetch navigation with that locale, and pass the language switcher to `Navbar`. Migrate every current English public page caller to pass `"en"` and an explicit target pair before running typecheck. Navigation/API failures are not swallowed with `.catch(() => [])`: either let the localized route error boundary handle the failure or return an explicit localized degraded-navigation state with a retry/request ID. Task 13 may then extract those already-green wrappers into shared page functions without an intermediate broken build.

The URL locale is the only authority for the currently rendered labels, direction, date/money display, validation, and error copy. A stored booking/lead locale is read-only presentation metadata on status screens and remains the authority for automatic callback redirects and outbound email; simply viewing or switching a token-bearing status URL never mutates the stored booking or business state. Add a component/API contract test for an Arabic booking opened through the English status URL and switched back to Arabic.

- [ ] **Step 7: Add a CI guard against new hardcoded customer English**

Create `rammah-next/scripts/check-public-i18n.mjs` that recursively scans all public files under `rammah-next/app`, `rammah-next/components`, and `rammah-next/features/public` for `Intl.DateTimeFormat("en"`, `Intl.NumberFormat("en"`, and JSX text matching the message-contract English values. Exclude `app/admin`, admin components, tests/fixtures, `messages/en.ts`, generated code, and a reviewed allowlist of machine/provider values; each allowlist entry includes file, exact token, owner, and reason. It exits 1 with file and line.

```js
if (violations.length) {
  for (const violation of violations) console.error(`${violation.file}:${violation.line} ${violation.reason}`);
  process.exit(1);
}
console.log("Public i18n static-copy guard passed");
```

Add `"i18n:check": "node scripts/check-public-i18n.mjs"` to `rammah-next/package.json` and frontend CI.

- [ ] **Step 8: Run component, guard, and type checks**

Run:

```powershell
npm --prefix rammah-next run test:unit -- lib/api/localized-api.test.ts components/booking/BookingFlow.locale.test.tsx
npm --prefix rammah-next run i18n:check
npm --prefix rammah-next run lint
npm --prefix rammah-next run typecheck
```

Expected: PASS with no hardcoded English Intl locale in public components.

- [ ] **Step 9: Commit locale-explicit frontend flows**

```powershell
git add rammah-next/lib/api rammah-next/lib/i18n rammah-next/components rammah-next/app rammah-next/scripts/check-public-i18n.mjs rammah-next/package.json .github/workflows/ci.yml docs/03-architecture/Frontend-Architecture.md
git commit -m "feat(i18n): localize public customer components"
```

### Task 13: Add the complete `/ar` route tree without duplicating business logic

**Files:**
- Create: `rammah-next/features/public/pages/content-pages.tsx`
- Create: `rammah-next/features/public/pages/catalog-pages.tsx`
- Create: `rammah-next/features/public/pages/blog-pages.tsx`
- Create: `rammah-next/features/public/pages/lead-pages.tsx`
- Create: `rammah-next/features/public/pages/booking-pages.tsx`
- Create: `rammah-next/features/public/pages/index.ts`
- Create: `rammah-next/features/public/pages/localized-pages.test.tsx`
- Create: `rammah-next/app/ar/page.tsx`
- Create: `rammah-next/app/ar/about/page.tsx`
- Create: `rammah-next/app/ar/services/page.tsx`
- Create: `rammah-next/app/ar/services/[slug]/page.tsx`
- Create: `rammah-next/app/ar/blog/page.tsx`
- Create: `rammah-next/app/ar/blog/[slug]/page.tsx`
- Create: `rammah-next/app/ar/contact/page.tsx`
- Create: `rammah-next/app/ar/privacy-policy/page.tsx`
- Create: `rammah-next/app/ar/terms-and-conditions/page.tsx`
- Create: `rammah-next/app/ar/privacy/page.tsx`
- Create: `rammah-next/app/ar/terms/page.tsx`
- Create: `rammah-next/app/ar/thank-you/page.tsx`
- Create: `rammah-next/app/ar/newsletter/confirm/page.tsx`
- Create: `rammah-next/app/ar/newsletter/unsubscribe/page.tsx`
- Create: `rammah-next/app/ar/booking/page.tsx`
- Create: `rammah-next/app/ar/booking/[slug]/page.tsx`
- Create: `rammah-next/app/ar/booking/status/page.tsx`
- Create: `rammah-next/app/ar/booking/status/[publicToken]/page.tsx`
- Create: `rammah-next/app/ar/booking/payment/[publicToken]/page.tsx`
- Create: `rammah-next/app/ar/booking/payment/return/page.tsx`
- Create: `rammah-next/app/ar/error.tsx`
- Create: `rammah-next/app/ar/not-found.tsx`
- Modify: `rammah-next/app/page.tsx`
- Modify: `rammah-next/app/about/page.tsx`
- Modify: `rammah-next/app/services/page.tsx`
- Modify: `rammah-next/app/services/[slug]/page.tsx`
- Modify: `rammah-next/app/services/corporate-training/page.tsx`
- Modify: `rammah-next/app/blog/page.tsx`
- Modify: `rammah-next/app/blog/[slug]/page.tsx`
- Modify: `rammah-next/app/contact/page.tsx`
- Modify: `rammah-next/app/privacy-policy/page.tsx`
- Modify: `rammah-next/app/terms-and-conditions/page.tsx`
- Modify: `rammah-next/app/privacy/page.tsx`
- Modify: `rammah-next/app/terms/page.tsx`
- Modify: `rammah-next/app/thank-you/page.tsx`
- Modify: `rammah-next/app/newsletter/confirm/page.tsx` created by `FEAT-02`
- Modify: `rammah-next/app/newsletter/unsubscribe/page.tsx` created by `FEAT-02`
- Modify: `rammah-next/app/booking/page.tsx`
- Modify: `rammah-next/app/booking/[slug]/page.tsx`
- Modify: `rammah-next/app/booking/status/page.tsx`
- Modify: `rammah-next/app/booking/status/[publicToken]/page.tsx`
- Modify: `rammah-next/app/booking/payment/[publicToken]/page.tsx`
- Modify: `rammah-next/app/booking/payment/return/page.tsx`
- Modify: `docs/04-ux-and-flows/Public-Site-Flows.md`
- Modify: `docs/04-ux-and-flows/Booking-Flow.md`

**Interfaces:**
- Consumes: locale-aware frontend clients/components and route targets.
- Produces: focused page modules exporting `renderHome`, `renderAbout`, `renderServices`, `renderServiceDetail`, `renderBlog`, `renderBlogDetail`, `renderContact`, `renderLegal`, `renderThankYou`, newsletter functions, and booking/payment/status functions through `features/public/pages/index.ts`. `renderServiceDetail` selects the existing corporate quote experience for the corporate/quote-only offering and the standard detail experience for other offerings.

File ownership is fixed:

| Shared file | Exports |
| --- | --- |
| `content-pages.tsx` | `renderHome`, `renderAbout`, `renderLegal`, `renderThankYou(locale, searchParams)` |
| `catalog-pages.tsx` | `renderServices`, `renderServiceDetail` |
| `blog-pages.tsx` | `renderBlog`, `renderBlogDetail` |
| `lead-pages.tsx` | `renderContact`, `renderNewsletterConfirm`, `renderNewsletterUnsubscribe` |
| `booking-pages.tsx` | `renderBookingLanding`, `renderBookingOffering`, `renderBookingStatusLookup`, `renderBookingStatus`, `renderPayment`, `renderPaymentReturn` |
| `index.ts` | named re-exports only; no rendering logic |

- [ ] **Step 1: Write a failing shared-page rendering test**

```tsx
it("uses one page loader for both locales", async () => {
  fetchPublicPageByKeyMock.mockResolvedValueOnce(arabicAboutFixture);
  const result = await renderAbout("ar");
  render(result);
  expect(fetchPublicPageByKeyMock).toHaveBeenCalledWith("about", "ar");
  expect(screen.getByText("عن أحمد رماح")).toBeInTheDocument();
});
```

- [ ] **Step 2: Create shared locale-aware page functions**

Each exported function accepts an explicit `PublicLocale`; dynamic functions also accept the decoded route parameter. The About function is:

```tsx
export async function renderAbout(locale: PublicLocale) {
  const page = await fetchPublicPageByKey("about", locale);
  const targets = {
    en: "/about",
    ar: page.availableLocales.ar ? "/ar/about" : null,
  };
  return <PublicFrame locale={locale} routeTargets={targets}><AboutExperience page={page} /></PublicFrame>;
}
```

Every Arabic discovery/new-submission renderer calls Task 1's server-only feature assertion before loading public data. Signed newsletter confirm/unsubscribe and verified booking status/payment/return/recovery renderers use Task 11's in-flight policy instead: they validate the token/stored record, remain `noindex`/`no-store`, and continue when discovery is disabled. Authenticated Draft Mode preview uses only the bound admin preview context. This prevents Task 13 from temporarily exposing unguarded Arabic routes before Task 16 adds SEO/preflight coverage.

For static CMS page identities (`home`, `about`, `contact`), fetch through `fetchPublicPageByKey` and build targets from the explicit static route map, not slug replacement. `renderLegal` fetches `privacy-policy` or `terms-and-conditions` through `fetchPublicLegalPageByKey`, so a localized Arabic content slug can differ without changing the fixed public route. For offering/blog detail, use `availableLocales` translated slugs. For token routes, preserve the validated token and build both locale-prefixed paths directly.

`renderServiceDetail` branches on trusted offering fields, not slug text: corporate or quote-only offerings render `CorporateExperience` and the locale-aware `CorporateQuoteForm`; bookable offerings render the standard service detail and booking CTA. The existing `/services/corporate-training` wrapper calls `renderServiceDetail("en", "corporate-training")`; its switch target comes from the offering's published Arabic slug and is served by `app/ar/services/[slug]/page.tsx`.

- [ ] **Step 3: Add thin route files with explicit locale**

Use this exact wrapper-to-export map:

| Route file | Export call |
| --- | --- |
| `app/ar/page.tsx` | `renderHome("ar")` |
| `app/ar/about/page.tsx` | `renderAbout("ar")` |
| `app/ar/services/page.tsx` | `renderServices("ar")` |
| `app/ar/services/[slug]/page.tsx` | `renderServiceDetail("ar", slug)` |
| `app/ar/blog/page.tsx` | `renderBlog("ar")` |
| `app/ar/blog/[slug]/page.tsx` | `renderBlogDetail("ar", slug)` |
| `app/ar/contact/page.tsx` | `renderContact("ar")` |
| `app/ar/privacy-policy/page.tsx` | `renderLegal("ar", "privacy-policy")` |
| `app/ar/terms-and-conditions/page.tsx` | `renderLegal("ar", "terms-and-conditions")` |
| `app/ar/thank-you/page.tsx` | `renderThankYou("ar", searchParams)` |
| `app/ar/newsletter/confirm/page.tsx` | `renderNewsletterConfirm("ar", searchParams)` |
| `app/ar/newsletter/unsubscribe/page.tsx` | `renderNewsletterUnsubscribe("ar", searchParams)` |
| `app/ar/booking/page.tsx` | `renderBookingLanding("ar")` |
| `app/ar/booking/[slug]/page.tsx` | `renderBookingOffering("ar", slug)` |
| `app/ar/booking/status/page.tsx` | `renderBookingStatusLookup("ar")` |
| `app/ar/booking/status/[publicToken]/page.tsx` | `renderBookingStatus("ar", publicToken)` |
| `app/ar/booking/payment/[publicToken]/page.tsx` | `renderPayment("ar", publicToken)` |
| `app/ar/booking/payment/return/page.tsx` | `renderPaymentReturn("ar", searchParams)` |

Static Arabic files use this exact form with the export named in the table:

```tsx
import { renderAbout } from "@/features/public/pages";
export default function ArabicAboutPage() { return renderAbout("ar"); }
```

Dynamic Arabic offering files use:

```tsx
import { renderServiceDetail } from "@/features/public/pages";
export default async function ArabicServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderServiceDetail("ar", slug);
}
```

Next supplies dynamic segment params decoded; wrappers pass `slug` once and API clients apply `encodeURIComponent` when building the backend URL, avoiding double-decoding and malformed-percent crashes. Token route files validate the UUID through the existing API/error path and never treat it as content. Existing English pages become equally thin wrappers passing `"en"`.

Both thank-you wrappers accept Next `searchParams`, read only `type`, and validate it against the closed set `contact | booking | default`; missing or invalid values render `default`. They never reflect raw query text, accept a redirect target, or preserve tracking/PII. Newsletter confirmation/unsubscribe accept only their signed token. Payment return accepts only the booking token allowlisted in Task 4.

- [ ] **Step 4: Add canonical redirects for duplicate legal aliases**

```tsx
import { redirect } from "next/navigation";
export default function LegacyPrivacyPage() { redirect("/privacy-policy"); }
```

Use `/privacy -> /privacy-policy`, `/terms -> /terms-and-conditions`, `/ar/privacy -> /ar/privacy-policy`, and `/ar/terms -> /ar/terms-and-conditions`.

- [ ] **Step 5: Add Arabic route error and not-found boundaries**

```tsx
"use client";
import { usePublicLocale } from "@/components/i18n/LocaleProvider";

export default function ArabicRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { messages } = usePublicLocale();
  return <main><h1>{messages.errors.UNKNOWN_ERROR}</h1>{error.digest ? <bdi dir="ltr">{error.digest}</bdi> : null}<button onClick={reset}>{messages.common.retry}</button></main>;
}
```

```tsx
import Link from "next/link";
export default function ArabicNotFound() {
  return <main lang="ar" dir="rtl"><h1>الصفحة غير موجودة</h1><Link href="/ar">العودة إلى الرئيسية</Link></main>;
}
```

Neither boundary exposes raw API/provider messages or silently redirects to English.

- [ ] **Step 6: Run page tests and clean build**

Run:

```powershell
npm --prefix rammah-next run test:unit -- features/public/pages/localized-pages.test.tsx
npm --prefix rammah-next run lint
npm --prefix rammah-next run typecheck
npm --prefix rammah-next run build
```

Expected: PASS; Next route manifest contains every listed `/ar` route and existing English routes.

- [ ] **Step 7: Commit the shared route tree**

```powershell
git add rammah-next/features/public/pages rammah-next/app docs/04-ux-and-flows/Public-Site-Flows.md docs/04-ux-and-flows/Booking-Flow.md
git commit -m "feat(i18n): add complete Arabic public route tree"
```

### Task 14: Make layout, animation, and interactive controls RTL-safe

**Files:**
- Create: `rammah-next/lib/i18n/logical-motion.ts`
- Create: `rammah-next/lib/i18n/logical-motion.test.ts`
- Create: `rammah-next/scripts/check-rtl-css.mjs`
- Modify: `rammah-next/app/globals.css`
- Modify: `rammah-next/components/Navbar.tsx`
- Modify: `rammah-next/components/Footer.tsx`
- Modify: `rammah-next/components/FloatingCTA.module.css`
- Modify: `rammah-next/components/ServicesSection.tsx`
- Modify: `rammah-next/components/MethodologySection.tsx`
- Modify: `rammah-next/components/about/AboutExperience.module.css`
- Modify: `rammah-next/components/about/AboutExperience.tsx`
- Modify: `rammah-next/components/about/AboutGlobe.tsx`
- Modify: `rammah-next/components/corporate/CorporateExperience.module.css`
- Modify: `rammah-next/components/corporate/CorporateExperience.tsx`
- Modify: `rammah-next/components/services/ServicesStack.tsx`
- Modify: `rammah-next/app/services/[slug]/page.tsx`
- Modify: `rammah-next/components/AboutSection.tsx`
- Modify: `rammah-next/components/BookingFlow.tsx`
- Modify: `rammah-next/components/BookingLanding.tsx`
- Modify: `rammah-next/components/BookingPaymentFrame.tsx`
- Modify: `rammah-next/components/BookingStatus.tsx`
- Modify: `rammah-next/components/ContactForm.tsx`
- Modify: `rammah-next/components/CTASection.tsx`
- Modify: `rammah-next/components/HeroSection.tsx`
- Modify: `rammah-next/components/LoadingScreen.tsx`
- Modify: `rammah-next/components/corporate/CorporateQuoteForm.tsx`
- Create: `rammah-next/tests/e2e/rtl-layout.spec.ts`
- Create: `rammah-next/lighthouserc.i18n.cjs`
- Modify: `rammah-next/package.json`
- Modify: `rammah-next/package-lock.json`
- Modify: `docs/03-architecture/Frontend-Architecture.md`

**Interfaces:**
- Consumes: locale context and direction.
- Produces: `logicalX(direction, ltrValue)`, CSS logical-property guard, no-overflow/keyboard RTL E2E.

- [ ] **Step 1: Write failing logical-motion tests**

```ts
import { describe, expect, it } from "vitest";
import { logicalX } from "./logical-motion";

describe("logical motion", () => {
  it("mirrors direction-sensitive x values", () => {
    expect(logicalX("ltr", 120)).toBe(120);
    expect(logicalX("rtl", 120)).toBe(-120);
    expect(logicalX("rtl", -40)).toBe(40);
  });
});
```

- [ ] **Step 2: Implement the pure motion helper**

```ts
export const logicalX = (direction: "ltr" | "rtl", ltrValue: number) =>
  direction === "rtl" ? -ltrValue : ltrValue;
```

- [ ] **Step 3: Add a failing RTL CSS guard**

The guard scans public TSX/CSS/module.css files and fails on directional declarations/classes that lack an inline `rtl-physical-ok:` justification comment. Detect:

```js
const forbidden = [
  /\b(margin|padding|border)-(left|right)\s*:/,
  /\b(left|right)\s*:/,
  /\b(text-left|text-right|ml-|mr-|pl-|pr-|left-|right-)\b/,
];
```

Run: `node rammah-next/scripts/check-rtl-css.mjs`

Expected: FAIL and print every current public directional occurrence.

- [ ] **Step 4: Convert public layout to logical direction**

Use these exact conversion rules:

```css
/* Before */ margin-left: auto;
/* After  */ margin-inline-start: auto;
/* Before */ padding-right: 1rem;
/* After  */ padding-inline-end: 1rem;
/* Before */ left: 0;
/* After  */ inset-inline-start: 0;
/* Before */ text-align: left;
/* After  */ text-align: start;
```

Tailwind conversions are `ml-* -> ms-*`, `mr-* -> me-*`, `pl-* -> ps-*`, `pr-* -> pe-*`, `left-* -> start-*`, `right-* -> end-*`, and `text-left/right -> text-start/end`. Keep nondirectional brand/media/play icons unmirrored. Use `logicalX(direction, value)` for every GSAP/Motion entrance/exit value whose meaning is start/end, including `AboutExperience.tsx`, `AboutGlobe.tsx`, `CorporateExperience.tsx`, and `ServicesStack.tsx`.

Apply the Arabic font variable declared in the root layout instead of merely loading it:

```css
html[lang="ar"] body { font-family: var(--font-arabic), system-ui, sans-serif; }
html[lang="en"] body { font-family: var(--font-english), system-ui, sans-serif; }
```

The E2E test asserts the computed Arabic body font contains the Arabic family and the English route retains the English family.

- [ ] **Step 5: Write the no-overflow and keyboard E2E first**

```ts
test("Arabic customer pages are RTL with no horizontal overflow", async ({ page }) => {
  for (const path of ["/ar", "/ar/about", "/ar/services", "/ar/services/%D8%AC%D9%84%D8%B3%D8%A9-%D8%A7%D9%84%D9%88%D8%B6%D9%88%D8%AD", "/ar/blog", "/ar/blog/%D9%85%D9%82%D8%A7%D9%84", "/ar/contact", "/ar/privacy-policy", "/ar/terms-and-conditions", "/ar/thank-you?type=contact", "/ar/booking", "/ar/booking/%D8%AC%D9%84%D8%B3%D8%A9-%D8%A7%D9%84%D9%88%D8%B6%D9%88%D8%AD"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
```

Add keyboard assertions that navigation/menu/forms follow DOM meaning rather than visual reversal, and reduced-motion assertions that content remains visible.

Run the same route-family table in desktop and mobile viewports. Add targeted bidi fixtures containing an email, phone, UUID, EGP amount, booking reference, URL, and mixed Arabic/Latin offering title; assert each machine value is isolated, copyable in logical order, and does not reorder adjacent punctuation. Token-bearing status/payment routes use deterministic safe fixtures and are explicitly `noindex`.

- [ ] **Step 6: Run RTL guard, unit, E2E, axe, and visual checks**

Run:

```powershell
npm --prefix rammah-next install --save-dev @axe-core/playwright @lhci/cli
node rammah-next/scripts/check-rtl-css.mjs
npm --prefix rammah-next run test:unit -- lib/i18n/logical-motion.test.ts
npm --prefix rammah-next run test:e2e -- tests/e2e/rtl-layout.spec.ts
npm --prefix rammah-next exec lhci autorun -- --config=lighthouserc.i18n.cjs
```

Expected: PASS, no horizontal overflow, zero critical/serious axe findings, correct `lang/dir` and computed fonts, and approved desktop/mobile screenshots. Lighthouse runs deterministic `/`, `/ar`, `/services`, and `/ar/services` fixtures with mobile performance score >= 0.85, accessibility score = 1.0, LCP <= 2500 ms, CLS <= 0.10, TBT <= 200 ms, and Arabic transfer/JS budgets no more than 10% above the equivalent English route. Task 17 creates the four named locale projects; this task intentionally runs the foundation project's existing browser configuration so its checkpoint is executable.

- [ ] **Step 7: Commit RTL-safe UI**

```powershell
git add rammah-next/app/globals.css rammah-next/components rammah-next/lib/i18n/logical-motion* rammah-next/scripts/check-rtl-css.mjs rammah-next/tests/e2e/rtl-layout.spec.ts rammah-next/lighthouserc.i18n.cjs rammah-next/package.json rammah-next/package-lock.json docs/03-architecture/Frontend-Architecture.md
git commit -m "feat(i18n): make public experience RTL-safe"
```

### Task 15: Add bilingual admin authoring, completeness, preview, and publication gates

**Files:**
- Create: `rammah-api/src/modules/localization/admin-localization.routes.ts`
- Create: `rammah-api/src/modules/localization/admin-localization.service.ts`
- Create: `rammah-api/src/modules/localization/admin-localization.repository.ts`
- Create: `rammah-api/src/modules/localization/localization-completeness.ts`
- Create: `rammah-api/src/modules/localization/admin-localization.integration.test.ts`
- Create: `rammah-api/src/modules/localization/publish-scheduled-translations.ts`
- Create: `rammah-api/src/modules/localization/publish-scheduled-translations.integration.test.ts`
- Modify: `rammah-api/src/app.ts`
- Modify: `rammah-api/src/modules/cms/admin-cms.routes.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.routes.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.service.ts`
- Modify: `rammah-api/src/modules/booking-form-fields/admin-booking-form-fields.routes.ts`
- Modify: `rammah-api/src/modules/emails/admin-emails.routes.ts`
- Modify: `rammah-api/src/modules/locations/admin-locations.routes.ts`
- Modify: `rammah-api/src/modules/media/admin-media.routes.ts` delivered by `FEAT-07`
- Modify: `rammah-api/src/worker/handlers/scheduled-publication.handler.ts` delivered by `JOB-02`/`FEAT-11`
- Create: `rammah-next/components/admin/localization/translation-resource.types.ts`
- Create: `rammah-next/components/admin/localization/translation-field-registry.ts`
- Create: `rammah-next/components/admin/localization/LocalizedEditor.tsx`
- Create: `rammah-next/components/admin/localization/AdminLocaleTabs.tsx`
- Create: `rammah-next/components/admin/localization/TranslationCompleteness.tsx`
- Create: `rammah-next/components/admin/localization/AdminLocaleTabs.test.tsx`
- Modify: `rammah-next/components/admin/AdminCms.tsx`
- Modify: `rammah-next/components/admin/AdminOfferingEditor.tsx`
- Modify: `rammah-next/components/admin/AdminBookingFormFields.tsx`
- Modify: `rammah-next/components/admin/AdminEmails.tsx`
- Modify: `rammah-next/components/admin/AdminLocations.tsx`
- Modify: `rammah-next/components/admin/AdminMediaLibrary.tsx` delivered by `FEAT-07`
- Create: `rammah-next/components/admin/AdminBlog.tsx`
- Create: `rammah-next/components/admin/AdminSeo.tsx`
- Create: `rammah-next/app/admin/(protected)/media/page.tsx`
- Create: `rammah-next/app/admin/(protected)/blog/page.tsx`
- Create: `rammah-next/app/admin/(protected)/seo/page.tsx`
- Modify: `rammah-next/lib/api/admin.ts`
- Create: `rammah-next/lib/api/admin-preview.ts`
- Create: `rammah-next/app/admin/preview/route.ts`
- Create: `rammah-next/app/admin/preview/exit/route.ts`
- Create: `rammah-next/app/admin/preview/route.test.ts`
- Modify: `docs/04-ux-and-flows/Admin-Dashboard-Flows.md`

**Interfaces:**
- Consumes: translation tables, rich-text sanitizer/editor from `FEAT-11`, admin auth/roles/audit from `SEC-05/08`.
- Produces: `TranslationResourceType`, typed `TranslationBundle`/field registry, `getTranslationBundle`, `saveTranslationDraft`, `publishTranslation`, `unpublishTranslation`, `copyEnglishToArabicDraft`, `publishScheduledTranslations`, completeness rules, English/Arabic admin tabs, operator locale filters, and revision-safe legal/email publication.

- [ ] **Step 1: Write failing permission and completeness integration tests**

```ts
it("prevents an editor from publishing incomplete Arabic legal content", async () => {
  const session = await loginAs("editor");
  const resource = await seedLegalPageWithArabicDraft({ body: "" });
  const response = await session.post(`/api/v1/admin/localization/legal_page/${resource.id}/ar/publish`).send({});
  expect(response.status).toBe(422);
  expect(response.body.error).toMatchObject({ code: "TRANSLATION_INCOMPLETE" });
  expect(response.body.error.details.missing).toContain("body");
});

it("publishes a complete Arabic offering and writes an audit event", async () => {
  const session = await loginAs("editor");
  const resource = await seedCompleteArabicOfferingDraft();
  const response = await session.post(`/api/v1/admin/localization/offering/${resource.id}/ar/publish`).send({});
  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe("published");
  expect(await findAudit("admin.localization.publish", resource.id)).not.toBeNull();
});
```

- [ ] **Step 2: Define the resource registry and completeness result**

```ts
export const translationResourceTypes = [
  "site_settings", "navigation_item", "media_asset", "page", "page_section",
  "legal_page", "seo_metadata", "offering_category", "offering",
  "offline_location", "booking_form_field", "email_template", "blog_category", "blog_post",
] as const;

export type TranslationResourceType = (typeof translationResourceTypes)[number];
export type TranslationCompleteness = {
  complete: boolean;
  missing: string[];
  invalid: Array<{ field: string; reason: string }>;
};
```

Create explicit Zod schemas per resource type. Slugs normalize to Unicode NFC, trim/collapse separators, lowercase Latin code points, allow Unicode letters/numbers plus single hyphens, and reject controls/bidi overrides, `%`, encoded or literal `/`/`\\`, `?`, `#`, dot segments, empty segments, and leading/trailing/doubled hyphens. Detect uniqueness on the normalized stored value. Navigation/footer URLs must be same-origin paths or explicitly allowlisted HTTPS origins; reject protocol-relative, credential-bearing, `javascript:`, `data:`, control-character, percent-encoded separator, and unsafe redirect targets. SEO canonical URLs must use the configured production origin. Rich text and email HTML go through the same server sanitizer as English. Page-section schemas protect structural keys/component/media IDs/behavior flags from localized edits and permit only their declared display keys.

- [ ] **Step 3: Implement explicit completeness rules**

```ts
const requiredFields: Record<TranslationResourceType, readonly string[]> = {
  site_settings: ["siteName"],
  navigation_item: ["label", "url"],
  media_asset: [], // handled by reviewed-alt-or-decorative rule below
  page: ["title", "slug"],
  page_section: [],
  legal_page: ["title", "slug", "body", "version"],
  seo_metadata: ["metaTitle", "metaDescription", "canonicalUrl"],
  offering_category: ["name", "slug"],
  offering: ["title", "slug", "shortDescription", "longDescription"],
  offline_location: ["name", "addressLine1"],
  booking_form_field: ["label"],
  email_template: ["subject", "body"],
  blog_category: ["name", "slug"],
  blog_post: ["title", "slug", "body"],
};

export function checkTranslationCompleteness(type: TranslationResourceType, value: Record<string, unknown>): TranslationCompleteness {
  const missing = requiredFields[type].filter((field) => typeof value[field] !== "string" || !String(value[field]).trim());
  const invalid = type === "booking_form_field" && Array.isArray(value.baseOptions) && Array.isArray(value.options)
    && JSON.stringify(value.baseOptions.map((option) => option.value)) !== JSON.stringify(value.options.map((option) => option.value))
    ? [{ field: "options", reason: "Localized options must preserve the exact ordered base value set." }]
    : [];
  return { complete: missing.length === 0 && invalid.length === 0, missing, invalid };
}
```

For media, completeness is `(isDecorative === true) OR (non-empty altText AND reviewedAt/reviewedByAdminId present)`; the simplified `requiredFields` entry above is replaced by that resource-specific rule. Filename-derived alt never passes. Every translation type evaluates effective lifecycle (`draft | scheduled | published | archived`) independently from its base resource, while public eligibility always requires both the base and translation to be effectively published.

Section-specific config schemas split localized display keys from stable machine configuration and add required localized config keys. Email publication extracts `{{variable}}` placeholders and requires the exact ordered/unique allowlisted variable set for that base template in both locales; missing or invented placeholders block publication. Publication additionally checks referenced media alt text, SEO, required email template set, legal version, safe links, and base resource operational status.

- [ ] **Step 4: Implement authenticated admin routes**

Use exact routes:

```text
GET  /api/v1/admin/localization/:resourceType/:resourceId
PUT  /api/v1/admin/localization/:resourceType/:resourceId/:locale
POST /api/v1/admin/localization/:resourceType/:resourceId/:locale/publish
POST /api/v1/admin/localization/:resourceType/:resourceId/:locale/unpublish
POST /api/v1/admin/localization/:resourceType/:resourceId/ar/copy-from-en
GET  /api/v1/admin/localization/:resourceType/:resourceId/:locale/preview
```

All use `requireAdmin`, CSRF protection on mutations, resource/UUID/locale schemas, role policy, and audit actions `admin.localization.save`, `.schedule`, `.publish`, `.unpublish`. `PUT` writes only the validated `translation_working_copies` record and never mutates the current typed public translation. This lets an editor draft or schedule a replacement while the last published English/Arabic version remains live. Publishing atomically copies the working payload into the typed translation row, updates lifecycle/hash/pointer state, and retains the working/audit history required by policy.

The legacy/base `pages.slug` and `legal_pages.slug` values used by fixed-route lookup become immutable internal keys after the English backfill. Use explicit fixed-key allowlists and reject mutations through both the new localization API and every legacy admin route/service, not just the UI. Admin forms edit only `page_translations.slug`/`legal_page_translations.slug`; API tests reject attempted key mutation. Dynamic offering and blog routing continues to use translated slugs.

During the additive compatibility window, saving/publishing English translations dual-writes the approved display fields to the legacy English base columns in the same transaction and verifies equality. This keeps the pre-localization binary rollback path valid. Do not remove the dual-write until a later migration explicitly retires rollback compatibility and removes legacy readers.

Legal and email publication is revision-based: validate/sanitize the working copy, compute its canonical hash, then atomically create-or-reuse the exact immutable revision and set `publishedRevisionId`, current typed fields, status, and publication time. Legal `(translationId, version)` is immutable: the same version/hash reuses its revision idempotently, while the same version with different content fails `LEGAL_VERSION_CONFLICT` and requires a new approved version. Email `(translationId, contentHash)` reuses the exact revision; new content creates a new hash/revision. Public reads and email enqueue never render the working copy.

Scheduling freezes the canonical working payload/hash as `scheduled`, blocks edits until the admin explicitly cancels it back to draft, and leaves the current typed translation live. `publishScheduledTranslations(now)` locks due working copies with `FOR UPDATE SKIP LOCKED`, revalidates their frozen hash/schema/base state, then invokes the same create-or-reuse publish function idempotently. It never flips status without copying a typed snapshot and, for legal/email, resolving the immutable revision. Tests cover concurrent workers, same-version/same-hash retry, same-version/different-hash rejection, attempted edit-after-schedule rejection, cancel/edit/reschedule, unpublish, republish, and audit history.

Preview uses protected Next Draft Mode, not a public API bypass. `GET /admin/preview?resourceType=&resourceId=&locale=&target=` verifies the existing admin session through the API, validates the resource UUID/type/locale, allowlists a matching target under `/` or `/ar`, enables the signed HttpOnly Draft Mode cookie plus a short-lived signed preview-context cookie bound to that resource and target, then redirects to the clean target. Locale-aware page loaders in Draft Mode validate the bound context and forward the admin session to `GET /api/v1/admin/localization/:resourceType/:resourceId/:locale/preview`; normal public APIs still require published content and the feature flag. The exit route removes both cookies. Preview responses set `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer`; target mismatch, logout, context expiry, or admin session expiry fails closed.

- [ ] **Step 5: Write the failing locale-tab component test**

```tsx
it("shows independent English and Arabic state and blocks incomplete publish", async () => {
  render(<AdminLocaleTabs resourceType="legal_page" resourceId={fixture.id} initialBundle={fixture.bundle} />);
  await userEvent.click(screen.getByRole("tab", { name: "Arabic" }));
  expect(screen.getByText("3 required fields missing")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish Arabic" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Preview Arabic" })).toHaveAttribute("href", expect.stringContaining("/admin/preview?target=%2Far%2F"));
});
```

- [ ] **Step 6: Implement admin locale tabs without translating the shell**

```tsx
export function AdminLocaleTabs({ resourceType, resourceId, initialBundle }: Props) {
  const [locale, setLocale] = useState<PublicLocale>("en");
  const translation = initialBundle.translations[locale];
  return (
    <section>
      <div role="tablist" aria-label="Content locale">
        <button role="tab" aria-selected={locale === "en"} onClick={() => setLocale("en")}>English</button>
        <button role="tab" aria-selected={locale === "ar"} onClick={() => setLocale("ar")}>Arabic</button>
      </div>
      <TranslationCompleteness locale={locale} result={translation.completeness} />
      <LocalizedEditor key={locale} locale={locale} dir={locale === "ar" ? "rtl" : "ltr"} value={translation.workingCopy.value} />
    </section>
  );
}
```

Define `Props`, `TranslationBundle`, per-resource value types, and the editor component registry in the exact files listed above. Each locale bundle exposes `{ currentPublished, workingCopy, completeness, availableActions }`; the UI edits only `workingCopy`. `LocalizedEditor` must not accept `Record<string, unknown>` for rendering; the field registry maps each `TranslationResourceType` to a typed schema/component and direction metadata for text, slug, URL, rich text, option, email variable, and machine fields. Add editors/tabs for site settings, navigation, media, pages/sections, legal, SEO, categories, offerings, locations, booking fields/options, email, blog categories/posts. Admin list/inbox surfaces expose locale/status/completeness filters so operators can find Arabic leads, bookings, email failures, drafts, and scheduled translations.

Editors remain English-labeled. Arabic content inputs set `dir="rtl"`; email/URL/slug/reference fields use the correct explicit direction. `copy-from-en` is explicit, CSRF/role protected, audited, copies display text only, never machine configuration/options values/revision IDs/status, and always leaves Arabic `draft`.

Preview route tests cover missing/expired admin session, open-redirect attempts, draft cookie enable/exit, unpublished Arabic render while the public flag is off, cache/robots/referrer headers, and failure after logout.

- [ ] **Step 7: Run admin API/component/security tests**

Run:

```powershell
npm --prefix rammah-api run test:integration -- src/modules/localization/admin-localization.integration.test.ts
npm --prefix rammah-api run test:integration -- src/modules/localization/publish-scheduled-translations.integration.test.ts
npm --prefix rammah-next run test:unit -- components/admin/localization/AdminLocaleTabs.test.tsx
npm --prefix rammah-next run test:unit -- app/admin/preview/route.test.ts
npm --prefix rammah-api run typecheck
npm --prefix rammah-next run typecheck
```

Expected: PASS; missing CSRF/role is rejected and incomplete translation cannot publish.

- [ ] **Step 8: Commit bilingual authoring**

```powershell
git add rammah-api/src/modules/localization rammah-api/src/modules/cms rammah-api/src/modules/offerings rammah-api/src/modules/booking-form-fields rammah-api/src/modules/emails rammah-api/src/modules/locations rammah-api/src/modules/media rammah-api/src/worker/handlers/scheduled-publication.handler.ts rammah-api/src/app.ts rammah-next/components/admin rammah-next/lib/api/admin.ts rammah-next/lib/api/admin-preview.ts rammah-next/app/admin docs/04-ux-and-flows/Admin-Dashboard-Flows.md
git commit -m "feat(i18n): add bilingual admin authoring gates"
```

### Task 16: Add Arabic feature gating, SEO, sitemap, and production preflight

**Files:**
- Modify: `rammah-api/src/app.ts`
- Modify: `rammah-api/src/modules/cms/public-cms.routes.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.routes.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.routes.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.routes.ts`
- Modify: `rammah-api/src/modules/availability/public-availability-slots.routes.ts`
- Modify: `rammah-api/src/modules/sessions/public-sessions.routes.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.routes.ts`
- Modify: `rammah-api/src/modules/quote-requests/public-quote-requests.routes.ts`
- Modify: `rammah-api/src/modules/contact-inquiries/public-contact-inquiries.routes.ts` created by `FEAT-08`
- Modify: `rammah-api/src/modules/newsletter/public-newsletter.routes.ts` created by `FEAT-02`
- Create: `rammah-api/src/modules/localization/public-localized-route-inventory.repository.ts`
- Create: `rammah-api/src/modules/localization/public-localized-route-inventory.service.ts`
- Create: `rammah-api/src/modules/localization/public-localized-route-inventory.integration.test.ts`
- Create: `rammah-api/src/shared/observability/i18n-metrics.ts`
- Modify: `rammah-api/src/scripts/production-preflight.ts`
- Create: `rammah-api/src/scripts/check-arabic-launch-content.ts`
- Create: `rammah-api/src/scripts/check-arabic-launch-content.integration.test.ts`
- Modify: `rammah-api/package.json`
- Create: `rammah-next/lib/i18n/locale-seo.ts`
- Create: `rammah-next/lib/i18n/locale-seo.test.ts`
- Create: `rammah-next/app/sitemap.ts`
- Create: `rammah-next/app/robots.ts`
- Modify: metadata builders in `rammah-next/features/public/pages/content-pages.tsx`, `catalog-pages.tsx`, `blog-pages.tsx`, `lead-pages.tsx`, and `booking-pages.tsx`
- Create: `rammah-next/tests/e2e/seo-locales.spec.ts`
- Modify: `docs/03-architecture/Frontend-Architecture.md`
- Modify: `docs/03-architecture/Deployment-Checklist.md`
- Modify: `docs/03-architecture/Monitoring-Alerting-Plan.md`
- Modify: `docs/06-engineering/Production-Runbook.md`

**Interfaces:**
- Consumes: localized public APIs, available locale slugs, admin completeness.
- Produces: full-surface consumption of Task 1's strict feature contract, a typed publication-aware route inventory, bilingual metadata/sitemap/robots, locale observability, and `preflight:i18n:ar`.

- [ ] **Step 1: Write failing feature-flag and SEO tests**

```ts
it("hides Arabic when the server feature flag is false", () => {
  expect(() => assertArabicPublicEnabled("ar", false)).toThrowError("ARABIC_PUBLIC_DISABLED");
  expect(() => assertArabicPublicEnabled("en", false)).not.toThrow();
});

it("rejects a direct Arabic API request while preserving English", async () => {
  const disabledApp = createApp({ arabicPublicEnabled: false });
  expect((await request(disabledApp).get("/api/v1/public/offerings?locale=ar")).body.error.code).toBe("ARABIC_PUBLIC_DISABLED");
  expect((await request(disabledApp).get("/api/v1/public/offerings?locale=en")).status).toBe(200);
});

it("emits locale-correct canonicals and reciprocal published alternates", () => {
  const targets = { en: "https://example.com/services/clarity", ar: "https://example.com/ar/services/الوضوح" };
  expect(buildLocaleAlternates("en", targets)).toEqual({
    canonical: "https://example.com/services/clarity",
    languages: { en: "https://example.com/services/clarity", ar: "https://example.com/ar/services/الوضوح", "x-default": "https://example.com/services/clarity" },
  });
  expect(buildLocaleAlternates("ar", targets).canonical).toBe("https://example.com/ar/services/الوضوح");
  expect(buildLocaleAlternates("en", { en: "https://example.com/blog/post", ar: null }).languages).toEqual({ en: "https://example.com/blog/post", "x-default": "https://example.com/blog/post" });
  expect(() => buildLocaleAlternates("ar", { en: "https://example.com/blog/post", ar: null })).toThrowError("LOCALIZED_CONTENT_NOT_FOUND");
});
```

- [ ] **Step 2: Extend the early feature contract across public surfaces**

Reuse—not recreate—`public-locale-feature.ts`, `public-feature.ts`, and `createApp({ arabicPublicEnabled })` injection from Task 1. Production uses validated server environment.

After locale parsing, indexable reads, leads, discovery, hold creation, and new booking routes call the guard before service work. The Task 11 exception policy remains explicit: verified token-bearing status/payment/return/recovery, hold release, callbacks/webhooks, reconciliation, and queued email continue for in-flight stored Arabic records after disable. All normal Arabic shared page loaders assert before public data fetch and translate disabled discovery to `notFound()`; authenticated Draft Mode preview uses the admin preview endpoint only.

Compose/deployment injects the same `AR_PUBLIC_ENABLED` value into web and API containers. Production preflight queries both surfaces and fails on a mismatch, so navigation, sitemap, routes, and API publication cannot disagree during enablement or rollback.

- [ ] **Step 3: Implement exact locale SEO helpers and metadata ownership**

```ts
export function buildLocaleAlternates(locale: PublicLocale, targets: { en: string; ar: string | null }) {
  if (locale === "ar" && !targets.ar) throw new Error("LOCALIZED_CONTENT_NOT_FOUND");
  return {
    canonical: locale === "ar" ? targets.ar : targets.en,
    languages: {
      en: targets.en,
      ...(targets.ar ? { ar: targets.ar } : {}),
      "x-default": targets.en,
    },
  };
}
```

Dynamic metadata passes the current locale to `buildLocaleAlternates`, uses localized CMS SEO/title/description and localized OpenGraph URL/alt. Token/status/payment/return/thank-you/admin pages explicitly emit `robots: { index: false, follow: false }` and no alternate indexing promise.

`locale-seo.ts` is the only canonical/hreflang builder. Static and dynamic page modules listed in Files call it from their exported metadata builders. `app/robots.ts` disallows `/admin`, token/status/payment/return, newsletter token, preview, and other sensitive paths; responses for those routes also set `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`, because robots rules alone are insufficient.

- [ ] **Step 4: Make sitemap publication-aware**

Add authenticated-to-service but publicly cacheable `GET /api/v1/public/cms/route-inventory` before the `/:slug` route. Its repository/service returns only public route identity, base resource ID/type, locale slug pair, effective published/indexable state, canonical path, and last-modified timestamp—never draft text or customer data. It requires base published state, immutable legal revision pointers, effective translation lifecycle, and safe canonical origins. Add OpenAPI and integration coverage for missing counterpart, scheduled/archived base or translation, duplicate normalized slug, and Arabic-disabled output.

`app/sitemap.ts` consumes that typed inventory. It emits published English entries and Arabic entries only when `AR_PUBLIC_ENABLED=true` and Arabic is effectively published/indexable. Each entry has alternates matching `buildLocaleAlternates`; no query-param or token URL appears.

- [ ] **Step 5: Write the failing Arabic content preflight test**

```ts
it("reports exact missing Arabic launch resources", async () => {
  await seedArabicLaunchContent({ missing: ["legal:privacy-policy", "email:booking_confirmed_customer"] });
  const result = await checkArabicLaunchContent(db);
  expect(result.ok).toBe(false);
  expect(result.failures).toEqual([
    { code: "AR_LEGAL_MISSING", resource: "privacy-policy" },
    { code: "AR_EMAIL_TEMPLATE_MISSING", resource: "booking_confirmed_customer" },
  ]);
});
```

- [ ] **Step 6: Implement exact preflight categories**

`checkArabicLaunchContent` returns `{ ok, failures }` and checks these named groups: required pages/sections, header/footer navigation, launch offerings/categories, booking fields/options with exact ordered machine values, contact/quote/newsletter UI dictionary build check, privacy/terms/refund/cancellation immutable legal revisions, required immutable customer email revisions, SEO/canonical fields, reviewed localized media alt or explicit decorative provenance, no orphan/duplicate/NFC slug collision, and zero draft/scheduled translation exposed by public APIs.

Required email keys are an explicit constant:

```ts
export const requiredArabicEmailTemplateKeys = [
  "booking_confirmed_customer",
  "booking_cancelled_customer",
  "booking_rescheduled_customer",
  "payment_failed_customer",
  "quote_request_customer",
  "contact_inquiry_customer",
  "newsletter_confirmation_customer",
  "newsletter_welcome_customer",
  "newsletter_unsubscribe_customer",
] as const;
```

These keys extend the existing underscore-based customer template registry; admin-only templates may remain English for this release. `FEAT-02`, `FEAT-06`, and `FEAT-08` must create the named customer keys rather than inventing a second naming convention.

Add `"preflight:i18n:ar": "tsx src/scripts/check-arabic-launch-content.ts"` to `rammah-api/package.json`. Keep the existing production command name `preflight:prod`; `production-preflight.ts` invokes the Arabic check whenever `AR_PUBLIC_ENABLED=true`.

Instrument counters/timers for public requests by locale/route family/status, `LOCALIZED_CONTENT_NOT_FOUND`, `ARABIC_PUBLIC_DISABLED`, translation preflight failures, locale-specific lead/booking conversion, payment completion/failure, callback unmatched reason, email delivery/dead-letter by locale/revision, and scheduler publication failures. Never label metrics with email, token, slug, free text, or unbounded resource IDs. Add the dashboard/alert names and redaction policy to the runbook; G6 compares English/Arabic error, conversion, payment, and email health during canary.

- [ ] **Step 7: Run SEO, preflight, build, and crawl checks**

Run:

```powershell
npm --prefix rammah-api run test:integration -- src/scripts/check-arabic-launch-content.integration.test.ts
npm --prefix rammah-api run test:integration -- src/modules/localization/public-localized-route-inventory.integration.test.ts
npm --prefix rammah-api run test:unit -- src/shared/i18n/public-locale-feature.unit.test.ts
npm --prefix rammah-api run preflight:i18n:ar
npm --prefix rammah-next run test:unit -- lib/i18n/locale-seo.test.ts
npm --prefix rammah-next run build
npm --prefix rammah-next run test:e2e -- tests/e2e/seo-locales.spec.ts
```

Expected: disabled fixture omits Arabic; complete enabled fixture reports zero failures and reciprocal canonical/hreflang with no token page indexed.

- [ ] **Step 8: Commit feature gate and SEO**

```powershell
git add rammah-api/package.json rammah-api/src/app.ts rammah-api/src/shared/i18n/public-locale-feature* rammah-api/src/shared/observability/i18n-metrics.ts rammah-api/src/scripts rammah-api/src/modules/localization rammah-api/src/modules/cms/public-cms.routes.ts rammah-api/src/modules/offerings/offerings.routes.ts rammah-api/src/modules/bookings/public-bookings.routes.ts rammah-api/src/modules/payments/public-payments.routes.ts rammah-api/src/modules/availability/public-availability-slots.routes.ts rammah-api/src/modules/sessions/public-sessions.routes.ts rammah-api/src/modules/pricing/public-price-preview.routes.ts rammah-api/src/modules/quote-requests/public-quote-requests.routes.ts rammah-api/src/modules/contact-inquiries rammah-api/src/modules/newsletter rammah-next/lib/i18n rammah-next/app rammah-next/tests/e2e/seo-locales.spec.ts docs/03-architecture/Frontend-Architecture.md docs/03-architecture/Deployment-Checklist.md docs/03-architecture/Monitoring-Alerting-Plan.md docs/06-engineering/Production-Runbook.md
git commit -m "feat(i18n): gate and index Arabic safely"
```

### Task 17: Complete bilingual E2E, content sign-off, staging soak, and release handoff

**Files:**
- Create: `rammah-next/tests/e2e/bilingual-content.spec.ts`
- Create: `rammah-next/tests/e2e/bilingual-leads.spec.ts`
- Create: `rammah-next/tests/e2e/bilingual-free-booking.spec.ts`
- Create: `rammah-next/tests/e2e/bilingual-paid-booking.spec.ts`
- Create: `rammah-next/tests/e2e/bilingual-admin-authoring.spec.ts`
- Create: `rammah-next/tests/e2e/bilingual-route-contract.spec.ts`
- Modify: `rammah-next/tests/e2e/seo-locales.spec.ts` created in Task 16
- Create: `rammah-next/tests/e2e/fixtures/bilingual.ts`
- Modify: `rammah-next/playwright.config.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/05-project-plan/Arabic-Content-Inventory.md`
- Create: `docs/05-project-plan/Bilingual-Launch-Acceptance-Report.md`
- Modify: `docs/06-engineering/Production-Runbook.md`
- Create: `docs/06-engineering/Admin-Operations-Guide.md`
- Modify: `docs/03-architecture/Deployment-Checklist.md`
- Modify: `docs/03-architecture/Testing-Strategy.md`

**Interfaces:**
- Consumes: all bilingual implementation tasks, G0-G4, and the non-soak G5 prerequisites/content/provider approvals.
- Produces: deterministic bilingual fixtures, CI projects, signed content inventory, staging soak evidence that closes G5, Arabic enable/disable runbook, and launch report authorizing production/G6.

- [ ] **Step 1: Define deterministic bilingual Playwright fixtures**

```ts
export const bilingualFixture = {
  offeringId: "10000000-0000-0000-0000-000000000001",
  enSlug: "clarity-session",
  arSlug: "جلسة-الوضوح",
  price: { countryCode: "EG", currency: "EGP", totalAmountMinor: 125000 },
  slot: { startsAt: "2026-08-15T10:00:00.000Z", endsAt: "2026-08-15T11:00:00.000Z", timezone: "Africa/Cairo", capacity: 2 },
  customer: { fullName: "أحمد محمد", email: "arabic.e2e@example.test", phone: "+201000000000" },
} as const;
```

The backend E2E seed creates one base offering/slot/price and paired published translations; both locale projects consume the same IDs and machine values.

- [ ] **Step 2: Add locale projects to Playwright**

```ts
projects: [
  { name: "english-desktop", use: { ...devices["Desktop Chrome"], locale: "en-US" } },
  { name: "arabic-desktop", use: { ...devices["Desktop Chrome"], locale: "ar-EG" } },
  { name: "english-mobile", use: { ...devices["Pixel 7"], locale: "en-US" } },
  { name: "arabic-mobile", use: { ...devices["Pixel 7"], locale: "ar-EG" } },
],
```

CI uses one worker for payment/auth tests and retains trace/screenshots only on failure.

- [ ] **Step 3: Write full bilingual content and lead journeys**

Tests cover home/nav/footer/switcher, clean and dirty mid-form locale changes, active-hold release, About, services/detail, blog/detail, privacy/terms, contact, corporate quote, newsletter confirm/unsubscribe, locale-specific email link, missing counterpart, API 404/429/500, and network retry. Every Arabic assertion checks `html[lang=ar][dir=rtl]`, visible Arabic labels, and no English catalog key outside approved LTR machine values.

- [ ] **Step 4: Write free-booking parity journey**

```ts
test("English and Arabic free booking share slot and booking state", async ({ browser }) => {
  const enContext = await browser.newContext({ locale: "en-US" });
  const arContext = await browser.newContext({ locale: "ar-EG" });
  try {
    const en = await enContext.newPage();
    const ar = await arContext.newPage();
    await completeFreeBooking(en, "/booking/clarity-session", bilingualFixture);
    await completeFreeBooking(ar, "/ar/booking/جلسة-الوضوح", bilingualFixture);
    const [enState, arState] = await Promise.all([readLastBookingState(en), readLastBookingState(ar)]);
    expect(pickMachineState(arState)).toEqual(pickMachineState(enState));
    expect(arState.customerLocale).toBe("ar");
  } finally {
    await enContext.close();
    await arContext.close();
  }
});
```

The fixture capacity is exactly two so both locale bookings use the same slot without intentionally racing the last seat. `pickMachineState` compares offering/slot/mode/price/currency/status/provider-state fields and intentionally excludes generated IDs, customer identity, timestamps, and `customerLocale`; concurrency correctness remains covered by `SEC-03/04` tests.

- [ ] **Step 5: Write paid-booking and recovery journey**

Cover Arabic success, decline, abandon, expiry, duplicate callback, callback-before-return, return-before-callback, reconciliation, retry, browser refresh/back, forged callback locale/token, and email/status return. Include disabling Arabic after the booking/hold/payment exists but before callback, return, status lookup, and email retry; those in-flight steps complete while new Arabic discovery/submission is blocked. Assert exact minor-unit/currency parity, trusted Arabic return path, Arabic customer email, and unchanged Kashier signature/state tests.

- [ ] **Step 6: Write admin authoring E2E**

Admin logs in to English `/admin`, opens Arabic tab, saves a draft, sees completeness failures, supplies required fields, previews `/ar`, publishes, verifies public visibility/sitemap, unpublishes, and verifies removal without affecting English.

- [ ] **Step 7: Create and sign the content inventory**

`Arabic-Content-Inventory.md` contains one row per public route/resource with columns:

```markdown
| Resource ID | English URL | Arabic URL | Arabic content owner | Legal review | SEO review | Email/CTA links | Published | Evidence |
```

The accountable role is `Product Owner`; legal rows also require `Legal Reviewer`. No row may say pending at launch. Machine translation is identified as draft evidence and cannot satisfy approval.

Create a machine-readable route contract table used by `bilingual-route-contract.spec.ts` with every English/Arabic family: home, about, services list/detail/corporate, blog list/detail, contact, privacy/terms plus legacy redirects, thank-you variants, newsletter confirm/unsubscribe, booking landing/detail/status lookup/token status/payment frame/return, not-found, error, and preview. For each row specify method, English path, Arabic path, expected status/redirect, indexability/cache policy, switch target/query allowlist, missing-counterpart behavior, and desktop/mobile coverage. The test fails if a public route exists outside the inventory or an inventory row is absent from the Next route manifest.

- [ ] **Step 8: Add bilingual CI gates**

Root CI must run API localization unit/integration tests, frontend message/route/RTL tests, i18n and RTL guards, clean builds, four Playwright projects, axe, bilingual SEO crawl, and production preflight with a complete seeded Arabic fixture. Required checks cannot be skipped by path filters when schema, public API, shared components, email, SEO, or deployment config changes.

- [ ] **Step 9: Rehearse staging enable/disable and soak**

Run this order on isolated staging:

```text
deploy schema/API/web with AR_PUBLIC_ENABLED=false
run English regression and English backfill verification
enter/import approved Arabic drafts through admin APIs
run preflight:i18n:ar until fail: 0
confirm G0-G4 plus all non-soak G5 content/legal/provider/quality prerequisites are green
enable AR_PUBLIC_ENABLED=true in staging
run full bilingual provider/E2E/SEO/a11y/performance suite
disable Arabic and confirm English plus in-flight Arabic status/payments/callbacks/emails remain healthy while new Arabic journeys are blocked
re-enable Arabic and soak for at least 48 hours with alerts/backups/workers active
sign G5 only after the enabled staging soak has no unresolved release blocker
enable Arabic in production only after staging soak sign-off; then complete G6 48-hour production canary
```

Record API/web image digests, migration head, content versions, provider transaction IDs, alert evidence, backup ID, and disable rehearsal in `Bilingual-Launch-Acceptance-Report.md`.

- [ ] **Step 10: Update operator and rollback docs**

Document exact commands for preflight, enabling/disabling Arabic, locating missing translation failures, retrying localized email jobs, previewing/unpublishing content, verifying sitemap/hreflang, and preserving booking/payment state. Arabic rollback changes only the feature flag/public navigation/sitemap; it does not delete translation rows or revert business data.

- [ ] **Step 11: Run the final release gate**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:a11y
npm run build
npm --prefix rammah-api run preflight:prod
npm --prefix rammah-api run db:verify:i18n:en
npm --prefix rammah-api run preflight:i18n:ar
```

Expected: every command PASS, `production-preflight` and Arabic preflight report zero failures, English and Arabic provider smoke evidence is attached, and there are zero open P0/P1 issues.

- [ ] **Step 12: Commit release coverage and handoff**

```powershell
git add rammah-next/tests/e2e rammah-next/playwright.config.ts .github/workflows/ci.yml docs/05-project-plan/Arabic-Content-Inventory.md docs/05-project-plan/Bilingual-Launch-Acceptance-Report.md docs/06-engineering docs/03-architecture/Deployment-Checklist.md docs/03-architecture/Testing-Strategy.md
git commit -m "test(i18n): gate bilingual production launch"
```

## Final Definition of Done

- Existing English URLs, content, booking, payment, emails, SEO, accessibility, and performance regressions remain green.
- Every public customer journey has a tested Arabic `/ar` equivalent.
- Admin can manage both locales without an Arabic admin shell.
- No Arabic page or required email silently falls back to English.
- Locale never changes price, slot, hold, booking, payment, callback, calendar, or provider truth.
- Stored customer locale drives return/status/email behavior and is visible to operators.
- Arabic content/legal/email/SEO inventory is approved and preflight reports zero failures.
- Staging enable/disable rehearsal and 48-hour soak pass.
- Production can disable new Arabic discovery/submission independently without data rollback while verified in-flight Arabic status/payment/callback/email work still completes safely.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-20-bilingual-arabic-customer-journey.md`. Two execution options:

1. **Subagent-Driven (recommended):** dispatch a fresh implementation subagent per task, then run spec-compliance and code-quality review before moving to the next task.
2. **Inline Execution:** execute in this session with `superpowers:executing-plans` in small batches and checkpoint after each milestone.
