/* Boot and glue. Everything else is a module. */

import { SESSION_BY_ID, GEO } from './data.js';
import * as store from './store.js';
import { initSpores, toast, buzz, TAP, REDUCED } from './fx.js';
import { initMap } from './map.js';
import { initSheet } from './sheet.js';
import * as ui from './ui.js';
import * as notify from './notify.js';
import * as offline from './offline.js';
import * as logo from './logo.js';
import { createSky } from './sky.js';
import * as tools from './tools.js';
import { applyEditorOverrides } from './overrides.js';

/* ?debug=1 — the field debugger. Imported first and armed immediately so it
   catches errors thrown during boot, which is the part you can never see by
   opening a console afterwards. */
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
let dbg = null;
if (DEBUG) {
  dbg = await import('./debug.js');
  dbg.armEarly();
}
import * as here from './here.js';
import * as geo from './geo.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);

let map, sheet, sky = null, torch = null, bootLogo = null;
let sketchReady = () => {};

/* ═══════════════════════════════════════════════════════════ boot ══════ */

async function boot () {
  /* the lockup, drawn from the Illustrator vectors: letters sprout out of the
     baseline, the tagline settles, then the roots spread underneath */
  logo.mountWordmark($('#bootWordmark'), { from: 'sprout', stagger: 58, delay: 120 })
    .then(w => { bootLogo = w; });
  logo.mountTagline($('#bootTagline'), { delay: 700 });
  logo.mountRoots($('#bootRoots'), { delay: 520, duration: 1600 });

  /* Anything traced in /editor/ on this device shows up here straight away.
     Must run before the renderers read the terrain. */
  const edits = applyEditorOverrides();

  initSpores($('#sporeCanvas'));
  torch = initTorchLayer();
  /* The sky is decoration. The map is the app. Nothing the sky does — failing
     to get a WebGL context, throwing on a method a fallback forgot to provide
     — may be allowed to stop initMap() from running. That is exactly what
     happened: a fallback object without followClock() threw here, the
     unhandled rejection killed the rest of boot, and the map never mounted at
     all, in complete silence. */
  try {
    sky = createSky($('#sky'));
    if (params.has('nosw')) window.__sky = sky;
    applyNight();
  } catch (err) {
    console.warn('Sky failed to start; carrying on without it.', err);
    sky = null;
  }

  sheet = initSheet();

  /* ?iso=1 stands the farm up. The renderers share one contract, so nothing
     else in the app has to know which one answered. */
  /* Isometric is the default now. Lite mode — stored, or forced with
     ?lite=1 — drops to the flat renderer, and initMap falls back to it on
     its own if WebGL or three.js will not start. */
  const lite = params.get('lite') === '1' ||
               (params.get('iso') !== '1' && store.get().lite === true);

  /* Hand the shipped geo-reference to the geo layer before anything asks it
     where you are. A transform solved locally in /recce/ still wins. */
  geo.useBaked(GEO);

  map = await initMap({
    /* Handed to initMap so a struggling 3D map can reclaim the sky's WebGL
       context as a last resort. A painted gradient instead of a live sky is a
       trade nobody will notice; a flat map instead of the farm is one they
       will. */
    /* The map can fall back minutes after boot, so the HUD button has to be
       told. Without this it kept claiming "3D" while showing the flat map. */
    releaseSky: () => {
      try {
        sky?.destroy?.();
        sky = null;
        $('#sky')?.classList.add('sky-fallback');
        console.warn('Gave the sky’s GPU context to the 3D map.');
      } catch { /* nothing to give up */ }
    },
    iso: !lite,
    edit: params.get('edit') === '1',
    onPick: id => ui.openVenue(id),
    onCamera: () => updateCompass(),
    onSketchReady: () => sketchReady()
  });
  ui.initUI({ map, sheet, closeSearch, torch, walkTo, geo, here, applyNight });

  notify.start();
  wireChrome();
  // Portfolio preview: do not register or alter service workers.
  handleDeepLinks();

  /* Hold the loader until the map has actually painted AND the lockup has had
     time to play. Never past MAX_BOOT, though — nobody should be stuck behind
     a loading screen because one asset is slow. */
  const MIN_BOOT = REDUCED ? 0 : 2500;
  const MAX_BOOT = 6000;
  const t0 = performance.now();
  let revealed = false;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    $('#canvasHost').classList.add('is-ready');
    const wait = Math.max(0, MIN_BOOT - (performance.now() - t0));
    setTimeout(() => {
      const b = $('#boot');
      if (!b) return;
      b.classList.add('is-gone');
      setTimeout(() => b.remove(), 700);
      store.set({ seenBoot: true });
      maybeOfferInstall();
    }, wait);
  };

  sketchReady = reveal;      // the p5 sketch calls this once the farm is drawn
  setTimeout(reveal, MAX_BOOT);

  /* never let edited data be mistaken for the real thing */
  if (edits) {
    setTimeout(() => toast(
      `Showing your editor changes — ${edits.routes} trails, ${edits.pins} pins moved. ` +
      `Export to make them permanent.`, 5200), MIN_BOOT + 900);
  }
}

