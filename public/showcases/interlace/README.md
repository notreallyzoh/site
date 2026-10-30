# Interlace

**Loops and woven geometry — an evolving visual instrument by Zoheb Mamoo / @notreallyzoh.**

Interlace explores woven geometry through recursive Hopf tori, counter-rotating fibre families and sculptural interpretations. It is adapted from **Tortoise Generator by nurecas**, whose mathematical construction and rendering implementation form the foundation of this edition.

## Loop studio (new)

Open `loops.html`. This standalone Canvas 2D studio has no dependencies, account requirements or API calls. It creates original procedural artwork inspired by a shared visual reference, without embedding or tracing the reference image.

- Four compositions: Signal Garden, Crystal Circuit, Fluid Bloom and Orbital Pulse.
- Crystal glyphs, petal fans, orbital rings and flowing ribbons; independent layer amounts.
- Diamond, grid and band layouts, mirrored pairs or radial alternation, seed, density, motif scale and detail.
- Shared three-colour palette, custom colours, ground, hue offset, glow and line weight.
- BPM, bars in 4/4, integer cycles, movement and phase spread. Phase zero and one render the same frame. Movement zero freezes the artwork.
- Pause, restart, phase scrub and full screen. Reduced-motion preferences start paused.
- Panoramic, landscape, square and portrait output. PNG capture and versioned JSON settings import/export.
- WebM recording requests 30 fps for one loop in real time. Supported codecs vary by browser; use a recent desktop Chromium browser for best results. Recording locks composition controls, can be cancelled, and cancels if the tab is hidden. It is silent, uses an internal BPM clock, and is not frame-exact offline rendering or audio analysis. Busy devices can drop frames.

A shared duration and phase origin let exported variants follow the same timing. To align separate clips in an editor, retain the same BPM, bars and cycles and start them together. Live browser instances are not externally clock-synchronised.

The loop studio (`loops.html`, `loops.css`, `loops.js`) is a new implementation for this portfolio edition. It does not use the inherited torus renderer. The original source credits below apply to torus mode.

## Try torus mode

From the portfolio, open `/showcases/interlace/index.html`. The app is a standalone HTML page with no build step. To run this directory separately, serve it with `python -m http.server 8000`, then open `http://localhost:8000`.

A WebGL2-capable browser and an internet connection are required: Three.js 0.185.1 and its addons load from jsDelivr. Desktop is recommended for the full control set. On smaller screens the panels start collapsed so the artwork remains visible.

## Explore

1. Drag the canvas to orbit; scroll or pinch to zoom.
2. Expand Geometry and change fibre count, recursion, chirality or nesting. Higher node budgets require more GPU resources.
3. Explore crossing lattices, colour, lighting and the Phenomenology modes.
4. Pause Animate before capturing a precise frame.
5. Expand Generate, capture a rendered or depth reference and save it locally. Geometry, reference capture and preset import/export do not need an API key.

Optional image generation uses your own Stability AI API key and credits. The browser sends the reference image and prompt directly to Stability AI. Check current pricing and terms with the provider. No key is bundled. A supplied key is saved in this browser's localStorage; clear the key field to remove it, especially on shared devices. This edition uses its own storage names.

## Edition changes

- New Interlace name, page title, description and portfolio identity.
- Separate edition and original-author credits, with the original licence retained.
- A portfolio return link and a dedicated portfolio sub-URL.
- Collapsed generation panel on entry and collapsed geometry controls on mobile.
- Narrow-screen control sizing and an Interlace preset filename.
- Updated documentation and portfolio showcase integration.

The procedural geometry, Phenomenology system, rendering, captures and Stability integration are inherited from the original project. No claim is made that these are new algorithms by the edition maintainer. Preset schema identifiers remain unchanged for compatibility. Future changes can be documented below as the edition evolves.

## Credits & licence

- **Portfolio edition / direction:** Zoheb Mamoo — @notreallyzoh.
- **Original artwork and generator:** [nurecas](https://nurecas.com), [Tortoise Generator source](https://github.com/nurecas/tortoise_generator).
- **Rendering:** Three.js and its contributors.
- **Optional image generation:** Stability AI.

Code retains the [MIT licence](./LICENSE), including the original copyright notice. See [third-party notices](./THIRD_PARTY_NOTICES.md). Images in `docs/` are inherited reference screenshots from the original distribution, not new Interlace captures.

## Iteration log

- **23 October 2026:** Initial Interlace portfolio edition and local integration. No hosted publication or paid generation performed.

- **30 October 2026:** Added the original loop studio with shared-palette motifs, deterministic periodic motion, settings and PNG exports, and real-time WebM capture. Torus mode remains accessible through the mode links.
