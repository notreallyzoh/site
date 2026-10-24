# Portfolio refresh validation

Reference build, not a pixel clone. Rocket Web Labs informed composition and
interaction patterns; Zoh's palette, type pair, wording, artist mark and real
project media provide the final identity. Reviewed side by side with reference
captures at desktop and phone widths. No network requests to Rocket Web Labs
or Wix assets occur in the portfolio.

Production preview tested at 1440, 768, 390 and 320 pixels:
- Ten existing projects retained; all four category filters return expected results.
- Three hero scenes and navigation to a previously filtered-out project work.
- Shroom Sabha's four images and embedded map preview load.
- Techground's nine media items, Signals' two and Mycelial Stage's two load.
- Both added 1/0 reels play locally: 14.93s and 114.82s. Original post links,
  cover images, portrait presentation and phone reader checked.
- Escape, modal focus containment/background inertness, focus return, mobile
  menu and toolkit accordion checked.
- Light/dark theme, copy-email action, reduced-motion mode and page/modal
  overflow checks pass.
- Updated resume responds successfully and matches the supplied 5,282-byte PDF.
- Production build and source whitespace checks pass. Browser checks reported
  no runtime errors or failed responses for the tested portfolio flows.

Checks and captures are in ignored `.playwright-cli/check-refresh.cjs`,
`.playwright-cli/check-onezero.cjs` and accompanying PNG files. The preview
server must be restarted after a rebuild, and the page reloaded before testing
new output. The development server on port 5173 updates automatically.

Intentional changes: real project imagery replaces the particle opening;
projects precede the practice section; native scrolling replaces pinned
horizontal scrolling; video previews play on hover; simulated activity/music
widgets and the decorative cursor/audio engine were removed. The JS bundle
decreased from approximately 605 kB to 306 kB before compression.

The supplied resume PDF is unedited. All changes are local; no deployment was
performed. Source Instagram media is kept locally for reliable previews and
can be replaced with higher-quality originals later.