/* ═══════════════════════════════════════════════════════════ chrome ════ */

function wireChrome () {
  $('#fitBtn').addEventListener('click', () => { buzz(TAP); map.fit(); map.clearHighlight(); });

  /* camera controls, shown only when there is a camera to control */
  if (map.isIsometric()) {
    document.documentElement.dataset.view = 'iso';

    /* The compass shows where north went and takes you back — the pattern
       people already know from every map app. */
    const rose = $('#compassBtn').querySelector('.compass-rose');
    $('#compassBtn').addEventListener('click', () => { buzz(TAP); map.resetNorth(); });
    $('#flattenBtn').addEventListener('click', e => {
      const flat = map.toggleFlatten();
      e.currentTarget.setAttribute('aria-pressed', String(flat));
      buzz(TAP);
      toast(flat ? 'Flattened — matching the printed map' : 'Standing the farm back up');
    });
  }

  /* lite mode needs a reload, because it swaps the whole renderer */
  const liteBox = $('#liteToggle');
  if (liteBox) {
    liteBox.checked = !map.isIsometric();
    liteBox.addEventListener('change', () => {
      store.set({ lite: liteBox.checked });
      location.href = location.pathname + (liteBox.checked ? '?lite=1' : '');
    });
  }

  /* layer visibility */
  const layerBtn = $('#layerBtn'), layerPanel = $('#layers');
  layerBtn.addEventListener('click', () => {
    const open = layerPanel.hidden;
    layerPanel.hidden = !open;
    layerBtn.setAttribute('aria-expanded', String(open));
    buzz(TAP);
  });
  layerPanel.addEventListener('change', e => {
    const cb = e.target.closest('input[data-layer]');
    if (!cb) return;
    if (cb.dataset.layer === 'labels') {
      document.getElementById('hotspots').classList.toggle('no-labels', !cb.checked);
    } else if (cb.dataset.layer === 'amenities') {
      document.getElementById('hotspots').classList.toggle('no-amenities', !cb.checked);
    } else {
      map.setLayer(cb.dataset.layer, cb.checked);
    }
    buzz(TAP);
  });
  document.addEventListener('click', e => {
    if (!layerPanel.hidden && !e.target.closest('#layers,#layerBtn')) {
      layerPanel.hidden = true;
      layerBtn.setAttribute('aria-expanded', 'false');
    }
  });
  $('#brandBtn').addEventListener('click', () => { buzz(TAP); ui.showTab('about'); sheet.go('full'); });

  $('#torchBtn').addEventListener('click', () => {
    const on = !isNight();
    store.set({ night: on ? 1 : 0 });
    applyNight();
    buzz(TAP);
    toast(on ? '🌒 Night mode — warmer, dimmer, kinder to your eyes' : '☀ Day mode');
  });

  /* search */
  const panel = $('#search'), input = $('#searchInput');
  $('#searchBtn').addEventListener('click', () => {
    panel.hidden = false;
    input.value = '';
    ui.renderSearch('');
    setTimeout(() => input.focus(), 60);
  });
  $('#searchClose').addEventListener('click', closeSearch);
  input.addEventListener('input', () => ui.renderSearch(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) closeSearch();
    if (e.key === '/' && panel.hidden && document.activeElement === document.body) {
      e.preventDefault(); $('#searchBtn').click();
    }
  });

  /* install card */
  $('#installNo').addEventListener('click', () => {
    $('#install').hidden = true;
    store.set({ seenInstall: true });
  });
  $('#installGo').addEventListener('click', async () => {
    $('#install').hidden = true;
    store.set({ seenInstall: true });
    if (offline.canPrompt()) await offline.promptInstall();
    else { ui.showTab('about'); sheet.go('full'); }
  });

  wireLocate();
  dbg?.mount({ map, geo, here });

  /* keep the map's usable band in sync with the sheet */
  sheet.onState?.(() => { /* CSS handles it; map re-measures on resize */ });
}

/* ══════════════════════════════════════════════════════ 3D or lite ══════ */

/*
 * Switching renderers means reloading — they build entirely different scenes —
 * so this is a navigation, not a toggle. It reads as two buttons rather than a
 * checkbox because "3D / Lite" is a choice between two things, and because a
 * checkbox labelled "Lite map" makes you work out which state is which.
 */
