/* ═══════════════════════════════════════════════════════════════════════════
   THE LOGO, ANIMATED
   ---------------------------------------------------------------------------
   The wordmark and the root fan come straight out of the Illustrator artwork
   as vectors, so we can drive them rather than just show them.

     wordmark.svg    "SHROOM SABHA" — 8 letter groups (#l00..#l07). The chunky
                     letters physically touch in places, so a few share a group;
                     that is still plenty for a stagger.
     logo-roots.svg  the root fan. Every strand is a filled sliver, so we draw
                     it on by animating a clip that sweeps outward from the
                     stem — stroke-dash would not work on fills.
     tagline.svg     "celebrate the magic of mushrooms"

   Every path is authored with var(--ink) / var(--gold) fallbacks, so the whole
   lockup recolours from the theme with no extra assets.
   ═══════════════════════════════════════════════════════════════════════ */

import { REDUCED } from './fx.js';

const CACHE = new Map();

/** Fetch an SVG once and hand back a live clone. */
async function load (name) {
  if (!CACHE.has(name)) {
    CACHE.set(name, fetch(`assets/logo/${name}.svg`)
      .then(r => r.ok ? r.text() : Promise.reject(new Error(r.status)))
      .catch(() => null));
  }
  const text = await CACHE.get(name);
  if (!text) return null;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  return svg && svg.nodeName === 'svg' ? svg : null;
}

/**
 * Mount the wordmark and play it in.
 * @param {Element} host
 * @param {object} opt {play, stagger, delay, from}
 *        from: 'sprout' (grows up from the baseline) | 'settle' (drops in)
 */
export async function mountWordmark (host, opt = {}) {
  const svg = await load('wordmark');
  if (!svg || !host) return null;

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';
  svg.setAttribute('aria-label', 'Shroom Sabha');

  const letters = [...svg.querySelectorAll('.ss-letter')];
  const mode = opt.from || 'sprout';
  const stagger = opt.stagger ?? 62;
  const delay = opt.delay ?? 0;

  if (!REDUCED && opt.play !== false) {
    letters.forEach((g, i) => {
      g.style.opacity = '0';
      g.style.animation =
        `ss-letter-${mode} .68s cubic-bezier(.34,1.56,.64,1) ${delay + i * stagger}ms forwards`;
    });
  }

  host.replaceChildren(svg);
  return {
    svg,
    letters,
    replay () {
      if (REDUCED) return;
      letters.forEach((g, i) => {
        g.style.animation = 'none';
        void g.offsetWidth;
        g.style.animation =
          `ss-letter-${mode} .68s cubic-bezier(.34,1.56,.64,1) ${i * stagger}ms forwards`;
      });
    },
    /** Nudge a single letter — used when a stamp lands. */
    bump (i = Math.floor(Math.random() * letters.length)) {
      const g = letters[i % letters.length];
      if (!g || REDUCED) return;
      g.style.animation = 'none';
      void g.offsetWidth;
      g.style.animation = 'ss-letter-bump .5s cubic-bezier(.34,1.56,.64,1)';
    }
  };
}

/**
 * Mount the root fan and grow it outward from the stem.
 * The strands are filled slivers rather than strokes, so the reveal is a
 * clip circle expanding from the top-centre where the stem meets the soil.
 */
export async function mountRoots (host, opt = {}) {
  const svg = await load('logo-roots');
  if (!svg || !host) return null;

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';

  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const [x, y, w, h] = vb;
  const cx = x + w / 2, cy = y + 2;
  const r = Math.hypot(w, h);

  const NS = 'http://www.w3.org/2000/svg';
  const cp = document.createElementNS(NS, 'clipPath');
  const id = `roots-grow-${Math.random().toString(36).slice(2, 8)}`;
  cp.setAttribute('id', id);
  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', REDUCED || opt.play === false ? r : 0);
  cp.appendChild(circle);

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('clip-path', `url(#${id})`);
  while (svg.firstChild) g.appendChild(svg.firstChild);
  svg.append(cp, g);
  host.replaceChildren(svg);

  const grow = (ms = 1500) => {
    if (REDUCED) { circle.setAttribute('r', r); return; }
    const t0 = performance.now();
    const step = now => {
      /* rAF hands back the timestamp from the start of the frame, which can
         sit a hair before t0 — enough to make p negative and hand the circle
         a negative radius, which SVG rejects. Clamp both ends. */
      const p = Math.max(0, Math.min(1, (now - t0) / ms));
      circle.setAttribute('r', Math.max(0, (1 - Math.pow(1 - p, 3)) * r));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (opt.play !== false) setTimeout(() => grow(opt.duration), opt.delay ?? 0);
  return { svg, grow };
}

export async function mountTagline (host, opt = {}) {
  const svg = await load('tagline');
  if (!svg || !host) return null;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  if (!REDUCED && opt.play !== false) {
    svg.style.opacity = '0';
    svg.style.animation = `ss-fade-up .7s cubic-bezier(.16,1,.3,1) ${opt.delay ?? 0}ms forwards`;
  }
  host.replaceChildren(svg);
  return svg;
}

/** Warm the cache so the boot screen never waits on a fetch. */
export function preload () {
  ['wordmark', 'logo-roots', 'tagline'].forEach(load);
}
