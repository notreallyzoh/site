/* ═══════════════════════════════════════════════════════════════════════════
   GROW YOUR MYCELIUM — the game layer
   ---------------------------------------------------------------------------
   Every place you stand in and every session you turn up to feeds a network
   that is yours alone: seeded per device, so no two look the same. Visit
   enough of the farm and it fruits. At the end you can take away a spore
   print of your three days.

   All of it is local. It works with no signal, which is the point.
   ═══════════════════════════════════════════════════════════════════════ */

import { SESSIONS, SESSION_BY_ID, VENUE_BY_ID, PINNED, FESTIVAL } from './data.js';
import * as store from './store.js';
import { REDUCED } from './fx.js';

/* ────────────────────────────────────────────────────────────── ranks ─── */

export const RANKS = [
  { at: 0,  name: 'Spore',         note: 'Landed. Nothing has happened yet.' },
  { at: 3,  name: 'Hypha',         note: 'A single thread, feeling outward.' },
  { at: 8,  name: 'Mycelium',      note: 'A network now. It is finding things.' },
  { at: 15, name: 'Primordium',    note: 'Knotting up. Something is about to happen.' },
  { at: 24, name: 'Fruiting Body', note: 'You broke the surface.' },
  { at: 34, name: 'Spore Print',   note: 'You covered the ground. Leave some for the next one.' }
];

export function points () {
  const s = store.get();
  return s.stamps.length + s.checkins.length;
}

export function rank () {
  const p = points();
  let cur = RANKS[0], next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (p >= RANKS[i].at) { cur = RANKS[i]; next = RANKS[i + 1] || null; }
  }
  const span = next ? next.at - cur.at : 1;
  const into = next ? p - cur.at : 1;
  return { ...cur, index: RANKS.indexOf(cur), next, progress: next ? Math.min(1, into / span) : 1, points: p };
}

/* ───────────────────────────────────────────────────────────── badges ─── */

const hourOf = iso => +iso.slice(11, 13);

export const BADGES = [
  { id: 'early',  glyph: '🌅', name: 'Early Riser',      hint: 'A session before 8am',
    test: s => s.checkins.some(c => SESSION_BY_ID[c.id] && hourOf(SESSION_BY_ID[c.id].start) < 8) },
  { id: 'night',  glyph: '🌒', name: 'Night Fruiter',    hint: 'Something after 8pm',
    test: s => s.checkins.some(c => SESSION_BY_ID[c.id] && hourOf(SESSION_BY_ID[c.id].start) >= 20) },
  { id: 'forays', glyph: '🧺', name: 'Deep Forager',     hint: 'Both Spore Safaris',
    test: s => ['d2-spore-safari', 'd3-spore-safari'].every(id => s.checkins.some(c => c.id === id)) },
  { id: 'halls',  glyph: '🏛', name: 'Three Halls',      hint: 'All workshop spaces',
    test: s => ['mycelium-grove', 'under-the-gills', 'primordium'].every(v => s.stamps.some(x => x.id === v)) },
  { id: 'wet',    glyph: '🌊', name: 'Swims Like It',    hint: 'Into the Oasis at dawn',
    test: s => s.checkins.some(c => c.id === 'd2-swim' || c.id === 'd3-swim') },
  { id: 'fed',    glyph: '🍲', name: 'Well Fed',         hint: 'Five meals at the Grove',
    test: s => s.checkins.filter(c => SESSION_BY_ID[c.id]?.kind === 'meal').length >= 5 },
  { id: 'farside',glyph: '🧭', name: 'Far Side',         hint: 'Reach the east boundary',
    test: s => s.stamps.some(x => x.id === 'cordyceps' || x.id === 'back-gate' || x.id === 'coral-fungi') },
  { id: 'sacred', glyph: '🪔', name: 'Walked Around',    hint: 'Find a sacred grove',
    test: s => s.stamps.some(x => VENUE_BY_ID[x.id]?.kind === 'sacred') },
  { id: 'ethics', glyph: '🍄', name: 'Careful Forager',  hint: 'Read the foraging ethics',
    test: s => s.badges.includes('ethics') },
  { id: 'circuit',glyph: '🕸', name: 'Full Circuit',     hint: 'Fifteen places on the farm',
    test: s => s.stamps.length >= 15 }
];

