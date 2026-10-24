/* Shroom Sabha 2026 — map space ⇄ the actual Earth
   ---------------------------------------------------------------------------
   The map is an illustration. It has its own units (0..1 across the farm), its
   own north, and its own idea of scale. To put a live GPS dot on it we need to
   know three things: how many metres one map unit is, how far the drawing is
   turned from true north, and where it sits on the planet.

   All three fall out of a similarity transform, solved from pairs of
   (map point, GPS reading) taken by standing on known landmarks. Two pairs is
   the minimum; four spread to the corners is what you actually want, because
   the residuals are the only honest signal of whether to trust the result.

   Deliberately a similarity, not an affine: scale, rotation, translation and
   nothing else. An affine would also absorb shear and non-uniform scale, which
   would silently soak up GPS error and report a beautiful, wrong fit. If the
   illustration really is distorted, the residuals should say so out loud.

   Equirectangular projection throughout. Over ~100 acres the error against a
   proper geodesic is millimetres — far below a phone's GPS noise floor.        */

const R = 6371000;              // mean Earth radius, metres
const RAD = Math.PI / 180;
const KEY = 'shroomsabha-geo';  // a transform solved on this device

/* ═══════════════════════════════════════════════════════════════ solving ══ */

/**
 * Least-squares similarity transform from map space to metres.
 *
 * @param  {{x:number,y:number,lat:number,lon:number}[]} pairs
 * @return {object|null} transform, or null if the pairs cannot constrain one
 */
export function solve (pairs) {
  if (!Array.isArray(pairs) || pairs.length < 2) return null;

  /* Work in metres about the centroid of the fixes — keeps the numbers small
     and the projection honest wherever on Earth the farm happens to be. */
  const lat0 = pairs.reduce((a, p) => a + p.lat, 0) / pairs.length;
  const lon0 = pairs.reduce((a, p) => a + p.lon, 0) / pairs.length;
  const mPerLon = RAD * R * Math.cos(lat0 * RAD);
  const mPerLat = RAD * R;

  const src = pairs.map(p => [p.x, p.y]);
  const dst = pairs.map(p => [(p.lon - lon0) * mPerLon, (p.lat - lat0) * mPerLat]);

  const mean = a => [a.reduce((s, v) => s + v[0], 0) / a.length,
                     a.reduce((s, v) => s + v[1], 0) / a.length];
  const [sx0, sy0] = mean(src);
  const [dx0, dy0] = mean(dst);

  /* Closed-form least squares for a 2-D similarity (Umeyama, minus the
     reflection case — a map is never mirrored). */
  let a = 0, b = 0, den = 0;
  for (let i = 0; i < src.length; i++) {
    const ux = src[i][0] - sx0, uy = src[i][1] - sy0;
    const vx = dst[i][0] - dx0, vy = dst[i][1] - dy0;
    a += ux * vx + uy * vy;
    b += ux * vy - uy * vx;
    den += ux * ux + uy * uy;
  }
  if (!den) return null;                       // every fix taken at one point

  const scale = Math.hypot(a, b) / den;        // metres per map unit
  const theta = Math.atan2(b, a);              // map-up → east-north, radians

  const T = { lat0, lon0, sx0, sy0, dx0, dy0, scale, theta, n: pairs.length };

  /* Residuals. Without these the transform is just a confident-looking guess. */
  let worst = 0, sum = 0;
  for (const p of pairs) {
    const q = toLatLon(T, p.x, p.y);
    const d = distance(q.lat, q.lon, p.lat, p.lon);
    worst = Math.max(worst, d);
    sum += d;
  }
  T.avg = sum / pairs.length;
  T.worst = worst;

  /* Which way true north points, in the drawing's own frame. */
  T.bearing = ((-theta / RAD) % 360 + 360) % 360;

  return T;
}

/**
 * How much to believe a transform. Two fixes always fit perfectly — zero
 * residual, zero information — so the count matters as much as the error.
 */
