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

Update both frontend fallbacks and seeded/published About content so production
does not show duplicate or stale section numbers.

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

## CMS Contract

Add an About section kind named `recognition` and expose the approved content as
editable CMS fields:

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
external URL must only accept HTTP or HTTPS values. Opening the CTA must use a
new tab with `rel="noopener noreferrer"`.

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
- Reach and CTA numbering is updated in fallback and deployed CMS content.
- Keyboard navigation, focus visibility, alt text, reduced motion, and responsive
  layout pass QA.
- Existing About animations, globe behavior, and neighboring sections are not
  regressed.
