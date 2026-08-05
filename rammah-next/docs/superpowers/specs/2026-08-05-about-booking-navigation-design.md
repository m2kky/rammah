# About cinematic and booking navigation

## Goal

Keep the About cinematic typography readable at every viewport, expose the
site navigation across every booking route, and reuse the clean About video as
the fullscreen menu background.

## Design

- Keep the existing cinematic composition and GSAP parallax. Constrain the
  moving text to a padded viewport-safe area and use responsive type sizes.
  Allow only the long final phrase to wrap on narrow screens.
- Add one `app/booking/layout.tsx` route layout that fetches the existing public
  navigation/site settings and renders the existing `Navbar` above all booking
  children. Do not add `PublicFrame`, because booking screens already own their
  `<main>` and do not need an extra footer.
- Replace the menu's old MP4 with the existing responsive About WebM sources:
  mobile below 900px and desktop otherwise. Retain the current dark overlays so
  menu links remain legible. No cinematic text is added to the menu.

## Verification

- Run lint/type checks for the touched app.
- Confirm About text stays readable at representative mobile and desktop sizes.
- Confirm `/booking`, offering, status, payment, and payment-return routes all
  show the same working navbar/menu.
- Confirm the fullscreen menu selects the appropriate About video source and
  contains no About text overlay.
