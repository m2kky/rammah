# Intro Once Per Tab Design

## Goal

Play the homepage intro once per browser tab, then skip it when the visitor navigates away and returns to Home in that same tab.

## Behavior

- Use `sessionStorage`, because its lifetime and isolation match a browser tab.
- Set the marker when the intro is first selected to play. Leaving before the video ends must not replay it on return.
- A new tab has a new session and plays the intro once.
- If storage access throws, preserve the current behavior and play the intro.
- Check storage in `useLayoutEffect` so returning visitors do not see a one-frame loader flash.
- Keep the existing autoplay, Safari fallback, progress, timeout, and completion behavior unchanged.

## Scope

Only `HomeClient` owns the per-tab decision. `LoadingScreen` remains responsible for playing and finishing the intro.

## Testing

A component test covers first visit, same-tab remount, new storage session, and unavailable storage. Existing loading-screen tests continue to protect playback behavior.