export function quality (T) {
  if (!T) return { label: 'none', ok: false, why: 'No fixes yet.' };

  if (T.n < 3) {
    return {
      label: 'unchecked', ok: true,
      why: 'Two fixes always fit exactly, so this cannot report its own error. Mark a third to find out whether it is right.'
    };
  }
  if (T.worst < 8) {
    return { label: 'good', ok: true, why: 'Inside a phone GPS’s own noise.' };
  }
  if (T.worst < 18) {
    return { label: 'usable', ok: true, why: 'Fine to walk by. The dot may sit a hut’s width off.' };
  }
  return {
    label: 'suspect', ok: false,
    why: 'Something is off — a mis-tapped landmark, or a fix taken under heavy canopy. Re-shoot the worst one.'
  };
}

/* ══════════════════════════════════════════════════════════ conversions ══ */

/** Map space → the Earth. */
export function toLatLon (T, x, y) {
  const cos = Math.cos(T.theta), sin = Math.sin(T.theta);
  const ux = x - T.sx0, uy = y - T.sy0;
  const mx = T.scale * (cos * ux - sin * uy) + T.dx0;
  const my = T.scale * (sin * ux + cos * uy) + T.dy0;
  return {
    lat: T.lat0 + my / (RAD * R),
    lon: T.lon0 + mx / (RAD * R * Math.cos(T.lat0 * RAD))
  };
}

/** The Earth → map space. The one the live dot actually needs. */
export function toWorld (T, lat, lon) {
  const mx = (lon - T.lon0) * RAD * R * Math.cos(T.lat0 * RAD) - T.dx0;
  const my = (lat - T.lat0) * RAD * R - T.dy0;
  const cos = Math.cos(-T.theta), sin = Math.sin(-T.theta);
  return {
    x: (cos * mx - sin * my) / T.scale + T.sx0,
    y: (sin * mx + cos * my) / T.scale + T.sy0
  };
}

/** Metres per map unit — for drawing an accuracy circle at the right size. */
export const metresPerUnit = T => (T ? T.scale : 0);

/* ═════════════════════════════════════════════════════════════ distances ══ */

/** Haversine, in metres. */
export function distance (lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial great-circle bearing, degrees clockwise from true north. */
export function bearing (lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * RAD;
  const y = Math.sin(dLon) * Math.cos(lat2 * RAD);
  const x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) -
            Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** "180 m" / "1.2 km" — never more precision than a phone can justify. */
export function readableDistance (m) {
  if (!Number.isFinite(m)) return '—';
  if (m < 20) return 'right here';
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** The eight-point compass word, which people follow better than degrees. */
export function compassWord (deg) {
  const names = ['north', 'north-east', 'east', 'south-east',
                 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/* ══════════════════════════════════════════════════════════════ storage ══ */

/*
 * A transform lives in one of two places. Once the recce is done and the
 * numbers are pasted into js/data.js as GEO, every phone gets it for free.
 * Until then a transform solved on this device is kept here, so whoever is
 * doing the walking gets the live dot the moment they have enough fixes.
 */

let baked = null;

/** Called once at boot with the GEO constant from data.js, if there is one. */
export function useBaked (T) {
  baked = (T && Number.isFinite(T.scale)) ? T : null;
}

export function saved () {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const T = JSON.parse(raw);
    return Number.isFinite(T?.scale) ? T : null;
  } catch { return null; }
}

export function save (T) {
  try { localStorage.setItem(KEY, JSON.stringify(T)); return true; }
  catch { return false; }
}

export function forget () {
  try { localStorage.removeItem(KEY); } catch { /* nothing to undo */ }
}

/** The transform to actually use: a local recce beats the shipped one. */
export function current () { return saved() || baked; }

/** Whether the live dot can be placed on the map at all. */
export const isGeoReferenced = () => !!current();
