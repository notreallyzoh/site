/* ═══════════════════════════════════════════════════════════════════════════
   THE MAP — gestures, pins, decluttering
   ---------------------------------------------------------------------------
   This file owns everything you interact with. It does NOT own how the farm
   is drawn: that is a renderer, and there are two of them.

   ONE VIEW MODEL, shared by both:

       { cx, cy, scale, azimuth, tilt }

       cx, cy   the world point (0..1) sitting in the middle of the visible
                band — the strip between the header and the sheet
       scale    screen pixels per world unit
       azimuth  compass rotation, degrees (flat renderer ignores it)
       tilt     camera elevation, degrees (flat renderer ignores it)

   ONE RENDERER CONTRACT:

       mount() setView(view) setPads(t,b) project(nx,ny) setNight(on)
       setLayer(name,on) resize() pause(v) fitBias

   `project` is the hinge. Pins, labels and amenities are real DOM positioned
   in SCREEN space from whatever the renderer says, so every one of them —
   plus the collision pass, the tiers, the search spotlight — works unchanged
   whether the farm is lying flat or standing up. Switching views is a flag.
   ═══════════════════════════════════════════════════════════════════════ */

import { FESTIVAL, PINNED, AMENITIES, pinFor } from './data.js';
import { burst, buzz, TAP, REDUCED } from './fx.js';
import { createMapSketch } from './mapsketch.js';
import * as store from './store.js';

const SIZE = FESTIVAL.map.w;                    // 1280 world units square

let viewport, layer, hotspotHost, renderer = null;
let vw = 0, vh = 0, padTop = 56, padBottom = 128;
let fitScale = 1, minScale = 1, maxScale = 3;
let home = { cx: .5, cy: .5, w: 1, h: 1 };
let onPick = () => {};
let onCamera = null;
let editMode = false;
let isIso = false;
let fellBack = false;
let lostTimer = 0;
let fellBackWhy = '';
let host = null;
let onFallback = null;
let nightOn = false;

const view = { cx: 0.5, cy: 0.5, scale: 0.3, azimuth: 45, tilt: 35.264 };

const nodes = new Map();       // venue id  -> button
const amNodes = new Map();     // amenity id -> button
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const GLYPH = {
  toilet:  '<path d="M8 21v-6H6.5l1.6-6.2a1.6 1.6 0 0 1 3.1 0L12.8 15H11v6zM9.5 6.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z"/><path d="M17.2 21v-5h2l-1.7-6a1.5 1.5 0 0 0-2.9 0L13 16h2v5zM16 6.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z"/>',
  shower:  '<path d="M5 3h5a5 5 0 0 1 5 5H5z"/><circle cx="8" cy="13" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="6" cy="17" r="1"/><circle cx="10" cy="19" r="1"/><circle cx="14" cy="19" r="1"/>',
  water:   '<path d="M3 7h9v3H7v10H4V10H3z"/><path d="M12 6h4a3 3 0 0 1 3 3v2h-3V9h-4z"/>',
  food:    '<path d="M6 3v8a2 2 0 0 0 4 0V3M8 3v18"/><path d="M17 3c-1.6 1.2-2.4 3-2.4 5.2 0 1.9.8 3 2.4 3.3V21"/>',
  firstaid:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M12 10v5M9.5 12.5h5"/><path d="M9 6V4.6A1.6 1.6 0 0 1 10.6 3h2.8A1.6 1.6 0 0 1 15 4.6V6"/>',
  sport:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>',
  swim:    '<path d="M2.5 17.5c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4"/><path d="M2.5 21c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4"/><circle cx="16.5" cy="6" r="2"/><path d="M6 14l5-4 3.5 2"/>',
  bees:    '<ellipse cx="12" cy="14" rx="4" ry="5.5"/><path d="M8 12h8M8 15.5h8"/><path d="M12 8.5V6M9.5 5l2 1.5M14.5 5l-2 1.5"/><path d="M8.5 10C6 8 4 9 4.5 11s3 1.5 4 .8M15.5 10c2.5-2 4.5-1 4 1s-3 1.5-4 .8"/>',
  cattle:  '<path d="M4 9c0-2 1.5-3.5 3.5-3.5h9C18.5 5.5 20 7 20 9v3.5A5.5 5.5 0 0 1 14.5 18h-5A5.5 5.5 0 0 1 4 12.5z"/><path d="M4 9C2.5 9 2 7.5 2 6M20 9c1.5 0 2-1.5 2-3"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>',
  recycle: '<path d="M7.5 4.5l2-3.2 2 3.2"/><path d="M9.5 1.8v7.4"/><path d="M4 12l-2.2 3.6L5 17.4M20 12l2.2 3.6L19 17.4M8 22h8"/><path d="M12 8.5l4 6.5H8z"/>',
  plant:   '<path d="M12 21v-8"/><path d="M12 13C12 9 9 6.5 5 6.5c0 4 3 6.5 7 6.5z"/><path d="M12 13c0-3.4 2.6-5.6 6-5.6 0 3.4-2.6 5.6-6 5.6z"/>'
};

/* ────────────────────────────────────────────────────────────── setup ─── */

