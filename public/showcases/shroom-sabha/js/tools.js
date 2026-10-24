/* ═══════════════════════════════════════════════════════════════════════════
   THINGS YOU NEED IN A FOREST
   ---------------------------------------------------------------------------
   Small, self-contained utilities for someone three days into a festival with
   a dying battery and no signal:

     torch        a screen you can actually walk by
     shareLocation an SMS to the crew with your coordinates in it
     sunTimes     sunrise and sunset, computed offline
     batterySaver drop everything expensive, keep the map

   Nothing here needs the network.
   ═══════════════════════════════════════════════════════════════════════ */

import { FESTIVAL, CARE } from './data.js';
import { toast, buzz, KNOCK } from './fx.js';

/* ══════════════════════════════════════════════════════════════ torch ════
   Two modes on purpose. White is for finding a dropped key; amber is for
   walking, because it does far less damage to night vision — and there is a
   masquerade running until ten. */

let wakeLock = null;

async function holdScreenAwake () {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* fine */ }
}
function releaseScreen () {
  try { wakeLock?.release(); } catch { /* fine */ }
  wakeLock = null;
}

export function initTorch () {
  const el = document.getElementById('torch');
  if (!el) return { open () {}, close () {} };

  let mode = 'amber';

  const close = () => {
    el.hidden = true;
    document.documentElement.dataset.torch = '';
    releaseScreen();
  };

  const open = () => {
    mode = 'amber';
    el.dataset.mode = mode;
    el.hidden = false;
    holdScreenAwake();
    buzz(KNOCK);
  };

  el.addEventListener('click', e => {
    /* tap the swatch to switch, anywhere else to put it away */
    if (e.target.closest('[data-torch-mode]')) {
      mode = mode === 'amber' ? 'white' : 'amber';
      el.dataset.mode = mode;
      buzz(6);
      return;
    }
    close();
  });

  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !el.hidden) holdScreenAwake();
  });

  return { open, close, isOpen: () => !el.hidden };
}

/* ═══════════════════════════════════════════════ share where you are ════
   The one feature here that might actually matter. An SMS goes through on a
   single bar of signal when nothing else will, and it reaches a human. */

export function shareLocation (opts = {}) {
  const tel = (CARE.contacts[0]?.tel || '').replace(/\s/g, '');
  const send = body => {
    /* iOS wants &, everything else wants ? — this form works on both */
    const sep = /iphone|ipad|ipod|mac/i.test(navigator.userAgent) ? '&' : '?';
    location.href = `sms:${tel}${sep}body=${encodeURIComponent(body)}`;
  };

  const name = opts.name ? `${opts.name} here. ` : '';
  const near = opts.near ? ` Near ${opts.near}.` : '';

  if (!navigator.geolocation) {
    send(`${name}I need a hand at Shroom Sabha.${near}`);
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }

  toast('Getting your location…', 2000);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: la, longitude: lo, accuracy: acc } = pos.coords;
        const link = `https://maps.google.com/?q=${la.toFixed(6)},${lo.toFixed(6)}`;
        send(`${name}I need a hand at Shroom Sabha.${near}\n` +
             `My location: ${la.toFixed(6)}, ${lo.toFixed(6)} (±${Math.round(acc)}m)\n${link}`);
        resolve({ ok: true, lat: la, lon: lo, accuracy: acc });
      },
      err => {
        send(`${name}I need a hand at Shroom Sabha.${near} (Could not get my location.)`);
        resolve({ ok: false, reason: err.message });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

/* ══════════════════════════════════════════════════ sunrise and sunset ══
   The standard NOAA solar position maths. Runs offline, which is the point —
   a foray that ends after dark should not need a network to tell you so. */

const RAD = Math.PI / 180;
const DAY_MS = 864e5, J1970 = 2440588, J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

const toJulian = d => d.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = j => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = d => toJulian(d) - J2000;

const meanAnomaly = d => RAD * (357.5291 + 0.98560028 * d);
const eclipticLongitude = M =>
  M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
    + RAD * 102.9372 + Math.PI;
const declination = L => Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));

const J0 = 0.0009;
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h, phi, dec) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

/**
 * @param {Date} date
 * @param {number} lat  degrees north
 * @param {number} lon  degrees east
 * @returns {{sunrise:Date, sunset:Date, noon:Date, dusk:Date, dawn:Date}}
 */
export function sunTimes (date, lat, lon) {
  const lw = RAD * -lon, phi = RAD * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = meanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);

  const at = angleDeg => {
    const h = angleDeg * RAD;
    const w = hourAngle(h, phi, dec);
    if (Number.isNaN(w)) return null;                 // sun never reaches it
    const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
    return { set: fromJulian(Jset), rise: fromJulian(Jnoon - (Jset - Jnoon)) };
  };

  const official = at(-0.833);                        // upper limb, refracted
  const civil = at(-6);                               // usable light

  return {
    noon: fromJulian(Jnoon),
    sunrise: official?.rise ?? null,
    sunset: official?.set ?? null,
    dawn: civil?.rise ?? null,
    dusk: civil?.set ?? null
  };
}

/** Sun times for the festival site on a given day. */
export function farmSun (date = new Date()) {
  const [lat, lon] = FESTIVAL.geo.split(',').map(Number);
  return sunTimes(date, lat, lon);
}

/** "Sunset 6:34 pm · dark by 6:57" — written for a human, in festival time. */
export function lightToday (date = new Date()) {
  const t = farmSun(date);
  const fmt = d => d
    ? d.toLocaleTimeString('en-IN', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
      }).replace(/\s/g, '').toLowerCase()
    : '—';
  return {
    ...t,
    sunriseText: fmt(t.sunrise),
    sunsetText: fmt(t.sunset),
    duskText: fmt(t.dusk),
    dawnText: fmt(t.dawn)
  };
}

/** Is it dark on the farm right now? Drives night mode when set to auto. */
export function isDarkNow (now = new Date()) {
  const t = farmSun(now);
  if (!t.dawn || !t.dusk) return now.getHours() >= 18 || now.getHours() < 6;
  return now < t.dawn || now > t.dusk;
}

/* ════════════════════════════════════════════════════════ battery saver ══
   Three days, no charging. This drops everything decorative and keeps the
   thing you actually came for: the map, the schedule, and the phone numbers. */

const saverListeners = new Set();
export function onSaverChange (fn) { saverListeners.add(fn); return () => saverListeners.delete(fn); }

export function applySaver (on) {
  document.documentElement.dataset.saver = on ? '1' : '';
  saverListeners.forEach(fn => fn(on));
}

/** What the battery is doing, when the browser will say. */
export async function batteryState () {
  try {
    const b = await navigator.getBattery?.();
    if (!b) return null;
    return { level: Math.round(b.level * 100), charging: b.charging };
  } catch { return null; }
}
