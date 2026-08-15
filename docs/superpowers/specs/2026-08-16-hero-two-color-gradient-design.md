# Hero Two-Color Gradient Design

## Problem

The current hero uses a large radial gradient to bridge the teal and white areas. Its transparent edge blends into the teal background as a wide gray halo, making the transition look muddy and visually detached from the rest of the page.

## Approved Direction

Use one vertical linear gradient made only from the existing hero colors:

- Teal: `#0F3B46`
- White: `#FFFFFF`
- Teal remains solid through the upper hero.
- The two colors transition through a controlled middle band.
- White remains solid through the lower hero.

The initial implementation target is:

```css
linear-gradient(
  to bottom,
  #0F3B46 0%,
  #0F3B46 28%,
  #FFFFFF 48%,
  #FFFFFF 100%
)
```

## Implementation Boundaries

- Replace the separate lower white block and radial ellipse with one gradient layer.
- Remove the elliptical shape, transparent white stops, blur, shadow, and added gray colors.
- Keep the portrait, typography, colors, and hero content unchanged.
- Animate only opacity during the hero entry; do not animate filters or gradient stops.
- Preserve the existing responsive hero layout.

## Verification

- Add a regression assertion for the approved linear gradient and the absence of the radial gradient.
- Run the relevant unit test, full unit suite, TypeScript, ESLint, and production build.
- Inspect the hero in a real browser at desktop and mobile widths to confirm the transition has no arc, gray halo, or visible seam.