export async function initMap (opts) {
  viewport = document.getElementById('viewport');
  layer = document.getElementById('layer');
  hotspotHost = document.getElementById('hotspots');
  onPick = opts.onPick || onPick;
  onCamera = opts.onCamera || null;
  editMode = opts.edit || false;
  isIso = opts.iso || false;
  onFallback = opts.onFallback || null;

  host = document.getElementById('canvasHost');
  try {
    if (isIso) {
      /* ?failiso=1 makes the first 3D start fail on purpose. The transient GPU
         refusal this guards against is impossible to reproduce on demand, so
         without a way to force it the retry path could only ever be tested by
         waiting for it to happen to someone. */
      if (new URLSearchParams(location.search).get('failiso') === '1') {
        throw new Error('forced failure via ?failiso=1');
      }
      const { createIsoMap } = await import('./iso.js');
      renderer = createIsoMap({
        container: host,
        onReady: () => opts.onSketchReady?.(),
        /* A lost context is recoverable in principle, but on a loaded phone it
           tends to keep happening. Give it a few seconds to come back; if it
           does not, swap to the flat renderer, which is 2-D canvas and cannot
           be evicted this way. A static map beats a blank one. */
        onContextLost: onContextLost,
        onContextBack: () => { clearTimeout(lostTimer); }
      });
    } else {
      renderer = createMapSketch({ container: host, onReady: () => opts.onSketchReady?.() });
    }
    renderer.mount();
  } catch (err) {
    /*
     * One retry before giving up. Watching this fail and then succeed on the
     * same phone minutes later showed the refusal is transient: the browser is
     * momentarily out of GPU resources, not incapable. Falling back permanently
     * on the first "no" meant a phone that could run the 3D map spent the whole
     * festival on the flat one, with no way back short of a reload.
     */
    /*
     * Retry properly before giving up, and take the sky's context if we must.
     *
     * Measured on a phone that had just refused the 3D map: three fresh WebGL
     * contexts were available seconds later. The refusal is a queue, not a
     * verdict — the browser has not yet reclaimed the contexts from whatever
     * was on screen before. One 700 ms retry was not enough to outlast it.
     *
     * The second half matters more. The sky asks for its context first and the
     * map asks second, so when only one is going spare, the decoration won and
     * the map fell back to flat. That is exactly backwards. If retries are not
     * working, drop the sky — it degrades to a painted gradient nobody will
     * miss — and give its context to the farm.
     */
    let recovered = false;
    if (isIso) {
      for (const wait of [600, 1400, 2400]) {
        await new Promise(r => setTimeout(r, wait));

        /* Last go: the sky is decoration, the map is the app. */
        if (wait === 2400) opts.releaseSky?.();

        try {
          const { createIsoMap } = await import('./iso.js');
          renderer = createIsoMap({
            container: host,
            onReady: () => opts.onSketchReady?.(),
            onContextLost, onContextBack: () => clearTimeout(lostTimer)
          });
          renderer.mount();
          recovered = true;
          console.warn('3D map started on retry after ' + wait + 'ms.');
          break;
        } catch (again) { err = again; }
      }
    }

    if (!recovered) {
      /* Say WHY, not just that. "Could not start" sends people looking at their
         phone; "too many tabs" tells them what to do about it. */
      fellBackWhy = diagnose(err);
      console.warn('3D map could not start —', fellBackWhy, err);
      fellBack = true;
      isIso = false;
      renderer = createMapSketch({ container: host, onReady: () => opts.onSketchReady?.() });
      try { renderer.mount(); } catch { renderer = null; }
    }
  }
  document.documentElement.dataset.view = isIso ? 'iso' : 'flat';
  if (new URLSearchParams(location.search).has('nosw')) window.__renderer = renderer;

  buildHotspots();
  buildAmenities();
  measure();
  fit(false);

  addEventListener('resize', () => {
    measure(); clampView(); apply(); renderer?.resize();
  }, { passive: true });
  bindGestures();

  if (editMode && !isIso) startEditMode();
  return api;
}

function measure () {
  const r = viewport.getBoundingClientRect();
  vw = r.width; vh = r.height;
  const css = getComputedStyle(document.documentElement);
  padTop = parseFloat(css.getPropertyValue('--hud-h')) || 56;
  /* Must agree with the rail media query in app.css, or the map reserves
     room for a sheet that is not there (or fails to reserve room for one
     that is). */
  const railed = innerWidth >= 820 || (innerWidth >= 560 && innerHeight <= 540);
  padBottom = railed ? 24 : (parseFloat(css.getPropertyValue('--peek')) || 128);

  /* Standing the farm up makes its silhouette wider than its footprint, so
     the isometric renderer asks for a slacker fit. */
  const bias = renderer?.fitBias ?? 1;
  const boxW = vw - 28;
  const boxH = vh - padTop - padBottom - 28;
  /* Fit to the farm, not to the sheet it is drawn on — the footprint covers
     under half the 1280 square, so fitting the square wasted the screen. */
  home = renderer?.footprint?.() || { cx: .5, cy: .5, w: 1, h: 1 };
  const span = Math.max(home.w, home.h) * SIZE;
  fitScale = Math.min(boxW / span, boxH / span) * bias;
  minScale = fitScale * 0.9;
  maxScale = Math.max(3, fitScale * 9);
  renderer?.setPads?.(padTop, padBottom);
}

