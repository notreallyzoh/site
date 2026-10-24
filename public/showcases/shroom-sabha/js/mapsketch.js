/* ═══════════════════════════════════════════════════════════════════════════
   THE LIVING FARM — p5 map renderer
   ---------------------------------------------------------------------------
   The farm is no longer a picture. terrain.js gives us what the ground is
   made of; everything you see is drawn from that, every frame.

   Structure borrowed from openFrameworks: cheap texture goes into an offscreen
   buffer once (an FBO in all but name), and only the things that must stay
   crisp or must move are drawn live in world space.

     BUFFER (once)     paper grain, ground classes, water bodies
     LIVE (per frame)  paths, buildings, trees, mushrooms, spores, fireflies

   The canvas is viewport-sized and applies the pan/zoom itself rather than
   being scaled by CSS, so lines stay sharp at any zoom instead of going soft
   the way the old raster did. map.js owns the transform and pushes it in
   through setView().

   Level of detail is by scale: far out you see masses of canopy, close in
   you see individual trees, and mushrooms only fruit once you are near
   enough to have found them.
   ═══════════════════════════════════════════════════════════════════════ */

import { TERRAIN } from './terrain.js';
import { pathDistance, canopyScale, footprint } from './clearance.js';

const VOID = 0, FIELD = 1, FOREST = 2, WATER = 3, PATH = 4, BUILDING = 5;

/* palette lifted from the printed map so the redraw stays on-brand */
const DAY = {
  paper:  [246, 240, 224],
  field:  [219, 221, 173],
  field2: [201, 206, 149],
  forest: [108, 132, 84],
  forestD:[ 84, 104, 66],
  forestL:[132, 156, 96],
  water:  [138, 190, 201],
  waterD: [ 96, 158, 178],
  path:   [200, 138,  78],   /* the terracotta of the printed map */
  pathD:  [150,  96,  52],
  build:  [143,  96,  81],
  buildD: [ 96,  58,  50],
  ink:    [ 56,  58,  46],
  cap:    [247, 232, 175],
  capGold:[227, 185,  41]
};

const NIGHT = {
  paper:  [ 44,  32,  52],
  field:  [ 58,  50,  60],
  field2: [ 50,  44,  54],
  forest: [ 34,  40,  46],
  forestD:[ 26,  30,  38],
  forestL:[ 46,  54,  58],
  water:  [ 40,  62,  86],
  waterD: [ 30,  48,  70],
  path:   [104,  74,  56],   /* terracotta, moonlit */
  pathD:  [ 74,  50,  38],
  build:  [ 74,  50,  56],
  buildD: [ 48,  32,  38],
  ink:    [ 20,  16,  26],
  cap:    [232, 208, 150],
  capGold:[231, 168,  58]
};