/* ═════════════════════════════════════════════════════ where you are ════ */

/*
 * The live dot needs two independent things to be true, and they fail for
 * completely different reasons, so they get completely different messages:
 *
 *   1. The phone knows where it is — a permission and a clear-ish sky.
 *   2. The map knows where IT is — the recce transform. Until someone has
 *      walked the farm with /recce/, a GPS reading is a pair of numbers with
 *      nowhere to put them, and saying "location unavailable" would be a lie.
 */

let navTarget = null;      // {x, y, name} we are walking to
let staleTimer = 0;

function wireLocate () {
  const btn = $('#locateBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    buzz(TAP);

    if (here.isOn()) {                       // second press: put it away
      here.disable();
      btn.setAttribute('aria-pressed', 'false');
      btn.removeAttribute('data-busy');
      map.setYou(null);
      clearNav();
      toast('Location off.');
      return;
    }

    if (!geo.isGeoReferenced()) {
      toast('The map has not been walked yet — open Recce from About and mark four spots. ' +
            'Until then there is nowhere to put the dot.', 6000);
      return;
    }

    btn.dataset.busy = '1';
    const res = await here.enable();
    btn.removeAttribute('data-busy');

    if (!res.ok) { toast(res.reason || 'Could not get a location.', 5200); return; }
    btn.setAttribute('aria-pressed', 'true');
    toast('Following you. Press again to stop.');
  });

  here.onChange(paintYou);
}

function paintYou (h) {
  if (!h.on || !h.world) { map.setYou(null); return; }

  const T = geo.current();
  const mpu = geo.metresPerUnit(T) || 1;

  /* A point ~12 m along the heading, so the cone can be aimed by projecting
     it rather than by guessing how the camera has rotated. */
  let ahead = null;
  if (h.heading != null) {
    const t = geo.toLatLon(T, h.world.x, h.world.y);
    const R = 6371000, RAD = Math.PI / 180, d = 12;
    const br = h.heading * RAD;
    const lat = t.lat + (d * Math.cos(br)) / (RAD * R);
    const lon = t.lon + (d * Math.sin(br)) / (RAD * R * Math.cos(t.lat * RAD));
    ahead = geo.toWorld(T, lat, lon);
  }

  map.setYou({
    x: h.world.x, y: h.world.y,
    accUnits: (h.acc ?? 15) / mpu,
    ahead,
    stale: Date.now() - h.at > 30000
  });

  updateNav(h);

  /* A fix that stops arriving should visibly go grey rather than sit there
     looking authoritative. */
  clearTimeout(staleTimer);
  staleTimer = setTimeout(() => paintYou(here.state()), 31000);
}

/* ─────────────────────────────────────────────────────────── walk there ── */

export function walkTo (x, y, name) {
  if (!geo.isGeoReferenced()) {
    toast('Walking directions need the farm walked first — see Recce in About.', 5200);
    return false;
  }
  navTarget = { x, y, name };
  if (!here.isOn()) $('#locateBtn')?.click();
  updateNav(here.state());
  return true;
}

function clearNav () {
  navTarget = null;
  document.querySelector('.nav-band')?.remove();
}

function updateNav (h) {
  if (!navTarget) return;
  const g = here.guideTo(navTarget.x, navTarget.y);
  if (!g || !h.on) return;

  let band = document.querySelector('.nav-band');
  if (!band) {
    band = document.createElement('div');
    band.className = 'nav-band';
    band.innerHTML =
      '<span class="nav-arrow"><svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 2l7 19-7-5-7 5z"/></svg></span>' +
      '<span class="nav-b"><b></b><span></span></span>' +
      '<button class="nav-x" type="button" aria-label="Stop walking there">✕</button>';
    band.querySelector('.nav-x').addEventListener('click', () => { buzz(TAP); clearNav(); });
    document.body.appendChild(band);
  }

  const arrow = band.querySelector('.nav-arrow');
  const title = band.querySelector('.nav-b b');
  const sub   = band.querySelector('.nav-b span');

  if (g.vague) {
    title.textContent = `You are at ${navTarget.name}`;
    sub.textContent = 'Close enough that the GPS cannot tell you apart from it.';
    arrow.style.setProperty('--turn', '0deg');
    return;
  }

  title.textContent = `${g.readable} to ${navTarget.name}`;

  if (g.relative == null) {
    /* No compass and standing still — a bearing is all we can honestly give. */
    sub.textContent = `Head ${g.word}. Start walking and this becomes a turn.`;
    arrow.style.setProperty('--turn', '0deg');
  } else {
    const t = Math.round(g.relative);
    sub.textContent =
      Math.abs(t) < 20 ? 'Straight ahead'
      : t > 0 ? `Turn ${Math.abs(t)}° right`
              : `Turn ${Math.abs(t)}° left`;
    arrow.style.setProperty('--turn', `${g.relative}deg`);
  }
}