/** Where the middle of the visible band sits, in screen pixels. */
const centreX = () => vw / 2;
const centreY = () => padTop + (vh - padTop - padBottom) / 2;

/* ───────────────────────────────────────────────────────── transform ─── */

function clampView () {
  /* Keep the farm from being dragged off into the void. Isometric gets a
     looser leash because its silhouette is not axis-aligned. */
  const slack = isIso ? 0.30 : 0.02;
  const halfW = vw / 2 / (SIZE * view.scale);
  const halfH = (vh - padTop - padBottom) / 2 / (SIZE * view.scale);
  view.cx = halfW >= 0.5 ? 0.5 : clamp(view.cx, halfW - slack, 1 - halfW + slack);
  view.cy = halfH >= 0.5 ? 0.5 : clamp(view.cy, halfH - slack, 1 - halfH + slack);
}

function apply () {
  renderer?.setView(view);
  viewDirty = true;
  scheduleFrame();
}

/** Screen position of a world point, straight from whichever renderer is up. */
export function project (nx, ny) {
  if (renderer?.project) return renderer.project(nx, ny);
  return {
    x: (nx - view.cx) * SIZE * view.scale + centreX(),
    y: (ny - view.cy) * SIZE * view.scale + centreY(),
    behind: false
  };
}

/** World point under a screen position — the inverse, for pinch and drag. */
function unproject (sx, sy) {
  return {
    x: view.cx + (sx - centreX()) / (SIZE * view.scale),
    y: view.cy + (sy - centreY()) / (SIZE * view.scale)
  };
}

/** Pan by a screen-pixel delta. */
function panBy (dx, dy) {
  const k = SIZE * view.scale;
  if (!isIso) { view.cx -= dx / k; view.cy -= dy / k; }
  else {
    /* rotate the drag into world space so the map follows your finger even
       when the compass has been turned */
    const a = -view.azimuth * Math.PI / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const wx = (dx * cos - dy * sin) / k;
    const wy = (dx * sin + dy * cos) / k / Math.max(.35, Math.sin(view.tilt * Math.PI / 180));
    view.cx -= wx; view.cy -= wy;
  }
  clampView(); apply();
}

/** Zoom about a screen point, keeping the world under it still. */
function zoomAt (next, sx, sy) {
  const ns = clamp(next, minScale, maxScale);
  if (!isIso) {
    const before = unproject(sx, sy);
    view.scale = ns;
    const after = unproject(sx, sy);
    view.cx += before.x - after.x;
    view.cy += before.y - after.y;
  } else {
    view.scale = ns;
  }
  clampView(); apply();
}

/* ─────────────────────────────────────────────────────────── animation ── */

let animRaf = 0;
const easeOut = t => 1 - Math.pow(1 - t, 4);

function animateTo (target, ms = 720, done) {
  cancelAnimationFrame(animRaf);
  if (REDUCED || ms === 0) {
    Object.assign(view, target); clampView(); apply(); done?.();
    return;
  }
  const from = { ...view }, t0 = performance.now();
  const keys = Object.keys(target);
  const step = now => {
    const p = Math.min(1, (now - t0) / ms);
    const e = easeOut(p);
    for (const k of keys) view[k] = from[k] + (target[k] - from[k]) * e;
    clampView(); apply();
    onCamera?.();
    if (p < 1) animRaf = requestAnimationFrame(step);
    else done?.();
  };
  animRaf = requestAnimationFrame(step);
}

/** Fit the whole farm. */
export function fit (animate = true) {
  const target = { cx: home.cx, cy: home.cy, scale: fitScale };
  animate ? animateTo(target, 620) : (Object.assign(view, target), clampView(), apply());
}

/** Centre a normalised point at a readable zoom. */
export function flyTo (nx, ny, scale) {
  animateTo({
    cx: nx, cy: ny,
    scale: clamp(scale ?? Math.max(fitScale * 2.4, 1.05), minScale, maxScale)
  }, 760);
}

export function focusVenue (id, scale) {
  const v = pinFor(id);
  if (!v) return;
  flyTo(v.x, v.y, scale);
  highlight(v.id);
  renderer?.setFocus?.(v.x, v.y);      // fades occluding canopy in isometric
}

export function focusAmenity (id) {
  const am = AMENITIES.find(a => a.id === id);
  if (!am) return null;
  amNodes.forEach(el => el.classList.remove('is-lit'));
  amNodes.get(id)?.classList.add('is-lit');
  flyTo(am.x, am.y, Math.max(fitScale * 4.2, 1.5));
  return am;
}

export function center () { return { x: view.cx, y: view.cy }; }

/* ── camera controls, only meaningful when the farm is standing up ──── */

export function rotate (deg) {
  animateTo({ azimuth: view.azimuth + deg }, 520, onCamera);
}

/** Current bearing and tilt, for the compass in the header. */
export const camera = () => ({ azimuth: view.azimuth, tilt: view.tilt });

