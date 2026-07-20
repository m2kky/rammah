# Bilingual Arabic Customer Journey Design

**Status:** Approved product and architecture baseline; implementation plan reviewed 2026-07-20

**Date:** 2026-07-20

**Product:** Rammah public website and customer journey

**Launch target:** Production-ready English and Arabic experience with the admin interface remaining English

## 1. Context

Rammah currently serves public content and customer flows in English. Existing English URLs are already part of the product surface, the root Next.js layout hardcodes `lang="en"`, public components contain English copy and `Intl` formatters, and the CMS/offering/email tables store one text representation per record. `site_settings.default_locale` exists, but there is no locale-aware routing, localized content model, RTL layout, localized email selection, or full Arabic test path.

The production-readiness plan previously treated Arabic as future readiness only. The product decision is now to launch the complete public customer journey in both English and Arabic without weakening the payment, booking, security, accessibility, SEO, performance, or operational gates.

## 2. Goal

Deliver a production-quality Arabic version of every public customer journey while preserving all existing English URLs and sharing one business source of truth for offerings, availability, pricing, bookings, payments, and provider state.

## 3. Success Criteria

- Existing English URLs and behavior continue to work without redirect churn.
- Every supported public English route has an Arabic counterpart under `/ar`.
- Arabic covers marketing pages, services, blog, legal pages, contact, corporate quote, newsletter, free booking, paid booking, payment return, booking status, thank-you states, and transactional customer email.
- The admin UI remains English but can author, validate, preview, publish, and audit both English and Arabic content.
- Business entities and state machines are not duplicated by language.
- A customer sees one language throughout a journey, including validation, errors, payment recovery, status, and email.
- Arabic pages are truly RTL, accessible, crawlable, and correctly identified by language metadata.
- An Arabic page cannot be published while required Arabic content is incomplete.
- The Arabic release passes the same CI, security, provider, staging, performance, accessibility, and canary gates as English.

## 4. Fixed Product Decisions

1. Existing unprefixed public URLs remain English.
2. Arabic public URLs use the `/ar` prefix.
3. `/admin` remains English for the first bilingual production release.
4. Admin editors manage English and Arabic content through locale tabs and completeness indicators.
5. The full public customer journey is bilingual; this is not limited to marketing pages.
6. There is no automatic redirect based on IP, country, browser language, or `Accept-Language`.
7. The user explicitly changes language using a switcher; the selected route remains deterministic and shareable.
8. Base business records remain language-neutral. Localized display content lives in typed translation tables.
9. Arabic is hidden behind `AR_PUBLIC_ENABLED=false` until content and release gates pass.
10. Machine-generated translation may be saved as a draft but is never auto-published.
11. Approved Arabic legal copy is an external launch input and blocks Arabic production enablement.
12. Arabic uses `ar-EG` for human-readable formatting. API timestamps, money minor units, country codes, identifiers, and provider payloads retain their existing machine formats.

## 5. Non-Goals

- Translating the admin interface in the first bilingual release.
- Creating separate Arabic offerings, prices, slots, bookings, payments, or provider accounts.
- Changing the pricing, tax, coupon, booking-capacity, or payment-trust rules.
- Automatically translating customer-supplied names, messages, or answers.
- Adding public customer accounts.
- Supporting arbitrary locales in the first release; the supported set is exactly `en` and `ar`, while schema constraints permit a future controlled expansion.
- Replacing the CMS, Express, Drizzle, PostgreSQL, Next.js, Kashier, Resend, or Google Calendar.

## 6. Chosen Architecture

```text
Browser request
   |
   +-- /...       -> locale=en, direction=ltr
   |
   `-- /ar/...    -> locale=ar, direction=rtl
             |
             v
Next public route wrapper
   |- loads typed UI dictionary
   |- calls public API with explicit locale
   |- renders shared locale-aware component
   `- emits locale SEO metadata
             |
             v
Express public API
   |- validates locale: en | ar
   |- loads one base business record
   |- joins one published translation
   |- returns stable error codes and localized content
   `- persists customerLocale on submissions
             |
             v
PostgreSQL
   |- language-neutral business/state tables
   |- per-resource translation tables
   `- immutable locale/content snapshots where historical evidence is required
```