/** Re-test every badge; returns the ids newly earned. */
export function checkBadges () {
  const s = store.get();
  const fresh = [];
  for (const b of BADGES) {
    if (s.badges.includes(b.id)) continue;
    try { if (b.test(s)) fresh.push(b.id); } catch { /* ignore */ }
  }
  fresh.forEach(id => store.award(id));
  return fresh;
}

/* ─────────────────────────────────────────────────── check-in windows ─── */

/** You can only check in near the time it actually happens. */
export function canCheckIn (session, now = Date.now()) {
  const start = new Date(session.start).getTime();
  const end = new Date(session.end || session.start).getTime();
  return now > start - 30 * 60e3 && now < end + 60 * 60e3;
}

/* ═════════════════════════════════════════════════ procedural network ═══
   Deterministic from the device seed, so the drawing is stable across
   reloads and grows rather than reshuffling.                              */

function mulberry32 (a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Build the segment list for a network of `n` stamps and `f` fruits.
 * Returns {segs:[{x1,y1,x2,y2,w,t}], caps:[{x,y,r,t}]} in a 0..1 x 0..1 box
 * with the origin at the bottom centre.
 */
export function buildNetwork (seed, n, f) {
  const rnd = mulberry32(seed);
  const segs = [];
  const caps = [];
  const trunks = Math.max(1, Math.min(9, 1 + Math.floor(n / 2)));

  const branch = (x, y, ang, len, depth, w, t) => {
    if (depth <= 0 || len < 0.012) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    segs.push({ x1: x, y1: y, x2, y2, w, t });
    const kids = rnd() < 0.72 ? 2 : 3;
    for (let i = 0; i < kids; i++) {
      const spread = 0.42 + rnd() * 0.55;
      const na = ang + (i - (kids - 1) / 2) * spread + (rnd() - 0.5) * 0.22;
      branch(x2, y2, na, len * (0.60 + rnd() * 0.22), depth - 1, w * 0.72, t + 0.055 + rnd() * 0.03);
    }
  };

  for (let i = 0; i < trunks; i++) {
    const a = -Math.PI / 2 + (i - (trunks - 1) / 2) * (0.30 + rnd() * 0.1) + (rnd() - 0.5) * 0.12;
    const depth = 3 + Math.min(3, Math.floor(n / 5));
    branch(0.5, 1, a, 0.16 + rnd() * 0.07, depth, 2.1, i * 0.02);
  }

  /* fruit at the tips of the longest-running branches */
  const tips = segs.filter(sg => sg.w < 1.1).sort((a, b) => a.y2 - b.y2);
  for (let i = 0; i < Math.min(f, tips.length, 14); i++) {
    const tip = tips[(i * 3) % tips.length];
    caps.push({ x: tip.x2, y: tip.y2, r: 0.016 + rnd() * 0.016, t: tip.t + 0.08 });
  }

  const maxT = segs.reduce((m, sg) => Math.max(m, sg.t), 0.001);
  segs.forEach(sg => { sg.t /= maxT; });
  caps.forEach(c => { c.t = Math.min(1, c.t / maxT); });
  return { segs, caps };
}

/**
 * Draw the network into a canvas, animating growth once.
 * @param {HTMLCanvasElement} canvas
 * @param {object} opt {seed, stamps, fruits, animate, scale, colors}
 */
export function drawNetwork (canvas, opt = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = opt.dpr || Math.min(devicePixelRatio || 1, 2);
  const W = opt.width || canvas.clientWidth || 320;
  const H = opt.height || canvas.clientHeight || 190;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  if (!opt.width) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const net = opt.net || buildNetwork(opt.seed || 1, opt.stamps || 0, opt.fruits || 0);
  const thread = opt.thread || '#E3B929';
  const cap = opt.cap || '#F7E8AF';

  const paint = p => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.strokeStyle = thread;
    for (const sg of net.segs) {
      if (sg.t > p) continue;
      const local = Math.min(1, (p - sg.t) / 0.16);
      ctx.globalAlpha = 0.32 + 0.5 * Math.min(1, sg.w / 2.1);
      ctx.lineWidth = sg.w;
      ctx.beginPath();
      ctx.moveTo(sg.x1 * W, sg.y1 * H);
      ctx.lineTo(sg.x1 * W + (sg.x2 - sg.x1) * W * local, sg.y1 * H + (sg.y2 - sg.y1) * H * local);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const c of net.caps) {
      if (c.t > p) continue;
      const g = Math.min(1, (p - c.t) / 0.12);
      const r = c.r * W * g;
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(c.x * W, c.y * H, r * 1.5, r, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = thread;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(c.x * W - r * 0.16, c.y * H, r * 0.32, r * 1.5);
      ctx.globalAlpha = 1;
    }
  };

  if (opt.animate === false || REDUCED) { paint(1); return; }

  const t0 = performance.now();
  const dur = 1400;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    paint(1 - Math.pow(1 - p, 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════════════════ spore print ════
   A takeaway card. Rendered on canvas so it works with no network.       */

export async function sporePrint () {
  const s = store.get();
  const r = rank();
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  /* soil ground */
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#150922');
  g.addColorStop(0.62, '#2A1440');
  g.addColorStop(1, '#412161');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* the network, big */
  const net = buildNetwork(s.seed, s.stamps.length, Math.floor(s.checkins.length / 3));
  const layer = document.createElement('canvas');
  drawNetwork(layer, { net, width: W, height: 700, dpr: 1, animate: false });
  ctx.drawImage(layer, 0, H - 700);

  const cream = '#F7E8AF', mustard = '#E3B929';
  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(247,232,175,.5)';
  ctx.font = '600 26px "Josefin Sans", system-ui, sans-serif';
  ctx.fillText('S H R O O M   S A B H A   ·   2 0 2 6', W / 2, 118);

  ctx.fillStyle = cream;
  ctx.font = '400 96px Calistoga, Georgia, serif';
  ctx.fillText(r.name, W / 2, 236);

  ctx.fillStyle = 'rgba(247,232,175,.62)';
  ctx.font = '400 30px "Josefin Sans", system-ui, sans-serif';
  wrap(ctx, r.note, W / 2, 292, W - 220, 40);

  /* three numbers */
  const stats = [
    [s.stamps.length, 'PLACES'],
    [s.checkins.length, 'SESSIONS'],
    [s.badges.length, 'BADGES']
  ];
  stats.forEach(([n, label], i) => {
    const x = W / 2 + (i - 1) * 290;
    ctx.fillStyle = mustard;
    ctx.font = '400 104px Calistoga, Georgia, serif';
    ctx.fillText(String(n), x, 500);
    ctx.fillStyle = 'rgba(247,232,175,.45)';
    ctx.font = '600 22px "Josefin Sans", system-ui, sans-serif';
    ctx.fillText(label.split('').join(' '), x, 542);
  });

  ctx.strokeStyle = 'rgba(247,232,175,.14)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(160, 596); ctx.lineTo(W - 160, 596); ctx.stroke();

  ctx.fillStyle = 'rgba(247,232,175,.4)';
  ctx.font = '400 24px "Josefin Sans", system-ui, sans-serif';
  ctx.fillText('Varanashi Organic Farms · 4–6 September', W / 2, 646);

  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  return { blob, canvas: cv };
}

function wrap (ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

/* ───────────────────────────────────────────────────────────── totals ─── */

export const totals = () => ({
  venues: PINNED.length,
  sessions: SESSIONS.filter(x => x.kind !== 'meal' && x.kind !== 'logistics').length,
  badges: BADGES.length
});