/** Point north again, standing the farm back up if it was flattened. */
export function resetNorth () {
  const az = view.azimuth;
  const snapped = Math.round(az / 360) * 360;          // shortest way round
  animateTo({ azimuth: snapped, tilt: 35.264 }, 620, onCamera);
}

/** Drop to straight-down and back — attendees have a top-down printed map. */
export function toggleFlatten () {
  const flat = view.tilt > 75;
  animateTo({ tilt: flat ? 35.264 : 90 }, 620, onCamera);
  return !flat;
}

export const isFlattened = () => view.tilt > 75;
/*
 * Losing the GPU context is not the same as being unable to run.
 *
 * Chrome takes the context back from any tab it puts in the background — lock
 * the screen, answer a message, come back — and hands it over again on return.
 * Treating the first loss as fatal is what stranded a perfectly capable phone
 * on the flat map: the 3D view started fine, the user pocketed the phone, and
 * it never came back for the rest of the session.
 *
 * So: while the page is hidden, do nothing at all. Only once it is visible
 * again, and only if the context has genuinely not returned, give up.
 */
function onContextLost () {
  clearTimeout(lostTimer);

  const giveUpSoon = () => {
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => {
      if (isIso && renderer?.contextAlive?.() === false) {
        swapToFlat('the 3D map lost the graphics card and it did not come back');
      }
    }, 6000);
  };

  if (document.hidden) {
    const onBack = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onBack);
      /* Give the browser a moment to restore it before judging. */
      setTimeout(() => {
        if (renderer?.contextAlive?.() === false) giveUpSoon();
      }, 1800);
    };
    document.addEventListener('visibilitychange', onBack);
    return;
  }
  giveUpSoon();
}

/**
 * Tear down the 3-D renderer and stand the flat one up in its place, keeping
 * the view where it was. Called when the GPU context goes and does not return.
 */
function swapToFlat (why) {
  if (!isIso) return;
  fellBackWhy = why;
  console.warn('Falling back to the flat map —', why);
  const keep = { cx: view.cx, cy: view.cy, scale: view.scale };

  try { renderer?.destroy?.(); } catch { /* it is already broken */ }
  /* destroy() cannot be trusted on a renderer whose context just died, and a
     leftover dead canvas sits in the same stacking context as the new one. */
  host.querySelectorAll('canvas').forEach(c => c.remove());

  isIso = false;
  fellBack = true;
  document.documentElement.dataset.view = 'flat';
  view.azimuth = 45;
  view.tilt = 90;

  /* p5 sets up asynchronously: the canvas exists before it can draw. Doing the
     restore work in onReady rather than straight after mount() is the whole
     difference between a map and an empty background with labels on it. */
  renderer = createMapSketch({
    container: host,
    onReady: () => {
      measure();
      view.cx = keep.cx;
      view.cy = keep.cy;
      view.scale = clamp(keep.scale, minScale, maxScale);
      renderer.setPads?.(padTop, padBottom);
      renderer.setNight?.(nightOn);      // otherwise a night map turns day mid-walk
      apply();
      layoutMarkers();
      onFallback?.(why);
    }
  });
  try { renderer.mount(); }
  catch (e) { console.error('The flat map could not start either.', e); renderer = null; }
}

export const isIsometric = () => isIso;
/* True when the isometric renderer was asked for but could not start — no
   WebGL2, or Three.js failed to load — and the flat one took over. The About
   pane reports this so a lost isometric view has a visible reason. */
export const didFallBack = () => fellBack;
/** Why the 3D map is not running, in words a person can act on. */
export const fallbackReason = () => fellBackWhy;

/**
 * Turn a renderer failure into something actionable.
 *
 * The common cause on a phone is not a missing feature — it is that the
 * browser has run out of live WebGL contexts, which happens well before you
 * notice, and which dozens of open tabs will do on their own. Chrome drops the
 * oldest contexts and refuses new ones, so a page that worked an hour ago
 * quietly stops. Battery saver is the other one: Android throttles the GPU and
 * a high-performance context request is the first thing to be refused.
 */
