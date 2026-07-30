# Loading Screen Mobile Balance Design

## Goal

Reduce the seated portrait's visual dominance on phones without breaking the synchronized handoff from the loading video to the homepage hero.

## Approved Geometry

- At widths below the existing `md` breakpoint, both the loading video and hero portrait use `h-[86dvh]`.
- At `md` and above, both keep `md:h-[96dvh]`.
- Both remain horizontally centered, bottom-aligned, `w-auto`, and `object-contain`.
- The source assets, loading duration, progress behavior, hero typography, and background animation remain unchanged.

## Rationale

The current `100dvh` mobile treatment makes the chair span beyond the viewport, crowds the top copy, and obscures too much of the `DECODE` word. An `86dvh` treatment gives the portrait breathing room while preserving its role as the hero's focal point. Applying the same geometry to the loader and hero prevents a size jump at the transition boundary.

## Acceptance Criteria

- The chair fits within a `390×844` viewport without side clipping.
- The portrait no longer crowds the role and statement copy.
- More of the `DECODE` word remains readable behind the seated pose.
- The final loading frame and first hero frame have matching rendered rectangles.
- Desktop geometry at `1440×900` is unchanged.
- Unit tests, type checking, linting, production build, and browser checks pass.
