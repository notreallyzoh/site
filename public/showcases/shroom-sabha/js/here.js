/* Shroom Sabha 2026 — where you are, and which way you are facing
   ---------------------------------------------------------------------------
   Two separate signals that people think of as one thing:

     Position comes from GPS. Reliable outdoors, slow to start, and under a
     forest canopy it degrades to something like 20–40 m without ever saying
     so. Hence the accuracy halo — an honest dot is one that admits its own
     fuzziness rather than drawing a confident circle in the wrong clearing.

     Heading comes from the magnetometer, which needs a permission of its own
     on iOS and does not exist at all on most laptops. Where it is missing we
     fall back to course-over-ground from GPS, which is only meaningful while
     you are actually walking — so the arrow is hidden when you stand still
     rather than left pointing at a stale direction.

   Everything here is opt-in and stops dead on release(). Nothing starts at
   boot: a festival map that grabs your location before you ask is a map people
   uninstall.                                                                  */

import * as geo from './geo.js';

const listeners = new Set();

const here = {
  on: false,
  lat: null, lon: null, acc: null,
  heading: null,         // degrees clockwise from true north, or null
  headingFrom: null,     // 'compass' | 'course'
  world: null,           // {x, y} in map space, once geo-referenced
  at: 0,
  error: null
};

let watchId = 0;
let orientHandler = null;
let smoothed = null;

/* ══════════════════════════════════════════════════════════════ lifecycle ══ */

/**
 * Start following the phone. Must be called from a user gesture — iOS requires
 * one for the compass permission, and every browser is happier about location
 * when the request is visibly tied to a tap.
 *
 * @return {Promise<{ok:boolean, reason?:string}>}
 */
export async function enable () {
  if (here.on) return { ok: true };

  if (!navigator.geolocation) {
    here.error = 'This browser has no GPS.';
    emit();
    return { ok: false, reason: here.error };
  }

  /* Ask for the compass first: it is the one that needs the gesture, and the
     gesture is spent by the time the location prompt returns. */
  await askCompass();

  return new Promise(resolve => {
    let settled = false;

    watchId = navigator.geolocation.watchPosition(pos => {
      here.on = true;
      here.error = null;
      here.lat = pos.coords.latitude;
      here.lon = pos.coords.longitude;
      here.acc = pos.coords.accuracy ?? null;
      here.at = Date.now();

      /* Course over ground, but only when it means something. A stationary
         phone reports whatever it last saw, or NaN, or 0. */
      const spd = pos.coords.speed;
      const crs = pos.coords.heading;
      if (here.headingFrom !== 'compass') {
        if (Number.isFinite(crs) && Number.isFinite(spd) && spd > 0.6) {
          here.heading = crs;
          here.headingFrom = 'course';
        } else if (here.headingFrom === 'course') {
          here.heading = null;
          here.headingFrom = null;
        }
      }

      const T = geo.current();
      here.world = T ? geo.toWorld(T, here.lat, here.lon) : null;

      emit();
      if (!settled) { settled = true; resolve({ ok: true }); }
    }, err => {
      here.error =
        err.code === 1 ? 'Location is blocked. Turn it on for this site in your browser settings.'
      : err.code === 2 ? 'No GPS signal. Step out from under the trees.'
                       : 'Still looking for satellites…';
      emit();
      if (!settled && err.code === 1) { settled = true; resolve({ ok: false, reason: here.error }); }
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  });
}

export function disable () {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = 0;
  stopCompass();
  here.on = false;
  here.world = null;
  here.heading = null;
  here.headingFrom = null;
  smoothed = null;
  emit();
}

export const isOn = () => here.on;
export const state = () => ({ ...here });

/** True once we know both where you are and how the map maps to the Earth. */
export const canPlace = () => here.on && !!here.world;

export function onChange (fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit () { for (const fn of listeners) { try { fn(state()); } catch {} } }

/* ════════════════════════════════════════════════════════════════ compass ══ */

async function askCompass () {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) return false;

  /* iOS 13+ gates the magnetometer behind an explicit prompt. */
  if (typeof DOE.requestPermission === 'function') {
    try {
      const res = await DOE.requestPermission();
      if (res !== 'granted') return false;
    } catch { return false; }
  }
  startCompass();
  return true;
}

function startCompass () {
  stopCompass();
  orientHandler = e => {
    let deg = null;

    if (Number.isFinite(e.webkitCompassHeading)) {
      /* Safari hands us a true compass heading directly. */
      deg = e.webkitCompassHeading;
    } else if (Number.isFinite(e.alpha) && (e.absolute || e.type === 'deviceorientationabsolute')) {
      /* alpha runs anticlockwise from north, so it has to be flipped, then
         corrected for however the screen itself is rotated. */
      const screenAngle = screen.orientation?.angle ?? window.orientation ?? 0;
      deg = (360 - e.alpha + screenAngle) % 360;
    }
    if (deg == null || !Number.isFinite(deg)) return;

    here.heading = smooth(deg);
    here.headingFrom = 'compass';
    emit();
  };

  /* 'absolute' is the one that is actually referenced to north. Plain
     'deviceorientation' is relative on Android and useless as a compass, but
     it is the only event Safari fires — hence both, filtered above. */
  window.addEventListener('deviceorientationabsolute', orientHandler, true);
  window.addEventListener('deviceorientation', orientHandler, true);
}

function stopCompass () {
  if (!orientHandler) return;
  window.removeEventListener('deviceorientationabsolute', orientHandler, true);
  window.removeEventListener('deviceorientation', orientHandler, true);
  orientHandler = null;
}

/**
 * Low-pass filter on a circle. Averaging degrees directly puts the needle at
 * 180° whenever it wobbles across north, which reads as a compass having a
 * seizure; going via unit vectors makes 359° and 1° the neighbours they are.
 */
function smooth (deg) {
  const a = deg * Math.PI / 180;
  const v = { x: Math.cos(a), y: Math.sin(a) };
  if (!smoothed) smoothed = v;
  else {
    const k = 0.25;
    smoothed = { x: smoothed.x + (v.x - smoothed.x) * k,
                 y: smoothed.y + (v.y - smoothed.y) * k };
  }
  return (Math.atan2(smoothed.y, smoothed.x) * 180 / Math.PI + 360) % 360;
}

/* ═════════════════════════════════════════════════════════════ navigation ══ */

/**
 * Where a map point is, relative to you: how far, which way, and — if we know
 * which way you are facing — how far to turn.
 *
 * @param {number} x  map-space x, 0..1
 * @param {number} y  map-space y, 0..1
 */
export function guideTo (x, y) {
  const T = geo.current();
  if (!T || here.lat == null) return null;

  const t = geo.toLatLon(T, x, y);
  const metres = geo.distance(here.lat, here.lon, t.lat, t.lon);
  const brg = geo.bearing(here.lat, here.lon, t.lat, t.lon);

  /* Relative turn, signed, in the range (-180, 180]. */
  const rel = here.heading == null
    ? null
    : ((brg - here.heading + 540) % 360) - 180;

  return {
    metres,
    bearing: brg,
    relative: rel,
    word: geo.compassWord(brg),
    readable: geo.readableDistance(metres),
    /* Below the accuracy of the fix, "which way" stops being meaningful. */
    vague: here.acc != null && metres < here.acc
  };
}