function diagnose (err) {
  const msg = String(err && (err.message || err)).toLowerCase();

  if (!window.WebGL2RenderingContext) {
    return 'this browser has no WebGL2, which the 3D map needs';
  }
  /* Ask for a throwaway context: if even that is refused, the problem is
     supply, not capability. */
  let canMake = false;
  try {
    const probe = document.createElement('canvas');
    canMake = !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch { canMake = false; }

  if (!canMake) {
    return 'your browser has run out of graphics memory — closing some tabs ' +
           'usually brings the 3D map back';
  }
  if (msg.includes('import') || msg.includes('fetch') || msg.includes('network')) {
    return 'part of the 3D map could not be downloaded';
  }
  if (msg.includes('context')) {
    return 'the graphics card refused a new drawing surface';
  }
  return 'the 3D map hit an error starting up (' + String(err && err.message || err).slice(0, 80) + ')';
}
export function setNight (on) { nightOn = on; renderer?.setNight(on); }
export function setLayer (name, on) { renderer?.setLayer?.(name, on); }
export function setQuality (q) { renderer?.setQuality?.(q); }
export const layerNames = () => renderer?.layerNames?.() || [];

/* ══════════════════════════════════════════════════ pin positioning ═════
   Every marker is positioned in screen space from project(), so the same
   code drives both views. One rAF per view change, ~51 elements.        */

let frameRaf = 0;
function scheduleFrame () {
  if (frameRaf) return;
  frameRaf = requestAnimationFrame(() => { frameRaf = 0; layoutMarkers(); });
}

/* The isometric camera can be mid-animation, so markers need re-laying-out
   while it moves — but only while it moves. `apply()` raises the flag. */
let viewDirty = false;
function tickWhileIso () {
  if (!isIso) return;
  if (viewDirty) { viewDirty = false; layoutMarkers(); }
  requestAnimationFrame(tickWhileIso);
}

function layoutMarkers () {
  positionAmenities();
  positionYou();
  declutter();
}

/* ─────────────────────────────────────────────────────────── you are here ── */

let youState = null;
let youEl = null;

/**
 * Place the live position marker.
 *
 * @param {?object} y  null to hide, otherwise
 *   {x, y}          map-space position
 *   {accUnits}      GPS accuracy expressed in map units, for the halo
 *   {ahead}         optional {x, y} a short way in the facing direction
 *   {stale}         the fix is old enough to distrust
 *
 * The halo radius and the cone angle are both derived by projecting a second
 * world point and measuring on screen, rather than by scaling a constant. That
 * is what keeps this correct when the map is rotated, tilted, or swapped for
 * the flat renderer — none of which this function needs to know about.
 */
export function setYou (y) {
  youState = y;
  youEl = youEl || document.getElementById('you');
  positionYou();
}

function positionYou () {
  if (!youEl) youEl = document.getElementById('you');
  if (!youEl) return;

  if (!youState) { youEl.hidden = true; return; }

  const p = project(youState.x, youState.y);
  const off = p.behind || p.x < -140 || p.y < -140 || p.x > vw + 140 || p.y > vh + 140;
  if (off) { youEl.hidden = true; return; }

  youEl.hidden = false;
  youEl.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
  youEl.classList.toggle('is-stale', !!youState.stale);

  if (Number.isFinite(youState.accUnits)) {
    const e = project(youState.x + youState.accUnits, youState.y);
    const r = Math.hypot(e.x - p.x, e.y - p.y);
    youEl.style.setProperty('--r', `${Math.max(14, Math.min(260, r))}px`);
  }

  if (youState.ahead) {
    const a = project(youState.ahead.x, youState.ahead.y);
    /* +90 because the cone's own zero points up the screen, not along +x. */
    const deg = Math.atan2(a.y - p.y, a.x - p.x) * 180 / Math.PI + 90;
    youEl.style.setProperty('--head', `${deg}deg`);
    youEl.dataset.heading = '1';
  } else {
    delete youEl.dataset.heading;
  }
}

function positionAmenities () {
  for (const [id, el] of amNodes) {
    const am = AMENITIES.find(a => a.id === id);
    const p = project(am.x, am.y);
    const off = p.x < -60 || p.y < -60 || p.x > vw + 60 || p.y > vh + 60 || p.behind;
    el.classList.toggle('is-off', off);
    if (!off) el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
  }
}

/* ──────────────────────────────────────────────────────────── gestures ── */

function bindGestures () {
  const live = new Map();
  let pinchStart = 0, pinchScale = 1, twistStart = 0, twistAz = 0;
  let mid = { x: 0, y: 0 };
  let last = { x: 0, y: 0, t: 0 };
  let vx = 0, vy = 0, moved = 0, inertia = 0, lastTap = 0;

  const stopInertia = () => { cancelAnimationFrame(inertia); inertia = 0; };
  const angleOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

  viewport.addEventListener('pointerdown', e => {
    if (editMode && e.target.closest('.hs')) return;
    stopInertia();
    cancelAnimationFrame(animRaf);
    live.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = { x: e.clientX, y: e.clientY, t: performance.now() };
    moved = 0; vx = vy = 0;
    if (live.size === 2) {
      const [a, b] = [...live.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchScale = view.scale;
      twistStart = angleOf(a, b);
      twistAz = view.azimuth;
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', e => {
    if (!live.has(e.pointerId)) return;
    const prev = live.get(e.pointerId);
    live.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (live.size >= 2) {
      const [a, b] = [...live.values()];
      if (pinchStart > 0) {
        const nm = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const pinchRatio = dist / pinchStart;
        let twist = angleOf(a, b) - twistStart;
        while (twist > 180) twist -= 360;
        while (twist < -180) twist += 360;

        /* Disambiguate the three two-finger gestures the way map apps do:
             twist        -> turn the compass
             pinch        -> zoom
             both fingers -> tilt, but only when neither of the other two is
             sliding up/down    happening, so a sloppy pinch never tips the camera. */
        const steady = Math.abs(pinchRatio - 1) < 0.10 && Math.abs(twist) < 9;

        if (isIso && steady && Math.abs(nm.y - mid.y) > 0.4) {
          /*
           * Plus, not minus. Every maps app treats two fingers pushed up the
           * screen as tipping the camera down toward the horizon — more 3D —
           * and pulled down as returning to a plan view. This did the reverse:
           * pushing up flattened the farm, which is the one thing a person
           * pushing "up into the scene" is not asking for. tilt 90 is straight
           * down here, so going more 3D means a smaller number.
           */
          view.tilt = clamp(view.tilt + (nm.y - mid.y) * 0.36, 14, 90);
          apply();
          onCamera?.();
        } else {
          panBy(nm.x - mid.x, nm.y - mid.y);
          zoomAt(pinchScale * pinchRatio, nm.x, nm.y);
          if (isIso && Math.abs(twist) > 4) {
            /*
             * Minus, not plus. The camera orbits the farm, so the world turns
             * the opposite way to the azimuth: measured, +30° of azimuth
             * sweeps a landmark 66° anticlockwise across the screen. Adding
             * the twist therefore turned the map against the fingers — you
             * twisted right and the farm went left.
             */
            view.azimuth = twistAz - twist;
            apply();
            onCamera?.();
          }
        }
        mid = nm;
      }
      moved = 99;
      return;
    }

    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 5) viewport.classList.add('is-dragging');
    panBy(dx, dy);

    const now = performance.now();
    const dt = Math.max(1, now - last.t);
    vx = (e.clientX - last.x) / dt;
    vy = (e.clientY - last.y) / dt;
    last = { x: e.clientX, y: e.clientY, t: now };
  });

  const release = e => {
    if (!live.has(e.pointerId)) return;
    live.delete(e.pointerId);
    viewport.classList.remove('is-dragging');
    if (live.size === 1) {
      const only = [...live.values()][0];
      last = { x: only.x, y: only.y, t: performance.now() };
      pinchStart = 0;
    }
    if (live.size > 0) return;

    if (moved < 6) {
      /*
       * Resolve the tap ourselves.
       *
       * The viewport captures the pointer on pointerdown so a drag keeps
       * working when the finger leaves the element — but capture also
       * retargets the eventual `click` to the capturing element. The result:
       * pointerdown lands on the label you pressed, and the click fires on the
       * viewport instead, so the delegated handler on the hotspot layer never
       * hears about it and nothing opens. Mouse and touch alike.
       *
       * Hit-testing the release point and forwarding to the marker keeps one
       * code path for "what did you press", and leaves the existing click
       * handlers as the single place that decides what pressing means.
       */
      if (!editMode) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const marker = under && under.closest && under.closest('.hs, .am');
        if (marker) { marker.click(); lastTap = 0; return; }
      }

      const now = performance.now();
      if (now - lastTap < 300) {
        if (view.scale > fitScale * 1.6) fit();
        else zoomAt(fitScale * 2.8, e.clientX, e.clientY);
        lastTap = 0;
        return;
      }
      lastTap = now;
      return;
    }

    if (Math.abs(vx) > 0.08 || Math.abs(vy) > 0.08) {
      let ivx = vx * 16, ivy = vy * 16;
      const glide = () => {
        ivx *= 0.93; ivy *= 0.93;
        panBy(ivx, ivy);
        inertia = (Math.abs(ivx) > 0.2 || Math.abs(ivy) > 0.2) ? requestAnimationFrame(glide) : 0;
      };
      inertia = requestAnimationFrame(glide);
    }
  };

  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);

  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    stopInertia();
    cancelAnimationFrame(animRaf);
    zoomAt(view.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX, e.clientY);
  }, { passive: false });

  viewport.tabIndex = 0;
  viewport.addEventListener('keydown', e => {
    const moves = { ArrowUp: [0, 60], ArrowDown: [0, -60], ArrowLeft: [60, 0], ArrowRight: [-60, 0] };
    if (moves[e.key]) { e.preventDefault(); panBy(...moves[e.key]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(view.scale * 1.25, vw / 2, vh / 2); }
    else if (e.key === '-') { e.preventDefault(); zoomAt(view.scale / 1.25, vw / 2, vh / 2); }
    else if (e.key === '0') { e.preventDefault(); fit(); }
    else if (e.key === '[') { e.preventDefault(); rotate(-45); }
    else if (e.key === ']') { e.preventDefault(); rotate(45); }
  });
}

