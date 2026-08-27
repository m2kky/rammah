# aCRL Official Recognition Section

## Goal

Add a short, premium social-proof section to the About page that verifies Ahmed
Rammah's official presence on the aCRL Academy website without interrupting the
page's editorial rhythm.

The section must make the external source obvious, show the same portrait used
on the official listing, and provide a prominent action that takes visitors as
close as the external site allows to Ahmed's profile.

## Source of Truth

Use the official aCRL Academy page:

`https://acrl-academy.eu/acrl-academy-eddi-schulze-2/`

The page lists Ahmed under `aCRL® Cooperation & Project Partners — Middle East`
as `Ahmed Sherif Rammah`, including the roles `Supervisor aCRL® Middle East` and
`Master Trainer aCRL®`.

The approved deep link is:

`https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah`

The external page does not expose a conventional HTML anchor for Ahmed's card.
The text fragment therefore scrolls to and highlights his exact name in
supporting browsers. Browsers that do not support text fragments open the same
official page normally.

## Placement and Numbering

Place the new section on `/about` immediately after `Systems meet people` and
before `The reach`.

The numbered sequence becomes:

1. `(01) The premise`
2. `(02) The method`
3. `(03) Systems meet people`
4. `(04) Official recognition`
5. `(05) The reach`
6. `(06) Start the work`

Update frontend fallbacks and the fresh-install seed. Add an idempotent data
migration for existing deployments so production receives the new published
section and updated reach/CTA numbers without depending on `db:seed`.

## Approved Content

- Section label: `(04) Official recognition`
- Name: `Ahmed Sherif Rammah`
- Statement: `Officially listed among aCRL® Cooperation & Project Partners — Middle East.`
- Roles: `Supervisor aCRL® Middle East · Master Trainer aCRL®`
- Source label: `acrl-academy.eu`
- Portrait badge: `Official profile`
- CTA: `View Ahmed on aCRL® Academy`
- CTA icon: external-link arrow

The wording must remain factual. Do not introduce broader accreditation,
endorsement, exclusivity, or partnership claims beyond what the official page
states.

## Visual Design

Use the approved hybrid direction: the portrait clarity of a profile card inside
the dark, restrained editorial band.

### Desktop

- Short full-width dark-teal band between the light story section and the black
  reach section.
- Portrait on the left in a fixed editorial crop, rendered in grayscale.
- Content on the right with a small section label and source domain at the top,
  the name as the primary heading, then the official statement and roles.
- High-contrast ivory CTA button aligned at the lower right. It must read as an
  action, not a subtle text link.
- Use the current About typography, spacing scale, and teal/ink/ivory palette.

### Mobile

- Keep the section compact; do not turn it into a full-screen panel.
- Place the portrait beside the name and statement where space permits, then
  stack naturally on the narrowest supported widths.
- Render the CTA as a full-width, minimum 48px-high button.
- Preserve comfortable tap spacing and avoid truncating the name, roles, or CTA.

## Media Handling

- Store a local, optimized copy of the official portrait instead of hotlinking
  the aCRL asset at runtime.
- Preserve the source URL in implementation notes or media metadata.
- Provide the local image as the fallback while allowing the recognition
  section's image to be changed through the existing CMS media workflow.
- Use intrinsic dimensions or an aspect-ratio container to prevent layout shift.
- Alt text: `Ahmed Sherif Rammah on the official aCRL Academy website`.

Define a single-image `portrait` slot on the recognition section. Keep the local
file fallback independent of database state. Register the same local portrait as
a managed media asset and assign it to the new section in both the fresh seed and
the production data migration so the current image is visible and replaceable in
the media library immediately after deployment.

## CMS Contract

Add a supported CMS section kind named `recognition`. Register it in the API
section definitions, the Next section-renderer registry, and the generic
renderer map so the existing registry-parity and publication contracts remain
valid. The database already stores section types as strings, so this does not
require a schema change.

Expose the approved content as editable CMS fields:

- section label/title
- name/headline
- statement/body
- roles
- source label
- CTA label
- external URL
- portrait media

The public page must render the approved fallback section when no CMS record
exists yet, and use safe field-level fallbacks when a record is incomplete. The
renderer must only use HTTP or HTTPS external URLs; an invalid or unsupported
CMS value falls back to the approved aCRL deep link. Opening the CTA must use a
new tab with `rel="noopener noreferrer"`.

The current About page also contains legacy custom section types that are not
all present in the generic CMS definition registry. Retrofitting those existing
types and repairing full-page republication is pre-existing CMS debt and is not
part of this feature. The new `recognition` section itself must be editable and
publishable through the current section editor without adding to that debt.

## Renderer and Data Flow

- The About page reads the first published `recognition` section and renders it
  between the existing story and reach markup.
- A dedicated recognition renderer owns the approved editorial band and is also
  registered in the generic renderer map to satisfy the shared CMS contract.
- Title, body, and config fields are normalized into a small recognition content
  model before rendering. Missing values use the approved copy.
- The portrait resolves from the section media slot first and then falls back to
  the optimized local portrait.
- The CTA URL passes through an HTTP(S)-only resolver. Invalid CMS data never
  reaches the rendered `href`; the approved deep link is used instead.

## Production Data Migration

Add one idempotent migration that targets the published About page by slug:

- Insert the published `recognition` section only when one does not already
  exist, using sort order `60` and the approved content.
- Register the local portrait as a ready, published managed media asset when the
  matching public URL does not exist, then add the `portrait` section assignment
  only when that slot is empty.
- Move the existing reach section to sort order `70` and change its default
  title from `(04) The reach` to `(05) The reach` without overwriting a genuinely
  customized title.
- Move the existing CTA section to sort order `80` and change its default title
  from `(05) Start the work` to `(06) Start the work` without overwriting a
  genuinely customized title.
- Leave archived and unrelated pages untouched.

Update the TypeScript seed with the same section, content, numbering, and sort
orders for fresh installations. Deployment continues to run `db:migrate`; it
does not require `db:seed`.

## Motion and Interaction

- Use only a restrained entrance reveal consistent with adjacent About content.
- Do not pin the section, scrub it with scroll, animate the portrait continuously,
  or add parallax.
- Respect `prefers-reduced-motion` and keep all content visible without animation.
- The entire section is not clickable; only the clear CTA and expected text links
  receive pointer interaction.

## Accessibility and Failure Behavior

- Use a semantic heading and descriptive image alt text.
- Give the CTA a visible keyboard focus state and an accessible name matching its
  visible label.
- If the local portrait cannot load, the text and CTA remain usable without a
  blank fixed-height gap.
- If the external site or text-fragment jump is unavailable, the visitor still
  reaches the official page; no client-side error is shown on Ahmed's site.

## Acceptance Checks

- The section appears exactly between the story and reach sections.
- Desktop and mobile match the approved hybrid composition.
- The portrait is served locally and does not depend on the aCRL image host.
- The CTA is visually prominent and opens the approved deep link in a new tab.
- A supporting Chromium browser lands on and highlights `Ahmed Sherif Rammah`.
- A browser without text-fragment support still opens the official page.
- The CMS can change all section copy, CTA data, and portrait without code edits.
- The recognition definition, API catalog, Next registry, generic renderer map,
  and their parity tests agree on the new section type.
- The idempotent migration inserts the production section once, preserves custom
  titles, registers/assigns the default portrait once, and updates the default
  reach/CTA ordering and numbering.
- Fresh seeds produce the same recognition, reach, and CTA order as production.
- Invalid non-HTTP(S) CTA values render the approved safe fallback URL.
- Keyboard navigation, focus visibility, alt text, reduced motion, and responsive
  layout pass QA.
- Existing About animations, globe behavior, and neighboring sections are not
  regressed.
- The feature does not claim to repair the pre-existing publication contract for
  every legacy About section type.