/* ── deterministic noise, so the farm looks the same on every device ───── */
function mulberry32 (a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function decodeRLE (str, n) {
  const out = new Uint8Array(n);
  let i = 0;
  for (const chunk of str.split('~')) {
    const dot = chunk.indexOf('.');
    if (dot < 0) { out[i++] = +chunk; continue; }
    const v = +chunk.slice(0, dot);
    let run = +chunk.slice(dot + 1);
    while (run-- > 0 && i < n) out[i++] = v;
  }
  return out;
}

export function createMapSketch (opts = {}) {
  const G = TERRAIN.grid;
  const WORLD = TERRAIN.size;                 // 1280 world units
  const cells = decodeRLE(TERRAIN.rle, G * G);
  const cellAt = (gx, gy) =>
    (gx < 0 || gy < 0 || gx >= G || gy >= G) ? VOID : cells[gy * G + gx];

  /* ── scatter the vegetation once, deterministically ─────────────────── */
  const rnd = mulberry32(20260904);
  /* keep the canopy off the trails — a route you cannot see is not a route */
  const clearance = pathDistance(cells, G);
  const trees = [];
  const shrooms = [];
  const reeds = [];

  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const c = cells[gy * G + gx];
      const x0 = gx / G, y0 = gy / G, step = 1 / G;

      const grow = canopyScale(clearance[gy * G + gx]);

      if (c === FOREST && grow > 0) {
        const n = 2 + (rnd() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          trees.push({
            x: (x0 + rnd() * step) * WORLD,
            y: (y0 + rnd() * step) * WORLD,
            r: (5.5 + rnd() * 6.5) * grow,
            tone: rnd(),
            shape: (rnd() * 3) | 0,
            phase: rnd() * 6.283,
            lean: (rnd() - 0.5) * 0.5
          });
        }
        if (rnd() < 0.10) {
          shrooms.push({
            x: (x0 + rnd() * step) * WORLD,
            y: (y0 + rnd() * step) * WORLD,
            r: 1.6 + rnd() * 2.6,
            gold: rnd() < 0.4,
            phase: rnd() * 6.283
          });
        }
      } else if (c === FIELD) {
        if (grow > 0 && rnd() < 0.16) {
          trees.push({
            x: (x0 + rnd() * step) * WORLD,
            y: (y0 + rnd() * step) * WORLD,
            r: (3.4 + rnd() * 3.4) * grow,
            tone: 0.55 + rnd() * 0.45,
            shape: (rnd() * 3) | 0,
            phase: rnd() * 6.283,
            lean: (rnd() - 0.5) * 0.6
          });
        }
        if (rnd() < 0.30) {
          reeds.push({
            x: (x0 + rnd() * step) * WORLD,
            y: (y0 + rnd() * step) * WORLD,
            h: 2 + rnd() * 3.5,
            phase: rnd() * 6.283
          });
        }
      }
    }
  }
  trees.sort((a, b) => a.y - b.y);        // painter's order: far trees first

  /* Spatial buckets. Twelve thousand trees is fine to draw when only a few
     hundred are on screen, but not fine to *iterate* every frame — so index
     them once and only visit the buckets the viewport touches. */
  const BUCKET = 80;
  const BCOLS = Math.ceil(WORLD / BUCKET);
  const bucketise = items => {
    const b = Array.from({ length: BCOLS * BCOLS }, () => []);
    items.forEach((it, i) => {
      const bx = Math.min(BCOLS - 1, Math.max(0, (it.x / BUCKET) | 0));
      const by = Math.min(BCOLS - 1, Math.max(0, (it.y / BUCKET) | 0));
      b[by * BCOLS + bx].push(i);
    });
    return b;
  };
  const treeBuckets = bucketise(trees);
  const shroomBuckets = bucketise(shrooms);
  const reedBuckets = bucketise(reeds);

  /** Walk only the buckets a view rectangle overlaps. */
  function eachIn (buckets, items, v, fn) {
    const x0 = Math.max(0, (v.x0 / BUCKET) | 0);
    const x1 = Math.min(BCOLS - 1, (v.x1 / BUCKET) | 0);
    const y0 = Math.max(0, (v.y0 / BUCKET) | 0);
    const y1 = Math.min(BCOLS - 1, (v.y1 / BUCKET) | 0);
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        const list = buckets[by * BCOLS + bx];
        for (let k = 0; k < list.length; k++) fn(items[list[k]]);
      }
    }
  }

  /* Routes come through as traced centrelines, so they can be stroked as one
     continuous ribbon. Painting a blob per grid cell — the first attempt —
     gave lumpy, stair-stepped tracks that looked nothing like the drawn map. */
  const routes = (TERRAIN.routes || []).map(line =>
    line.map(([x, y]) => ({ x: x * WORLD, y: y * WORLD })));
  const builds = TERRAIN.buildings.map(b => ({
    x: b.x * WORLD, y: b.y * WORLD,
    w: Math.max(6, b.w * WORLD), h: Math.max(6, b.h * WORLD),
    r: mulberry32(Math.round(b.x * 9999))()
  }));
  const waters = TERRAIN.water.map(b => ({
    x: b.x * WORLD, y: b.y * WORLD, w: b.w * WORLD, h: b.h * WORLD
  }));

  /* ── p5 instance ─────────────────────────────────────────────────────── */
  let P = null, ground = null, canopy = null;
  let tx = 0, ty = 0, sc = 1;
  /* the shared view model — see the header of map.js */
  const view = { cx: .5, cy: .5, scale: .3 };
  let padTop = 56, padBottom = 128;
  let night = false, paused = false;
  let pal = DAY;
  let groundDirty = true, spriteDirty = false;
  const LIVE_TREES = 0.9;   // scale at which trees start animating
  const hidden = { trees: false, buildings: false, water: false, shrooms: false };
  let quality = 'high', lastFrame = 0;
  const spores = [];
  const fireflies = [];

  const sketch = p => {
    P = p;

    p.setup = () => {
      const host = opts.container;
      const c = p.createCanvas(host.clientWidth || window.innerWidth,
                               host.clientHeight || window.innerHeight);
      c.parent(host);
      c.canvas.classList.add('map-canvas');
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.noiseSeed(20260904);
      p.randomSeed(20260904);

      buildSprites();
      assignSprites();
      buildGround();
      buildCanopy();

      for (let i = 0; i < 90; i++) {
        spores.push({
          x: Math.random() * WORLD, y: Math.random() * WORLD,
          r: 0.6 + Math.random() * 1.6,
          vx: (Math.random() - 0.5) * 0.05,
          vy: -0.02 - Math.random() * 0.06,
          a: 0.2 + Math.random() * 0.5
        });
      }
      for (let i = 0; i < 46; i++) {
        fireflies.push({
          x: Math.random() * WORLD, y: Math.random() * WORLD,
          ph: Math.random() * 6.283, sp: 0.4 + Math.random() * 0.9,
          rad: 14 + Math.random() * 46
        });
      }
      opts.onReady?.();
    };

    p.windowResized = () => {
      const host = opts.container;
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      if (w !== p.width || h !== p.height) p.resizeCanvas(w, h);
    };

    p.draw = () => {
      if (paused) return;
      /* battery saver: a still map at 8fps instead of a living one at 60 */
      if (quality === 'low') {
        const now = p.millis();
        if (now - lastFrame < 125) return;
        lastFrame = now;
      }
      const t = quality === 'low' ? 0 : p.millis() / 1000;
      pal = night ? NIGHT : DAY;
      if (spriteDirty) { buildSprites(); assignSprites(); spriteDirty = false; groundDirty = true; }
      if (groundDirty) { buildGround(); buildCanopy(); groundDirty = false; }

      p.clear();
      p.push();
      p.translate(tx, ty);
      p.scale(sc);

      /* the paper the farm is drawn on */
      p.image(ground, 0, 0, WORLD, WORLD);

      const vb = viewBounds();
      if (!hidden.water) drawWater(t, vb);

      /* Twelve thousand trees is far too many to touch per frame at the
         overview, so the canopy is baked into its own buffer and blitted.
         Once you are close enough for sway to read, we switch to live trees
         for the handful of buckets on screen instead. */
      if (!hidden.trees) {
        if (sc < LIVE_TREES) P.image(canopy, 0, 0, WORLD, WORLD);
        else drawTrees(t, vb);
      }
      if (!hidden.buildings) drawBuildings(vb);
      if (!hidden.shrooms && sc > 0.55) drawShrooms(t, vb);
      if (!hidden.trees && sc > LIVE_TREES) drawReeds(t, vb);
      if (quality !== 'low') drawDrift(t, vb);

      p.pop();
    };
  };

  /* ── viewport in world coordinates, for culling ──────────────────────── */
  function viewBounds () {
    const pad = 40;
    return {
      x0: (-tx) / sc - pad,
      y0: (-ty) / sc - pad,
      x1: (P.width - tx) / sc + pad,
      y1: (P.height - ty) / sc + pad
    };
  }
  const inView = (x, y, v, m = 0) =>
    x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;

  /* ═══════════════════════════════════════════════ static ground buffer ══
     40,000 cells is far too many to paint per frame, but ground is texture
     rather than line art, so a little softness at high zoom costs nothing.
     Trees, paths and buildings stay live and stay sharp.                  */
  function buildGround () {
    const R = 2048;                       // roads and edges stay legible here
    if (!ground) ground = P.createGraphics(R, R);
    const g = ground;
    const cell = R / G;
    g.pixelDensity(1);
    g.clear();                            // no paper — the farm floats on soil
    g.noStroke();

    /* ── ground washes ─────────────────────────────────────────────────── */
    const jitter = mulberry32(7);
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const c = cells[gy * G + gx];
        if (c === VOID) { jitter(); continue; }
        const x = gx * cell, y = gy * cell;
        const n = jitter();

        if (c === FOREST) {
          g.fill(...(n < 0.3 ? pal.forestD : n > 0.78 ? pal.forestL : pal.forest));
        } else if (c === WATER) {
          g.fill(...pal.water);
        } else {
          /* field, path and building cells all sit on field-coloured ground;
             roads and structures are drawn over the top */
          g.fill(...(n < 0.42 ? pal.field2 : pal.field));
        }
        g.rect(x - cell * 0.4, y - cell * 0.4, cell * 1.8, cell * 1.8);
      }
    }

    /* ── routes ────────────────────────────────────────────────────────────
       Drawn as overlapping discs across neighbouring path cells, which joins
       them into one continuous ribbon. A point cloud read as dots; this reads
       as a road you can actually follow. */
    const k = R / WORLD;
    const ctx = g.drawingContext;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const ribbon = (width, col) => {
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.lineWidth = width * k;
      for (const line of routes) {
        if (line.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(line[0].x * k, line[0].y * k);
        if (line.length === 2) {
          ctx.lineTo(line[1].x * k, line[1].y * k);
        } else {
          /* quadratic through midpoints — smooths the traced centreline
             without letting it drift off the road */
          for (let i = 1; i < line.length - 1; i++) {
            const mx = (line[i].x + line[i + 1].x) / 2;
            const my = (line[i].y + line[i + 1].y) / 2;
            ctx.quadraticCurveTo(line[i].x * k, line[i].y * k, mx * k, my * k);
          }
          const last = line[line.length - 1];
          ctx.lineTo(last.x * k, last.y * k);
        }
        ctx.stroke();
      }
    };
    ribbon(11, pal.pathD);
    ribbon(7.5, pal.path);

    /* ── structures ───────────────────────────────────────────────────── */
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        if (cells[gy * G + gx] !== BUILDING) continue;
        g.fill(...pal.buildD);
        g.rect(gx * cell - cell * .1, gy * cell + cell * .2, cell * 1.3, cell * 1.3, cell * .2);
        g.fill(...pal.build);
        g.rect(gx * cell - cell * .25, gy * cell - cell * .1, cell * 1.35, cell * 1.35, cell * .2);
      }
    }

    /* ── the farm edge: a hand-drawn line where ground meets nothing ───── */
    g.noFill();
    g.stroke(...pal.ink, night ? 120 : 165);
    g.strokeWeight(cell * 0.42);
    g.strokeCap(P.ROUND);
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        if (cells[gy * G + gx] === VOID) continue;
        const x = gx * cell, y = gy * cell;
        const w = (jitter() - 0.5) * cell * 0.3;
        if (cellAt(gx, gy - 1) === VOID) g.line(x, y + w, x + cell, y + w);
        if (cellAt(gx, gy + 1) === VOID) g.line(x, y + cell + w, x + cell, y + cell + w);
        if (cellAt(gx - 1, gy) === VOID) g.line(x + w, y, x + w, y + cell);
        if (cellAt(gx + 1, gy) === VOID) g.line(x + cell + w, y, x + cell + w, y + cell);
      }
    }
    g.noStroke();
  }

  function buildCanopy () {
    const R = 2048;
    if (!canopy) canopy = P.createGraphics(R, R);
    const g = canopy;
    g.pixelDensity(1);
    g.clear();
    const ctx = g.drawingContext;
    const k = R / WORLD;
    for (const tr of trees) {
      const w = tr.r * 3.0 * k;
      ctx.drawImage(tr.sprite, (tr.x + tr.lean) * k - w / 2, tr.y * k - w * 0.52, w, w);
    }
  }

  /* ═══════════════════════════════════════════════════════ sprite cache ══
     Canopies are the same handful of shapes over and over. Drawing each one
     with five ellipses per frame is what cost us the frame rate; baking them
     into little offscreen canvases turns every tree into a single drawImage. */

  const TONES = 3, SHAPES = 3;
  let treeSprites = [], shroomSprites = [];
  const SPR = 128;                       // sprite resolution, generous for zoom

  function buildSprites () {
    treeSprites = [];
    for (let tone = 0; tone < TONES; tone++) {
      for (let shape = 0; shape < SHAPES; shape++) {
        const g = document.createElement('canvas');
        g.width = g.height = SPR;
        const c = g.getContext('2d');
        const base = tone === 0 ? pal.forestD : tone === 2 ? pal.forestL : pal.forest;
        const R = SPR * 0.30;
        const cx = SPR / 2, cy = SPR * 0.52;
        const wob = 0.86 + shape * 0.1;

        const blob = (dx, dy, rx, ry, col) => {
          c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          c.beginPath();
          c.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, 6.2832);
          c.fill();
        };
        blob(0, R * 0.18, R * 1.05 * wob, R * 0.86, [base[0] * .82, base[1] * .82, base[2] * .82]);
        blob(-R * 0.34, -R * 0.08, R * 0.76, R * 0.68, base);
        blob(R * 0.36, -R * 0.02, R * 0.68, R * 0.60, base);
        blob(-R * 0.08, -R * 0.44, R * 0.54, R * 0.46,
             [Math.min(255, base[0] * 1.22), Math.min(255, base[1] * 1.2), base[2] * 1.05]);
        treeSprites.push(g);
      }
    }

    shroomSprites = [pal.cap, pal.capGold].map(col => {
      const g = document.createElement('canvas');
      g.width = g.height = 64;
      const c = g.getContext('2d');
      c.fillStyle = `rgb(${pal.buildD[0]},${pal.buildD[1]},${pal.buildD[2]})`;
      c.fillRect(29, 30, 6, 22);
      c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      c.beginPath();
      c.ellipse(32, 30, 21, 14, 0, 0, 6.2832);
      c.fill();
      c.fillStyle = 'rgba(56,58,46,.22)';
      c.beginPath(); c.ellipse(25, 27, 4, 3, 0, 0, 6.2832); c.fill();
      c.beginPath(); c.ellipse(39, 31, 3.2, 2.4, 0, 0, 6.2832); c.fill();
      return g;
    });
  }

  function assignSprites () {
    for (const tr of trees) {
      const tone = tr.tone < 0.34 ? 0 : tr.tone > 0.72 ? 2 : 1;
      tr.sprite = treeSprites[tone * SHAPES + (tr.shape | 0)];
    }
  }

  /* ═══════════════════════════════════════════════════════════ layers ══ */

  function drawWater (t, v) {
    const p = P;
    p.noStroke();
    for (const w of waters) {
      if (!inView(w.x, w.y, v, Math.max(w.w, w.h))) continue;
      p.fill(...pal.waterD);
      p.ellipse(w.x, w.y, w.w * 1.02, w.h * 1.02);
      p.fill(...pal.water);
      p.ellipse(w.x, w.y, w.w * 0.94, w.h * 0.94);

      /* ripples — the only thing on the farm that never stops moving */
      if (sc > 0.4) {
        p.noFill();
        p.stroke(255, 255, 255, night ? 26 : 60);
        p.strokeWeight(0.7 / sc * 0.7 + 0.5);
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.35 + i * 0.33) % 1;
          p.ellipse(w.x, w.y, w.w * 0.3 * (0.4 + ph), w.h * 0.3 * (0.4 + ph));
        }
        p.noStroke();
      }
    }
  }

  function drawPaths (v) {
    const p = P;
    p.noStroke();
    const rOuter = 6.6, rInner = 4.4;
    p.fill(...pal.pathD);
    for (const n of paths) {
      if (!inView(n.x, n.y, v, 10)) continue;
      p.ellipse(n.x, n.y, rOuter, rOuter);
    }
    p.fill(...pal.path);
    for (const n of paths) {
      if (!inView(n.x, n.y, v, 10)) continue;
      p.ellipse(n.x, n.y, rInner, rInner);
    }
  }

  function drawBuildings (v) {
    const p = P;
    for (const b of builds) {
      if (!inView(b.x, b.y, v, Math.max(b.w, b.h))) continue;
      const w = b.w, h = b.h;
      p.noStroke();
      p.fill(...pal.buildD);
      p.rect(b.x - w / 2 + 1.4, b.y - h / 2 + 1.8, w, h, 1.5);
      p.fill(...pal.build);
      p.rect(b.x - w / 2, b.y - h / 2, w, h, 1.5);
      if (sc > 0.7) {
        p.stroke(...pal.ink, 150);
        p.strokeWeight(0.6);
        p.noFill();
        p.rect(b.x - w / 2, b.y - h / 2, w, h, 1.5);
        /* a roofline, so it reads as a building rather than a box */
        p.line(b.x - w / 2, b.y - h / 2 + h * 0.34, b.x + w / 2, b.y - h / 2 + h * 0.34);
        p.noStroke();
      }
      if (night) {
        p.noStroke();
        p.fill(255, 214, 130, 40);
        p.ellipse(b.x, b.y, w * 2.4, h * 2.4);
        p.fill(255, 222, 150, 190);
        p.rect(b.x - 1, b.y - 0.5, 2, 2);
      }
    }
  }

  function drawTrees (t, v) {
    const ctx = P.drawingContext;
    eachIn(treeBuckets, trees, v, tr => {
      const sway = Math.sin(t * 0.7 + tr.phase) * (0.9 + tr.r * 0.06);
      const w = tr.r * 3.0, h = tr.r * 3.0;
      ctx.drawImage(tr.sprite,
        tr.x + sway * 0.5 + tr.lean - w / 2,
        tr.y - h * 0.52, w, h);
    });
  }

  function drawReeds (t, v) {
    const ctx = P.drawingContext;
    ctx.strokeStyle = `rgba(${pal.forestL[0]},${pal.forestL[1]},${pal.forestL[2]},.62)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    eachIn(reedBuckets, reeds, v, r => {
      const sw = Math.sin(t * 1.6 + r.phase) * 1.1;
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + sw, r.y - r.h);
    });
    ctx.stroke();
  }

  /* Mushrooms only fruit once you have come close enough to find them. */
  function drawShrooms (t, v) {
    const ctx = P.drawingContext;
    const grow = Math.min(1, (sc - 0.55) / 0.9);
    eachIn(shroomBuckets, shrooms, v, m => {
      const breathe = 1 + Math.sin(t * 1.1 + m.phase) * 0.05;
      const r = m.r * grow * breathe;
      if (r < 0.3) return;
      const w = r * 3.2, h = r * 3.2;
      ctx.drawImage(shroomSprites[m.gold ? 1 : 0], m.x - w / 2, m.y - h * 0.55, w, h);
    });
  }

  /* Spores by day, fireflies after dark. */
  function drawDrift (t, v) {
    const p = P;
    p.noStroke();
    if (!night) {
      for (const s of spores) {
        s.x += s.vx; s.y += s.vy;
        if (s.y < -20) { s.y = WORLD + 20; s.x = Math.random() * WORLD; }
        if (!inView(s.x, s.y, v, 6)) continue;
        p.fill(255, 252, 232, s.a * 190);
        p.ellipse(s.x, s.y, s.r * 2, s.r * 2);
      }
    } else {
      for (const f of fireflies) {
        const a = (Math.sin(t * f.sp + f.ph) + 1) / 2;
        const x = f.x + Math.cos(t * f.sp * 0.5 + f.ph) * f.rad;
        const y = f.y + Math.sin(t * f.sp * 0.37 + f.ph) * f.rad * 0.6;
        if (!inView(x, y, v, 8)) continue;
        p.fill(214, 255, 150, 30 * a);
        p.ellipse(x, y, 9, 9);
        p.fill(226, 255, 176, 235 * a);
        p.ellipse(x, y, 2.1, 2.1);
      }
    }
  }

  /* ── public surface ──────────────────────────────────────────────────── */
  /* Derive this renderer's own translate/scale from the shared view. */
  function syncFromView () {
    const w = P?.width || window.innerWidth;
    const h = P?.height || window.innerHeight;
    sc = view.scale;
    tx = w / 2 - view.cx * WORLD * sc;
    ty = padTop + (h - padTop - padBottom) / 2 - view.cy * WORLD * sc;
  }

  const api = {
    kind: 'flat',
    fitBias: 1,
    footprint: () => footprint(cells, G),

    mount () {
      if (!window.p5) throw new Error('p5 not loaded');
      return new window.p5(sketch);
    },
    setView (v) { Object.assign(view, v); syncFromView(); },
    setPads (t, b) { padTop = t; padBottom = b; syncFromView(); },

    /** World 0..1 -> screen px. The hinge the DOM markers hang off. */
    project (nx, ny) {
      return { x: nx * WORLD * sc + tx, y: ny * WORLD * sc + ty, behind: false };
    },

    /** Layer visibility, matching the isometric renderer's contract. */
    setLayer (name, on) { hidden[name] = !on; },
    setQuality (q) { quality = q; },
    layerNames: () => ['trees', 'buildings', 'water', 'shrooms'],
    setFocus () { /* occlusion only matters when things stand up */ },
    setNight (on) { if (on !== night) { night = on; groundDirty = true; spriteDirty = true; } },
    pause (v) { paused = v; },
    resize () { P?.windowResized?.(); syncFromView(); },
    stats: () => ({ trees: trees.length, shrooms: shrooms.length,
                    paths: paths.length, builds: builds.length })
  };
  return api;
}