/* ──────────────────────────────────────────────────────────── hotspots ── */

const TIER = {
  understory: 1, 'under-the-gills': 1, primordium: 1, 'mycelium-grove': 1,
  'the-oasis': 1, 'shroom-room': 1, 'camp-ground': 1,
  'birds-nest-fungi': 2, 'main-house': 2, 'entry-road': 2, 'back-gate': 2,
  canteen: 2, temple: 2, 'old-tree-house': 2, raktheshwari: 2,
  'coral-fungi': 2, cordyceps: 2
};
const tierOf = v => TIER[v.id] || (v.kind === 'stay' ? 2 : 3);
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

function buildHotspots () {
  const frag = document.createDocumentFragment();
  const ordered = [...PINNED].sort((a, b) =>
    Math.hypot(a.x - .5, a.y - .5) - Math.hypot(b.x - .5, b.y - .5));

  ordered.forEach((v, i) => {
    const b = document.createElement('button');
    b.className = 'hs';
    b.type = 'button';
    b.dataset.id = v.id;
    b.dataset.tier = tierOf(v);
    b.dataset.kind = v.kind;
    b.setAttribute('aria-label', `${v.name}${v.role ? ' — ' + v.role : ''}`);
    b.style.setProperty('--delay', `${420 + i * 26}ms`);
    b.style.setProperty('--breath', `${(i * 311) % 4000}ms`);
    b.innerHTML =
      '<span class="hs-inner">' +
        `<span class="hs-chip"><b>${esc(v.name)}</b>` +
        (v.role ? `<i>${esc(v.role)}</i>` : '') + '</span>' +
        '<span class="hs-stem"></span><span class="hs-dot"></span></span>';
    if (store.isStamped(v.id)) b.classList.add('is-stamped');
    frag.appendChild(b);
    nodes.set(v.id, b);
  });
  hotspotHost.appendChild(frag);

  hotspotHost.addEventListener('click', e => {
    const b = e.target.closest('.hs');
    if (!b || editMode) return;
    const r = b.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 14, spread: .8 });
    buzz(TAP);
    highlight(b.dataset.id);
    onPick(b.dataset.id);
  });

  store.onChange(what => {
    if (what !== 'stamps' && what !== 'reset') return;
    nodes.forEach((el, id) => el.classList.toggle('is-stamped', store.isStamped(id)));
  });
}