/* Keep the header compass pointing at true north and leaning with the tilt. */
function updateCompass () {
  const btn = $('#compassBtn');
  if (!btn || !map?.camera) return;
  const { azimuth, tilt } = map.camera();
  const rose = btn.querySelector('.compass-rose');
  if (rose) rose.style.transform =
    `rotate(${-(azimuth - 45)}deg) scaleY(${(0.42 + 0.58 * Math.sin(tilt * Math.PI / 180)).toFixed(3)})`;
  btn.classList.toggle('is-turned', Math.abs((azimuth - 45) % 360) > 3);
  const flat = map.isFlattened();
  $('#flattenBtn')?.setAttribute('aria-pressed', String(flat));
}

function closeSearch () {
  $('#search').hidden = true;
  $('#searchInput').blur();
  map?.spotlight(null);
}

function initTorchLayer () {
  const t = tools.initTorch();
  /* battery saver is a stored preference, so honour it from the first frame */
  tools.applySaver(store.get().saver);
  tools.onSaverChange(on => {
    if (on) { sky?.destroy?.(); sky = null; }
    else if (!sky) { sky = createSky($('#sky')); applyNight(); }
    map?.setQuality?.(on ? 'low' : 'high');
  });
  return t;
}

/* ═══════════════════════════════════════════════════════ night mode ════ */

function isNight () {
  const pref = store.get().night;
  if (pref === 0 || pref === 1) return pref === 1;
  /* auto follows the real sun over the farm, not a fixed clock — sunset in
     coastal Karnataka moves by half an hour across the year */
  return tools.isDarkNow();
}

function applyNight () {
  const on = isNight();
  document.documentElement.dataset.night = on ? '1' : '0';
  const nb = $('#torchBtn');
  if (nb) nb.setAttribute('aria-pressed', String(on));
  document.querySelectorAll('[data-act="night"]').forEach(b => {
    if (b.type === 'checkbox') b.checked = on;
  });
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', on ? '#120714' : '#2A1440');
  map?.setNight?.(on);          // the farm switches to moonlight and fireflies

  /* Keep the sky honest with the toggle: forcing night should give you a
     night sky, not a noon one — but with no override we follow the clock. */
  const pref = store.get().night;
  if (pref === 1) sky?.setHour(22);
  else if (pref === 0) sky?.setHour(11);
  else sky?.followClock();
}

/* ═══════════════════════════════════════════════════ service worker ════ */

async function registerSW () {
  if (!('serviceWorker' in navigator)) return;

  /* ?nosw=1 — development escape hatch. Tears the worker down so edits are
     visible immediately instead of being served from last night's cache. */
  if (params.get('nosw') === '1') {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    console.info('[dev] service worker disabled via ?nosw=1');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    offline.attach(reg);
    notify.attach(reg);

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('A newer map is ready — reopen the app to get it.', 5000);
        }
      });
    });

    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'OPEN_SESSION' && e.data.sessionId) {
        openSession(e.data.sessionId);
      }
    });

    /* if it is already controlling, we can precache silently on a good link */
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn('Service worker unavailable — the app still runs, just not offline.', err);
  }
}

/* ═══════════════════════════════════════════════════════ deep links ════ */

function handleDeepLinks () {
  const tab = params.get('tab');
  if (tab && ['schedule', 'saved', 'places', 'care', 'about'].includes(tab)) {
    ui.showTab(tab);
    sheet.go('full');
  }
  const sid = params.get('session');
  if (sid) openSession(sid);
  const vid = params.get('venue');
  if (vid) setTimeout(() => ui.openVenue(vid), 400);
}

function openSession (id) {
  if (!SESSION_BY_ID[id]) return;
  setTimeout(() => { ui.openSession(id); sheet.go('half'); }, 400);
}

/* ═══════════════════════════════════════════════════ install nudge ═════ */

function maybeOfferInstall () {
  const s = store.get();
  if (s.seenInstall || offline.isStandalone()) return;
  if (s.offlineSaved) return;

  const show = () => {
    if (store.get().seenInstall) return;
    $('#installHint').textContent = offline.installHint();
    $('#install').hidden = false;
  };

  if (offline.canPrompt()) show();
  else {
    offline.onInstallable(ok => { if (ok) show(); });
    if (offline.isIOS()) setTimeout(show, 22_000);
  }
}

/* ─────────────────────────────────────────────────────────────── go ──── */

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
