/* ═══════════════════════════════════════════════════════════════════════════
   THE FARM, STANDING UP — isometric renderer
   ---------------------------------------------------------------------------
   Same contract as the flat renderer in mapsketch.js, so map.js does not care
   which one it is talking to:

       mount()                    start drawing
       setView(view)              {cx, cy, scale, azimuth, tilt}
       project(nx, ny)            world 0..1  ->  screen px, for the DOM pins
       setNight(on) / resize() / pause() / dispose()

   That shared contract is the whole point: the pins, labels, amenities,
   decluttering and every gesture live in map.js and work unchanged in both
   views. Switching is one flag.

   An orthographic camera at a fixed elevation *is* isometric — no projection
   maths of our own, and a real depth buffer, so nothing sorts wrong.

   Built from the same terrain.js the flat map uses:
     ground   one textured plane, alpha-cut to the farm's footprint
     slab     wall quads wherever an inside cell meets the void
     trees    three InstancedMeshes, one per tone — three draw calls for 7,000
     roads    painted into the ground texture, so they cost nothing extra
   ═══════════════════════════════════════════════════════════════════════ */

import * as THREE from '../vendor/three.module.min.js';
import { TERRAIN } from './terrain.js';
import { pathDistance, canopyScale, footprint } from './clearance.js';

const VOID = 0, FIELD = 1, FOREST = 2, WATER = 3, PATH = 4, BUILDING = 5;

const DAY = {
  field:   0xDBDDAD, field2: 0xC9CE95,
  forest:  0x6C8454, forestD: 0x54683F, forestL: 0x8FB06A,
  water:   0x8ABEC9, path: 0xC88A4E, pathD: 0x966034,
  build:   0x8F6051, roof: 0xB0705C,
  slab:    0x5E3B22, slabDark: 0x3A2415,
  sun:     0xFFF3DC, sky: 0xBFD8E8, groundBounce: 0x9AA36F,
  sunI:    1.15, ambI: 0.62
};

const NIGHT = {
  field:   0x50564A, field2: 0x464C42,
  forest:  0x2E3A38, forestD: 0x232D2E, forestL: 0x3E4C44,
  water:   0x2A4560, path: 0x6E5140, pathD: 0x4C3729,
  build:   0x4E3640, roof: 0x5E4048,
  slab:    0x2E1F16, slabDark: 0x1C1310,
  sun:     0xAFC0E8, sky: 0x243050, groundBounce: 0x1E2430,
  sunI:    0.42, ambI: 0.40
};

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

const hex = n => '#' + n.toString(16).padStart(6, '0');

/*
 * How much GPU to ask for.
 *
 * Measured on a Nothing Phone (1) — Adreno 642L, a perfectly ordinary
 * mid-range chip — the full-fat budget crashed Chrome's GPU process about six
 * seconds into building the scene: both the sky and the map contexts died
 * within three milliseconds of each other, which is a process crash rather
 * than an eviction. Two 2048² textures, a 1024² shadow map and a 2× pixel
 * ratio on a 2.6-dpr screen is simply more than that chip will give a browser
 * tab, and the failure mode is total: no 3D map for the rest of the session.
 *
 * A phone gets a quarter of the texture memory and a quarter of the shadow
 * map. At arm's length on a 6-inch screen the difference is close to
 * invisible; the difference between a 3D map and no 3D map is not.
 */
function gpuBudget () {
  const mem = navigator.deviceMemory || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 900;
  const modest = (coarse && small) || mem <= 4;
  return modest
    /*
     * No MSAA and no shadows on a phone.
     *
     * Even at a quarter of the texture memory the GPU process still crashed on
     * an Adreno 642L about six seconds in. Antialiasing is the expensive part
     * on a tiled mobile GPU — MSAA multiplies the tile memory for every pixel
     * of a full-screen render — and the shadow pass is a second render of the
     * whole scene each time it updates. Losing both costs some crispness and
     * the soft shadows under the trees. Keeping them costs the 3D map
     * entirely, which is not a trade worth making.
     */
    ? { tex: 1024, shadow: 512, maxDpr: 1.5, aa: false, shadows: false, label: 'phone' }
    : { tex: 2048, shadow: 1024, maxDpr: 2, aa: true, shadows: true, label: 'desktop' };
}