function buildAmenities () {
  const frag = document.createDocumentFragment();
  AMENITIES.forEach((am, i) => {
    const el = document.createElement('button');
    el.className = 'am';
    el.type = 'button';
    el.dataset.id = am.id;
    el.dataset.type = am.type;
    el.setAttribute('aria-label', am.note || am.type);
    el.style.setProperty('--delay', `${700 + i * 18}ms`);
    el.innerHTML =
      '<span class="am-inner">' +
        `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[am.type] || GLYPH.plant}</svg>` +
        `<span class="am-tip">${esc(am.note || '')}</span></span>`;
    frag.appendChild(el);
    amNodes.set(am.id, el);
  });
  hotspotHost.appendChild(frag);
}

/* ── label decluttering ────────────────────────────────────────────────
   Thirty names will always collide on a phone, and a map you cannot read is
   not a map. Walk the pins in priority order, keep the ones that fit, fold
   the rest to a plain dot until there is room. */

const chipBox = new Map();

function declutter () {
  const t = view.scale < fitScale * 1.6 ? 1 : view.scale < fitScale * 3.4 ? 2 : 3;
  if (hotspotHost.dataset.zoom !== String(t)) {
    hotspotHost.dataset.zoom = String(t);
    chipBox.clear();
  }

  const list = [];
  for (const [id, el] of nodes) {
    const tier = +el.dataset.tier;
    if (tier > t) { el.classList.add('is-off'); continue; }

    const v = PINNED.find(p => p.id === id);
    const p = project(v.x, v.y);
    if (p.behind || p.x < -90 || p.y < -90 || p.x > vw + 90 || p.y > vh + 90) {
      el.classList.add('is-off');
      continue;
    }
    el.classList.remove('is-off');
    el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;

    let box = chipBox.get(id);
    if (!box) {
      const chip = el.querySelector('.hs-chip');
      box = { w: chip.offsetWidth || 90, h: chip.offsetHeight || 30 };
      if (box.w) chipBox.set(id, box);
    }
    list.push({ el, tier, sx: p.x, sy: p.y, w: box.w, h: box.h });
  }

  list.sort((a, b) =>
    a.tier - b.tier ||
    (a.el.classList.contains('is-active') ? -1 : 0) - (b.el.classList.contains('is-active') ? -1 : 0) ||
    a.sy - b.sy);

  const margin = 3, taken = [];
  const hits = r => taken.some(q => r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1);

  /*
   * Reserve the chrome before anything else competes for space. Photographing
   * the real phone showed "MUDHOUSE" sitting behind the header and a chip
   * tucked under the sheet — invisible, but still counted as shown, so the
   * declutter had happily suppressed a legible neighbour to make room for it.
   */
  taken.push({ x0: -1e4, x1: 1e4, y0: -1e4, y1: padTop + 6 });
  taken.push({ x0: -1e4, x1: 1e4, y0: vh - padBottom + 6, y1: 1e4 });

  /* A chip cut in half by the screen edge reads as breakage: "Oysterling" is
     not a place. Fold it and let it return when you pan. */
  const clipped = r => r.x0 < 4 || r.x1 > vw - 4;

  for (const p of list) {
    const r = {
      x0: p.sx - p.w / 2 - margin, x1: p.sx + p.w / 2 + margin,
      y0: p.sy - p.h - 13 - margin, y1: p.sy - 9 + margin
    };
    const bad = hits(r) || clipped(r);
    if (bad && !p.el.classList.contains('is-active')) p.el.classList.add('is-folded');
    else { p.el.classList.remove('is-folded'); taken.push(r); }
  }

  /*
   * Amenities compete for exactly the same pixels as the labels, and until now
   * nothing arbitrated between them — measuring the map at mid zoom found a
   * toilet icon sitting on "The Oasis", and showers stacked on taps, because
   * three fixtures share one washblock in the data.
   *
   * The venue chips have already claimed their space above, so they win; the
   * amenities fold where they would collide. Within amenities the order is by
   * how much it matters to find the thing: nobody urgently needs the games
   * pin, and somebody may urgently need first aid.
   */
  const AM_RANK = { firstaid: 0, water: 1, toilet: 2, food: 3, shower: 4 };
  const ams = [];
  for (const [id, el] of amNodes) {
    if (el.classList.contains('is-off')) { el.classList.remove('is-folded'); continue; }
    const am = AMENITIES.find(a => a.id === id);
    if (!am) continue;
    const p = project(am.x, am.y);
    ams.push({ el, p, rank: AM_RANK[am.type] ?? 9 });
  }
  ams.sort((a, b) => a.rank - b.rank || a.p.y - b.p.y);

  const HALF = 15;                       // .am-inner is 26px plus its border
  for (const a of ams) {
    const r = {
      x0: a.p.x - HALF - margin, x1: a.p.x + HALF + margin,
      y0: a.p.y - HALF - margin, y1: a.p.y + HALF + margin
    };
    /* Same edge rule as the chips: half an icon hanging off the screen is
       noise, and it comes back the moment you pan. */
    if (hits(r) || clipped(r)) a.el.classList.add('is-folded');
    else { a.el.classList.remove('is-folded'); taken.push(r); }
  }
}