The routing layer, translation resolver, formatting helpers, message dictionaries, CMS translation APIs, and email locale selection are separate units with explicit interfaces. Components consume a locale and already-resolved content; they do not query translation tables or infer locale from arbitrary browser state.

## 7. Route Strategy

### 7.1 Public routes

| Journey | English URL | Arabic URL |
| --- | --- | --- |
| Home | `/` | `/ar` |
| About | `/about` | `/ar/about` |
| Services | `/services` | `/ar/services` |
| Service detail | `/services/:slug` | `/ar/services/:arabicSlug` |
| Corporate training | `/services/corporate-training` | `/ar/services/:arabicCorporateSlug` |
| Blog | `/blog` | `/ar/blog` |
| Blog post | `/blog/:slug` | `/ar/blog/:arabicSlug` |
| Contact | `/contact` | `/ar/contact` |
| Newsletter confirmation | `/newsletter/confirm` | `/ar/newsletter/confirm` |
| Newsletter unsubscribe | `/newsletter/unsubscribe` | `/ar/newsletter/unsubscribe` |
| Booking entry | `/booking` | `/ar/booking` |
| Offering booking | `/booking/:slug` | `/ar/booking/:arabicSlug` |
| Booking status | `/booking/status/:publicToken` | `/ar/booking/status/:publicToken` |
| Payment | `/booking/payment/:publicToken` | `/ar/booking/payment/:publicToken` |
| Payment return | `/booking/payment/return` | `/ar/booking/payment/return` |
| Thank you | `/thank-you` | `/ar/thank-you` |
| Privacy | `/privacy-policy` | `/ar/privacy-policy` |
| Terms | `/terms-and-conditions` | `/ar/terms-and-conditions` |

The duplicate legacy aliases `/privacy` and `/terms` redirect to the canonical English pages. Arabic aliases, if exposed, redirect to the canonical `/ar` pages.

### 7.2 Next.js document locale

The root document must render the correct `<html lang>` and `dir` on the server. A request-boundary locale resolver identifies `/ar` paths and forwards a trusted internal locale signal to the root layout. It does not redirect or perform authentication. The root layout emits:

- English: `lang="en" dir="ltr"`;
- Arabic: `lang="ar" dir="rtl"`.

Arabic route files are thin wrappers around shared page loaders/components. English and Arabic must not maintain separate copies of business UI logic.

### 7.3 Language switching

- Static routes use an explicit English/Arabic route map.
- CMS, blog, and offering routes switch by stable resource ID and the published counterpart slug returned by the API.
- The switcher is hidden or disabled with a clear accessible label when the counterpart is not published.
- Token-bearing booking status/payment routes preserve the same public token and change only the locale prefix.
- Query parameters required for a safe return/recovery flow are preserved through an allowlist; tracking parameters are not copied to token-bearing routes.

## 8. Locale Contract

The shared logical type is:

```ts
export const publicLocales = ["en", "ar"] as const;
export type PublicLocale = (typeof publicLocales)[number];
```

Rules:

- Next route wrappers pass an explicit locale to API clients.
- Public read endpoints accept `locale=en|ar`; absence resolves to `en` for backward compatibility.
- Public submission bodies include `locale` and reject unsupported values with stable code `UNSUPPORTED_LOCALE`.
- Successful localized responses include `locale`, stable `resourceId`, localized `slug`, and `availableLocales` where route switching needs them.
- Responses set `Content-Language`.
- `Accept-Language` is not an authority and does not change API results.
- Error payloads keep stable codes and safe technical metadata; visible copy comes from frontend locale dictionaries.
- Provider callbacks never accept locale as payment evidence.

## 9. Data Model

### 9.1 Principle

Base tables retain identity, relationships, operational configuration, price/capacity values, media references, sort order, and business state. Translation tables hold only localized public content and per-locale editorial state.

The existing base `status` is the global safety gate: public reads require the base resource to be effectively `published`; draft, scheduled-before-time, archived, or globally disabled base resources are unavailable in every locale. Translation `status` independently controls draft/scheduled/published/archived visibility for one locale. During the additive compatibility release, locale-aware public reads require both effective base publication and effective requested-translation publication.

Every translation table has:

- `id`;
- parent resource foreign key;
- `locale` constrained by the database enum and application schema to exactly `en | ar`;
- localized fields;
- `status` where the content can publish independently;
- `published_at` where relevant;
- `created_at` and `updated_at`;
- unique `(parent_id, locale)`;
- unique `(locale, slug)` for localized slug resources;
- indexes supporting public locale/status/slug reads.

Typed translation rows are the current public snapshot; admins do not edit a published row in place. A shared schema-validated `translation_working_copies` store holds one draft or frozen scheduled replacement per resource/locale. Publishing atomically copies the working payload to the typed row, so authors can prepare the next version without making the current page disappear or leaking draft edits. Legal and customer-email publication additionally creates immutable revisions and advances a published revision pointer.

### 9.2 Translation tables

| Translation table | Parent | Localized fields |
| --- | --- | --- |
| `translation_working_copies` | polymorphic validated resource identity | typed JSON working payload, schema version/hash, draft/scheduled state, schedule/admin provenance |
| `site_setting_translations` | `site_settings` | `site_name` |
| `navigation_item_translations` | `navigation_items` | `label`, `url`, `status` |
| `media_asset_translations` | `media_assets` | reviewed `alt_text` or explicit decorative state and review provenance |
| `page_translations` | `pages` | `title`, `slug`, `status`, `published_at` |
| `page_section_translations` | `page_sections` | `title`, `body`, localized `config`, `status` |
| `legal_page_translations` + immutable revisions | `legal_pages` | current typed `title`, `slug`, `body`, `version`, `content_hash` plus published revision pointer; drafts live in working copies |
| `seo_metadata_translations` | `seo_metadata` | `meta_title`, `meta_description`, `canonical_url` |
| `offering_category_translations` | `offering_categories` | `name`, `slug`, `description`, `status` |
| `offering_translations` | `offerings` | `title`, `slug`, `short_description`, `long_description`, `status` |
| `offline_location_translations` | `offline_locations` | `name`, address display fields, `city`, `instructions` |
| `booking_form_field_translations` | `booking_form_fields` | `label`, localized option labels with stable option values, `status` |
| `email_template_translations` + immutable revisions | `email_templates` | current typed `subject`, `body`, `content_hash` plus published revision pointer; drafts live in working copies |
| `blog_category_translations` | `blog_categories` | `name`, `slug`, `status` |
| `blog_post_translations` | `blog_posts` | `title`, `slug`, `excerpt`, `body`, `status`, `published_at` |

Localized `page_sections.config` is allowed because current section configuration contains visible copy. Structural keys, component selection, media IDs, and behavior flags remain in the base record or are validated against a section-specific schema so Arabic config cannot change business behavior.

### 9.3 Customer locale snapshots

Add `customer_locale` with a default/backfill of `en` to:

- `bookings`;
- quote requests;
- contact inquiries;
- newsletter subscribers;
- email deliveries or their outbox payload snapshot.

Payment rows use the booking locale through their booking relation. They do not maintain an independently mutable locale.

Booking answer labels and option labels are resolved on the server from `booking_form_field_translations` using the submitted field ID and stored booking locale. The client cannot author the historical label snapshot.

### 9.4 Additive migration

Localization uses expand/contract migrations:

1. Create translation tables and locale snapshot columns without dropping existing text columns.
2. Backfill one `en` translation per existing record in a transaction-safe, restartable migration/script.
3. Verify every copied field and canonical hash, missing/extra/orphan/duplicate rows, NFC slug uniqueness, immutable revision pointers, and English API response parity; media null alt remains null and never becomes a filename.
4. Switch reads/writes to translation repositories while dual-writing approved English display fields to the legacy columns during the binary rollback compatibility window.
5. Remove legacy localized columns only in a later release after production evidence and rollback compatibility expire.

No historical Drizzle migration is rewritten.

## 10. Content Resolution and Publishing

Public content is returned only when:

- the base resource is operationally available;
- the requested translation exists;
- the requested translation is `published`;
- required localized fields and referenced media are valid;
- scheduled publication time has passed where applicable.

There is no silent English fallback inside a published Arabic page. Missing Arabic content returns a stable localized-not-available outcome, excludes the route from the Arabic sitemap, and prevents the language switch from promising the route.

Admin publication validation reports missing required fields by locale. Arabic launch preflight checks at least:

- required public pages and sections;
- navigation/footer labels and valid links;
- all launch offerings and categories;
- booking form labels/options;
- privacy, terms, refund/cancellation copy;
- active transactional email templates;
- SEO title/description and canonical mapping;
- image alt text for launch-critical media;
- contact, quote, newsletter, booking, payment, status, and thank-you UI dictionary coverage.

## 11. UI Message Dictionaries

Static interface copy does not live in page-section CMS records. It is stored in domain-focused typed dictionaries:

```text
lib/i18n/
  locales.ts
  route-map.ts
  formatters.ts
  get-messages.ts
  messages/
    en/common.ts
    en/forms.ts
    en/booking.ts
    en/payment.ts
    en/errors.ts
    ar/common.ts
    ar/forms.ts
    ar/booking.ts
    ar/payment.ts
    ar/errors.ts
```

The English message shape is the compile-time contract. Arabic must satisfy the same keys. CI fails for a missing or extra key. Components receive messages or a typed translation function and never embed new public English strings directly.

## 12. Formatting and RTL

- Human-facing English formatting uses `en`; Arabic uses `ar-EG`.
- All timestamps remain ISO in API contracts and are formatted at the edge using the booking/site timezone.
- Money remains integer minor units and the original ISO currency. Locale changes presentation only.
- Phone numbers, email addresses, URLs, UUIDs, provider references, verification codes, and machine values render in isolated LTR spans inside Arabic pages.
- The Arabic subtree loads an approved Arabic font with a defined fallback stack.
- Layout CSS uses logical properties such as `margin-inline`, `padding-inline`, `inset-inline`, `border-inline`, and `text-align: start`.
- Direction-sensitive icons are mirrored only when their meaning depends on direction. Brand marks, media, play icons, and nondirectional symbols are not mirrored.
- GSAP/motion calculations use logical direction helpers rather than hardcoded left/right assumptions.
- Reduced motion, keyboard order, screen-reader order, focus order, and DOM order remain correct in RTL.

## 13. Complete Customer Journey

### 13.1 Discovery and content

Home, About, Services, service detail, corporate training, Blog, blog detail, Contact, Privacy, and Terms load localized CMS/offering content, navigation, footer, metadata, image alt text, empty states, and errors.

### 13.2 Lead capture

Contact, corporate quote, and newsletter submissions send `locale`. Confirmation UI and queued emails use the stored locale. Consent evidence stores the exact immutable legal revision shown to the customer. The server issues a short-lived signed receipt bound to revision ID, locale, content hash, purpose, and expiry; submission verification prevents a publish-between-render-and-submit race and rejects forged client versions.

### 13.3 Booking

Offering copy, attendance modes, locations, dynamic fields/options, validation messages, availability display, timezone, price explanation, hold expiry, and outcome states use one locale. Availability, capacity, and price values remain identical across languages.

### 13.4 Payment

The URL locale determines the currently rendered payment/status labels. The stored booking locale determines automatic callback return, provider display language, recovery-email links, and confirmation/failure email. Kashier signature, amount, currency, merchant order, and state transitions are unchanged. Callback redirects derive token/locale only from the verified matched booking/payment record; unmatched callbacks never reuse query-derived redirect data.

### 13.5 Status and email

Token-bearing status pages render the selected URL locale but never expose more data because of locale choice. Customer emails use the immutable booking/lead locale snapshot. Admin notification content may remain English for the first release.

## 14. SEO and Discovery

- Existing English URLs remain canonical for English.
- Arabic pages use their `/ar` canonical URLs.
- Published counterparts emit reciprocal `hreflang="en"`, `hreflang="ar"`, and `hreflang="x-default"` links.
- `x-default` points to the existing English canonical route.
- Sitemap generation includes only published, indexable locale variants.
- Admin, booking-status, payment, payment-return, thank-you, preview, and token-bearing pages remain `noindex` and `no-store` where sensitive.
- Structured data uses localized name/description/URL but shared factual values.
- OpenGraph/Twitter metadata and image alt text are locale-aware.
- Language selection does not create query-string-indexed duplicates.

## 15. Error and Fallback Behavior