export function createIsoMap (opts = {}) {
  const host = opts.container;
  const BUDGET = gpuBudget();
  const onContextLost = opts.onContextLost;
  const onContextBack = opts.onContextBack;
  const G = TERRAIN.grid;
  const W = TERRAIN.size;                       // 1280 world units square
  const cells = decodeRLE(TERRAIN.rle, G * G);
  const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= G || gy >= G) ? VOID : cells[gy * G + gx];

  const SLAB = 46;                              // how thick the farm is
  let pal = DAY;
  let night = false;

  /* ── view state, in the shared model ───────────────────────────────── */
  let view = { cx: 0.5, cy: 0.5, scale: 0.3, azimuth: 45, tilt: 35.264 };
  let vw = 1, vh = 1, padTop = 0, padBottom = 0;

  const renderer = new THREE.WebGLRenderer({
    antialias: BUDGET.aa,
    alpha: true,
    /* 'high-performance' asks for the discrete GPU on a laptop; on a phone it
       is at best meaningless and at worst a hint to run the chip hot. */
    powerPreference: BUDGET.label === 'phone' ? 'default' : 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = BUDGET.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'iso-canvas';
  host.appendChild(renderer.domElement);

  /*
   * WebGL contexts are not guaranteed. On a phone the browser will take one
   * back whenever it feels memory pressure — dozens of open tabs is enough —
   * and without this handler the canvas simply goes blank and never returns.
   * Everything else on the page keeps working, which is what makes it such a
   * confusing failure to look at: the pins and labels are all still there,
   * floating on nothing.
   *
   * preventDefault() on the loss event is what makes restoration possible at
   * all; without it the browser will not bother firing 'restored'.
   */
  let contextLost = false;
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    contextLost = true;
    onContextLost?.();
  }, false);

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    /* Three re-uploads its own GPU resources, but the render targets and the
       baked textures were ours, so they have to be marked for re-upload. */
    try {
      renderer.resetState();
      scene.traverse(o => {
        const m = o.material;
        if (!m) return;
        for (const mat of (Array.isArray(m) ? m : [m])) {
          if (mat.map) mat.map.needsUpdate = true;
          mat.needsUpdate = true;
        }
      });
      sun.shadow.needsUpdate = true;
      onContextBack?.();
    } catch { /* if it cannot come back, the watchdog swaps to the flat map */ }
  }, false);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 6000);

  /* everything hangs off these so a layer can be hidden in one line */
  const layers = {
    ground:    new THREE.Group(),
    slab:      new THREE.Group(),
    water:     new THREE.Group(),
    trees:     new THREE.Group(),
    buildings: new THREE.Group()
  };
  Object.values(layers).forEach(g => scene.add(g));

  /* ── lights ────────────────────────────────────────────────────────── */
  const sun = new THREE.DirectionalLight(pal.sun, pal.sunI);
  sun.castShadow = BUDGET.shadows;
  sun.shadow.mapSize.set(BUDGET.shadow, BUDGET.shadow);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 3000;
  const sc = sun.shadow.camera;
  sc.left = -1000; sc.right = 1000; sc.top = 1000; sc.bottom = -1000;
  sun.shadow.bias = -0.0016;
  scene.add(sun, sun.target);

  sun.position.set(-260, 1500, -140);
  sun.target.position.set(W / 2, 0, W / 2);
  sun.shadow.autoUpdate = false;          // static scene, static light
  sun.shadow.needsUpdate = true;

  const hemi = new THREE.HemisphereLight(pal.sky, pal.groundBounce, pal.ambI);
  scene.add(hemi);

  /* ══════════════════════════════════════════════════ ground texture ══
     Roads go in here rather than as their own geometry: they are flat, so
     painting them costs one texture instead of a mesh and a draw call.   */
  const TEX = BUDGET.tex;
  const texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = TEX;
  const tctx = texCanvas.getContext('2d');
  const groundTex = new THREE.CanvasTexture(texCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function paintGround () {
    const cell = TEX / G;
    const k = TEX / W;
    tctx.clearRect(0, 0, TEX, TEX);
    const jitter = mulberry32(7);

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const c = cells[gy * G + gx];
        if (c === VOID) { jitter(); continue; }
        const n = jitter();
        tctx.fillStyle =
          c === FOREST ? hex(n < 0.3 ? pal.forestD : n > 0.78 ? pal.forestL : pal.forest)
          : c === WATER ? hex(pal.water)
          : hex(n < 0.42 ? pal.field2 : pal.field);
        /* overlap so the ground reads as washes rather than tiles */
        tctx.fillRect(gx * cell - cell * .4, gy * cell - cell * .4, cell * 1.8, cell * 1.8);
      }
    }

    /* routes, as one continuous ribbon with a darker edge */
    tctx.lineCap = 'round';
    tctx.lineJoin = 'round';
    const ribbon = (width, colour) => {
      tctx.strokeStyle = hex(colour);
      tctx.lineWidth = width * k;
      for (const line of TERRAIN.routes) {
        if (line.length < 2) continue;
        tctx.beginPath();
        tctx.moveTo(line[0][0] * W * k, line[0][1] * W * k);
        if (line.length === 2) {
          tctx.lineTo(line[1][0] * W * k, line[1][1] * W * k);
        } else {
          for (let i = 1; i < line.length - 1; i++) {
            const mx = (line[i][0] + line[i + 1][0]) / 2 * W * k;
            const my = (line[i][1] + line[i + 1][1]) / 2 * W * k;
            tctx.quadraticCurveTo(line[i][0] * W * k, line[i][1] * W * k, mx, my);
          }
          const last = line[line.length - 1];
          tctx.lineTo(last[0] * W * k, last[1] * W * k);
        }
        tctx.stroke();
      }
    };
    ribbon(12, pal.pathD);
    ribbon(8, pal.path);

    /* a dashed centreline — the single cheapest thing that makes a road
       read as a route you can follow (straight out of reference 1) */
    tctx.setLineDash([7 * k, 9 * k]);
    tctx.strokeStyle = 'rgba(255,248,230,.55)';
    tctx.lineWidth = 1.1 * k;
    for (const line of TERRAIN.routes) {
      if (line.length < 3) continue;
      tctx.beginPath();
      tctx.moveTo(line[0][0] * W * k, line[0][1] * W * k);
      for (let i = 1; i < line.length; i++) tctx.lineTo(line[i][0] * W * k, line[i][1] * W * k);
      tctx.stroke();
    }
    tctx.setLineDash([]);

    groundTex.needsUpdate = true;
  }

  /* ══════════════════════════════════════════════════════ geometry ════ */

  function buildGround () {
    const geo = new THREE.PlaneGeometry(W, W);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({
      map: groundTex, transparent: true, alphaTest: 0.5
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(W / 2, 0, W / 2);
    mesh.receiveShadow = true;
    layers.ground.add(mesh);
  }

  /** Wall quads wherever an inside cell meets nothing — this is the slab. */
  function buildSlab () {
    const cell = W / G;
    const pos = [], norm = [], idx = [];
    let v = 0;

    const quad = (ax, az, bx, bz, nx, nz) => {
      pos.push(ax, 0, az,  bx, 0, bz,  bx, -SLAB, bz,  ax, -SLAB, az);
      for (let i = 0; i < 4; i++) norm.push(nx, 0, nz);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    };

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        if (cells[gy * G + gx] === VOID) continue;
        const x = gx * cell, z = gy * cell, x2 = x + cell, z2 = z + cell;
        if (at(gx, gy - 1) === VOID) quad(x, z, x2, z, 0, -1);
        if (at(gx, gy + 1) === VOID) quad(x2, z2, x, z2, 0, 1);
        if (at(gx - 1, gy) === VOID) quad(x, z2, x, z, -1, 0);
        if (at(gx + 1, gy) === VOID) quad(x2, z, x2, z2, 1, 0);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: pal.slab }));
    mesh.castShadow = true;
    layers.slab.add(mesh);

    /* cap the bottom so the slab is solid when you tilt low */
    const capPos = [], capIdx = [];
    let cv = 0;
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        if (cells[gy * G + gx] === VOID) continue;
        const x = gx * cell, z = gy * cell, x2 = x + cell, z2 = z + cell;
        capPos.push(x, -SLAB, z, x, -SLAB, z2, x2, -SLAB, z2, x2, -SLAB, z);
        capIdx.push(cv, cv + 1, cv + 2, cv, cv + 2, cv + 3);
        cv += 4;
      }
    }
    const capGeo = new THREE.BufferGeometry();
    capGeo.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
    capGeo.setIndex(capIdx);
    capGeo.computeVertexNormals();
    layers.slab.add(new THREE.Mesh(capGeo,
      new THREE.MeshBasicMaterial({ color: pal.slabDark })));
  }

  function buildWater () {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({
      color: pal.water, transparent: true, opacity: 0.92
    });
    for (const b of TERRAIN.water) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(b.w * W * 1.02, 1, b.h * W * 1.02);
      m.position.set(b.x * W, 1.2, b.y * W);
      layers.water.add(m);
    }
  }

  /* Trees: one InstancedMesh per tone. Seeded identically to the flat map,
     so the same forest appears in both views. */
  const treeMeshes = [];
  function buildTrees () {
    const rnd = mulberry32(20260904);
    const buckets = [[], [], []];
    /* Standing up, an overhanging canopy hides the trail completely — so the
       corridor matters more here than on the flat map, not less. */
    const clearance = pathDistance(cells, G);

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const c = cells[gy * G + gx];
        const x0 = gx / G, y0 = gy / G, step = 1 / G;
        const push = (r, tone) => {
          buckets[tone].push({
            x: (x0 + rnd() * step) * W,
            z: (y0 + rnd() * step) * W,
            r, lean: (rnd() - .5) * .3
          });
        };
        /* Fewer, bigger trees than the flat map: in three dimensions they
           overlap and read as dense at a third of the count. */
        const grow = canopyScale(clearance[gy * G + gx]);
        if (c === FOREST && grow > 0) {
          if (rnd() < .78) {
            const t = rnd();
            push((9 + rnd() * 8) * grow, t < .34 ? 0 : t > .72 ? 2 : 1);
          }
        } else if (c === FIELD && grow > 0 && rnd() < .07) {
          push((6 + rnd() * 5) * grow, 2);
        }
      }
    }

    const canopy = new THREE.IcosahedronGeometry(1, 0);
    const trunk = new THREE.CylinderGeometry(0.12, 0.17, 1, 4);
    const tones = [pal.forestD, pal.forest, pal.forestL];
    const dummy = new THREE.Object3D();

    buckets.forEach((list, i) => {
      if (!list.length) return;
      const cm = new THREE.InstancedMesh(canopy,
        new THREE.MeshLambertMaterial({ color: tones[i], flatShading: true }), list.length);
      const tm = new THREE.InstancedMesh(trunk,
        new THREE.MeshLambertMaterial({ color: pal.slab }), list.length);
      cm.castShadow = tm.castShadow = true;
      cm.receiveShadow = true;

      list.forEach((t, n) => {
        const h = t.r * 2.0;
        dummy.position.set(t.x + t.lean, h + t.r * .5, t.z);
        dummy.rotation.set(0, n * 1.7, 0);
        dummy.scale.set(t.r, t.r * .92, t.r);
        dummy.updateMatrix();
        cm.setMatrixAt(n, dummy.matrix);

        dummy.position.set(t.x, h * .5, t.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(t.r * .5, h, t.r * .5);
        dummy.updateMatrix();
        tm.setMatrixAt(n, dummy.matrix);
      });
      cm.instanceMatrix.needsUpdate = true;
      tm.instanceMatrix.needsUpdate = true;
      layers.trees.add(cm, tm);
      treeMeshes.push(cm, tm);
    });
  }

  /* Buildings from the BUILDING cells, merged into runs so a long structure
     becomes one block rather than a row of cubes. */
  function buildBuildings () {
    const cell = W / G;
    const seen = new Uint8Array(G * G);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const wall = new THREE.MeshLambertMaterial({ color: pal.build });
    const roof = new THREE.MeshLambertMaterial({ color: pal.roof });
    const mats = [wall, wall, roof, wall, wall, wall];
    const boxes = [];

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const i = gy * G + gx;
        if (cells[i] !== BUILDING || seen[i]) continue;
        let run = 0;
        while (gx + run < G && cells[gy * G + gx + run] === BUILDING && !seen[gy * G + gx + run]) {
          seen[gy * G + gx + run] = 1; run++;
        }
        boxes.push({ x: (gx + run / 2) * cell, z: (gy + .5) * cell, w: run * cell });
      }
    }

    const dummy = new THREE.Object3D();
    const mesh = new THREE.InstancedMesh(box, mats, boxes.length);
    mesh.castShadow = mesh.receiveShadow = true;
    boxes.forEach((b, n) => {
      const h = 16 + (n % 3) * 7;
      dummy.position.set(b.x, h / 2, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(Math.max(b.w, cell * 1.4), h, cell * 1.7);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    layers.buildings.add(mesh);
  }

  /* ══════════════════════════════════════════════════════ camera ═════ */

  function applyView () {
    const az = view.azimuth * Math.PI / 180;
    const el = view.tilt * Math.PI / 180;
    const dist = 2400;

    const cx = view.cx * W, cz = view.cy * W;
    camera.position.set(
      cx + Math.cos(az) * Math.cos(el) * dist,
      Math.sin(el) * dist,
      cz + Math.sin(az) * Math.cos(el) * dist
    );
    camera.lookAt(cx, 0, cz);
    /* project() can be called between frames, and matrixWorldInverse is only
       refreshed during render — so refresh it here or the DOM pins drift away
       from the farm they are supposed to be labelling. */
    camera.updateMatrixWorld(true);

    /* Orthographic "zoom" is the half-width of the frustum. view.scale is
       screen px per world unit, exactly as in the flat renderer, so the two
       views stay in step when you switch between them. */
    const halfW = vw / 2 / view.scale;
    const halfH = vh / 2 / view.scale;
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH;   camera.bottom = -halfH;

    /* nudge the centre up so the farm sits above the sheet, not behind it */
    const offset = (padTop - padBottom) / 2 / view.scale;
    camera.top += offset; camera.bottom += offset;
    camera.updateProjectionMatrix();

    /* The sun stays put in world space. If it followed the camera the shadow
       map would have to be re-rendered every frame; fixed, it is drawn once. */
  }

  /* ═══════════════════════════════════════════════════ projection ════
     What the DOM pins need: where is this world point on screen? */
  const _v = new THREE.Vector3();
  function project (nx, ny, height = 0) {
    _v.set(nx * W, height, ny * W).project(camera);
    return {
      x: (_v.x * 0.5 + 0.5) * vw,
      y: (-_v.y * 0.5 + 0.5) * vh,
      behind: _v.z > 1
    };
  }

  /* ═════════════════════════════════════════ occlusion around a pin ══
     Isometric hides things behind other things. When a pin is active we
     fade the canopy near it so the place you are looking at is not buried
     under a tree — the one real usability cost of this view, handled. */
  let focus = null, fade = 1, fadeSettled = true;

  function setFocus (nx, ny) {
    focus = (nx == null) ? null : { x: nx * W, y: ny * W };
    fadeSettled = false;
  }

  /* Isometric hides things behind other things, so we thin the canopy while
     you are looking at a particular place.

     Assigning `material.transparent` marks the material as needing a shader
     recompile — doing that every frame costs more than the entire rest of the
     scene. So we only touch it when the flag genuinely flips, and stop
     working altogether once the fade has arrived. */
  function updateOcclusion () {
    if (fadeSettled) return;
    const target = focus ? 0.34 : 1;
    fade += (target - fade) * 0.14;
    if (Math.abs(target - fade) < 0.004) { fade = target; fadeSettled = true; }

    const wantTransparent = fade < 0.995;
    for (const m of treeMeshes) {
      if (m.material.transparent !== wantTransparent) {
        m.material.transparent = wantTransparent;
        m.material.needsUpdate = true;
      }
      m.material.opacity = fade;
    }
  }

  /* ═══════════════════════════════════════════════════════ loop ═════ */
  let raf = 0, running = true, built = false;

  function resize () {
    vw = host.clientWidth || window.innerWidth;
    vh = host.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, BUDGET.maxDpr));
    /* the third argument must stay true: with it false three.js sets the
       drawing buffer but leaves the element's CSS size alone, so the canvas
       ends up devicePixelRatio times too large and you see a corner of the
       render instead of the whole thing */
    renderer.setSize(vw, vh, true);
    applyView();
  }

  function frame () {
    raf = requestAnimationFrame(frame);
    /* Read the live value rather than a flag set by an event. A cached flag
       never recovers if the "visible" event does not arrive — which happens
       in embedded views and some in-app browsers, and leaves a blank map. */
    if (!running || document.hidden || contextLost) return;
    updateOcclusion();
    renderer.render(scene, camera);
  }

  function repaintForPalette () {
    pal = night ? NIGHT : DAY;
    paintGround();
    sun.color.setHex(pal.sun); sun.intensity = pal.sunI;
    hemi.color.setHex(pal.sky); hemi.groundColor.setHex(pal.groundBounce);
    hemi.intensity = pal.ambI;
    layers.slab.children.forEach((m, i) =>
      m.material.color.setHex(i === 0 ? pal.slab : pal.slabDark));
    layers.water.children.forEach(m => m.material.color.setHex(pal.water));
    const tones = [pal.forestD, pal.forest, pal.forestL];
    let t = 0;
    layers.trees.children.forEach(m => {
      if (m.geometry.type === 'IcosahedronGeometry') m.material.color.setHex(tones[t++ % 3]);
      else m.material.color.setHex(pal.slab);
    });
    layers.buildings.children.forEach(m => {
      if (Array.isArray(m.material)) {
        m.material[2].color.setHex(pal.roof);
        [0, 1, 3, 4, 5].forEach(i => m.material[i].color.setHex(pal.build));
      }
    });
  }

  /* ══════════════════════════════════════════════════════ api ═══════ */
  let torn = false;
  function teardown () {
    if (torn) return;
    torn = true;
    running = false;
    cancelAnimationFrame(raf);
    try { renderer.dispose(); } catch {}
    try { renderer.forceContextLoss(); } catch {}
    try { renderer.domElement.remove(); } catch {}
  }

  const api = {
    kind: 'iso',

    /* Standing the farm up turns a 1280 square into a ~1810 diagonal, so the
       shared fit calculation needs to pull back to show the whole thing. */
    fitBias: 0.88,
    footprint: () => footprint(cells, G),

    mount () {
      if (built) return api;
      paintGround();
      buildGround();
      buildSlab();
      buildWater();
      buildTrees();
      buildBuildings();
      built = true;
      resize();
      raf = requestAnimationFrame(frame);
      addEventListener('resize', resize, { passive: true });
      opts.onReady?.();
      return api;
    },

    setView (v) { Object.assign(view, v); applyView(); },
    /** Whether the GPU context is currently ours. */
    contextAlive: () => !contextLost,
    budget: () => ({ ...BUDGET }),
    setPads (top, bottom) { padTop = top; padBottom = bottom; applyView(); },
    project,
    setFocus,

    setNight (on) { if (on !== night) { night = on; repaintForPalette(); } },

    /** Show or hide a whole layer — the "what do I want to see" control. */
    setLayer (name, visible) { if (layers[name]) layers[name].visible = visible; },

    /* battery saver drops shadows and pixel ratio — the two things that cost
       real power in a 3D scene */
    setQuality (q) {
      const low = q === 'low';
      renderer.shadowMap.enabled = BUDGET.shadows && !low;
      renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, BUDGET.maxDpr));
      sun.castShadow = BUDGET.shadows && !low;
      renderer.setSize(vw, vh, true);
    },
    layerNames: () => Object.keys(layers),

    pause (v) { running = !v; },
    resize,

    /*
     * dispose() and destroy() are the same thing on purpose: map.js called
     * destroy() and this object only offered dispose(), so the optional-call
     * silently did nothing and every abandoned 3-D renderer kept its GPU
     * context for the life of the tab. A handful of reloads was enough to
     * exhaust them, after which the browser refused new ones and the map fell
     * back to flat "for no reason".
     *
     * forceContextLoss() is the part that actually hands the context back;
     * renderer.dispose() alone frees three's own objects and leaves the
     * context alive.
     */
    dispose: teardown,
    destroy: teardown,

    stats: () => ({
      trees: treeMeshes.filter(m => m.geometry.type === 'IcosahedronGeometry')
        .reduce((a, m) => a + m.count, 0),
      draws: renderer.info.render.calls,
      tris: renderer.info.render.triangles
    })
  };

  /* Give the GPU its context back when this page goes away — a bfcache
     restore or a reload should not cost a context each time. */
  addEventListener('pagehide', teardown, { once: true });

  return api;
}