/* ──────────────────────────────────────────────────────── pin states ─── */

let activeId = null;

export function highlight (id) {
  if (activeId && nodes.has(activeId)) nodes.get(activeId).classList.remove('is-active');
  activeId = id;
  if (id && nodes.has(id)) nodes.get(id).classList.add('is-active');
  if (!id) renderer?.setFocus?.(null);
  scheduleFrame();
}

export function clearHighlight () { highlight(null); }

export function spotlight (ids) {
  const set = ids ? new Set(ids.map(i => pinFor(i)?.id)) : null;
  nodes.forEach((el, id) => el.classList.toggle('is-dim', !!set && !set.has(id)));
}

export function celebrate (id) {
  const v = pinFor(id);
  const el = v && nodes.get(v.id);
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, { count: 34, spread: 1.5, rise: 1.2 });
}

/* ───────────────────────────────────────────────────────── edit mode ──── */

function startEditMode () {
  document.querySelectorAll('.hs, .am').forEach(el => el.classList.add('is-editing'));
  const moved = new Map();

  const bar = document.createElement('div');
  bar.className = 'editbar';
  bar.innerHTML = `<span><b>Pin editor.</b> Drag any marker. <i id="editN">0</i> moved.</span>
                   <button type="button" id="editCopy">Copy JSON</button>`;
  document.body.appendChild(bar);

  let drag = null;
  hotspotHost.addEventListener('pointerdown', e => {
    const b = e.target.closest('.hs, .am');
    if (!b) return;
    e.stopPropagation();
    b.setPointerCapture(e.pointerId);
    const id = b.dataset.id;
    const src = b.classList.contains('am')
      ? AMENITIES.find(a => a.id === id) : PINNED.find(p => p.id === id);
    drag = { el: b, id, src, sx: e.clientX, sy: e.clientY, ox: src.x, oy: src.y };
  });
  hotspotHost.addEventListener('pointermove', e => {
    if (!drag) return;
    e.stopPropagation();
    const k = SIZE * view.scale;
    drag.src.x = drag.ox + (e.clientX - drag.sx) / k;
    drag.src.y = drag.oy + (e.clientY - drag.sy) / k;
    layoutMarkers();
  });
  const stop = () => {
    if (!drag) return;
    moved.set(drag.id, { x: +drag.src.x.toFixed(4), y: +drag.src.y.toFixed(4) });
    document.getElementById('editN').textContent = moved.size;
    drag = null;
  };
  hotspotHost.addEventListener('pointerup', stop);
  hotspotHost.addEventListener('pointercancel', stop);

  document.getElementById('editCopy').addEventListener('click', () => {
    const text = [...moved.entries()]
      .map(([id, p]) => `  ${id.padEnd(22)} x: ${p.x}, y: ${p.y}`).join('\n')
      || '(nothing moved yet)';
    navigator.clipboard?.writeText(text).then(
      () => import('./fx.js').then(m => m.toast('Coordinates copied — paste into data.js')),
      () => alert(text));
  });
}

/* ──────────────────────────────────────────────────────────────── api ─── */

const api = {
  fit, flyTo, focusVenue, focusAmenity, highlight, clearHighlight, spotlight,
  celebrate, setNight, center, project, rotate, resetNorth, camera,
  toggleFlatten, isFlattened, isIsometric, setLayer, setQuality, layerNames,
  setYou, didFallBack, fallbackReason,
  stats: () => renderer?.stats?.() || null
};
export default api;

/* keep isometric markers glued to a camera that never stops moving */
requestAnimationFrame(tickWhileIso);
