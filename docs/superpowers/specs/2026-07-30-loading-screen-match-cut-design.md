# Loading Screen Match-Cut Design

## Goal

Turn Ahmed Rammah's new intro video into a loading sequence that flows directly into the homepage hero. The last video frame and the hero portrait must appear visually continuous, so the loader feels like the opening beat of the page rather than a separate asset.

## Approved Direction

Use a pixel-matched transition:

1. Play a lightly reframed version of the original intro.
2. Hold the final seated frame briefly.
3. Remove the loader while revealing an image extracted from that exact frame in the hero.
4. Animate the hero background and text around the stationary portrait.

## Video Treatment

- Source: `rammah-next/public/intro.mp4`
- Target duration: 7.2 seconds, with an allowed encoding tolerance of ±0.15 seconds.
- Preserve the natural timing; only remove excess still time near the end.
- Apply a subtle 5% crop centered on Ahmed and the chair.
- Keep the original vertical composition.
- Remove audio from the loading asset.
- Do not fade the video to black.
- Hold the final seated frame for 0.3 seconds, with an allowed encoding tolerance of ±0.05 seconds.
- Encode as H.264 MP4 with `yuv420p`, fast-start metadata, and mobile-safe playback settings.
- Keep the original source file unchanged.

## Hero Treatment

- Extract the held final video frame directly from the processed master.
- Use that frame as the hero portrait source.
- Match the hero image's size, crop, horizontal position, vertical position, and bottom alignment to the final video frame.
- Keep the portrait visible during the transition; animate the teal/white hero background, role labels, statement, and display word around it.
- Avoid a visible dissolve, scale jump, or vertical jump between loader and hero.

## Responsive Behavior

- Mobile: the vertical video fills the viewport height with the 5% crop preserved. Ahmed, the chair, and the final seated pose remain readable.
- Desktop: the vertical composition stays centered against black side space. The hero portrait uses the same centered geometry.
- The final-frame match must be checked at a minimum of `390×844` and `1440×900`.

## Playback Reliability

- Keep `autoPlay`, `muted`, `playsInline`, and `preload="auto"`.
- Provide a poster extracted from the processed video.
- Retry playback on `canplay` and when the page becomes visible again.
- Exit safely to the hero if video playback errors or exceeds the hard timeout.
- Drive the progress indicator from the processed video's actual duration.

## Acceptance Criteria

- The loading sequence runs for 7.2 seconds within the approved ±0.15-second tolerance.
- The crop is subtle and does not exceed the approved 5% treatment.
- The final pose is held for 0.3 seconds within the approved ±0.05-second tolerance.
- The loader-to-hero transition has no black flash.
- The portrait does not visibly jump in size or position during the transition.
- The intro plays on mobile with a poster fallback.
- The original `intro.mp4` remains unchanged.
- Unit tests, type checking, linting, and the production build pass.
- Browser checks pass at `390×844` and `1440×900`.
