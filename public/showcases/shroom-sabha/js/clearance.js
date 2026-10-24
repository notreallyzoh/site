/* ═══════════════════════════════════════════════════════════════════════════
   KEEPING THE TRAILS CLEAR
   ---------------------------------------------------------------------------
   Trees are scattered per grid cell, but a canopy is wider than the cell it
   grows in — so trees rooted beside a path lean over it and the route you are
   meant to follow disappears under leaves.

   This measures how far each cell is from the nearest path and hands back a
   simple rule: no trees on or beside a trail, smaller trees one step further
   out, normal after that. A cleared corridor with a soft edge, rather than a
   hard stripe of bare ground.
   ═══════════════════════════════════════════════════════════════════════ */

const PATH = 4;

/**
 * Chebyshev distance from every cell to the nearest path cell, capped.
 * Two passes over the grid — forward then backward — which is all an
 * 8-connected distance transform needs.
 */
export function pathDistance (cells, G, cap = 3) {
  const d = new Uint8Array(G * G).fill(cap);
  for (let i = 0; i < cells.length; i++) if (cells[i] === PATH) d[i] = 0;

  const at = (x, y) => (x < 0 || y < 0 || x >= G || y >= G) ? cap : d[y * G + x];

  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const i = y * G + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i],
        at(x - 1, y) + 1, at(x, y - 1) + 1,
        at(x - 1, y - 1) + 1, at(x + 1, y - 1) + 1);
    }
  }
  for (let y = G - 1; y >= 0; y--) {
    for (let x = G - 1; x >= 0; x--) {
      const i = y * G + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i],
        at(x + 1, y) + 1, at(x, y + 1) + 1,
        at(x + 1, y + 1) + 1, at(x - 1, y + 1) + 1);
    }
  }
  return d;
}

/**
 * How big a tree may be in this cell.
 *   0  right on or beside the trail — nothing grows
 *   1  one step out — undergrowth only
 *   1  clear of the trail — full size
 */
export function canopyScale (dist) {
  if (dist <= 1) return 0;
  if (dist === 2) return 0.55;
  return 1;
}

/**
 * The bounding box of everything that is not void, in 0..1 world space.
 * `fit` used to centre on the middle of the 1280 square, but the farm only
 * fills part of it — so the map opened smaller and more off-centre than it
 * needed to. Fitting to this instead uses the whole screen.
 */
export function footprint (cells, G) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0, found = false;
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      if (!cells[gy * G + gx]) continue;      // 0 is void
      found = true;
      const x = gx / G, y = gy / G;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (!found) return { cx: 0.5, cy: 0.5, w: 1, h: 1 };
  const pad = 1 / G;
  return {
    cx: (x0 + x1 + pad) / 2,
    cy: (y0 + y1 + pad) / 2,
    w: (x1 - x0) + pad * 2,
    h: (y1 - y0) + pad * 2
  };
}
