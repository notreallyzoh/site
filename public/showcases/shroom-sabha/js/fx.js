/* Micro-interaction layer: spore bursts, haptics, toasts.
   One rAF loop, one canvas, capped particle count. Nothing else runs. */

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── haptics ───────────────────────────────────────────────────────────── */
export function buzz (pattern = 8) {
  if (REDUCED) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
export const TAP = 8;
export const KNOCK = [0, 14, 40, 14];
export const BLOOM = [0, 20, 50, 20, 50, 42];

/* ── spore particles ───────────────────────────────────────────────────── */
let cv, ctx, dpr = 1, parts = [], raf = 0;

export function initSpores (canvas) {
  cv = canvas;
  ctx = cv.getContext('2d', { alpha: true });
  resize();
  addEventListener('resize', resize, { passive: true });
}

function resize () {
  if (!cv) return;
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  cv.style.width = innerWidth + 'px';
  cv.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const PALETTE = ['#E3B929', '#F5D255', '#E0DF8B', '#F7E8AF'];

/**
 * Puff of spores drifting up and out from a screen point.
 * @param {number} x screen px
 * @param {number} y screen px
 * @param {object} opt {count, spread, rise, hue}
 */
export function burst (x, y, opt = {}) {
  if (REDUCED || !ctx) return;
  const n = Math.min(opt.count ?? 18, 40);
  const spread = opt.spread ?? 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.6 + Math.random() * 2.4) * spread;
    parts.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - (opt.rise ?? 0.7),
      r: 1 + Math.random() * 2.4,
      life: 1,
      decay: 0.008 + Math.random() * 0.014,
      c: opt.hue || PALETTE[(Math.random() * PALETTE.length) | 0],
      drift: (Math.random() - 0.5) * 0.06
    });
  }
  if (parts.length > 260) parts = parts.slice(-260);
  if (!raf) raf = requestAnimationFrame(tick);
}

/** A slow bloom of spores rising from the bottom — used when a rank is gained. */
export function bloom () {
  if (REDUCED || !ctx) return;
  const y = innerHeight * 0.82;
  for (let i = 0; i < 34; i++) {
    parts.push({
      x: innerWidth * (0.15 + Math.random() * 0.7),
      y: y + Math.random() * 60,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -(0.7 + Math.random() * 1.5),
      r: 1.4 + Math.random() * 3,
      life: 1,
      decay: 0.0045 + Math.random() * 0.005,
      c: PALETTE[(Math.random() * PALETTE.length) | 0],
      drift: (Math.random() - 0.5) * 0.05
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick () {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vx += p.drift;
    p.vy += 0.008;          // barely any gravity — spores hang
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, p.life) * 0.85;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.6), 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
}

/** Burst centred on an element. */
export function burstAt (el, opt) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opt);
}

/* ── toasts ────────────────────────────────────────────────────────────── */
let toastHost;
export function toast (html, ms = 2600) {
  toastHost ||= document.getElementById('toasts');
  if (!toastHost) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  toastHost.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
