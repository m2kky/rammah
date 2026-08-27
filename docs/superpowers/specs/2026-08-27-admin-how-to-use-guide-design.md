# Admin “How to use” Guide — Design

**Date:** 2026-08-27  
**Status:** Design approved; awaiting written specification review  
**Audience:** Ahmed Rammah site administrators

## 1. Goal

Add a permanent Arabic operating guide inside the admin dashboard at `/admin/how-to-use`. The guide must explain the current dashboard as it behaves in code, not an aspirational future version. It must help a non-technical administrator complete real tasks safely, understand what each field affects, recognize dependencies between pages, and recover from common mistakes.

The guide is static application content. It is not editable through the CMS, does not use a database or API, and must be updated in the same pull request whenever a documented admin workflow changes materially.

## 2. Success criteria

- `How to use` appears in the admin navigation immediately after `Overview`.
- The page is written in clear Arabic and rendered right-to-left.
- Exact English labels from the dashboard remain visible so the reader can match the guide to the UI.
- A reader can complete the documented workflows without prior knowledge of the data model.
- Every current, enabled admin area is covered by a page reference.
- The guide distinguishes `Offering`, `Availability`, `Session`, `Program`, and `Booking` before giving operational steps.
- Each workflow states prerequisites, numbered steps, downstream effects, common mistakes, rollback/edit instructions, and direct admin links.
- Local search finds content by Arabic terms and English UI labels such as `Capacity`, `Early bird`, and `Slot`.
- The page adds no runtime API calls and no new dependency.
- Disabled `Settings` is not described as an available workflow.

## 3. Scope

### Included

- A new protected admin route at `/admin/how-to-use`.
- A navigation link in the existing admin shell.
- A hybrid guide:
  1. task-oriented playbooks for common end-to-end workflows;
  2. a detailed reference for each dashboard page and field family.
- Local search, section anchors, native expandable sections, direct admin links, empty-search feedback, and responsive navigation.
- Troubleshooting, safe-edit guidance, status explanations, and pre-launch checklists.

### Excluded

- CMS editing for the guide.
- Database tables, API routes, analytics, completion tracking, user-specific progress, bookmarks, comments, or translations.
- Screenshots, videos, tours, tooltips across existing pages, or a third-party documentation/search package.
- Documentation for disabled or unfinished admin features.

## 4. Information architecture

The page uses the following order.

### 4.1 Header and search

- Title: `How to use`.
- Arabic subtitle explaining that this is the operating manual for the current dashboard.
- A single search field that matches Arabic copy, English labels, page names, aliases, and step text.
- A clear-search action and a useful no-results state.

### 4.2 “Understand the system first”

This section establishes the operating model:

- `Offering`: the reusable service/product definition shown to customers.
- `Availability`: recurring weekly appointment windows for appointment-slot offerings.
- `Session`: one fixed start/end occurrence associated with an offering.
- `Program`: one enrollment covering a one-off event or several dated occurrences.
- `Booking`: the customer’s transaction/reservation, not the service definition.
- `Location`: a reusable venue required by offline/hybrid flows where applicable.
- Status meanings and visibility: `Draft`, `Published`, `Scheduled`, and `Archived`.
- Capacity states: `Booked`, `Held`, and `Remaining`.
- A decision guide for choosing appointment slots, a fixed session, or a program.
- The dependency order: create/configure the offering before availability, sessions, programs, and pricing that depend on it.

### 4.3 “Start here” playbooks

Each playbook includes:

1. When to use it.
2. Prerequisites.
3. Numbered steps using exact UI labels.
4. The effect of each important choice.
5. What customers see.
6. Common mistakes and checks.
7. How to edit, archive, delete, or otherwise recover safely.
8. Direct links to the required admin pages.

Required playbooks:

1. Create a bookable 1:1 appointment service from scratch.
2. Add a fixed-date `Session` and connect it to the correct offering.
3. Create a one-occurrence event, workshop, or webinar.
4. Create a multi-occurrence course/program with one enrollment.
5. Add two availability windows on the same weekday without overlap.
6. Close or reopen a specific date with availability overrides.
7. Set the global minimum advance-booking days and explain the whole-date rule.
8. Configure online, offline, and hybrid delivery and choose a location.
9. Set and interpret `Capacity` for offerings, sessions, and programs.
10. Configure `Free`, `Paid`, and `Quote only` booking modes.
11. Configure base pricing, country/price groups, automatic country selection, and `Early bird` pricing.
12. Review a booking, understand its state, and handle cancellation or follow-up safely.
13. Review payment records and use available reconciliation/retry actions.
14. Review and follow up on quote requests.
15. Add, edit, order, publish, or archive booking form fields.
16. Inspect email deliveries, edit templates, and retry failed messages.
17. Create a CMS page and add ready-made sections.
18. Edit text, links, images, videos, and other media inside a section.
19. Use the Media Library, upload from device, use an external URL, and understand processing states.
20. Create, version, schedule, publish, and archive legal pages.
21. Create and publish a blog post with category, featured image, and SEO metadata.
22. Edit header/footer navigation links and their order/status.
23. Edit contact details, social links, and site settings that currently exist.
24. Configure Google Calendar/Meet integrations and retry failed syncs.
25. Preview and verify CMS/SEO changes before publishing.
26. Safely change or roll back content using draft, publish, archive, and delete rules.

### 4.4 Detailed page reference

The guide covers every enabled current admin destination:

- `Overview`
- `Offerings`, including the new/edit form and price groups
- `Availability`, including weekly windows, date overrides, calendar overview, and global booking policy
- `Locations`
- `Events & Programs`
- `Form Fields`
- `Sessions`
- `Bookings`
- `Payments`
- `Quotes`
- `Emails`
- `CMS`: Pages, Media, Global media, Legal, Blog, Navigation, and current Site settings
- `Integrations`

Each page reference explains:

- What the page owns.
- What it does not own.
- Required upstream records.
- Every visible field or closely related field group.
- Valid choices and practical examples.
- Customer-facing and operational effects.
- Status, edit, delete, and archive behavior.
- Warnings for changes made after bookings/enrollments already exist.

### 4.5 Troubleshooting

The troubleshooting matrix includes at least:

- An offering does not appear publicly.
- Appointment dates or times do not appear.
- Two windows on the same weekday produce unexpected availability.
- The earliest bookable date is later than expected.
- A session/program cannot select the expected offering.
- An offline/hybrid item cannot be saved without a location.
- Capacity looks full because places are held.
- The expected price group or early-bird price is not applied.
- A media upload is missing, processing, or failed.
- A replaced image/video does not appear on the public page.
- A CMS page/section, legal page, or blog post is still invisible.
- Calendar or Meet sync failed.
- A payment is pending or inconsistent.
- A customer did not receive an email.

Each entry gives an ordered diagnostic path and links to the relevant page. It must not instruct administrators to run database commands or server operations.

### 4.6 Pre-launch checklists

Separate checklists cover:

- Appointment offering launch.
- Session/event launch.
- Program/course launch.
- CMS page/content publication.
- Paid booking readiness.

## 5. Field explanation format

Important fields use a consistent compact structure:

- **Label:** exact English label from the UI.
- **Meaning:** plain Arabic definition.
- **Where it applies:** which records and customer flows use it.
- **Recommended value/example:** a realistic example rather than a universal default.
- **Impact:** what changes immediately or on the next booking/public request.
- **Warning:** risks when changing it after bookings, enrollments, or publication.

For example, `Capacity` must be documented independently for an offering default, a fixed session, and a complete program. The guide must not imply that one capacity value automatically rewrites existing child records unless the current code does so.

## 6. User interface design

- Add `How to use` after `Overview` in the existing `AdminShell` navigation.
- Apply `dir="rtl"` to the guide content only; keep the surrounding admin shell unchanged.
- Keep English UI labels visually isolated with left-to-right direction where necessary.
- Desktop layout: sticky table of contents plus readable main column.
- Small screens: a compact section selector/anchor list above the content.
- Use native `<details>`/`<summary>` for expandable playbooks and reference entries.
- Use existing colors, borders, typography, and spacing from the admin dashboard.
- Use standard Next.js links for direct navigation.
- Preserve keyboard navigation, visible focus states, semantic headings, associated search labels, and readable contrast.

## 7. Static content model

Use one static content module containing a small typed structure for sections and entries. Each searchable entry contains only the fields the UI needs, such as:

- stable `id` for anchors;
- Arabic title and short summary;
- English labels/aliases;
- destination links;
- prerequisites;
- ordered steps;
- effects;
- warnings;
- rollback guidance.

Do not introduce a generic documentation engine, renderer registry, plugin system, or CMS schema. Repeated visual structure may use small local React components in the page file.

## 8. Search behavior

- Search is case-insensitive.
- Normalize surrounding whitespace and compare a joined searchable string for each entry.
- Arabic and English aliases are stored with the relevant entry.
- Matching entries remain visible with their parent section heading.
- Non-matching entries are hidden.
- An empty query shows the full guide.
- A query with no matches shows a clear Arabic message and a reset action.
- No highlighting, fuzzy-search dependency, ranking engine, or server request is required.

## 9. Data flow and dependencies

1. The protected Next.js route imports static guide content.
2. The client page keeps only the search query as interactive state.
3. A derived filter selects matching entries.
4. Native details/anchors handle expansion and navigation.
5. Direct links navigate to existing protected admin routes.

There is no backend, database, storage, authentication change, migration, or external service dependency. The existing protected admin layout continues to enforce access.

## 10. Error and edge-case handling

- Empty content sections are not rendered.
- No-results search has a reset action.
- Links only target routes that currently exist and are enabled.
- Content must state when an action is irreversible or becomes archive-only after usage.
- Current code behavior wins over old specs or assumptions if they differ.
- Operational unknowns must be phrased as a check, not invented behavior.
- The page must remain useful when JavaScript is slow: content renders in the document, while search is the enhancement.

## 11. Testing and verification

Keep checks focused:

- Component test: the guide renders the core glossary and representative playbooks.
- Component test: Arabic and English queries filter to the expected entry and a missing query shows the empty state.
- Component or static check: direct links use existing admin routes.
- Coverage check: every enabled `AdminShell` destination has a corresponding guide reference, excluding `How to use` itself.
- Existing component tests, type checking, and linting remain green.

Manual verification:

- Desktop and mobile-width layout.
- RTL content with English labels.
- Keyboard use of search, table of contents, `<details>`, and links.
- At least one complete workflow checked against each relevant admin page in the running app.

## 12. Maintenance rule

Any change that adds, removes, renames, or materially changes an admin page, field, status, workflow, validation rule, or customer-facing effect must update the static guide content and its coverage test in the same change. This rule keeps the guide trustworthy without building a separate documentation platform.

## 13. Ponytail decisions

- Static content instead of CMS/database storage.
- Native search/filter logic instead of a search package.
- Native `<details>` and anchors instead of accordion/navigation libraries.
- Existing admin styles and components instead of a new design system.
- One content module and one route-level UI rather than a documentation framework.
