# Interaction observations and translation

Rocket Web Labs was inspected at 1440px and 390px. Its inset navigation stays
at the top; desktop links become a compact mobile menu. The hero uses large
left-aligned text with a media background. The introduction uses a large
typographic statement and inline visual accents. The View Work link exposes
a 0.2-second colour transition; its settled background is white, text black.
Reference captures are in the ignored `.playwright-cli/reference-*.png` files.

Portfolio implementation:
- Inset navigation with underline hover/current section state, mobile menu,
  Escape close and focus return; 44px control targets.
- Three explicitly selected hero scenes, with a 0.7-second crossfade. No
  automatic slideshow. Each scene names its actual project and contribution.
- Project previews have a small zoom and arrow response. Portrait artwork
  stays contained. Video previews play on mouse hover and pause on exit.
- Filter underline transitions and a short stagger on the updated project set.
- Case studies retain media controls; the background becomes inert, focus is
  trapped and returns on close. The close control stays reachable when scrolling.
- Native toolkit accordions, light/dark theme, copy-email confirmation.
- Reduced-motion preference removes transitions and JS entrance animations,
  and prevents hover autoplay. Explicit video playback controls remain usable.

No reference images, fonts, code, tracking or external assets were imported.