| Condition | Required behavior |
| --- | --- |
| Unsupported locale | API `400` with `UNSUPPORTED_LOCALE`; frontend route not generated |
| Arabic feature flag off | Arabic discovery, navigation, sitemap, leads, holds, and new bookings are blocked; signed newsletter confirm/unsubscribe plus verified token-bearing status/payment/recovery, callbacks, reconciliation, hold release, and queued email for already-created Arabic records remain available and noindex |
| Missing Arabic translation | No mixed-language fallback; route absent from switcher/sitemap and publication gate fails |
| Arabic API request fails | Localized retry/error boundary; no automatic switch to English during a transaction |
| Locale changes mid-form | Clean forms switch immediately; dirty forms ask for confirmation, never persist/transfer PII, and clear in-memory customer data only after confirmation |
| Locale changes after hold | On confirmed switch, best-effort release the active hold, clear customer input, and restart against the explicit counterpart; cancel keeps the current hold/form untouched |
| Callback locale query forged | Ignore it; use stored booking locale |
| Arabic email template missing | Do not silently send English; block required template publication/preflight and surface a retryable operational failure |
| RTL media/animation fails | Static accessible fallback remains usable |
| Arabic legal content missing/expired | Arabic launch gate fails; no placeholder is published |

## 16. Security and Privacy

- Locale is display context, not authorization, identity, price, payment, or availability evidence.
- Public tokens retain the same masking, caching, referrer, analytics, and `noindex` protections in both languages.
- Translation fields use the same server validation and rich-text sanitization as English.
- Bidi control characters and mixed-direction content are normalized/rejected where they could spoof email, URLs, prices, references, or admin review.
- Audit logs record locale-aware content changes without duplicating or leaking customer PII.
- Consent and legal snapshots include locale and content version.
- Analytics and error tracking never include token-bearing URLs or raw Arabic customer content.

## 17. Admin Editorial Experience

The admin shell remains English. Localizable editors provide:

- English and Arabic tabs;
- per-locale draft/published/scheduled/archived state;
- missing-field and translation-completeness indicators;
- locale preview links;
- paired slug display;
- explicit copy-from-English-to-Arabic-draft action with audit logging;
- publish prevention when required fields, legal versions, email templates, SEO, or referenced media are incomplete;
- independent Arabic unpublish without deleting the base entity or English version.
- immutable legal/email revision creation on publish and idempotent scheduled publication;
- fixed-key immutability across legacy/new APIs and temporary English dual-write for binary rollback;
- locale/status/completeness filters for content, customer records, and email failures.

Admin operational tables for bookings/payments remain English but display the customer locale as a filterable field where it affects communication.

## 18. Testing Strategy

### 18.1 Unit tests

- locale parsing and route classification;
- exact message-key parity;
- static and resource route switching;
- `en` and `ar-EG` date/time/money formatting;
- bidi/LTR isolation helpers;
- locale-aware error-code mapping;
- email template selection;
- Arabic publish-completeness validation.

### 18.2 PostgreSQL integration tests

- English backfill parity and restartability;
- unique `(resource_id, locale)` and `(locale, slug)` constraints;
- independent locale publication states;
- no cross-locale slug lookup;
- localized form-field/options snapshot from server-owned definitions;
- customer locale persistence for free/paid bookings, quotes, contact, and newsletter;
- callback/return locale derived from the trusted booking;
- required Arabic email missing/dead-letter visibility;
- immutable email revision retry determinism;
- signed legal-consent receipt, publish race, version/hash/locale/purpose snapshot;
- feature-disable behavior for new versus in-flight Arabic journeys.

### 18.3 Component and accessibility tests

- `lang`, `dir`, focus order, keyboard order, accessible names, validation messages, dialogs, menus, and live regions;
- language switch preserving safe journey state;
- Arabic text wrapping and long-copy behavior;
- LTR isolation for email/phone/money/reference/token;
- reduced-motion behavior under RTL.

### 18.4 Playwright E2E

Run English and Arabic variants for:

- homepage/navigation/footer and language switching;
- services/list/detail and quote-only routing;
- blog/list/detail;
- contact, corporate quote, and newsletter confirmation;
- free booking;
- paid sandbox booking, callback-before-return, return-before-callback, failure, expiry, retry, and status;
- email link returning to the correct locale;
- legal pages;
- mobile and desktop keyboard-only flows;
- admin editing, previewing, publishing, and unpublishing an Arabic translation.

