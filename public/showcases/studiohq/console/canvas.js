'use strict';

// ..//canvas: {THE PRODUCTION FLOOR} — the studio's node-based infinite
// canvas (v0.19). A separate script/closure from app.js on purpose (this
// pane is hq-app's biggest single feature and app.js was already ~5000
// lines); see window.HQReviewBridge/window.HQConsole/window.HQCanvasWantsHotkeys
// at the bottom of app.js for the small, explicit surface the two share —
// this file never reaches into app.js's closure any other way.
//
// Engine shape: one `#canvas-world` div gets a single CSS transform
// (translate+scale) applied per frame — every node/edge/cluster lives
// inside it, so panning/zooming never touches more than one element's
// style. Semantic zoom (constellation/mid/node-altitude) is three render
// modes keyed off `camera.zoom`, with hysteresis so it never flickers at
// a threshold. Server state (GET /api/canvas/flow) is polled only while
// this pane is actually visible — flow JSON can hold a lot of node data
// that nobody needs to fetch every 5s while looking at ..//agenda instead.
(function () {
  const paneEl = document.querySelector('.term[data-pane="canvas"]');
  if (!paneEl) return;

  const viewportEl = document.getElementById('canvas-viewport');
  const worldEl = document.getElementById('canvas-world');
  const gridFloorEl = document.getElementById('canvas-grid-floor');
  const clustersEl = document.getElementById('canvas-clusters');
  const edgesSvg = document.getElementById('canvas-edges');
  const nodesEl = document.getElementById('canvas-nodes');
  const emptyEl = document.getElementById('canvas-empty');
  const minimapDotsEl = document.getElementById('canvas-minimap-dots');
  const minimapViewEl = document.getElementById('canvas-minimap-view');
  const paletteEl = document.getElementById('canvas-palette');
  const inspectorEl = document.getElementById('canvas-inspector');
  const nowDockEl = document.getElementById('canvas-now-dock');
  const altitudeLabelEl = document.getElementById('canvas-altitude');
  const flowSelectEl = document.getElementById('canvas-flow-select');
  const newFlowBtn = document.getElementById('canvas-new-flow-btn');
  const searchInputEl = document.getElementById('canvas-search-input');
  const reviewOverlayEl = document.getElementById('canvas-review-overlay');
  const reviewOverlayBodyEl = document.getElementById('canvas-review-overlay-body');
  const reviewOverlayCloseBtn = document.getElementById('canvas-review-overlay-close');
  if (!viewportEl || !worldEl) return;

  const bridge = window.HQConsole || {};
  const reduced = () => (bridge.reducedMotion ? bridge.reducedMotion() : (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const houseEase = bridge.houseEase || 'power2.out';

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // ---------- fetch ----------

  async function apiFetch(url, opts) {
    let res;
    try {
      res = await fetch(url, opts);
    } catch {
      return { ok: false, status: 0, body: null };
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  }
  function apiErrorText(result) {
    const detail = result.body && (result.body.message || result.body.error);
    return detail || `request failed (HTTP ${result.status})`;
  }
  function toast(msg) {
    if (bridge.showGlobalToast) bridge.showGlobalToast(msg);
  }

  const KIND_META = {
    brief: { glyph: '§', label: 'BRIEF' },
    asset: { glyph: '◆', label: 'ASSET' },
    ffmpeg: { glyph: '▶', label: 'FFMPEG' },
    img2threejs: { glyph: '⬡', label: 'IMG2THREEJS' },
    build: { glyph: '⚙', label: 'BUILD' },
    'review-gate': { glyph: '◉', label: 'REVIEW GATE' },
    deliver: { glyph: '➤', label: 'DELIVER' },
  };
  const KIND_ORDER = ['brief', 'asset', 'ffmpeg', 'img2threejs', 'build', 'review-gate', 'deliver'];

  // ---------- state ----------

  let flows = [];
  let currentSlug = null;
  let flow = null; // hydrated current flow from the server
  let camera = { x: 400, y: 260, zoom: 0.5 };
  let altitude = 'mid';
  let selectedNodeId = null;
  let hoveringViewport = false;
  let opsStateRef = null;
  const nodeEls = new Map();
  const clusterEls = new Map();
  const prevStatus = new Map(); // nodeId -> last-seen status, for pulse-on-done detection
  let dragMode = null;
  let dragCtx = null;
  let spaceHeld = false;
  let searchOpen = false;
  let reviewOverlayCard = null;

  function isPaneVisible() {
    return !paneEl.classList.contains('pane-hidden') && !paneEl.classList.contains('pane-collapsed') && viewportEl.offsetParent !== null;
  }

  // ---------- camera ----------

  function screenToWorld(sx, sy) {
    return { x: (sx - camera.x) / camera.zoom, y: (sy - camera.y) / camera.zoom };
  }
  function worldToScreen(wx, wy) {
    return { x: wx * camera.zoom + camera.x, y: wy * camera.zoom + camera.y };
  }

  function applyCameraTransform() {
    worldEl.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    gridFloorEl.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
    updateAltitude();
    updateMinimapView();
    scheduleSaveCamera();
    // clusters live in a screen-space overlay (not scaled by the world
    // transform, so their giant display-caps names stay legible at any
    // zoom) — their positions have to be recomputed on every pan/zoom, not
    // just on an altitude change.
    if (altitude === 'high') renderConstellation();
  }

  const ALT_HIGH = 0.22;
  const ALT_LOW = 0.85;
  const HYSTERESIS = 0.05;
  function updateAltitude() {
    let next = altitude;
    if (altitude === 'high' && camera.zoom > ALT_HIGH + HYSTERESIS) next = 'mid';
    else if (altitude === 'low' && camera.zoom < ALT_LOW - HYSTERESIS) next = 'mid';
    else if (altitude === 'mid') {
      if (camera.zoom <= ALT_HIGH) next = 'high';
      else if (camera.zoom >= ALT_LOW) next = 'low';
    }
    if (next !== altitude) {
      altitude = next;
      viewportEl.dataset.altitude = altitude;
      if (altitudeLabelEl) altitudeLabelEl.textContent = altitude.toUpperCase();
      renderFlow(); // altitude change swaps constellation <-> node rendering
    }
  }

  let saveCameraTimer = null;
  function scheduleSaveCamera() {
    if (!currentSlug) return;
    clearTimeout(saveCameraTimer);
    saveCameraTimer = setTimeout(() => {
      apiFetch('./api/canvas/flow/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: currentSlug, camera }),
      });
    }, 1500);
  }

  // ---------- pan / zoom / inertia ----------

  viewportEl.addEventListener(
    'wheel',
    (e) => {
      if (!flow) return;
      e.preventDefault();
      const rect = viewportEl.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0012);
      const newZoom = clamp(camera.zoom * factor, 0.05, 3.2);
      const worldPt = screenToWorld(cx, cy);
      camera.zoom = newZoom;
      camera.x = cx - worldPt.x * newZoom;
      camera.y = cy - worldPt.y * newZoom;
      applyCameraTransform();
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && hoveringViewport) {
      const tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        spaceHeld = true;
        viewportEl.style.cursor = 'grab';
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
  });

  let panVelocity = { x: 0, y: 0 };
  let panSamples = [];
  let inertiaRaf = null;

  function stopInertia() {
    if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
    inertiaRaf = null;
  }

  function runInertia() {
    stopInertia();
    if (reduced() || (Math.abs(panVelocity.x) < 0.5 && Math.abs(panVelocity.y) < 0.5)) return;
    const step = () => {
      camera.x += panVelocity.x;
      camera.y += panVelocity.y;
      panVelocity.x *= 0.9;
      panVelocity.y *= 0.9;
      applyCameraTransform();
      if (Math.abs(panVelocity.x) > 0.5 || Math.abs(panVelocity.y) > 0.5) {
        inertiaRaf = requestAnimationFrame(step);
      }
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  function nodeElAtPoint(target) {
    return target && target.closest ? target.closest('.canvas-node') : null;
  }
  function portElAtPoint(target) {
    return target && target.closest ? target.closest('.canvas-port') : null;
  }
  function resizeHandleAtPoint(target) {
    return target && target.closest ? target.closest('.canvas-node-resize') : null;
  }
  function eyeAtPoint(target) {
    return target && target.closest ? target.closest('.canvas-node-eye') : null;
  }

  viewportEl.addEventListener('pointerdown', (e) => {
    if (!flow) return;
    // the eye is a plain button, not a drag handle — setPointerCapture()
    // below (via beginMoveNode) retargets the subsequent mouseup/click away
    // from whatever was under the pointer, which would silently swallow the
    // eye's own click handler. Let it behave like a normal button instead.
    if (eyeAtPoint(e.target)) return;
    stopInertia();
    const portEl = portElAtPoint(e.target);
    const resizeEl = resizeHandleAtPoint(e.target);
    const nodeEl = nodeElAtPoint(e.target);

    if (portEl && portEl.classList.contains('port-out')) {
      beginConnect(e, portEl);
      return;
    }
    if (resizeEl && nodeEl) {
      beginResize(e, nodeEl);
      return;
    }
    if (nodeEl && (e.button === 0) && !spaceHeld) {
      beginMoveNode(e, nodeEl);
      return;
    }
    if (e.button === 0 || e.button === 1 || spaceHeld) {
      beginPan(e);
    }
  });

  function beginPan(e) {
    dragMode = 'pan';
    dragCtx = { lastX: e.clientX, lastY: e.clientY };
    panSamples = [];
    viewportEl.classList.add('panning');
    viewportEl.setPointerCapture(e.pointerId);
    closePalette();
  }

  viewportEl.addEventListener('pointermove', (e) => {
    if (dragMode === 'pan') {
      const dx = e.clientX - dragCtx.lastX;
      const dy = e.clientY - dragCtx.lastY;
      camera.x += dx;
      camera.y += dy;
      dragCtx.lastX = e.clientX;
      dragCtx.lastY = e.clientY;
      panSamples.push({ dx, dy });
      if (panSamples.length > 4) panSamples.shift();
      applyCameraTransform();
    } else if (dragMode === 'move-node') {
      const dx = (e.clientX - dragCtx.startClientX) / camera.zoom;
      const dy = (e.clientY - dragCtx.startClientY) / camera.zoom;
      dragCtx.node.x = dragCtx.startX + dx;
      dragCtx.node.y = dragCtx.startY + dy;
      positionNodeEl(dragCtx.el, dragCtx.node);
      renderEdges();
    } else if (dragMode === 'resize-node') {
      const dx = (e.clientX - dragCtx.startClientX) / camera.zoom;
      const dy = (e.clientY - dragCtx.startClientY) / camera.zoom;
      dragCtx.node.w = Math.max(180, dragCtx.startW + dx);
      dragCtx.node.h = Math.max(120, dragCtx.startH + dy);
      positionNodeEl(dragCtx.el, dragCtx.node);
      renderEdges();
    } else if (dragMode === 'connect') {
      const pt = screenToWorld(...screenPointFromEvent(e));
      updateTempEdge(dragCtx.fromPt, pt);
    }
  });

  function screenPointFromEvent(e) {
    const rect = viewportEl.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  viewportEl.addEventListener('pointerup', (e) => {
    if (dragMode === 'pan') {
      viewportEl.classList.remove('panning');
      if (panSamples.length) {
        const avg = panSamples.reduce((a, s) => ({ x: a.x + s.dx, y: a.y + s.dy }), { x: 0, y: 0 });
        panVelocity = { x: avg.x / panSamples.length, y: avg.y / panSamples.length };
        runInertia();
      }
    } else if (dragMode === 'move-node') {
      finishMoveNode();
    } else if (dragMode === 'resize-node') {
      finishResizeNode();
    } else if (dragMode === 'connect') {
      finishConnect(e);
    }
    dragMode = null;
    dragCtx = null;
  });

  viewportEl.addEventListener('mouseenter', () => { hoveringViewport = true; });
  viewportEl.addEventListener('mouseleave', () => { hoveringViewport = false; });
  window.HQCanvasWantsHotkeys = () => hoveringViewport && !!flow;

  viewportEl.addEventListener('dblclick', (e) => {
    if (nodeElAtPoint(e.target)) return;
    const [sx, sy] = screenPointFromEvent(e);
    openPalette(sx, sy, screenToWorld(sx, sy));
  });

  // ---------- node move / resize ----------

  function beginMoveNode(e, el) {
    const node = flow.nodes.find((n) => n.id === el.dataset.nodeId);
    if (!node) return;
    selectNode(node.id);
    dragMode = 'move-node';
    dragCtx = { el, node, startClientX: e.clientX, startClientY: e.clientY, startX: node.x, startY: node.y };
    viewportEl.setPointerCapture(e.pointerId);
  }
  function finishMoveNode() {
    const { node } = dragCtx;
    patchNode(node.id, { x: Math.round(node.x), y: Math.round(node.y) });
  }
  function beginResize(e, el) {
    const node = flow.nodes.find((n) => n.id === el.dataset.nodeId);
    if (!node) return;
    dragMode = 'resize-node';
    dragCtx = { el, node, startClientX: e.clientX, startClientY: e.clientY, startW: node.w, startH: node.h };
    viewportEl.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function finishResizeNode() {
    const { node } = dragCtx;
    patchNode(node.id, { w: Math.round(node.w), h: Math.round(node.h) });
  }

  async function patchNode(nodeId, patch) {
    const result = await apiFetch('./api/canvas/node/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: currentSlug, nodeId, patch }),
    });
    if (result.ok) setFlow(result.body.flow);
    else toast(apiErrorText(result));
  }

  // ---------- edge connect ----------

  let tempEdgePath = null;
  function beginConnect(e, portEl) {
    const nodeEl = portEl.closest('.canvas-node');
    if (!nodeEl) return;
    const node = flow.nodes.find((n) => n.id === nodeEl.dataset.nodeId);
    if (!node) return;
    dragMode = 'connect';
    const fromPt = { x: node.x + node.w, y: node.y + node.h / 2, nodeId: node.id };
    dragCtx = { fromPt };
    tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempEdgePath.setAttribute('class', 'canvas-edge-path dashed');
    edgesSvg.appendChild(tempEdgePath);
    viewportEl.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function updateTempEdge(from, to) {
    if (!tempEdgePath) return;
    tempEdgePath.setAttribute('d', bezierPath(from.x, from.y, to.x, to.y));
  }
  function finishConnect(e) {
    if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
    const portEl = portElAtPoint(e.target);
    if (portEl && portEl.classList.contains('port-in')) {
      const toNodeEl = portEl.closest('.canvas-node');
      const toId = toNodeEl && toNodeEl.dataset.nodeId;
      if (toId && toId !== dragCtx.fromPt.nodeId) {
        createEdge(dragCtx.fromPt.nodeId, toId);
      }
    }
  }
  async function createEdge(from, to) {
    const result = await apiFetch('./api/canvas/edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: currentSlug, edge: { from, to } }),
    });
    if (result.ok) setFlow(result.body.flow);
    else toast(apiErrorText(result));
  }

  // ---------- flow list / load ----------

  async function loadFlows() {
    const result = await apiFetch('./api/canvas/flows');
    if (!result.ok) return;
    flows = result.body.flows;
    renderFlowSelect();
    if (!currentSlug && flows.length) {
      selectFlow(flows[0].slug);
    } else if (!flows.length) {
      emptyEl.hidden = false;
      renderConstellation();
    }
  }

  function renderFlowSelect() {
    if (!flowSelectEl) return;
    flowSelectEl.innerHTML = flows
      .map((f) => `<option value="${escapeHtml(f.slug)}"${f.slug === currentSlug ? ' selected' : ''}>${escapeHtml(f.name)} (${f.nodeCount})</option>`)
      .join('');
  }

  // setFlow() is the one place that actually swaps `flow` and re-renders.
  // resetCamera is true only when the operator deliberately opens a flow
  // (its saved camera IS its "persistent home", per the design spec) — a
  // background refresh (poll, or the result of a local mutation) must never
  // yank the camera out from under whatever the operator is looking at.
  function setFlow(newFlow, opts) {
    opts = opts || {};
    flow = newFlow;
    emptyEl.hidden = true;
    if (opts.resetCamera && flow.camera) {
      camera = { x: flow.camera.x, y: flow.camera.y, zoom: flow.camera.zoom };
      applyCameraTransform();
    }
    renderFlow();
  }

  async function selectFlow(slug) {
    currentSlug = slug;
    const result = await apiFetch(`./api/canvas/flow?slug=${encodeURIComponent(slug)}`);
    if (!result.ok) {
      toast(apiErrorText(result));
      return;
    }
    setFlow(result.body.flow, { resetCamera: true });
    renderFlowSelect();
  }

  async function refreshCurrentFlow() {
    if (!currentSlug) return;
    const result = await apiFetch(`./api/canvas/flow?slug=${encodeURIComponent(currentSlug)}`);
    if (!result.ok) return;
    setFlow(result.body.flow);
  }

  flowSelectEl && flowSelectEl.addEventListener('change', () => selectFlow(flowSelectEl.value));
  newFlowBtn &&
    newFlowBtn.addEventListener('click', async () => {
      const name = window.prompt('New flow name:', 'Untitled flow');
      if (name === null) return;
      const result = await apiFetch('./api/canvas/flow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!result.ok) { toast(apiErrorText(result)); return; }
      await loadFlows();
      selectFlow(result.body.flow.slug);
    });

  // ---------- rendering: dispatch by altitude ----------

  function renderFlow() {
    if (altitude === 'high') {
      clustersEl.style.display = '';
      nodesEl.style.display = 'none';
      edgesSvg.style.display = 'none';
      renderConstellation();
    } else {
      clustersEl.style.display = 'none';
      nodesEl.style.display = '';
      edgesSvg.style.display = '';
      renderNodes();
      renderEdges();
    }
    renderMinimap();
  }

  // ---------- constellation (high altitude) ----------

  function renderConstellation() {
    const seen = new Set();
    let i = 0;
    for (const f of flows) {
      seen.add(f.slug);
      let el = clusterEls.get(f.slug);
      if (!el) {
        el = document.createElement('div');
        el.className = 'canvas-cluster';
        el.innerHTML = '<div class="canvas-cluster-name"></div><div class="canvas-cluster-dot"></div>';
        el.addEventListener('click', () => {
          selectFlow(f.slug);
          camera.zoom = 0.5;
          applyCameraTransform();
        });
        clustersEl.appendChild(el);
        clusterEls.set(f.slug, el);
      }
      el.dataset.status = f.status;
      el.querySelector('.canvas-cluster-name').textContent = f.name;
      // laid out on a simple ring in WORLD space so multiple flows never
      // overlap; a flow's own saved camera (its "persistent home") only
      // matters once you're inside it — spatial memory is about node layout
      // within a flow, the constellation itself is just a glance-able index.
      // Converted to screen space every call since this overlay isn't
      // parented under the zoom-scaled #canvas-world (see the CSS comment).
      const angle = (i / Math.max(1, flows.length)) * Math.PI * 2;
      const radius = 900;
      const worldX = Math.cos(angle) * radius;
      const worldY = Math.sin(angle) * radius * 0.6;
      const screenPt = worldToScreen(worldX, worldY);
      el.style.left = `${screenPt.x}px`;
      el.style.top = `${screenPt.y}px`;
      i += 1;
    }
    for (const [slug, el] of clusterEls) {
      if (!seen.has(slug)) {
        el.remove();
        clusterEls.delete(slug);
      }
    }
  }

  // ---------- nodes (mid/low altitude) ----------

  function escapeHtml(s) {
    return bridge.escapeHtml ? bridge.escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function nodeBodyHtml(node) {
    if (node.kind === 'brief') {
      return `<div class="canvas-node-brief-text">${escapeHtml(node.data.text || '')}</div>`;
    }
    const thumb = node.data.thumbPath;
    if (thumb) {
      return `<img src="./api/canvas/artifact-raw?path=${encodeURIComponent(thumb)}" alt="${escapeHtml(node.name)}" loading="lazy" />`;
    }
    if (node.kind === 'review-gate' && node.data.reviewCard && node.data.reviewCard.shot) {
      return `<img src="./api/review-shot?id=${encodeURIComponent(node.data.reviewCard.id)}&mode=studio" alt="${escapeHtml(node.name)}" loading="lazy" />`;
    }
    const emptyLabel = {
      asset: 'no artifact yet',
      ffmpeg: node.status === 'running' ? 'rendering…' : 'not run yet',
      'img2threejs': node.data.queuedAt ? 'queued for orchestrator' : 'no source yet',
      build: node.data.linkedJob ? `job ${node.data.linkedJob.milestonesDone}/${node.data.linkedJob.milestonesTotal}` : node.data.queuedAt ? 'queued for orchestrator' : 'not dispatched',
      'review-gate': node.data.cardId ? 'awaiting verdict' : 'not opened yet',
      deliver: node.status === 'done' ? 'ready' : 'awaiting upstream approval',
    }[node.kind] || '';
    return `<div class="canvas-node-body-empty">${escapeHtml(emptyLabel)}</div>`;
  }

  function progressRingSvg(pct) {
    const r = 9;
    const c = 2 * Math.PI * r;
    const off = c - (c * clamp(pct, 0, 100)) / 100;
    return `<svg class="canvas-node-progress-ring" viewBox="0 0 22 22"><circle class="track" cx="11" cy="11" r="${r}"/><circle class="fill" cx="11" cy="11" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
  }

  function chipHtml(text) {
    return `<span class="canvas-node-chip">${escapeHtml(text)}</span>`;
  }

  function nodeFooterHtml(node) {
    const chips = [];
    if (node.engine) chips.push(chipHtml(node.engine));
    if (node.kind === 'ffmpeg' && typeof node.data.progress === 'number') chips.push(chipHtml(`${node.data.progress}%`));
    if (node.kind === 'build' && node.data.linkedJob) chips.push(chipHtml(node.data.linkedJob.status || 'queued'));
    if (node.data.durationSec) chips.push(chipHtml(`${node.data.durationSec}s`));
    chips.push(chipHtml(node.status));
    return `<div class="canvas-node-footer">${chips.join('')}</div>`;
  }

  function hasEye(node) {
    return node.kind === 'review-gate' && !!node.data.cardId;
  }

  function positionNodeEl(el, node) {
    el.style.transform = `translate(${node.x}px, ${node.y}px)`;
    el.style.width = `${node.w}px`;
    el.style.height = `${node.h}px`;
  }

  function nodeInViewport(node) {
    const rect = viewportEl.getBoundingClientRect();
    const pad = 400;
    const tl = { x: node.x * camera.zoom + camera.x, y: node.y * camera.zoom + camera.y };
    const br = { x: tl.x + node.w * camera.zoom, y: tl.y + node.h * camera.zoom };
    return br.x >= -pad && tl.x <= rect.width + pad && br.y >= -pad && tl.y <= rect.height + pad;
  }

  function renderNodes() {
    if (!flow) {
      nodeEls.forEach((el) => el.remove());
      nodeEls.clear();
      return;
    }
    const seen = new Set();
    for (const node of flow.nodes) {
      seen.add(node.id);
      const visible = nodeInViewport(node);
      let el = nodeEls.get(node.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'canvas-node';
        el.dataset.nodeId = node.id;
        el.addEventListener('click', (e) => {
          if (e.target.closest('.canvas-node-eye')) {
            openReviewOverlay(node.id);
            return;
          }
          if (dragMode) return;
          selectNode(node.id);
        });
        nodesEl.appendChild(el);
        nodeEls.set(node.id, el);
      }
      el.classList.toggle('placeholder', !visible);
      el.classList.toggle('selected', node.id === selectedNodeId);
      el.dataset.kind = node.kind;
      el.dataset.status = node.status;
      positionNodeEl(el, node);
      if (visible) {
        const meta = KIND_META[node.kind] || { glyph: '?', label: node.kind };
        const ring = node.kind === 'ffmpeg' && node.status === 'running' && typeof node.data.progress === 'number' ? progressRingSvg(node.data.progress) : '';
        el.innerHTML = `
          <div class="canvas-node-header">
            <span class="canvas-node-glyph" title="${escapeHtml(meta.label)}">${meta.glyph}</span>
            <span class="canvas-node-name">${escapeHtml(node.name)}</span>
            ${hasEye(node) ? '<button type="button" class="canvas-node-eye" title="Open review">&#128065;</button>' : ''}
          </div>
          <div class="canvas-node-body">${nodeBodyHtml(node)}${ring}</div>
          ${nodeFooterHtml(node)}
          <span class="canvas-port port-in"></span>
          <span class="canvas-port port-out"></span>
          <span class="canvas-node-resize" aria-hidden="true"></span>
        `;
      } else {
        el.innerHTML = `<span class="canvas-node-glyph">${(KIND_META[node.kind] || {}).glyph || '?'}</span>`;
      }

      // acid pulse along outbound edges the instant a node flips to done
      const last = prevStatus.get(node.id);
      if (last && last !== 'done' && node.status === 'done') {
        flow.edges.filter((e) => e.from === node.id).forEach((e) => pulseEdgeSoon(e.id));
      }
      prevStatus.set(node.id, node.status);
    }
    for (const [id, el] of nodeEls) {
      if (!seen.has(id)) {
        el.remove();
        nodeEls.delete(id);
        prevStatus.delete(id);
      }
    }
  }

  function selectNode(nodeId) {
    selectedNodeId = nodeId;
    nodeEls.forEach((el, id) => el.classList.toggle('selected', id === nodeId));
    renderInspector();
  }

  // ---------- edges ----------

  function bezierPath(x1, y1, x2, y2) {
    const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  function renderEdges() {
    if (!flow) {
      edgesSvg.innerHTML = '';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const edge of flow.edges) {
      const from = flow.nodes.find((n) => n.id === edge.from);
      const to = flow.nodes.find((n) => n.id === edge.to);
      if (!from || !to) continue;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', `canvas-edge-${edge.id}`);
      path.setAttribute('class', `canvas-edge-path${edge.dashed ? ' dashed' : ''}`);
      path.setAttribute('d', bezierPath(from.x + from.w, from.y + from.h / 2, to.x, to.y + to.h / 2));
      frag.appendChild(path);
    }
    edgesSvg.innerHTML = '';
    edgesSvg.appendChild(frag);
  }

  const hasGsapMotion = () => window.gsap && window.MotionPathPlugin;
  if (hasGsapMotion()) gsap.registerPlugin(MotionPathPlugin);

  function pulseEdgeSoon(edgeId) {
    // let the just-rebuilt <path> land in the DOM first
    requestAnimationFrame(() => pulseEdge(edgeId));
  }
  function pulseEdge(edgeId) {
    if (reduced() || !hasGsapMotion()) return;
    const path = document.getElementById(`canvas-edge-${edgeId}`);
    if (!path) return;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('class', 'canvas-edge-pulse-dot');
    dot.setAttribute('r', '4');
    edgesSvg.appendChild(dot);
    gsap.to(dot, {
      motionPath: { path: `#canvas-edge-${edgeId}`, align: `#canvas-edge-${edgeId}`, alignOrigin: [0.5, 0.5] },
      duration: 1.1,
      ease: 'none',
      onComplete: () => dot.remove(),
    });
  }

  // ---------- minimap ----------

  function flowBounds() {
    if (!flow || !flow.nodes.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 700 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    flow.nodes.forEach((n) => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    return { minX: minX - 100, minY: minY - 100, maxX: maxX + 100, maxY: maxY + 100 };
  }

  function renderMinimap() {
    if (!minimapDotsEl) return;
    minimapDotsEl.innerHTML = '';
    if (!flow) return;
    const b = flowBounds();
    const w = b.maxX - b.minX || 1;
    const h = b.maxY - b.minY || 1;
    const mapRect = minimapDotsEl.parentElement.getBoundingClientRect();
    flow.nodes.forEach((n) => {
      const dot = document.createElement('div');
      dot.className = 'canvas-minimap-dot' + (n.status === 'running' ? ' running' : n.status === 'awaiting' ? ' awaiting' : '');
      dot.style.left = `${((n.x - b.minX) / w) * mapRect.width}px`;
      dot.style.top = `${((n.y - b.minY) / h) * mapRect.height}px`;
      minimapDotsEl.appendChild(dot);
    });
    updateMinimapView();
  }

  function updateMinimapView() {
    if (!minimapViewEl || !flow) return;
    const b = flowBounds();
    const w = b.maxX - b.minX || 1;
    const h = b.maxY - b.minY || 1;
    const mapRect = minimapViewEl.parentElement.getBoundingClientRect();
    const rect = viewportEl.getBoundingClientRect();
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(rect.width, rect.height);
    minimapViewEl.style.left = `${clamp(((topLeft.x - b.minX) / w) * mapRect.width, 0, mapRect.width)}px`;
    minimapViewEl.style.top = `${clamp(((topLeft.y - b.minY) / h) * mapRect.height, 0, mapRect.height)}px`;
    minimapViewEl.style.width = `${Math.max(4, ((bottomRight.x - topLeft.x) / w) * mapRect.width)}px`;
    minimapViewEl.style.height = `${Math.max(4, ((bottomRight.y - topLeft.y) / h) * mapRect.height)}px`;
  }

  const minimapEl = document.getElementById('canvas-minimap');
  if (minimapEl) {
    let draggingMinimap = false;
    const panTo = (e) => {
      const b = flowBounds();
      const mapRect = minimapEl.getBoundingClientRect();
      const rect = viewportEl.getBoundingClientRect();
      const fx = (e.clientX - mapRect.left) / mapRect.width;
      const fy = (e.clientY - mapRect.top) / mapRect.height;
      const worldX = b.minX + fx * (b.maxX - b.minX);
      const worldY = b.minY + fy * (b.maxY - b.minY);
      camera.x = rect.width / 2 - worldX * camera.zoom;
      camera.y = rect.height / 2 - worldY * camera.zoom;
      applyCameraTransform();
    };
    minimapEl.addEventListener('pointerdown', (e) => { draggingMinimap = true; panTo(e); minimapEl.setPointerCapture(e.pointerId); });
    minimapEl.addEventListener('pointermove', (e) => { if (draggingMinimap) panTo(e); });
    minimapEl.addEventListener('pointerup', () => { draggingMinimap = false; });
  }

  // ---------- kind palette ----------

  function closePalette() {
    if (paletteEl) paletteEl.hidden = true;
  }
  function openPalette(screenX, screenY, worldPt) {
    if (!flow || !paletteEl) return;
    paletteEl.style.left = `${screenX}px`;
    paletteEl.style.top = `${screenY}px`;
    paletteEl.innerHTML = KIND_ORDER.map(
      (k) => `<button type="button" class="canvas-palette-item" data-kind="${k}"><span class="canvas-node-glyph">${KIND_META[k].glyph}</span>${KIND_META[k].label}</button>`
    ).join('');
    paletteEl.hidden = false;
    paletteEl.querySelectorAll('.canvas-palette-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.kind;
        closePalette();
        const result = await apiFetch('./api/canvas/node', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: currentSlug, node: { kind, name: KIND_META[kind].label, x: Math.round(worldPt.x), y: Math.round(worldPt.y) } }),
        });
        if (result.ok) setFlow(result.body.flow);
        else toast(apiErrorText(result));
      });
    });
  }
  document.addEventListener('click', (e) => {
    if (paletteEl && !paletteEl.hidden && !e.target.closest('#canvas-palette')) closePalette();
  });

  // ---------- inspector ----------

  function renderInspector() {
    if (!inspectorEl) return;
    const node = flow && flow.nodes.find((n) => n.id === selectedNodeId);
    if (!node) { inspectorEl.hidden = true; return; }
    inspectorEl.hidden = false;
    const meta = KIND_META[node.kind] || { label: node.kind };
    let body = '';
    if (node.kind === 'brief') {
      body = `<textarea id="canvas-insp-brief" rows="8">${escapeHtml(node.data.text || '')}</textarea>
        <button type="button" class="canvas-btn" id="canvas-insp-save-brief">SAVE</button>`;
    } else if (node.kind === 'asset') {
      body = `<input type="file" id="canvas-insp-upload" accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.mkv" />
        <p style="font-size:10px;color:var(--ink-faint)">or generate a synthetic test clip:</p>
        <button type="button" class="canvas-btn" id="canvas-insp-gen-testsrc">GENERATE TESTSRC (5s)</button>`;
    } else if (node.kind === 'ffmpeg') {
      body = `<button type="button" class="canvas-btn" id="canvas-insp-trim">RUN: TRIM 3s + 720p WEBM</button>
        <button type="button" class="canvas-btn" id="canvas-insp-thumb">RUN: THUMBNAIL</button>
        ${typeof node.data.progress === 'number' ? `<p style="font-size:10px;color:var(--acid)">${node.data.progress}%</p>` : ''}`;
    } else if (node.kind === 'img2threejs') {
      body = `<button type="button" class="canvas-btn" id="canvas-insp-i2t">QUEUE DISPATCH</button>
        <p style="font-size:10px;color:var(--ink-faint)">writes a request to jobs/queue/ for the orchestrator — never auto-run here.</p>`;
    } else if (node.kind === 'build') {
      body = `<textarea id="canvas-insp-prompt" rows="4" placeholder="dispatch prompt&hellip;">${escapeHtml(node.data.prompt || '')}</textarea>
        <button type="button" class="canvas-btn" id="canvas-insp-dispatch">QUEUE BUILD DISPATCH</button>
        <input type="text" id="canvas-insp-joblink" placeholder="link jobs/&lt;slug&gt;.md" value="${escapeHtml(node.data.jobSlug || '')}" />
        <button type="button" class="canvas-btn" id="canvas-insp-link">LINK JOB</button>`;
    } else if (node.kind === 'review-gate') {
      body = node.data.cardId
        ? `<p style="font-size:10px;color:var(--amber)">card: ${escapeHtml(node.data.cardId)} — ${escapeHtml(node.status)}</p>
           <button type="button" class="canvas-btn" id="canvas-insp-open-eye">OPEN REVIEW</button>`
        : `<input type="text" id="canvas-insp-gate-title" placeholder="title" value="${escapeHtml(flow.name)} — ${escapeHtml(node.name)}" />
           <textarea id="canvas-insp-gate-note" rows="3" placeholder="what should Zoh look at?"></textarea>
           <button type="button" class="canvas-btn" id="canvas-insp-gate-open">OPEN REVIEW GATE</button>`;
    } else if (node.kind === 'deliver') {
      body = `<p style="font-size:10px;color:${node.status === 'done' ? 'var(--acid)' : 'var(--ink-faint)'}">${node.status === 'done' ? 'ready for handoff' : 'awaiting upstream approval'}</p>
        <a class="canvas-btn" style="display:inline-block;text-decoration:none" target="_blank" href="./api/canvas/deliver?slug=${encodeURIComponent(currentSlug)}&node=${encodeURIComponent(node.id)}">OPEN HANDOFF PAGE</a>`;
    }
    inspectorEl.innerHTML = `<button type="button" class="canvas-inspector-close">&#10005;</button>
      <h3>${escapeHtml(meta.label)} &mdash; ${escapeHtml(node.name)}</h3>
      <input type="text" id="canvas-insp-name" value="${escapeHtml(node.name)}" />
      ${body}
      <button type="button" class="canvas-btn" id="canvas-insp-delete" style="color:var(--red);border-color:var(--red-dim)">DELETE NODE</button>`;

    inspectorEl.querySelector('.canvas-inspector-close').addEventListener('click', () => selectNode(null));
    const nameInput = inspectorEl.querySelector('#canvas-insp-name');
    nameInput.addEventListener('change', () => patchNode(node.id, { name: nameInput.value }));
    inspectorEl.querySelector('#canvas-insp-delete').addEventListener('click', async () => {
      if (!window.confirm(`Delete "${node.name}"?`)) return;
      const result = await apiFetch('./api/canvas/node/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: currentSlug, nodeId: node.id }),
      });
      if (result.ok) { selectedNodeId = null; setFlow(result.body.flow); }
      else toast(apiErrorText(result));
    });

    if (node.kind === 'brief') {
      inspectorEl.querySelector('#canvas-insp-save-brief').addEventListener('click', () => {
        patchNode(node.id, { text: inspectorEl.querySelector('#canvas-insp-brief').value });
      });
    } else if (node.kind === 'asset') {
      inspectorEl.querySelector('#canvas-insp-upload').addEventListener('change', (e) => uploadAsset(node.id, e.target.files[0]));
      inspectorEl.querySelector('#canvas-insp-gen-testsrc').addEventListener('click', () => runFfmpegNode(node.id, 'generate-testsrc', { durationSec: 5 }));
    } else if (node.kind === 'ffmpeg') {
      inspectorEl.querySelector('#canvas-insp-trim').addEventListener('click', () => runFfmpegNode(node.id, 'trim-transcode', { durationSec: 3 }));
      inspectorEl.querySelector('#canvas-insp-thumb').addEventListener('click', () => runFfmpegNode(node.id, 'thumbnail', {}));
    } else if (node.kind === 'img2threejs') {
      inspectorEl.querySelector('#canvas-insp-i2t').addEventListener('click', async () => {
        const result = await apiFetch('./api/canvas/node/img2threejs-dispatch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: currentSlug, nodeId: node.id }),
        });
        if (result.ok) setFlow(result.body.flow); else toast(apiErrorText(result));
      });
    } else if (node.kind === 'build') {
      inspectorEl.querySelector('#canvas-insp-dispatch').addEventListener('click', async () => {
        const prompt = inspectorEl.querySelector('#canvas-insp-prompt').value;
        const result = await apiFetch('./api/canvas/node/build-dispatch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: currentSlug, nodeId: node.id, prompt }),
        });
        if (result.ok) { setFlow(result.body.flow); toast('BUILD queued for the orchestrator'); } else toast(apiErrorText(result));
      });
      inspectorEl.querySelector('#canvas-insp-link').addEventListener('click', async () => {
        const jobSlug = inspectorEl.querySelector('#canvas-insp-joblink').value;
        const result = await apiFetch('./api/canvas/node/build-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: currentSlug, nodeId: node.id, jobSlug }),
        });
        if (result.ok) setFlow(result.body.flow); else toast(apiErrorText(result));
      });
    } else if (node.kind === 'review-gate') {
      if (node.data.cardId) {
        inspectorEl.querySelector('#canvas-insp-open-eye').addEventListener('click', () => openReviewOverlay(node.id));
      } else {
        inspectorEl.querySelector('#canvas-insp-gate-open').addEventListener('click', async () => {
          const title = inspectorEl.querySelector('#canvas-insp-gate-title').value;
          const note = inspectorEl.querySelector('#canvas-insp-gate-note').value;
          const result = await apiFetch('./api/canvas/node/review-gate-open', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: currentSlug, nodeId: node.id, title, note }),
          });
          if (result.ok) { setFlow(result.body.flow); toast('Review gate opened — Zoh will see it in ..//review'); } else toast(apiErrorText(result));
        });
      }
    }
  }

  async function uploadAsset(nodeId, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataBase64 = String(reader.result).split(',')[1] || '';
      const result = await apiFetch('./api/canvas/node/asset-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: currentSlug, nodeId, filename: file.name, dataBase64 }),
      });
      if (result.ok) setFlow(result.body.flow);
      else toast(apiErrorText(result));
    };
    reader.readAsDataURL(file);
  }

  // A short burst of extra refreshes right after kicking off a real ffmpeg
  // process — waiting on app.js's ambient 5s poll alone would leave the
  // status ring frozen on "idle" for up to 5s after the operator's own
  // click, and a quick op could even finish inside that window unseen.
  function fastPollBurst() {
    [400, 900, 1600, 2600, 4000].forEach((ms) => {
      setTimeout(() => {
        if (currentSlug && isPaneVisible() && !dragMode) refreshCurrentFlow();
      }, ms);
    });
  }

  async function runFfmpegNode(nodeId, op, params) {
    const result = await apiFetch('./api/canvas/node/ffmpeg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: currentSlug, nodeId, op, params }),
    });
    if (!result.ok) { toast(apiErrorText(result)); return; }
    toast(`${op} started`);
    fastPollBurst();
  }

  // ---------- review overlay (the EYE — reuses the v0.16 composer wholesale) ----------

  function openReviewOverlay(nodeId) {
    const node = flow.nodes.find((n) => n.id === nodeId);
    const cardId = node && node.data.cardId;
    if (!cardId || !reviewOverlayEl || !window.HQReviewBridge) return;
    const card = window.HQReviewBridge.findCard(cardId) || (node.data.reviewCard ? { ...node.data.reviewCard } : null);
    if (!card) { toast('review card not found in current state yet'); return; }
    reviewOverlayCard = cardId;
    reviewOverlayBodyEl.innerHTML = window.HQReviewBridge.cardHtml(card);
    reviewOverlayEl.hidden = false;
  }
  if (reviewOverlayBodyEl && window.HQReviewBridge) window.HQReviewBridge.wire('canvas-review-overlay-body');
  if (reviewOverlayCloseBtn) reviewOverlayCloseBtn.addEventListener('click', () => { reviewOverlayEl.hidden = true; reviewOverlayCard = null; });
  if (reviewOverlayEl) reviewOverlayEl.addEventListener('click', (e) => { if (e.target === reviewOverlayEl) { reviewOverlayEl.hidden = true; reviewOverlayCard = null; } });

  // ---------- viewpoints (1-9 recall, shift+1-9 save) + search (/) + F frame ----------

  function viewpointKey() {
    return `hq-history-console-canvas-viewpoints-v1::${currentSlug}`;
  }
  function loadViewpoints() {
    try { return JSON.parse(localStorage.getItem(viewpointKey()) || '{}'); } catch { return {}; }
  }
  function saveViewpoint(slot) {
    const vps = loadViewpoints();
    vps[slot] = { ...camera };
    try { localStorage.setItem(viewpointKey(), JSON.stringify(vps)); } catch { /* private mode tolerance */ }
    toast(`viewpoint ${slot} saved`);
  }
  function recallViewpoint(slot) {
    const vps = loadViewpoints();
    const vp = vps[slot];
    if (!vp) return;
    flyCameraTo(vp.x, vp.y, vp.zoom);
  }

  function flyCameraTo(x, y, zoom) {
    if (reduced() || typeof gsap === 'undefined') {
      camera = { x, y, zoom };
      applyCameraTransform();
      return;
    }
    gsap.to(camera, { x, y, zoom, duration: 0.5, ease: houseEase, onUpdate: applyCameraTransform });
  }

  function frameNodes(nodes) {
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    const rect = viewportEl.getBoundingClientRect();
    const pad = 80;
    const zoom = clamp(Math.min(rect.width / (maxX - minX + pad * 2), rect.height / (maxY - minY + pad * 2)), 0.05, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    flyCameraTo(rect.width / 2 - cx * zoom, rect.height / 2 - cy * zoom, zoom);
  }

  document.addEventListener('keydown', (e) => {
    if (!hoveringViewport || !flow) return;
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'f' || e.key === 'F') {
      const selected = flow.nodes.filter((n) => n.id === selectedNodeId);
      frameNodes(selected.length ? selected : flow.nodes);
    } else if (e.key === '/') {
      e.preventDefault();
      openSearch();
    } else if (e.key >= '1' && e.key <= '9') {
      const slot = e.key;
      if (e.shiftKey) saveViewpoint(slot);
      else recallViewpoint(slot);
    }
  });

  function openSearch() {
    if (!searchInputEl) return;
    searchOpen = true;
    searchInputEl.hidden = false;
    searchInputEl.value = '';
    searchInputEl.focus();
  }
  function closeSearch() {
    searchOpen = false;
    if (searchInputEl) searchInputEl.hidden = true;
  }
  if (searchInputEl) {
    searchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSearch(); return; }
      if (e.key !== 'Enter') return;
      const q = searchInputEl.value.trim().toLowerCase();
      if (!q) { closeSearch(); return; }
      const nodeMatch = flow && flow.nodes.find((n) => n.name.toLowerCase().includes(q));
      if (nodeMatch) {
        frameNodes([nodeMatch]);
        closeSearch();
        return;
      }
      const flowMatch = flows.find((f) => f.name.toLowerCase().includes(q));
      if (flowMatch) {
        selectFlow(flowMatch.slug);
        closeSearch();
        return;
      }
      toast('no match');
    });
  }

  // ---------- NOW-RUNNING dock ----------

  async function refreshNowDock() {
    if (!nowDockEl || !isPaneVisible()) return;
    const result = await apiFetch('./api/canvas/now');
    const ffmpegJobs = (result.ok && result.body.ffmpegJobs) || [];
    const jobsFromOps = (opsStateRef && opsStateRef.jobs) || [];
    const running = jobsFromOps.filter((j) => j.status === 'running' || j.status === 'verifying');
    const units = (opsStateRef && opsStateRef.orchestration && opsStateRef.orchestration.units.filter((u) => u.active)) || [];

    const chips = [];
    ffmpegJobs.forEach((j) => chips.push({ label: `FFMPEG ${j.op} ${j.pct}%`, slug: j.slug, nodeId: j.nodeId }));
    running.forEach((j) => chips.push({ label: `${(j.status || '').toUpperCase()} ${j.title || j.slug}`, jobSlug: j.slug }));
    units.forEach((u) => chips.push({ label: `orchestration: ${u.name}` }));

    if (!chips.length) {
      nowDockEl.innerHTML = '<span class="canvas-now-empty">all quiet on the floor</span>';
      return;
    }
    nowDockEl.innerHTML = chips
      .map((c, i) => `<button type="button" class="canvas-now-chip" data-chip="${i}"><span class="dot"></span>${escapeHtml(c.label)}</button>`)
      .join('');
    nowDockEl.querySelectorAll('.canvas-now-chip').forEach((btn, i) => {
      btn.addEventListener('click', async () => {
        const c = chips[i];
        if (c.slug) {
          if (c.slug !== currentSlug) await selectFlow(c.slug);
          const n = flow && flow.nodes.find((nn) => nn.id === c.nodeId);
          if (n) { camera.zoom = 0.9; applyCameraTransform(); frameNodes([n]); }
        }
      });
    });
  }

  // ---------- ops-state hook (from app.js's poll) ----------

  window.HQCanvas = {
    onState(state) {
      opsStateRef = { jobs: state.jobs, orchestration: state.orchestration };
      refreshNowDock();
      // Piggybacks on app.js's own 5s poll rather than running a second
      // timer — a review card's verdict (or an ffmpeg job finishing) can
      // flip a gate/node's status between polls, so re-fetching the
      // current flow here keeps gate/edge dash state and progress rings
      // from ever going stale while this pane is actually visible. Skipped
      // mid-drag so a background refresh never yanks a node back to its
      // last-saved position while the operator is still moving it.
      if (currentSlug && isPaneVisible() && !dragMode) refreshCurrentFlow();
    },
  };

  // ---------- boot ----------

  applyCameraTransform();
  loadFlows();
  refreshNowDock();
})();