Payment and concurrency tests assert identical machine price, slot, hold, booking, and payment state for English and Arabic inputs.

### 18.5 Visual and performance checks

- Screenshot baselines for representative desktop/mobile English and Arabic pages;
- zero critical accessibility findings in both directions;
- no horizontal overflow at supported breakpoints;
- no material regression to the production LCP/CLS/INP and asset budgets;
- Arabic font loading does not block usable fallback content.

## 19. Observability

- Add low-cardinality `locale` to public request, submission, email, and page-health metrics.
- Track Arabic translation-not-found, publish-gate failure, email-template missing, and language-switch failures.
- Correlate booking/payment/job IDs exactly as in English.
- Do not log localized customer form content or token-bearing URLs.
- Canary dashboards compare error/conversion drop-off by locale without treating locale as a payment/business-state dimension.

## 20. Rollout Order

1. Complete repository consolidation, payment/capacity P0 fixes, test foundation, and CI baseline.
2. Add locale foundation, request classification, typed dictionaries, and server-rendered `lang`/`dir` while Arabic remains disabled.
3. Apply additive translation schema and backfill English.
4. Make public CMS/offering/form/email APIs locale-aware and persist customer locale.
5. Add shared locale-aware page components and `/ar` route wrappers.
6. Add admin translation editing, preview, completeness, and publication gates.
7. Enter and approve Arabic content, legal documents, SEO, media alt text, and email templates.
8. Run bilingual unit/integration/E2E/accessibility/visual/performance suites.
9. Deploy disabled to staging, run English regression/backfill checks, enable Arabic in staging, run the full provider/SEO/a11y/performance suite, rehearse disable/re-enable, then soak enabled staging for at least 48 hours.
10. After G0-G5 and staging-soak sign-off, deploy production disabled, smoke, enable Arabic in production, run live bilingual smoke, and complete G6 canary monitoring with Arabic enabled.

## 21. Release Gates

Arabic production enablement is blocked until:

- all P0 security/payment/booking gates from the main production plan pass;
- every required Arabic content and email template passes completeness validation;
- a named Arabic content owner approves the full route/content inventory;
- legal approves the exact Arabic privacy/terms/refund/cancellation versions;
- all public Arabic routes pass mobile/desktop E2E and accessibility checks;
- English regression suites remain green;
- price/slot/booking/payment parity tests pass;
- reciprocal canonical/hreflang/sitemap checks pass;
- the Arabic font and RTL layout meet performance budgets;
- staging provider flows and soak complete without unresolved P0/P1;
- rollback can disable Arabic independently without rolling back bookings or payments.

## 22. Documentation and Requirement Changes

The approved scope is reflected in these canonical documents and contracts:

- `docs/02-requirements/FRS.md`: bilingual public-journey requirements with English admin scope;
- `docs/02-requirements/NFR.md`: explicit RTL, locale parity, SEO, accessibility, and performance acceptance;
- `docs/05-project-plan/Production-Readiness-Execution-Plan.md`: bilingual Epic after P0/test foundations and before final CMS/SEO/content closure;
- OpenAPI and environment contracts: locale parameters, response fields, persisted locale, and `AR_PUBLIC_ENABLED`;
- admin/content/legal/provider/launch runbooks: bilingual completeness, preview, email, preflight, rollback, and canary procedures.

## 23. Effort and Schedule Impact

The current codebase has a default locale field but not a reusable localization system. Full public-journey localization therefore requires schema, API, CMS, route, component, email, SEO, RTL, test, and content-release work.

- Engineering: approximately **17-24 focused engineer-days** after P0/test foundations, including immutable revisions, consent receipts, in-flight rollback safety, observability, and release evidence.
- Content translation and legal approval: external lead time, parallel after the schema/editor contract stabilizes.
- Updated complete production program: approximately **48-65 focused engineer-days**, depending on coupon/tax/media/editor scope and provider readiness.
- Two engineers: typically **6-7 calendar weeks** including staging soak when external inputs arrive on time; plan up to 8 weeks if provider/content/legal remediation repeats a gate.

The Arabic Epic must not delay payment and booking P0 fixes, but it must land before final CMS content, SEO closure, acceptance, and production launch.
