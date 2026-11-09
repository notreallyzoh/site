(() => {
  'use strict';

  const POLL_MS = 5000;
  const HOUR_PX = 46;
  const GREEN_RAMP = ['var(--phosphor)', 'var(--phosphor-dim)', 'var(--phosphor-dim2)', 'var(--ink-dim)'];

  let lastState = null;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ---------- PERSONAL MODE (press 0): studio <-> personal ----------
  // data-mode is set on <html> pre-paint by an inline script in index.html's
  // <head> (same synchronous-read-before-paint technique as the scene zero
  // gate) — here we only read that initial value back out; every change
  // from here on is owned by setMode() further below (near the readout
  // controls, where PANES/renderRail/playMotif etc. are already in scope).
  const MODE_KEY = 'hq-history-console-mode-v1';
  function loadMode() {
    try {
      return localStorage.getItem(MODE_KEY) === 'personal' ? 'personal' : 'studio';
    } catch {
      return 'studio';
    }
  }
  function saveMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // private mode / quota tolerance, same as every other persisted key here
    }
  }
  let currentMode = document.documentElement.getAttribute('data-mode') === 'personal' ? 'personal' : loadMode();

  // ---------- motion toolkit (choreography pass v0.11) ----------
  // Two eases, cast like actors (web-animation law #1): houseEase (expo-out)
  // is the information ease, used everywhere by default — sculpture morph,
  // NOW strip/jam word-reveals, scene zero. playEase adds a subtle ~1.01x
  // overshoot and is reserved ONLY for playful moments: loadout switches,
  // pane summon from the rail, review card arrival. Mixing them elsewhere
  // is the "easing salad" anti-pattern the skill warns against.

  function cubicBezierEase(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const dx = sampleX(t) - x;
        const d = sampleDX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= dx / d;
      }
      return sampleY(clamp(t, 0, 1));
    };
  }
  const houseEase = cubicBezierEase(0.16, 1, 0.3, 1); // expo-out, --ease in CSS
  const playEase = cubicBezierEase(0.3, 1.2, 0.6, 1); // ~1.01x overshoot, --ease-play in CSS

  // Split-text atom (web-animation law #2), hand-rolled — no SplitText
  // plugin loaded. Char split is cached per element (pane titles are
  // static, so the DOM surgery happens once and every re-summon just
  // re-animates the same spans); word split is cheap and re-run fresh
  // each time since its source text changes every render.
  const charSplitCache = new WeakMap();
  function splitTextNode(node, mode, out) {
    const text = node.textContent;
    if (!text) return;
    const frag = document.createDocumentFragment();
    if (mode === 'char') {
      Array.from(text).forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = ch === ' ' ? ' ' : ch;
        frag.appendChild(span);
        out.push(span);
      });
    } else {
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const span = document.createElement('span');
        span.className = 'wd';
        span.textContent = part;
        frag.appendChild(span);
        out.push(span);
      });
    }
    node.parentNode.replaceChild(frag, node);
  }
  function splitInto(root, mode, skipClass) {
    const out = [];
    function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) splitTextNode(child, mode, out);
        else if (child.nodeType === Node.ELEMENT_NODE && !(skipClass && child.classList.contains(skipClass))) walk(child);
      });
    }
    walk(root);
    return out;
  }
  // pane titles: split once, cache the spans, reuse on every future summon/switch
  function getTitleChars(h2) {
    if (charSplitCache.has(h2)) return charSplitCache.get(h2);
    const chars = splitInto(h2, 'char', 'cursor');
    charSplitCache.set(h2, chars);
    return chars;
  }
  // NOW strip / jam transcript: content regenerates every render, so split fresh
  function splitWordsFresh(root) {
    return splitInto(root, 'word', null);
  }

  // ---------- Telegram Mini App readiness ----------

  let tg = null;
  function initTelegram() {
    if (!(window.Telegram && window.Telegram.WebApp)) return;
    tg = window.Telegram.WebApp;
    try {
      tg.ready();
      tg.expand && tg.expand();
      applyThemeParams(tg.themeParams);
      tg.onEvent && tg.onEvent('themeChanged', () => applyThemeParams(tg.themeParams));
    } catch {
      // outside a real Telegram client this can no-op or throw quietly; never block the console
    }
  }

  function applyThemeParams(theme) {
    if (!theme) return;
    const root = document.documentElement.style;
    if (theme.bg_color) root.setProperty('--bg', theme.bg_color);
    if (theme.text_color) root.setProperty('--ink', theme.text_color);
    if (theme.hint_color) root.setProperty('--ink-dim', theme.hint_color);
  }

  function tgInitDataHeader() {
    return tg && tg.initData ? { 'X-Telegram-Init-Data': tg.initData } : {};
  }

  // ---------- shared fetch wrapper: no silent failures ----------

  // Every fetch in this file goes through here. Network failures (fetch
  // itself throwing) and non-OK responses both resolve (never reject) to
  // the same shape so callers never need a second try/catch — status 0
  // marks "never reached the server" vs. a real HTTP status.
  async function apiFetch(url, opts) {
    let res;
    try {
      res = await fetch(url, opts);
    } catch {
      return { ok: false, status: 0, statusText: 'network error', body: null };
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, body };
  }

  function apiErrorText(result) {
    const detail = result.body && (result.body.message || result.body.error);
    if (result.status === 0) return detail || 'network error reaching hq-app';
    return detail ? `${detail} (HTTP ${result.status})` : `request failed (HTTP ${result.status} ${result.statusText || ''})`.trim();
  }

  function showPaneToast(toastId, message) {
    const toast = document.getElementById(toastId);
    if (!toast) return;
    const textEl = toast.querySelector('.pane-toast-text');
    if (textEl) textEl.textContent = message;
    toast.classList.add('visible');
  }

  function hidePaneToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) toast.classList.remove('visible');
  }

  document.querySelectorAll('.pane-toast-close').forEach((btn) => {
    btn.addEventListener('click', () => hidePaneToast(btn.dataset.toastClose));
  });

  // ---------- stale-client killer (version handshake) ----------

  const staleBanner = document.getElementById('stale-banner');
  const staleBannerText = document.getElementById('stale-banner-text');
  const staleReloadBtn = document.getElementById('stale-banner-reload');
  let knownAppVersion = null;
  let staleDetected = false;

  // Any live text input with content in it counts as "don't yank this
  // page out from under the operator" — covers the concierge message box
  // today and any future in-pane text field (a review note input, etc.)
  // without needing a per-field allowlist.
  function hasInProgressInput() {
    const fields = document.querySelectorAll('input[type="text"], textarea');
    for (const el of fields) {
      if (el.value && el.value.trim()) return true;
    }
    return false;
  }

  function showStaleBanner() {
    staleBanner.hidden = false;
    if (hasInProgressInput()) {
      staleBannerText.textContent = 'NEW BUILD DETECTED — RELOAD WHEN READY';
      staleReloadBtn.hidden = false;
    } else {
      staleBannerText.textContent = 'NEW BUILD DETECTED — RELOADING';
      staleReloadBtn.hidden = true;
      setTimeout(() => location.reload(), 2000);
    }
  }

  staleReloadBtn.addEventListener('click', () => location.reload());

  function checkAppVersion(version) {
    if (typeof version !== 'number' || staleDetected) return;
    if (knownAppVersion === null) {
      knownAppVersion = version;
      return;
    }
    if (version !== knownAppVersion) {
      staleDetected = true;
      showStaleBanner();
    }
  }

  // ---------- polling ----------

  const tickEl = document.getElementById('tick');
  const updatedEl = document.getElementById('updated');
  const liveDot = document.getElementById('live-dot');

  async function poll() {
    const result = await apiFetch('./api/state?mode=' + currentMode, { headers: tgInitDataHeader(), cache: 'no-store' });
    if (!result.ok) {
      if (result.status === 401) {
        goToLogin();
        return;
      }
      updatedEl.textContent = 'connection lost — ' + apiErrorText(result);
      liveDot.style.background = 'var(--danger)';
      return;
    }
    checkAppVersion(result.body && result.body.appVersion);
    render(result.body);
    liveDot.style.background = '';
    flashTick();
  }

  function flashTick() {
    tickEl.classList.add('pulse');
    setTimeout(() => tickEl.classList.remove('pulse'), 220);
  }

  // ..//fuel: {tank} polls on its own 60s cadence (server-side cached at
  // the same interval in lib/fuel.js) rather than riding the 5s state
  // poll — a 401 here just waits for the next tick; the main poll() above
  // already owns the login redirect.
  const FUEL_POLL_MS = 60000;
  async function pollFuel() {
    const result = await apiFetch('./api/fuel', { headers: tgInitDataHeader(), cache: 'no-store' });
    if (!result.ok) return;
    renderFuel(result.body);
  }

  // ..//rnd: {learnings} — same own-cadence shape as pollFuel above, its
  // own 120s poll (server-side cached at the same interval in lib/rnd.js).
  const RND_POLL_MS = 120000;
  async function pollRnd() {
    const result = await apiFetch('./api/rnd', { headers: tgInitDataHeader(), cache: 'no-store' });
    if (!result.ok) return;
    renderRnd(result.body);
  }

  function relativeTime(iso) {
    return iso ? new Date(iso).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : 'not archived';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return s + 's ago';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.round(m / 60) + 'h ago';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- render: AI credits ----------

  function nextUtcResetLabel() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const ms = next.getTime() - now.getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `resets ~${h}h ${m}m (UTC daily, est.)`;
  }

  function setAgentChip(chipId, active) {
    const chip = document.getElementById(chipId);
    if (!chip) return;
    chip.classList.toggle('good', active);
    chip.classList.toggle('off', !active);
    const dot = chip.querySelector('.roster-dot');
    if (dot) {
      dot.classList.toggle('good', active);
      dot.classList.toggle('off', !active);
    }
  }

  function renderAgentsActive(agentsActive) {
    const a = agentsActive || { hermesGateway: false, claudeWorkers: 0, geminiAuthed: false, total: 0 };
    setAgentChip('agent-chip-hermes', a.hermesGateway);
    setAgentChip('agent-chip-claude', a.claudeWorkers > 0);
    document.getElementById('agent-claude-count').textContent = `·${a.claudeWorkers}`;
    setAgentChip('agent-chip-gemini', a.geminiAuthed);
    document.getElementById('agents-active-total').textContent = `${a.total}/3 online`;
  }

  function renderClaudeCode(claudeCode) {
    const engineEl = document.getElementById('cc-engine');
    const modelEl = document.getElementById('cc-model');
    const jobsEl = document.getElementById('cc-jobs');
    const procEl = document.getElementById('cc-processes');
    if (!claudeCode) {
      engineEl.textContent = 'Claude Max subscription';
      modelEl.textContent = 'model: —';
      jobsEl.textContent = '0 jobs today';
      procEl.textContent = '0 processes running';
      return;
    }
    engineEl.textContent = claudeCode.engine;
    modelEl.textContent = `model: ${claudeCode.model}`;
    // jobsToday is jobs/*.md files dated today, not filtered by owner — a
    // proxy for "claude-code jobs" (job files don't record which engine
    // actually did the work), labeled honestly rather than passed off as exact.
    jobsEl.textContent = `${claudeCode.jobsToday} job${claudeCode.jobsToday === 1 ? '' : 's'} today (proxy)`;
    jobsEl.title = 'proxy: jobs/*.md files dated today, not filtered by owner';
    procEl.textContent = `${claudeCode.processCount} process${claudeCode.processCount === 1 ? '' : 'es'} running`;
  }

  function renderOpenRouter(openrouter) {
    const bal = document.getElementById('or-balance');
    const daily = document.getElementById('or-daily');
    if (!openrouter) {
      bal.textContent = 'balance: unavailable';
      daily.textContent = 'spent today: --';
      return;
    }
    bal.textContent = `balance: $${openrouter.balance.toFixed(2)}`;
    daily.textContent = `spent today: $${openrouter.dailySpend.toFixed(2)}`;
  }

  function renderCredits(gemini, claudeCode, agentsActive, openrouter) {
    const banner = document.getElementById('fallback-banner');
    const bars = document.getElementById('credits-bars');
    const total = document.getElementById('credits-total');
    const errs = document.getElementById('credits-errs');
    const jobsToday = document.getElementById('credits-jobs');
    const resetEl = document.getElementById('credits-reset');

    renderAgentsActive(agentsActive);
    renderClaudeCode(claudeCode);
    renderOpenRouter(openrouter);

    const claudeJobs = gemini ? gemini.claudeJobsToday || 0 : 0;
    jobsToday.textContent = `${claudeJobs} claude-code job${claudeJobs === 1 ? '' : 's'} today (proxy)`;
    jobsToday.title = 'proxy: jobs/*.md files dated today, not filtered by owner';
    resetEl.textContent = nextUtcResetLabel();

    if (!gemini || !gemini.available) {
      banner.textContent = 'NO LOG DATA';
      banner.className = 'fallback-banner ok';
      bars.innerHTML = '<p class="empty">~/.hermes/logs unreadable or absent</p>';
      total.textContent = '0 calls today';
      errs.textContent = '0 &middot; 0';
      return;
    }

    if (gemini.fallbackActive) {
      banner.textContent = `FALLBACK TIER ACTIVE — ${gemini.errors429 + gemini.errors503} error(s) today`;
      banner.className = 'fallback-banner alert';
    } else {
      banner.textContent = 'NOMINAL';
      banner.className = 'fallback-banner ok';
    }

    if (!gemini.models.length) {
      bars.innerHTML = '<p class="empty">no calls logged today</p>';
    } else {
      const max = Math.max(...gemini.models.map((m) => m.count));
      bars.innerHTML = gemini.models
        .map((m, i) => {
          const pct = Math.max(4, Math.round((m.count / max) * 100));
          const color = GREEN_RAMP[Math.min(i, GREEN_RAMP.length - 1)];
          return `<div class="bar-row">
            <div class="bar-label"><span>${escapeHtml(m.model)}</span><span class="n">${m.count}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%; --bar-color:${color};"></div></div>
          </div>`;
        })
        .join('');
    }

    total.textContent = `${gemini.totalCalls} call${gemini.totalCalls === 1 ? '' : 's'} today`;
    errs.textContent = `${gemini.errors429} ×429 · ${gemini.errors503} ×503`;
  }

  // ---------- render: ..//fuel: {tank} ----------
  // Own 60s poll (pollFuel, near the main poll loop below) — a real
  // network call (OpenRouter) plus a sqlite read live behind /api/fuel, so
  // this doesn't ride the 5s /api/state cadence. Every tile degrades to an
  // UNREACHABLE/reason render rather than throwing — a slow OpenRouter or a
  // locked state.db must never blank the whole pane.

  function fmtUsd(n) {
    return typeof n === 'number' ? '$' + n.toFixed(2) : '--';
  }

  function renderFuelOpenRouter(o) {
    const banner = document.getElementById('fuel-or-banner');
    const remaining = document.getElementById('fuel-or-remaining');
    const usage = document.getElementById('fuel-or-usage');
    const daily = document.getElementById('fuel-or-daily');
    const weekly = document.getElementById('fuel-or-weekly');
    if (!o || o.status !== 'OK') {
      banner.textContent = 'UNREACHABLE' + (o && o.reason ? ' — ' + o.reason : '');
      banner.className = 'fallback-banner alert';
      remaining.textContent = 'remaining: --';
      usage.textContent = 'usage: --';
      daily.textContent = 'today: --';
      weekly.textContent = '7d: --';
      return;
    }
    if (o.defcon) {
      banner.textContent = 'DEFCON — REMAINING CREDIT BELOW $1';
      banner.className = 'fallback-banner danger';
    } else {
      banner.textContent = 'NOMINAL';
      banner.className = 'fallback-banner ok';
    }
    remaining.textContent = 'remaining: ' + fmtUsd(o.remainingCredit);
    usage.textContent = 'usage: ' + fmtUsd(o.usageTotal);
    daily.textContent = 'today: ' + fmtUsd(o.usageDaily);
    weekly.textContent = '7d: ' + fmtUsd(o.usageWeekly);
  }

  function renderFuelHermes(h) {
    const defaultEl = document.getElementById('fuel-hermes-default');
    const effortEl = document.getElementById('fuel-hermes-effort');
    const ladderEl = document.getElementById('fuel-hermes-ladder');
    if (!h || h.status !== 'OK') {
      defaultEl.textContent = 'default: UNREACHABLE';
      effortEl.textContent = 'reasoning: --';
      effortEl.className = '';
      ladderEl.innerHTML = '<li class="empty">' + escapeHtml((h && h.reason) || 'no data') + '</li>';
      return;
    }
    defaultEl.textContent = `default: ${h.defaultModel || '--'} (${h.provider || '--'})`;
    effortEl.textContent = `reasoning: ${h.reasoningEffort || '--'}` + (h.redAlert ? ' — RED ALERT' : '');
    effortEl.className = h.redAlert ? 'fuel-red-alert' : '';
    if (!h.fallbackLadder || !h.fallbackLadder.length) {
      ladderEl.innerHTML = '<li class="empty">no fallback ladder configured</li>';
    } else {
      ladderEl.innerHTML = h.fallbackLadder
        .map((f) => `<li>${escapeHtml(f.provider || '?')} / ${escapeHtml(f.model || '?')}</li>`)
        .join('');
    }
  }

  function renderFuelSessions(s) {
    const openEl = document.getElementById('fuel-session-open');
    const zombieEl = document.getElementById('fuel-session-zombie');
    const listEl = document.getElementById('fuel-session-list');
    const barsEl = document.getElementById('fuel-token-bars');
    if (!s || s.status !== 'OK') {
      openEl.textContent = 'UNREACHABLE';
      zombieEl.textContent = '';
      listEl.innerHTML = '<p class="empty">' + escapeHtml((s && s.reason) || 'no data') + '</p>';
      barsEl.innerHTML = '<p class="empty">no usage data</p>';
      return;
    }
    openEl.textContent = `${s.openCount} open session${s.openCount === 1 ? '' : 's'}`;
    zombieEl.textContent = `${s.zombieCount} zombie${s.zombieCount === 1 ? '' : 's'}`;
    zombieEl.className = s.zombieCount > 0 ? 'fuel-red-alert' : '';
    if (!s.openSessions.length) {
      listEl.innerHTML = '<p class="empty">no open sessions</p>';
    } else {
      listEl.innerHTML = s.openSessions
        .map(
          (sess) =>
            `<div class="fuel-session-row${sess.zombie ? ' zombie' : ''}">
              <span>${escapeHtml(sess.id)}</span><span>${sess.messageCount} msgs</span>${sess.zombie ? '<span class="fuel-zombie-flag">ZOMBIE</span>' : ''}
            </div>`
        )
        .join('');
    }
    if (!s.last7dTokensByModel.length) {
      barsEl.innerHTML = '<p class="empty">no usage in last 7d</p>';
    } else {
      const max = Math.max(...s.last7dTokensByModel.map((m) => m.totalTokens)) || 1;
      barsEl.innerHTML = s.last7dTokensByModel
        .map((m, i) => {
          const pct = Math.max(4, Math.round((m.totalTokens / max) * 100));
          const color = GREEN_RAMP[Math.min(i, GREEN_RAMP.length - 1)];
          return `<div class="bar-row">
            <div class="bar-label"><span>${escapeHtml(m.model)}</span><span class="n">${m.totalTokens.toLocaleString()} tok</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%; --bar-color:${color};"></div></div>
          </div>`;
        })
        .join('');
    }
  }

  function renderFuelGemini(g) {
    const bodyEl = document.getElementById('fuel-gemini-body');
    if (!g || g.status !== 'OK') {
      bodyEl.innerHTML = '<p class="empty">' + escapeHtml((g && g.reason) || 'UNREACHABLE') + '</p>';
      return;
    }
    const proxyNote = `<p class="hint">${escapeHtml(g.proxy || '')}</p>`;
    if (typeof g.count429 === 'number') {
      bodyEl.innerHTML = `<div class="credits-foot"><span>${g.count429} &times;429 today</span></div>${proxyNote}`;
      return;
    }
    if (!g.byModel || !g.byModel.length) {
      bodyEl.innerHTML = `<p class="empty">no gemini calls in last 24h</p>${proxyNote}`;
      return;
    }
    bodyEl.innerHTML =
      g.byModel
        .map((m) => `<div class="credits-foot"><span>${escapeHtml(m.model)}</span><span>${m.calls} call${m.calls === 1 ? '' : 's'}</span></div>`)
        .join('') + proxyNote;
  }

  function renderFuel(state) {
    if (!state) return;
    renderFuelOpenRouter(state.openrouter);
    renderFuelHermes(state.hermes);
    renderFuelSessions(state.sessionHealth);
    renderFuelGemini(state.geminiProxy);
  }

  // ---------- render: ..//rnd: {learnings} ----------
  // Own 120s poll (pollRnd, near pollFuel above) — vault file reads plus a
  // systemctl call live behind /api/rnd. Every tile degrades independently
  // (a missing track file, an empty dispatch log, no runs yet) rather than
  // ever blanking the whole pane — see lib/rnd.js's module comment.

  const RND_TRACK_LABEL = {
    robotics: 'ROBOTICS',
    orchestration: 'ORCHESTRATION',
    'nothing-survival': 'NOTHING SURVIVAL',
  };

  function rndTrackRowHtml(t, latestRun) {
    const label = RND_TRACK_LABEL[t.key] || (t.key || '').toUpperCase();
    const healthHint = latestRun
      ? `<p class="rnd-track-run"><span class="rnd-track-run-tag">LAST RUN</span> ${escapeHtml(latestRun.snippet)}</p>`
      : '';
    if (t.status !== 'OK') {
      const tag = t.status === 'PENDING_FIRST_RUN' ? 'PENDING FIRST RUN' : 'UNREACHABLE';
      return `<div class="rnd-track rnd-track-pending">
        <div class="rnd-track-top"><span class="rnd-track-name">${escapeHtml(label)}</span><span class="rnd-track-tag">${escapeHtml(tag)}</span></div>
        ${t.reason ? `<p class="hint">${escapeHtml(t.reason)}</p>` : ''}
        ${healthHint}
      </div>`;
    }
    const progress = typeof t.progress === 'number' ? `${t.progress} ${escapeHtml(t.progressLabel || '')}`.trim() : '--';
    return `<div class="rnd-track">
      <div class="rnd-track-top">
        <span class="rnd-track-name">${escapeHtml(label)}</span>
        <span class="rnd-track-progress">${escapeHtml(progress)}</span>
      </div>
      ${t.lastLogLine ? `<p class="rnd-track-log">${escapeHtml(t.lastLogLine)}</p>` : ''}
      ${t.seed ? `<p class="rnd-track-seed"><span class="rnd-track-seed-tag">NEXT SEED</span> ${escapeHtml(t.seed)}</p>` : ''}
      ${healthHint}
    </div>`;
  }

  // Track keys (robotics/orchestration/nothing-survival) don't quite match
  // the dispatcher's short slugs (robotics/orchestration/nothing) — see
  // bench/rnd-idle-dispatch.sh's TRACKS array — so match on prefix rather
  // than exact key.
  function findLatestRunForTrack(latestRuns, trackKey) {
    if (!latestRuns || !latestRuns.length) return null;
    return latestRuns.find((r) => trackKey.indexOf(r.track) === 0 || r.track.indexOf(trackKey) === 0) || null;
  }

  function renderRndTracks(tracks, latestRuns) {
    const el = document.getElementById('rnd-track-list');
    if (!tracks || !tracks.length) {
      el.innerHTML = '<p class="empty">no track data</p>';
      return;
    }
    el.innerHTML = tracks.map((t) => rndTrackRowHtml(t, findLatestRunForTrack(latestRuns, t.key))).join('');
  }

  function renderRndLessons(lessons) {
    const el = document.getElementById('rnd-lesson-list');
    if (!lessons || !lessons.length) {
      el.innerHTML = '<p class="empty">no lessons yet</p>';
      return;
    }
    el.innerHTML = lessons
      .map((l) => {
        const trackTag = l.track ? `<span class="rnd-lesson-track">${escapeHtml(RND_TRACK_LABEL[l.track] || l.track)}</span>` : '';
        const dateStr = l.date ? String(l.date).slice(0, 10) : '';
        return `<div class="rnd-lesson-row">
          <span class="rnd-lesson-heading">${escapeHtml(l.heading)}</span>
          ${trackTag}
          <span class="rnd-lesson-date">${escapeHtml(dateStr)}</span>
        </div>`;
      })
      .join('');
  }

  function renderRndDispatcher(d) {
    const logEl = document.getElementById('rnd-dispatcher-log');
    const nextEl = document.getElementById('rnd-dispatcher-next');
    if (!d || d.status !== 'OK') {
      logEl.innerHTML = '<p class="empty">' + escapeHtml((d && d.reason) || 'no data') + '</p>';
    } else if (!d.lines || !d.lines.length) {
      logEl.innerHTML = '<p class="empty">no dispatches yet</p>';
    } else {
      logEl.innerHTML = d.lines.map((l) => `<div class="rnd-dispatcher-line">${escapeHtml(l)}</div>`).join('');
    }
    nextEl.textContent = 'next fire: ' + ((d && d.nextFire) || '--');
  }

  function renderRnd(state) {
    if (!state) return;
    renderRndTracks(state.tracks, state.latestRuns);
    renderRndLessons(state.lessons);
    renderRndDispatcher(state.dispatcher);
  }

  // ---------- render: pipeline (jobs + clients) ----------

  function renderJobs(jobs) {
    const el = document.getElementById('jobs-list');
    if (!jobs || !jobs.length) {
      el.innerHTML = '<p class="empty">no job files in vault</p>';
      return;
    }
    el.innerHTML = jobs
      .map((j) => {
        const pct = j.milestonesTotal ? Math.round((j.milestonesDone / j.milestonesTotal) * 100) : 0;
        const stalledFlag = j.stalled ? `<div class="job-stalled-flag">STALLED &middot; silent ${j.silentMinutes}m</div>` : '';
        return `<div class="job ${j.stalled ? 'stalled' : ''}">
          <div class="job-top">
            <span class="job-name">${escapeHtml(j.project || j.slug)}</span>
            <span class="job-status ${escapeHtml(j.status)}">${escapeHtml(j.status)}</span>
          </div>
          <div class="job-bar"><div class="job-bar-fill" style="width:${pct}%"></div></div>
          <div class="job-current">${j.milestonesDone}/${j.milestonesTotal} &middot; ${escapeHtml(j.current || '&mdash;')}</div>
          ${stalledFlag}
        </div>`;
      })
      .join('');
  }

  function clientDueMeta(c) {
    if (c.dueDays === null) return { cls: 'safe', label: 'no due date' };
    if (c.dueDays < 0) return { cls: 'overdue', label: `OVERDUE ${Math.abs(c.dueDays)}d` };
    if (c.dueDays <= 2) return { cls: 'overdue', label: c.dueDays === 0 ? 'DUE TODAY' : `T-${c.dueDays}d` };
    if (c.dueDays <= 5) return { cls: 'soon', label: `T-${c.dueDays}d` };
    return { cls: 'safe', label: `T-${c.dueDays}d` };
  }

  function renderClients(clients) {
    const el = document.getElementById('clients-list');
    if (!clients || !clients.length) {
      el.innerHTML = '<p class="empty">no client files in vault</p>';
      return;
    }
    el.innerHTML = clients
      .map((c) => {
        const { cls, label } = clientDueMeta(c);
        return `<div class="client">
          <span class="client-name">${escapeHtml(c.client)}<span class="client-open">${c.openItems} open</span></span>
          <span class="client-due ${cls}">${label}</span>
        </div>`;
      })
      .join('');
  }

  // ---------- render: ..//clients: {portfolio} ----------
  // Status colors reserved+labeled (dataviz law): AHEAD dim green, ON TRACK
  // plain ink, BEHIND amber with the gap pct; LIVE acid, STAGED phosphor,
  // UNLAUNCHED dim. schedule-health thresholds are +-5 percentage points —
  // inside that band reads as "on track", not a false-precision exact zero.

  function scheduleHealthChip(scheduleHealth) {
    if (scheduleHealth === null) return { cls: 'unknown', label: 'NO TIMELINE' };
    if (scheduleHealth >= 5) return { cls: 'ahead', label: 'AHEAD' };
    if (scheduleHealth <= -5) return { cls: 'behind', label: `BEHIND ${Math.abs(scheduleHealth)}%` };
    return { cls: 'ontrack', label: 'ON TRACK' };
  }

  function launchStateBadge(state) {
    if (state === 'live') return { cls: 'live', label: 'LIVE' };
    if (state === 'staged') return { cls: 'staged', label: 'STAGED' };
    return { cls: 'unlaunched', label: 'UNLAUNCHED' };
  }

  let selectedClientSlug = null;

  function clientDetailHtml(c) {
    const itemsHtml = c.unchecked.length
      ? c.unchecked.map((t) => `<div class="pc-item"><span class="pc-item-mark">&middot;</span>${escapeHtml(t)}</div>`).join('')
      : '<p class="empty">no open items</p>';
    const jobsHtml = c.jobs.length
      ? c.jobs
          .map((j) => {
            const pct = j.milestonesTotal ? Math.round((j.milestonesDone / j.milestonesTotal) * 100) : 0;
            return `<div class="pc-job">
              <div class="pc-job-top">
                <span class="job-status ${escapeHtml(j.status)}">${escapeHtml(j.status)}</span>
                <span class="pc-job-current">${j.milestonesDone}/${j.milestonesTotal} &middot; ${escapeHtml(j.current || '&mdash;')}</span>
              </div>
              <div class="pc-job-bar"><div class="pc-job-bar-fill" style="width:${pct}%"></div></div>
            </div>`;
          })
          .join('')
      : '<p class="empty">no jobs dispatched yet</p>';
    const links = [
      c.live ? `<a href="${escapeHtml(c.live)}" target="_blank" rel="noopener noreferrer" class="pc-link live">LIVE &#8594;</a>` : '',
      c.stagingUrl ? `<a href="${escapeHtml(c.stagingUrl)}" target="_blank" rel="noopener noreferrer" class="pc-link staging">STAGING &#8594;</a>` : '',
    ]
      .filter(Boolean)
      .join('');
    return `<div class="pc-detail">
      <h4 class="pc-sub">OPEN ITEMS</h4>
      <div class="pc-items">${itemsHtml}</div>
      <h4 class="pc-sub">RECENT JOBS</h4>
      <div class="pc-jobs">${jobsHtml}</div>
      <h4 class="pc-sub">LINKS</h4>
      ${links ? `<div class="pc-links">${links}</div>` : '<p class="empty">no staging/live link yet</p>'}
    </div>`;
  }

  function clientCardHtml(c, rank) {
    const due = clientDueMeta(c);
    const health = scheduleHealthChip(c.scheduleHealth);
    const launch = launchStateBadge(c.launchState);
    const timelinePct = c.timelineElapsedPct === null ? 0 : c.timelineElapsedPct;
    const completionCls = c.runningJobs > 0 ? 'acid' : 'bright';
    const expanded = selectedClientSlug === c.slug;
    return `<div class="portfolio-card${expanded ? ' expanded' : ''}" data-slug="${escapeHtml(c.slug)}">
      <div class="pc-head" role="button" tabindex="0" aria-expanded="${expanded}">
        <span class="pc-rank">${String(rank).padStart(2, '0')}</span>
        <div class="pc-head-main">
          <div class="pc-head-top">
            <span class="pc-name">${escapeHtml(c.client)}</span>
            <span class="pc-due ${due.cls}">${due.label}</span>
          </div>
          <div class="pc-bar-row">
            <span class="pc-bar-label">TIMELINE</span>
            <div class="pc-bar-track"><div class="pc-bar-fill timeline" style="width:${timelinePct}%"></div></div>
          </div>
          <div class="pc-bar-row">
            <span class="pc-bar-label">COMPLETION</span>
            <div class="pc-bar-track"><div class="pc-bar-fill completion ${completionCls}" style="width:${c.completionPct}%"></div></div>
          </div>
          <div class="pc-chip-row">
            <span class="pc-chip ${health.cls}">${health.label}</span>
            <span class="pc-badge ${launch.cls}">${launch.label}</span>
            <span class="pc-open">${c.openItems} open item${c.openItems === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
      ${expanded ? clientDetailHtml(c) : ''}
    </div>`;
  }

  function renderClientsPortfolio(clients) {
    const el = document.getElementById('clients-portfolio');
    if (!clients || !clients.length) {
      el.innerHTML = '<p class="empty">no client files in vault</p>';
      return;
    }
    el.innerHTML = clients.map((c, i) => clientCardHtml(c, i + 1)).join('');
  }

  function selectClientCard(slug) {
    selectedClientSlug = selectedClientSlug === slug ? null : slug;
    renderClientsPortfolio(lastState ? lastState.clients : null);
  }

  document.getElementById('clients-portfolio').addEventListener('click', (e) => {
    const head = e.target.closest('.pc-head');
    if (!head) return;
    const card = head.closest('.portfolio-card');
    if (card) selectClientCard(card.dataset.slug);
  });
  document.getElementById('clients-portfolio').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest('.pc-head');
    if (!head) return;
    e.preventDefault();
    const card = head.closest('.portfolio-card');
    if (card) selectClientCard(card.dataset.slug);
  });

  // ---------- ..//tasks: {zoh} ----------
  // Shared across both modes (see PANES) — server swaps the vault root, the
  // pane itself is identical. T-countdown thresholds match the CEO task
  // pane spec: amber inside 24h, red once overdue (status colors reserved+
  // labeled, same dataviz law as scheduleHealthChip/clientDueMeta).

  let openTaskCount = 0;
  let expandedTaskHash = null;

  function taskDueMeta(t) {
    // a done task's due date no longer means anything urgent — the row's
    // own strikethrough already marks it settled, so no chip at all here
    if (t.done || !t.due || t.dueMs === null) return { cls: 'none', label: '' };
    const diffMs = t.dueMs - Date.now();
    if (diffMs < 0) {
      const h = Math.floor(-diffMs / 3600000);
      return { cls: 'overdue', label: h < 1 ? 'OVERDUE' : `OVERDUE ${h}h` };
    }
    const hours = diffMs / 3600000;
    if (hours < 24) {
      const hh = Math.floor(hours);
      const mm = Math.round((hours - hh) * 60);
      return { cls: 'soon', label: `T-${hh}h${String(mm).padStart(2, '0')}m` };
    }
    return { cls: 'safe', label: `T-${Math.floor(hours / 24)}d` };
  }

  function taskItemHtml(t) {
    const due = taskDueMeta(t);
    const expanded = expandedTaskHash === t.hash;
    const hasSteps = (t.steps || []).length > 0;
    const stepsHtml = hasSteps
      ? `<div class="task-steps">${t.steps.map((s) => `<div class="task-step">${escapeHtml(s)}</div>`).join('')}</div>`
      : '';
    return `<div class="task-item${expanded ? ' expanded' : ''}">
      <div class="task-row${t.done ? ' done' : ''}${t.overdue ? ' overdue' : ''}">
        <label class="task-check-wrap">
          <input type="checkbox" class="task-check" data-hash="${escapeHtml(t.hash)}" ${t.done ? 'checked' : ''} aria-label="${t.done ? 'Mark task not done' : 'Mark task done'}" />
          <span class="task-check-mark" aria-hidden="true"></span>
        </label>
        <div class="task-main"${hasSteps ? ` data-toggle="${escapeHtml(t.hash)}" role="button" tabindex="0"` : ''}>
          <span class="task-title">${escapeHtml(t.text)}</span>
          ${due.label ? `<span class="task-due ${due.cls}">${escapeHtml(due.label)}</span>` : ''}
        </div>
        ${hasSteps ? `<span class="task-expand-arrow" aria-hidden="true">${expanded ? '&#9662;' : '&#9656;'}</span>` : ''}
      </div>
      ${stepsHtml}
    </div>`;
  }

  function renderTasks(tasks) {
    const listEl = document.getElementById('tasks-list');
    const doneEl = document.getElementById('tasks-done');
    const doneHEl = document.getElementById('tasks-done-h');
    if (!listEl || !doneEl || !doneHEl) return;
    const all = tasks || [];
    const open = all.filter((t) => !t.done);
    const done = all.filter((t) => t.done);
    listEl.innerHTML = open.length ? open.map(taskItemHtml).join('') : '<p class="empty">no open tasks</p>';
    // last 10 done, most-recently-appearing-in-file first (see lib/tasks.js)
    const doneShown = done.slice(-10).reverse();
    doneHEl.hidden = !doneShown.length;
    doneEl.innerHTML = doneShown.map(taskItemHtml).join('');
    openTaskCount = open.length;
    renderRail();
  }

  function toggleTaskExpand(hash) {
    expandedTaskHash = expandedTaskHash === hash ? null : hash;
    renderTasks(lastState ? lastState.tasks : null);
  }

  function submitTaskToggle(hash, done, checkboxEl) {
    if (checkboxEl) checkboxEl.disabled = true;
    apiFetch('./api/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, done, mode: currentMode }),
    }).then((result) => {
      if (!result.ok) {
        showPaneToast('toast-tasks', apiErrorText(result));
        if (checkboxEl) {
          checkboxEl.disabled = false;
          checkboxEl.checked = !done;
        }
        return;
      }
      hidePaneToast('toast-tasks');
      // check-off is a user-initiated moment, not an autonomous notification —
      // exempt from playMotif()'s 10s cooldown (see playTaskTick())
      if (done) playTaskTick();
      return poll();
    });
  }

  ['tasks-list', 'tasks-done'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
      const cb = e.target.closest('.task-check');
      if (!cb) return;
      submitTaskToggle(cb.dataset.hash, cb.checked, cb);
    });
    el.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle]');
      if (!toggle) return;
      toggleTaskExpand(toggle.dataset.toggle);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const toggle = e.target.closest('[data-toggle]');
      if (!toggle) return;
      e.preventDefault();
      toggleTaskExpand(toggle.dataset.toggle);
    });
  });

  const tasksQuickaddForm = document.getElementById('tasks-quickadd-form');
  const tasksQuickaddInput = document.getElementById('tasks-quickadd-input');
  const tasksQuickaddSend = document.getElementById('tasks-quickadd-send');
  if (tasksQuickaddForm) {
    tasksQuickaddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = tasksQuickaddInput.value.trim().slice(0, 300);
      if (!text) return;
      tasksQuickaddInput.disabled = true;
      tasksQuickaddSend.disabled = true;
      apiFetch('./api/task/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: currentMode }),
      })
        .then((result) => {
          if (!result.ok) {
            showPaneToast('toast-tasks', apiErrorText(result));
            return;
          }
          hidePaneToast('toast-tasks');
          tasksQuickaddInput.value = '';
          return poll();
        })
        .finally(() => {
          tasksQuickaddInput.disabled = false;
          tasksQuickaddSend.disabled = false;
          tasksQuickaddInput.focus();
        });
    });
  }

  // ---------- PERSONAL MODE panes: quests, pursuits, applications, assets ----------

  // Same job-ledger shape as renderJobs() (quests share the frontmatter
  // protocol with studio jobs — see ~/personal-brain/quests/README.md), just
  // targeting a different element and using the slug for a name since a
  // quest has no `project:` field.
  function renderQuests(quests) {
    const el = document.getElementById('quests-list');
    if (!el) return;
    if (!quests || !quests.length) {
      el.innerHTML = '<p class="empty">no quests in ~/personal-brain/quests</p>';
      return;
    }
    el.innerHTML = quests
      .map((j) => {
        const pct = j.milestonesTotal ? Math.round((j.milestonesDone / j.milestonesTotal) * 100) : 0;
        const stalledFlag = j.stalled ? `<div class="job-stalled-flag">STALLED &middot; silent ${j.silentMinutes}m</div>` : '';
        return `<div class="job ${j.stalled ? 'stalled' : ''}">
          <div class="job-top">
            <span class="job-name">${escapeHtml(j.slug)}</span>
            <span class="job-status ${escapeHtml(j.status)}">${escapeHtml(j.status)}</span>
          </div>
          <div class="job-bar"><div class="job-bar-fill" style="width:${pct}%"></div></div>
          <div class="job-current">${j.milestonesDone}/${j.milestonesTotal} &middot; ${escapeHtml(j.current || '&mdash;')}</div>
          ${stalledFlag}
        </div>`;
      })
      .join('');
  }

  // Categorical, not decorative (dataviz law: accent always categorizes) —
  // each pursuit kind gets its own hue so the pane reads as a curated
  // spread rather than a wall of monochrome violet rows. Muted enough to
  // stay in the phosphor-CRT family, varied enough to actually feel like
  // six different kinds of thing.
  const PURSUIT_KIND_COLORS = {
    exhibition: '#c46bff',
    festival: '#ff6b9d',
    opencall: '#6bd4ff',
    brand: '#ffb020',
    curator: '#6bffb0',
    enquiry: '#8f83a8',
  };
  function pursuitKindColor(kind) {
    return PURSUIT_KIND_COLORS[kind] || PURSUIT_KIND_COLORS.enquiry;
  }

  function pursuitHealthMeta(p) {
    if (p.health === 'behind') return { cls: 'behind', label: p.dueDays < 0 ? `OVERDUE ${Math.abs(p.dueDays)}D` : 'DUE' };
    if (p.health === 'ontrack') return { cls: 'ontrack', label: p.dueDays === 0 ? 'DUE TODAY' : `T-${p.dueDays}D` };
    if (p.health === 'ahead') return { cls: 'ahead', label: 'AHEAD' };
    return { cls: 'unknown', label: 'NO DUE DATE' };
  }

  function renderPursuits(pursuits) {
    const el = document.getElementById('pursuits-list');
    if (!el) return;
    if (!pursuits || !pursuits.length) {
      el.innerHTML = '<p class="empty">no pursuits in ~/personal-brain/pursuits</p>';
      return;
    }
    const groups = new Map();
    pursuits.forEach((p) => {
      if (!groups.has(p.kind)) groups.set(p.kind, []);
      groups.get(p.kind).push(p);
    });
    let html = '';
    groups.forEach((list, kind) => {
      const color = pursuitKindColor(kind);
      html += `<h3 class="pursuit-group-h"><span class="pursuit-kind-dot" style="--kind-color:${color}"></span>${escapeHtml(kind)}</h3>`;
      html += list
        .map((p) => {
          const health = pursuitHealthMeta(p);
          const dueLabel = p.dueDays === null ? '&mdash;' : p.dueDays < 0 ? `${Math.abs(p.dueDays)}d overdue` : `in ${p.dueDays}d`;
          return `<div class="pursuit-row" style="--kind-color:${pursuitKindColor(p.kind)}">
            <span class="pursuit-title">${escapeHtml(p.title)}<span class="pursuit-status">${escapeHtml(p.status)}</span></span>
            <span class="pursuit-due">${dueLabel}</span>
            <span class="pursuit-health ${health.cls}">${health.label}</span>
          </div>`;
        })
        .join('');
    });
    el.innerHTML = html;
  }

  const APPLICATION_STAGE_ORDER = ['SCOUTED', 'APPLIED', 'INTERVIEW', 'OFFER', 'CLOSED'];
  // A funnel is a progression, not a category set — color follows the
  // story (cool/neutral start, warming toward the goal, acid at OFFER
  // since that's the one moment worth an aliveness-tier accent, ink-faint
  // once archived at CLOSED).
  const APPLICATION_STAGE_COLORS = {
    SCOUTED: null,
    APPLIED: 'var(--phosphor-dim)',
    INTERVIEW: '#6bd4ff',
    OFFER: 'var(--acid)',
    CLOSED: 'var(--ink-faint)',
  };
  const APPLICATION_STAGE_GLOW = { OFFER: 'var(--acid-glow)' };

  function renderApplications(applications) {
    const el = document.getElementById('applications-funnel');
    if (!el) return;
    const app = applications || {};
    el.innerHTML = APPLICATION_STAGE_ORDER.map((stage) => {
      const items = app[stage] || [];
      const cards = items.length
        ? items
            .map(
              (a) => `<div class="app-card">
                <span class="app-company">${escapeHtml(a.company)}</span>
                ${a.roleTrack ? `<span class="app-role-track">${escapeHtml(a.roleTrack)}</span>` : ''}
                ${a.nextAction ? `<div class="app-next">${escapeHtml(a.nextAction)}${a.nextActionDays !== null ? ` &middot; ${a.nextActionDays}d` : ''}</div>` : ''}
              </div>`
            )
            .join('')
        : '<p class="empty">&mdash;</p>';
      const color = APPLICATION_STAGE_COLORS[stage];
      const style = color ? ` style="--stage-color:${color};--stage-color-glow:${APPLICATION_STAGE_GLOW[stage] || 'transparent'}"` : '';
      return `<div class="app-col"${style}><div class="app-col-h"><span>${stage}</span><span class="app-col-count">${items.length}</span></div>${cards}</div>`;
    }).join('');
  }

  function renderAssets(assets) {
    const el = document.getElementById('assets-list');
    if (!el) return;
    if (!assets || !assets.length) {
      el.innerHTML = '<p class="empty">no assets/artifacts.md in vault</p>';
      return;
    }
    el.innerHTML = assets
      .map((a) => {
        const age = a.daysSince === null ? 'never touched' : a.daysSince === 0 ? 'touched today' : `${a.daysSince}d since touched`;
        return `<div class="asset-row">
          <i class="asset-dot ${a.freshness}"></i>
          <span class="asset-name">${escapeHtml(a.name)}</span>
          <span class="asset-age">${escapeHtml(age)}</span>
          <button type="button" class="asset-touch" data-name="${escapeHtml(a.name)}">TOUCHED TODAY</button>
        </div>`;
      })
      .join('');
  }

  const assetsListEl = document.getElementById('assets-list');
  if (assetsListEl) {
    assetsListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.asset-touch');
      if (!btn || btn.disabled) return;
      const name = btn.dataset.name;
      btn.disabled = true;
      btn.textContent = 'TOUCHING…';
      apiFetch('./api/personal/assets/touch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
        .then((result) => {
          if (!result.ok) {
            showPaneToast('toast-assets', apiErrorText(result));
            btn.disabled = false;
            btn.textContent = 'TOUCHED TODAY';
            return;
          }
          hidePaneToast('toast-assets');
          if (lastState) lastState.assets = result.body.assets;
          renderAssets(result.body.assets);
        });
    });
  }

  // The agenda pane's time-grid is a studio-only concept (cron/job
  // scheduling within today) — hidden via CSS in personal mode (see
  // style.css). Personal mode reuses the same #agenda-deadlines list/markup,
  // just populated from pursuits due dates + application next-actions
  // instead of client due dates (state.personalDeadlines, built server-side
  // in lib/personal.js#getPersonalDeadlines).
  function renderPersonalAgenda(state) {
    const deadlinesEl = document.getElementById('agenda-deadlines');
    if (!deadlinesEl) return;
    const items = state.personalDeadlines || [];
    if (!items.length) {
      deadlinesEl.innerHTML = '<p class="empty">no upcoming deadlines</p>';
      return;
    }
    deadlinesEl.innerHTML = items
      .map((d) => {
        let label;
        let urgent = false;
        if (d.dueDays < 0) {
          label = `OVERDUE ${Math.abs(d.dueDays)}D`;
          urgent = true;
        } else if (d.dueDays === 0) {
          label = 'DUE TODAY';
          urgent = true;
        } else {
          label = `T-${d.dueDays}D`;
        }
        return `<div class="agenda-deadline ${urgent ? 'urgent' : ''}">
          <span class="dl-label">${escapeHtml(d.client)}</span>
          <span class="dl-count">${label}</span>
        </div>`;
      })
      .join('');
  }

  // ---------- render: agenda (today's time-grid) ----------

  function hoursDecimal(date) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function endOfToday() {
    const d = startOfToday();
    d.setDate(d.getDate() + 1);
    return d;
  }

  function clipToToday(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const start = startOfToday();
    const end = endOfToday();
    if (d < start) return start;
    if (d > end) return end;
    return d;
  }

  function formatHM(h) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // Cron entries + jobs that started today are time-scaled blocks; a job
  // that started before today gets no honest start-of-day position on this
  // grid, so it's split off as a "continuation" (rendered as a dim chip
  // instead of a misleading full-height block from 00:00).
  function todayDateStr() {
    const d = startOfToday();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // The agenda is a "now" board, not a day-long activity log: a job that
  // finished (done/failed) or hasn't started (queued) — however recently —
  // is never a "now" item, no matter what its own started-date says. This
  // is the fix for the stale "continuing since <date>" filler a done job
  // used to render as (v0.17.2 ops-truth pass): only a job actually still
  // running/verifying is eligible for a timed block OR a continuation chip.
  function isAgendaActiveJob(j) {
    return j.status === 'running' || j.status === 'verifying';
  }

  function buildAgendaEvents(cron, jobs, tasks) {
    const events = [];
    const continuations = [];
    (cron || []).forEach((c) => {
      const parts = /^(\d{1,2}):(\d{2})$/.exec(c.time || '');
      if (!parts) return;
      const startHour = Number(parts[1]) + Number(parts[2]) / 60;
      events.push({ kind: 'cron', name: c.name, startHour, endHour: startHour + 0.4 });
    });
    const today = todayDateStr();
    (tasks || []).forEach((t) => {
      if (t.done || !t.due) return;
      const parts = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})$/.exec(t.due);
      if (!parts || parts[1] !== today) return;
      const startHour = Number(parts[2]) + Number(parts[3]) / 60;
      events.push({ kind: 'task', task: t, startHour, endHour: startHour + 0.3 });
    });
    (jobs || []).forEach((j) => {
      if (!isAgendaActiveJob(j)) return;
      if (!j.startedAt) return;
      const rawStart = new Date(j.startedAt);
      if (Number.isNaN(rawStart.getTime())) return;
      if (rawStart < startOfToday()) {
        continuations.push(j);
        return;
      }
      const e = clipToToday(j.endedAt || new Date().toISOString());
      if (!e) return;
      const startHour = hoursDecimal(rawStart);
      let endHour = hoursDecimal(e);
      if (endHour <= startHour) endHour = startHour + 0.3;
      events.push({ kind: 'job', job: j, startHour, endHour, slug: j.slug });
    });
    return { events, continuations };
  }

  // ---------- orchestration awareness (v0.17.2) ----------
  // state.orchestration (studio mode only — see lib/state.js#getOrchestration)
  // is {units: [{name, active}], processes: {claude, opencode}}. Shared by
  // the NOW strip, the agenda's untimed "now" chips, and the sculpture's
  // running-state boost, so all three agree on what "the studio is building
  // right now" means.
  function activeOrchestrationUnits(state) {
    const o = state && state.orchestration;
    return o && Array.isArray(o.units) ? o.units.filter((u) => u.active) : [];
  }

  function orchestrationEngineCount(state) {
    const o = state && state.orchestration;
    if (!o || !o.processes) return 0;
    return (o.processes.claude || 0) + (o.processes.opencode || 0);
  }

  function orchestrationActive(state) {
    return activeOrchestrationUnits(state).length > 0 || orchestrationEngineCount(state) > 0;
  }

  function computeRange(events) {
    const nowHour = hoursDecimal(new Date());
    let start = 8;
    let end = 21;
    events.forEach((e) => {
      start = Math.min(start, e.startHour);
      end = Math.max(end, e.endHour);
    });
    start = Math.min(start, nowHour);
    end = Math.max(end, nowHour);
    start = Math.max(0, Math.floor(start) - 1);
    end = Math.min(24, Math.ceil(end) + 1);
    if (end - start < 6) end = Math.min(24, start + 6);
    return { start, end };
  }

  // Overlapping intervals get side-by-side columns instead of stacking on
  // top of each other: sweep events sorted by start, greedily reuse the
  // first free column whose last-placed event has already ended; when a
  // gap appears (no event was active), close the cluster and reset the
  // free-column ledger so unrelated later blocks don't inherit an
  // unnecessarily narrow width.
  function layoutAgendaColumns(events) {
    const sorted = events.slice().sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);
    let cluster = [];
    let columnEnds = [];
    let clusterEnd = -Infinity;
    function flush() {
      if (!cluster.length) return;
      const totalCols = Math.max(...cluster.map((e) => e.col)) + 1;
      cluster.forEach((e) => {
        e.totalCols = totalCols;
      });
    }
    sorted.forEach((e) => {
      if (cluster.length && e.startHour >= clusterEnd - 1e-9) {
        flush();
        cluster = [];
        columnEnds = [];
        clusterEnd = -Infinity;
      }
      let placed = false;
      for (let i = 0; i < columnEnds.length; i++) {
        if (columnEnds[i] <= e.startHour + 1e-9) {
          columnEnds[i] = e.endHour;
          e.col = i;
          placed = true;
          break;
        }
      }
      if (!placed) {
        e.col = columnEnds.length;
        columnEnds.push(e.endHour);
      }
      cluster.push(e);
      clusterEnd = Math.max(clusterEnd, e.endHour);
    });
    flush();
    return sorted;
  }

  function agendaBlockPosition(e) {
    if (e.totalCols > 1) {
      return { left: `calc(${(e.col * 100) / e.totalCols}% + 2px)`, width: `calc(${100 / e.totalCols}% - 4px)` };
    }
    return { left: '6px', width: 'calc(100% - 12px)' };
  }

  function renderContinuations(continuations) {
    const el = document.getElementById('agenda-continuations');
    if (!continuations || !continuations.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = continuations
      .map((j) => {
        const started = new Date(j.startedAt);
        const label = Number.isNaN(started.getTime())
          ? 'earlier'
          : started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `<div class="agenda-chip" data-slug="${escapeHtml(j.slug)}" title="started ${escapeHtml(label)}">
          <span class="chip-glyph">&#8942;</span>${escapeHtml(j.project || j.slug)} &middot; continuing since ${escapeHtml(label)}
        </div>`;
      })
      .join('');
  }

  // Active orchestration units + live engine processes render as untimed
  // "now" chips — acid, not the dim continuation chip color, since this is
  // genuinely happening right now (the two-green aliveness tier), not a
  // stale carry-over.
  function renderOrchestrationAgenda(state) {
    const el = document.getElementById('agenda-orchestration');
    if (!el) return;
    const units = activeOrchestrationUnits(state);
    const engines = orchestrationEngineCount(state);
    if (!units.length && !engines) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const items = units.map(
      (u) => `<div class="agenda-orch-chip"><span class="chip-glyph">&#9679;</span>${escapeHtml(u.name)} &middot; now</div>`
    );
    if (engines > 0) {
      items.push(
        `<div class="agenda-orch-chip"><span class="chip-glyph">&#9679;</span>${engines} engine${engines === 1 ? '' : 's'} building &middot; now</div>`
      );
    }
    el.hidden = false;
    el.innerHTML = items.join('');
  }

  function renderAgenda(state) {
    window.renderHistoricalAgenda(); return;
    const hoursEl = document.getElementById('agenda-hours');
    const trackEl = document.getElementById('agenda-track');
    const emptyEl = document.getElementById('agenda-empty');
    const deadlinesEl = document.getElementById('agenda-deadlines');

    const { events, continuations } = buildAgendaEvents(state.cron, state.jobs, state.tasks);
    layoutAgendaColumns(events);
    const { start, end } = computeRange(events);
    const totalHours = end - start;
    const pxHeight = totalHours * HOUR_PX;

    trackEl.style.setProperty('--hour-px', HOUR_PX + 'px');
    trackEl.style.height = pxHeight + 'px';
    hoursEl.style.position = 'relative';
    hoursEl.style.height = pxHeight + 'px';

    let hoursHtml = '';
    for (let h = start; h <= end; h++) {
      hoursHtml += `<div class="agenda-hour-label" style="position:absolute; top:${(h - start) * HOUR_PX}px;">${String(h % 24).padStart(2, '0')}:00</div>`;
    }
    hoursEl.innerHTML = hoursHtml;

    let blocksHtml = '';
    events.forEach((e) => {
      const top = (e.startHour - start) * HOUR_PX;
      const height = Math.max(16, (e.endHour - e.startHour) * HOUR_PX);
      const { left, width } = agendaBlockPosition(e);
      const posStyle = `top:${top}px; height:${height}px; left:${left}; width:${width};`;
      if (e.kind === 'cron') {
        blocksHtml += `<div class="agenda-block cron" style="${posStyle}">
          <span class="ab-title">${escapeHtml(e.name)}</span>
          <span class="ab-meta">cron &middot; ${escapeHtml(formatHM(e.startHour))}</span>
        </div>`;
        return;
      }
      if (e.kind === 'task') {
        const due = taskDueMeta(e.task);
        blocksHtml += `<div class="agenda-block task ${due.cls}" style="${posStyle}">
          <span class="ab-title">${escapeHtml(e.task.text)}</span>
          <span class="ab-meta">TASK &middot; ${escapeHtml(formatHM(e.startHour))}</span>
        </div>`;
        return;
      }
      // Only running/verifying jobs reach a timed block at all (see
      // isAgendaActiveJob) — done/failed/queued never render on the agenda.
      const j = e.job;
      const cls = j.status === 'verifying' ? 'job-verifying' : 'job-running';
      const statusLabel = j.stalled ? 'STALLED' : j.status.toUpperCase();
      blocksHtml += `<div class="agenda-block ${cls}" data-slug="${escapeHtml(j.slug)}" style="${posStyle}">
        <span class="ab-title">${escapeHtml(j.project || j.slug)}</span>
        <span class="ab-meta">${escapeHtml(statusLabel)} &middot; ${j.milestonesDone}/${j.milestonesTotal}</span>
      </div>`;
    });

    const nowHour = hoursDecimal(new Date());
    if (nowHour >= start && nowHour <= end) {
      const top = (nowHour - start) * HOUR_PX;
      blocksHtml += `<div class="agenda-nowline" style="top:${top}px;"><span class="nowline-tag">NOW</span></div>`;
    }

    trackEl.innerHTML = blocksHtml;
    emptyEl.hidden = events.length > 0 || continuations.length > 0 || orchestrationActive(state);
    renderContinuations(continuations);
    renderOrchestrationAgenda(state);
    renderAgendaDetail();

    const deadlineClients = (state.clients || []).filter((c) => c.dueDays !== null && c.dueDays <= 3);
    if (!deadlineClients.length) {
      deadlinesEl.innerHTML = '';
    } else {
      deadlinesEl.innerHTML = deadlineClients
        .map((c) => {
          let label;
          let urgent = false;
          if (c.dueDays < 0) {
            label = `OVERDUE ${Math.abs(c.dueDays)}D`;
            urgent = true;
          } else if (c.dueDays === 0) {
            label = 'DUE TODAY';
            urgent = true;
          } else {
            label = `T-${c.dueDays}D`;
          }
          const health = scheduleHealthChip(c.scheduleHealth);
          return `<div class="agenda-deadline ${urgent ? 'urgent' : ''}">
            <span class="dl-label">${escapeHtml(c.client)}</span>
            <span class="dl-health ${health.cls}">${health.label}</span>
            <span class="dl-count">${label}</span>
          </div>`;
        })
        .join('');
    }
  }

  // ---------- agenda detail: milestones / commits / duration ----------

  let selectedAgendaSlug = null;

  function openAgendaDetail(slug) {
    selectedAgendaSlug = selectedAgendaSlug === slug ? null : slug;
    renderAgendaDetail();
  }

  function formatDuration(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  function renderAgendaDetail() {
    const el = document.getElementById('agenda-detail');
    if (!el) return;
    if (!selectedAgendaSlug || !lastState) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const job = (lastState.jobs || []).find((j) => j.slug === selectedAgendaSlug);
    if (!job) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const started = job.startedAt ? new Date(job.startedAt) : null;
    const ended = job.endedAt ? new Date(job.endedAt) : new Date();
    const durationLabel = started ? formatDuration(ended - started) : 'unknown';
    const checklistHtml = (job.checklist || []).length
      ? job.checklist
          .map(
            (i) =>
              `<div class="ad-check${i.done ? ' done' : ''}"><span class="ad-check-mark">${i.done ? '&#10003;' : '&middot;'}</span>${escapeHtml(i.text)}</div>`
          )
          .join('')
      : '<p class="empty">no milestones declared</p>';
    const commitsHtml = (job.commits || []).length
      ? job.commits
          .map(
            (c) =>
              `<div class="ad-commit"><span class="ad-commit-author">${escapeHtml(c.author)}</span><span class="ad-commit-msg">${escapeHtml(c.message)}</span></div>`
          )
          .join('')
      : '<p class="empty">no commits in this window</p>';
    el.innerHTML = `
      <div class="ad-head">
        <span class="ad-title">${escapeHtml(job.project || job.slug)}</span>
        <button type="button" class="ad-close" id="ad-close">CLOSE</button>
      </div>
      <div class="ad-meta">${escapeHtml(job.status.toUpperCase())} &middot; ${job.milestonesDone}/${job.milestonesTotal} &middot; duration ${escapeHtml(durationLabel)}</div>
      <h4 class="ad-sub">MILESTONES</h4>
      <div class="ad-checklist">${checklistHtml}</div>
      <h4 class="ad-sub">COMMITS DURING WINDOW</h4>
      <div class="ad-commits">${commitsHtml}</div>
    `;
  }

  document.getElementById('agenda-grid').addEventListener('click', (e) => {
    const block = e.target.closest('.agenda-block[data-slug]');
    if (block) openAgendaDetail(block.dataset.slug);
  });
  document.getElementById('agenda-continuations').addEventListener('click', (e) => {
    const chip = e.target.closest('.agenda-chip[data-slug]');
    if (chip) openAgendaDetail(chip.dataset.slug);
  });
  document.getElementById('agenda-detail').addEventListener('click', (e) => {
    if (e.target.closest('#ad-close')) openAgendaDetail(selectedAgendaSlug);
  });

  // ---------- render: roster ----------

  const ROSTER_DEFS = [
    { key: 'you', name: 'YOU', role: 'CEO / TASTE', engine: '', glyph: '☉' },
    { key: 'hermes', name: 'HERMES', role: 'CHIEF OF STAFF', engine: 'GEMINI-3.5-FLASH + FALLBACKS', glyph: '◆' },
    { key: 'claudeCode', name: 'CLAUDE CODE', role: 'DEV FLOOR', engine: 'MAX', glyph: '▲' },
    { key: 'geminiCli', name: 'GEMINI CLI', role: 'VOLUME ENGINE', engine: '', glyph: '◫' },
  ];

  let selectedRosterKey = null;

  function rosterStatus(lastActivityAt) {
    if (!lastActivityAt) return { cls: 'off', label: 'NO DATA' };
    const ageMin = (Date.now() - new Date(lastActivityAt).getTime()) / 60000;
    if (ageMin < 20) return { cls: 'good', label: 'ACTIVE' };
    return { cls: 'off', label: 'IDLE' };
  }

  function renderRoster(roster) {
    const el = document.getElementById('roster-grid');
    if (!roster) {
      el.innerHTML = '<p class="empty">no roster data</p>';
      renderRosterDetail(null);
      return;
    }
    el.innerHTML = ROSTER_DEFS.map((def) => {
      const data = roster[def.key] || {};
      let status = rosterStatus(data.lastActivityAt);
      if (def.key === 'geminiCli' && !data.authed) {
        status = { cls: 'warn', label: 'NOT AUTHED' };
      }
      const activityLabel = data.lastActivityAt ? relativeTime(data.lastActivityAt) : 'no activity seen';
      const isSelected = selectedRosterKey === def.key;
      return `<div class="roster-card${isSelected ? ' selected' : ''}" data-key="${def.key}" role="button" tabindex="0" aria-expanded="${isSelected}">
        <div class="roster-glyph">${def.glyph}</div>
        <div class="roster-name">${def.name}</div>
        <div class="roster-role">${def.role}</div>
        ${def.engine ? `<div class="roster-engine">${def.engine}</div>` : ''}
        <div class="roster-foot">
          <span>${escapeHtml(activityLabel)}</span>
          <span class="roster-status ${status.cls}"><i class="roster-dot ${status.cls}"></i>${status.label}</span>
        </div>
      </div>`;
    }).join('');
    renderRosterDetail(selectedRosterKey);
  }

  // ---------- roster drill-down: personal work sheet ----------

  function engineQuotaLine(key, gemini) {
    if (!gemini) return 'no usage data';
    if (key === 'geminiCli') {
      if (!gemini.available) return 'no gemini log data';
      const top = gemini.models[0];
      return `${gemini.totalCalls} call${gemini.totalCalls === 1 ? '' : 's'} today${top ? ` &middot; top model: ${escapeHtml(top.model)} (${top.count})` : ''}`;
    }
    if (key === 'claudeCode') {
      const n = gemini.claudeJobsToday || 0;
      return `${n} job${n === 1 ? '' : 's'} dispatched today`;
    }
    if (key === 'hermes') {
      if (!gemini.available) return 'no gemini log data';
      return `${gemini.totalCalls} call${gemini.totalCalls === 1 ? '' : 's'} today &middot; ${gemini.errors429} &times;429 &middot; ${gemini.errors503} &times;503`;
    }
    return '';
  }

  function renderRosterDetail(key) {
    const detailEl = document.getElementById('roster-detail');
    if (!key || !lastState || !lastState.roster || !lastState.roster[key]) {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
      return;
    }
    const def = ROSTER_DEFS.find((d) => d.key === key);
    const data = lastState.roster[key];
    const jobs = data.jobs || [];
    const commits = data.commits || [];

    const jobsHtml = jobs.length
      ? jobs
          .map((j) => {
            const pct = j.milestonesTotal ? Math.round((j.milestonesDone / j.milestonesTotal) * 100) : 0;
            return `<div class="rd-job">
              <div class="rd-job-top">
                <span class="rd-job-name">${escapeHtml(j.project || j.slug)}</span>
                <span class="job-status ${escapeHtml(j.status)}">${escapeHtml(j.status)}</span>
              </div>
              <div class="rd-job-bar"><div class="rd-job-bar-fill" style="width:${pct}%"></div></div>
              <div class="rd-job-current">${j.milestonesDone}/${j.milestonesTotal} &middot; ${escapeHtml(j.current || '—')}</div>
            </div>`;
          })
          .join('')
      : '<p class="empty">no jobs owned by this agent</p>';

    const commitsHtml = commits.length
      ? commits
          .map((c) => {
            const zero = !c.count;
            const msg = c.latestMessage
              ? `<div class="rd-commit-msg">${escapeHtml(c.latestMessage)} &middot; ${relativeTime(c.latestAt)}</div>`
              : '';
            return `<div class="rd-commit-row${zero ? ' zero' : ''}">
              <div class="rd-commit-head"><span>${escapeHtml(c.repo)}</span><span class="n">${c.count} commit${c.count === 1 ? '' : 's'} &middot; 7d</span></div>
              ${msg}
            </div>`;
          })
          .join('')
      : '<p class="empty">no commit data</p>';

    detailEl.hidden = false;
    detailEl.innerHTML = `
      <div class="rd-head">
        <span class="rd-title">${def ? escapeHtml(def.name) : escapeHtml(key)} &mdash; work sheet</span>
        <button type="button" class="rd-close" id="rd-close">CLOSE</button>
      </div>
      <div class="rd-engine">${def && def.engine ? `<span class="n">${escapeHtml(def.engine)}</span> &middot; ` : ''}${engineQuotaLine(key, lastState.gemini)}</div>
      <h4 class="rd-sub">OWNED JOBS</h4>
      <div class="rd-jobs">${jobsHtml}</div>
      <h4 class="rd-sub">COMMITS &middot; LAST 7D</h4>
      <div class="rd-commits">${commitsHtml}</div>
    `;
  }

  function selectRosterCard(key) {
    selectedRosterKey = selectedRosterKey === key ? null : key;
    renderRoster(lastState ? lastState.roster : null);
  }

  document.getElementById('roster-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.roster-card');
    if (card) selectRosterCard(card.dataset.key);
  });
  document.getElementById('roster-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.roster-card');
    if (!card) return;
    e.preventDefault();
    selectRosterCard(card.dataset.key);
  });
  document.getElementById('roster-detail').addEventListener('click', (e) => {
    if (e.target.closest('#rd-close')) selectRosterCard(selectedRosterKey);
  });

  // ---------- render: marquee ticker ----------

  let lastTickerKey = null;
  function renderTicker(ticker) {
    const track = document.getElementById('marquee-track');
    if (!ticker || !ticker.length) {
      if (lastTickerKey !== '') {
        track.innerHTML = '<span class="marquee-item">no recent activity</span>';
        lastTickerKey = '';
      }
      return;
    }
    const key = ticker.map((t) => t.type + ':' + t.text).join('|');
    if (key === lastTickerKey) return; // avoid restarting the CSS animation every poll
    lastTickerKey = key;
    const itemsHtml = ticker
      .map((t) => `<span class="marquee-item"><span class="tag">${t.type === 'commit' ? 'COMMIT' : 'LOG'}</span>${escapeHtml(t.text)}</span>`)
      .join('');
    track.innerHTML = itemsHtml + itemsHtml;
  }

  // ---------- data flow graph ----------

  const REPO_EDGE = {
    'studio-brain': 'edge-vault-github',
    'bz-site': 'edge-bzsite-github',
    'roca-site': 'edge-rocasite-github',
  };
  const AMBIENT_EDGES = ['edge-you-hermes', 'edge-hermes-claudecode', 'edge-hermes-hermesstate', 'edge-you-pc', 'edge-github-pc'];

  const AUTHOR_COLORS = new Map();
  function colorForAuthor(name) {
    if (!AUTHOR_COLORS.has(name)) {
      AUTHOR_COLORS.set(name, GREEN_RAMP[AUTHOR_COLORS.size % GREEN_RAMP.length]);
    }
    return AUTHOR_COLORS.get(name);
  }

  const edgeState = new Map(); // edgeId -> { entries: [{color,size}], interval }
  const loopsStarted = new Set();
  const hasGsapMotion = () => window.gsap && window.MotionPathPlugin;

  if (hasGsapMotion()) {
    gsap.registerPlugin(MotionPathPlugin);
  }

  function spawnPulse(edgeId, color, size) {
    if (!hasGsapMotion()) return;
    const path = document.getElementById(edgeId);
    if (!path) return;
    const group = document.getElementById('pulses');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', String(size));
    dot.setAttribute('fill', color);
    dot.style.color = color;
    group.appendChild(dot);
    gsap.to(dot, {
      motionPath: { path: '#' + edgeId, align: '#' + edgeId, alignOrigin: [0.5, 0.5] },
      duration: 1.4,
      ease: 'none',
      onComplete: () => dot.remove(),
    });
  }

  function startEdgeLoop(edgeId) {
    if (loopsStarted.has(edgeId)) return;
    loopsStarted.add(edgeId);
    const fire = () => {
      const cfg = edgeState.get(edgeId);
      if (cfg && cfg.entries.length) {
        cfg.entries.forEach((e) => spawnPulse(edgeId, e.color, e.size));
      }
      const delay = (cfg && cfg.interval) || 5200;
      setTimeout(fire, delay);
    };
    fire();
  }

  function updateFlow(git, jobs) {
    AMBIENT_EDGES.forEach((edgeId) => {
      edgeState.set(edgeId, { entries: [{ color: 'var(--ink-faint)', size: 2.5 }], interval: 5200 });
      startEdgeLoop(edgeId);
    });

    // a repo with a job actively running/verifying right now pulses acid
    // instead of its author color — the aliveness tier, live work only.
    const activeProjects = new Set((jobs || []).filter((j) => j.status === 'running' || j.status === 'verifying').map((j) => j.project));

    const legendAuthors = new Map();

    (git || []).forEach((repo) => {
      const edgeId = REPO_EDGE[repo.name];
      if (!edgeId || !repo.available || !repo.authors.length) return;
      const isActive = activeProjects.has(repo.name);
      const maxCount = Math.max(1, ...repo.authors.map((a) => a.count));
      const entries = repo.authors.map((a) => {
        const color = isActive ? 'var(--acid)' : colorForAuthor(a.author);
        legendAuthors.set(a.author, color);
        return {
          color,
          size: 3 + (a.count / maxCount) * 3.5,
          count: a.count,
        };
      });
      const totalCount = entries.reduce((s, e) => s + e.count, 0);
      const interval = clamp(7000 / Math.max(1, totalCount), 1100, 6500);
      edgeState.set(edgeId, { entries, interval });
      startEdgeLoop(edgeId);
    });

    renderLegend(legendAuthors);
  }

  function renderLegend(authorMap) {
    const el = document.getElementById('flow-legend');
    const items = [
      '<span class="legend-item"><span class="legend-dot" style="background:var(--phosphor)"></span>hermes / claude-code</span>',
      '<span class="legend-item"><span class="legend-dot" style="background:var(--ink-faint)"></span>idle channel</span>',
    ];
    authorMap.forEach((color, author) => {
      items.push(`<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${escapeHtml(author)} (24h commits)</span>`);
    });
    el.innerHTML = items.join('');
  }

  // ---------- render: links: {studio} ----------

  function renderLinks(links) {
    const listEl = document.getElementById('links-list');
    const orgEl = document.getElementById('links-org');
    if (!links) {
      listEl.innerHTML = '<p class="empty">no link data</p>';
      return;
    }
    if (links.org) orgEl.href = links.org;
    if (!links.repos || !links.repos.length) {
      listEl.innerHTML = '<p class="empty">Private Git remotes and old staging addresses are excluded. Open the archive notes above for provenance.</p>';
      return;
    }
    listEl.innerHTML = links.repos
      .map((r) => {
        const ghLabel = r.githubUrl ? r.githubUrl.replace(/^https?:\/\//, '') : null;
        const ghHtml = r.githubUrl
          ? `<a href="${escapeHtml(r.githubUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ghLabel)}</a>`
          : '<span class="links-none">no git remote configured</span>';
        const age = r.lastCommitAt ? `updated ${relativeTime(r.lastCommitAt)}` : 'no commits';
        const stagingHtml = r.stagingUrl
          ? `<div class="links-staging"><span class="tag">staging</span><a href="${escapeHtml(r.stagingUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.stagingUrl.replace(/^https?:\/\//, ''))}</a></div>`
          : '';
        return `<div class="links-row">
          <div class="links-row-top"><span class="links-name">${escapeHtml(r.name)}</span><span class="links-age">${escapeHtml(age)}</span></div>
          ${ghHtml}
          ${stagingHtml}
        </div>`;
      })
      .join('');
  }

  // ---------- concierge: {hermes} ----------

  const CONCIERGE_MAX_LEN = 2000;
  const THINKING_FRAMES = ['◐', '◓', '◑', '◒'];
  const conciergeState = { busy: false, exchanges: [] };
  let exchangeSeq = 0;
  let thinkingTimer = null;

  const conciergeForm = document.getElementById('concierge-form');
  const conciergeInput = document.getElementById('concierge-input');
  const conciergeSendBtn = document.getElementById('concierge-send');
  const conciergeTranscript = document.getElementById('concierge-transcript');

  function startThinkingAnimation() {
    if (thinkingTimer) {
      clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
    const pending = conciergeState.exchanges.find((ex) => ex.status === 'pending');
    if (!pending || reducedMotion()) return;
    let i = 0;
    thinkingTimer = setInterval(() => {
      const el = document.getElementById('thinking-' + pending.id);
      if (!el) {
        clearInterval(thinkingTimer);
        thinkingTimer = null;
        return;
      }
      i = (i + 1) % THINKING_FRAMES.length;
      el.textContent = THINKING_FRAMES[i];
    }, 220);
  }

  function forwardButtonHtml(ex) {
    if (ex.forwardStatus === 'sending') return `<button type="button" class="concierge-forward" data-exchange="${ex.id}" disabled>SENDING&hellip;</button>`;
    if (ex.forwardStatus === 'sent') return `<button type="button" class="concierge-forward sent" data-exchange="${ex.id}" disabled>SENT &#10003;</button>`;
    if (ex.forwardStatus === 'failed') return `<button type="button" class="concierge-forward failed" data-exchange="${ex.id}">RETRY [-&gt; PHONE]</button>`;
    return `<button type="button" class="concierge-forward" data-exchange="${ex.id}">[-&gt; PHONE]</button>`;
  }

  function renderConcierge() {
    if (!conciergeState.exchanges.length) {
      conciergeTranscript.innerHTML = '<p class="empty">No verified Hermes chat export is included. This was a separate agent session in the deployed app. Sending is disabled here.</p>';
      return;
    }
    conciergeTranscript.innerHTML = conciergeState.exchanges
      .map((ex) => {
        const userHtml = `<div class="concierge-msg user">
          <div class="concierge-msg-head"><span class="who">YOU</span></div>
          <div class="concierge-msg-body">${escapeHtml(ex.question)}</div>
        </div>`;
        let agentHtml;
        if (ex.status === 'pending') {
          agentHtml = `<div class="concierge-msg agent thinking">
            <div class="concierge-msg-head"><span class="who">HERMES</span></div>
            <div class="concierge-msg-body"><span class="thinking-glyph" id="thinking-${ex.id}">${THINKING_FRAMES[0]}</span> thinking&hellip;</div>
          </div>`;
        } else if (ex.status === 'error') {
          agentHtml = `<div class="concierge-msg error">
            <div class="concierge-msg-head"><span class="who">HERMES</span></div>
            <div class="concierge-msg-body">${escapeHtml(ex.errorMessage || 'hermes chat failed')}</div>
          </div>`;
        } else {
          agentHtml = `<div class="concierge-msg agent">
            <div class="concierge-msg-head"><span class="who">HERMES</span>${forwardButtonHtml(ex)}</div>
            <div class="concierge-msg-body">${escapeHtml(ex.answer)}</div>
          </div>`;
        }
        return userHtml + agentHtml;
      })
      .join('');
    conciergeTranscript.scrollTop = conciergeTranscript.scrollHeight;
    startThinkingAnimation();
  }

  conciergeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (conciergeState.busy) return;
    const message = conciergeInput.value.trim().slice(0, CONCIERGE_MAX_LEN);
    if (!message) return;

    const id = ++exchangeSeq;
    conciergeState.exchanges.push({ id, question: message, status: 'pending' });
    conciergeState.busy = true;
    conciergeInput.value = '';
    conciergeInput.disabled = true;
    conciergeSendBtn.disabled = true;
    renderConcierge();

    apiFetch('./api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
      .then((result) => {
        const ex = conciergeState.exchanges.find((x) => x.id === id);
        if (!ex) return;
        if (result.ok && result.body && typeof result.body.reply === 'string') {
          ex.status = 'done';
          ex.answer = result.body.reply || '(empty reply)';
          hidePaneToast('toast-concierge');
        } else {
          ex.status = 'error';
          ex.errorMessage = apiErrorText(result);
          showPaneToast('toast-concierge', ex.errorMessage);
        }
      })
      .finally(() => {
        conciergeState.busy = false;
        conciergeInput.disabled = false;
        conciergeSendBtn.disabled = false;
        renderConcierge();
        conciergeInput.focus();
      });
  });

  conciergeTranscript.addEventListener('click', (e) => {
    const btn = e.target.closest('.concierge-forward');
    if (!btn || btn.disabled) return;
    const id = Number(btn.dataset.exchange);
    const ex = conciergeState.exchanges.find((x) => x.id === id);
    if (!ex || ex.status !== 'done') return;
    ex.forwardStatus = 'sending';
    renderConcierge();
    apiFetch('./api/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `Q: ${ex.question}\nA: ${ex.answer}` }),
    })
      .then((result) => {
        ex.forwardStatus = result.ok && result.body && result.body.ok ? 'sent' : 'failed';
        if (ex.forwardStatus === 'failed') showPaneToast('toast-concierge', apiErrorText(result));
        else hidePaneToast('toast-concierge');
      })
      .finally(() => renderConcierge());
  });

  renderConcierge();

  // ---------- ..//review: {your eyes} ----------

  function findReviewCard(id) {
    return lastState && lastState.review ? lastState.review.find((c) => c.id === id) : null;
  }

  const EVENT_LABEL = { approved: 'APPROVE', rework: 'REWORK', comment: 'COMMENT' };
  const VERDICT_TOAST_LABEL = { approved: 'APPROVED', rework: 'REWORK', comment: 'COMMENT' };

  // Inline verdict composer (v0.16) — replaces prompt() popups. Only one
  // open at a time; kept as in-memory state (not DOM state) so a poll()
  // mid-typing can't blow away unsaved text — see render()'s guard below,
  // which skips renderReview() entirely while this is set and catches up
  // in one shot on close.
  let reviewComposer = null; // { cardId, kind, draft } — kind: approved|rework|comment|amend

  function composerDraftKey(cardId, kind) {
    return `hq-history-console-review-draft-v1:${cardId}:${kind}`;
  }
  function loadDraft(cardId, kind) {
    try {
      return localStorage.getItem(composerDraftKey(cardId, kind)) || '';
    } catch {
      return '';
    }
  }
  function saveDraft(cardId, kind, text) {
    try {
      if (text) localStorage.setItem(composerDraftKey(cardId, kind), text);
      else localStorage.removeItem(composerDraftKey(cardId, kind));
    } catch {
      // private mode / quota exceeded — same tolerance as saveLayout etc.
    }
  }

  function eventRowHtml(ev, isLast, cardId) {
    const cls = ev.verdict;
    const when = ev.at ? relativeTime(ev.at) : '';
    const label = ev.verdict === 'amended'
      ? `AMENDED${ev.amends ? ` (was ${EVENT_LABEL[ev.amends] || ev.amends.toUpperCase()})` : ''}`
      : (EVENT_LABEL[ev.verdict] || ev.verdict.toUpperCase());
    const amendBtn = isLast
      ? `<button type="button" class="review-amend-btn" data-amend-id="${escapeHtml(cardId)}">AMEND</button>`
      : '';
    return `<div class="review-event ${cls}">
      <span class="re-label ${cls}">${label}</span>
      ${ev.note ? `<span class="re-note">${escapeHtml(ev.note)}</span>` : ''}
      <span class="re-when">${escapeHtml(when)}</span>
      ${amendBtn}
    </div>`;
  }

  function threadHtml(c) {
    const events = c.events || [];
    if (!events.length) return '';
    return `<div class="review-thread">${events.map((ev, i) => eventRowHtml(ev, i === events.length - 1, c.id)).join('')}</div>`;
  }

  function composerHtml(cardId, kind) {
    const draft = reviewComposer && reviewComposer.cardId === cardId && reviewComposer.kind === kind ? reviewComposer.draft : '';
    const placeholder = kind === 'approved' ? 'optional note…' : kind === 'amend' ? 'corrected note…' : 'required note…';
    const sendLabel = kind === 'amend' ? 'SEND AMENDMENT' : 'SEND';
    return `<div class="review-composer" data-composer-card="${escapeHtml(cardId)}" data-composer-kind="${kind}">
      <textarea class="review-composer-text" placeholder="${escapeHtml(placeholder)}" rows="2">${escapeHtml(draft)}</textarea>
      <div class="review-composer-actions">
        <button type="button" class="review-composer-send">${sendLabel}</button>
        <button type="button" class="review-composer-cancel">CANCEL</button>
      </div>
    </div>`;
  }

  function reviewCardHtml(c) {
    const shotSrc = window.historicalShot(c.id);
    const thumb = c.shot
      ? `<img class="review-thumb" src="${shotSrc}" alt="${escapeHtml(c.title)}" data-lightbox="${escapeHtml(c.id)}" />`
      : '<div class="review-thumb review-thumb-empty">no screenshot</div>';
    const captured = c.capturedAt ? relativeTime(c.capturedAt) : 'unknown time';
    const staging = c.url
      ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" class="review-staging">staging &#8594;</a>`
      : '';
    const openHere = reviewComposer && reviewComposer.cardId === c.id;
    const tail = openHere
      ? composerHtml(c.id, reviewComposer.kind)
      : `<div class="review-actions">
          <button type="button" class="review-approve" data-id="${escapeHtml(c.id)}">APPROVE</button>
          <button type="button" class="review-rework" data-id="${escapeHtml(c.id)}">REWORK</button>
          <button type="button" class="review-comment" data-id="${escapeHtml(c.id)}">COMMENT</button>
        </div>`;
    return `<div class="review-card" data-id="${escapeHtml(c.id)}">
      ${thumb}
      <div class="review-card-body">
        <div class="review-card-top"><span class="review-title">${escapeHtml(c.title)}</span><span class="review-project">${escapeHtml(c.project)}</span></div>
        <p class="review-note">${escapeHtml(c.note)}</p>
        <div class="review-card-meta"><span>${escapeHtml(captured)}</span>${staging}</div>
        <p class="review-note">${escapeHtml(c.note || '')}</p>${c.shot ? `<img class="review-thumb" src="${window.historicalShot(c.id)}" alt="${escapeHtml(c.title)}" data-lightbox="${escapeHtml(c.id)}" />` : ''}${threadHtml(c)}
        ${tail}
      </div>
    </div>`;
  }

  function reviewHistoryRowHtml(c) {
    const cls = c.status === 'approved' ? 'approved' : 'rework';
    const label = c.status === 'approved' ? 'APPROVED' : 'REWORK';
    const openHere = reviewComposer && reviewComposer.cardId === c.id && reviewComposer.kind === 'amend';
    return `<div class="review-history-row ${cls}">
      <div class="rh-top">
        <span class="rh-label ${cls}">${label}</span>
        <span class="rh-title">${escapeHtml(c.title)}</span>
        <span class="rh-project">${escapeHtml(c.project)}</span>
      </div>
      <p class="review-note">${escapeHtml(c.note || '')}</p>${c.shot ? `<img class="review-thumb" src="${window.historicalShot(c.id)}" alt="${escapeHtml(c.title)}" data-lightbox="${escapeHtml(c.id)}" />` : ''}${threadHtml(c)}
      ${openHere ? composerHtml(c.id, 'amend') : ''}
    </div>`;
  }

  function renderReview(review) {
    const pendingEl = document.getElementById('review-pending');
    const historyEl = document.getElementById('review-history');
    const cards = review || [];
    const pending = cards.filter((c) => c.status === 'pending');
    const history = cards.filter((c) => c.status !== 'pending');
    pendingEl.innerHTML = pending.length ? pending.map(reviewCardHtml).join('') : '<p class="empty">nothing waiting on your eyes</p>';
    historyEl.innerHTML = history.length ? history.map(reviewHistoryRowHtml).join('') : '<p class="empty">no verdicts yet</p>';
  }

  function autoGrowComposer(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 320) + 'px';
  }

  function openComposer(cardId, kind, prefill) {
    const draft = loadDraft(cardId, kind);
    reviewComposer = { cardId, kind, draft: draft || prefill || '' };
    renderReview(lastState ? lastState.review : []);
    const ta = document.querySelector(
      `.review-composer[data-composer-card="${CSS.escape(cardId)}"][data-composer-kind="${kind}"] .review-composer-text`
    );
    if (ta) {
      autoGrowComposer(ta);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
    }
  }

  function closeComposer() {
    reviewComposer = null;
    renderReview(lastState ? lastState.review : []);
  }

  let reviewToastTimer = null;
  function showVerdictToast(label, note) {
    showPaneToast('toast-review', note ? `${label}: ${note}` : label);
    clearTimeout(reviewToastTimer);
    // an 8s preview, not a permanent record — the full text already lives
    // on in the card's own history thread (never truncated there).
    reviewToastTimer = setTimeout(() => hidePaneToast('toast-review'), 8000);
  }

  function submitFromComposer(cardId, kind) {
    const wrap = document.querySelector(
      `.review-composer[data-composer-card="${CSS.escape(cardId)}"][data-composer-kind="${kind}"]`
    );
    if (!wrap) return;
    const textarea = wrap.querySelector('.review-composer-text');
    const note = textarea.value.trim();
    if (kind !== 'approved' && !note) {
      textarea.classList.add('invalid');
      textarea.focus();
      return;
    }
    wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const isAmend = kind === 'amend';
    const url = isAmend ? './api/review/amend' : './api/review';
    const payload = isAmend ? { id: cardId, note, mode: currentMode } : { id: cardId, verdict: kind, note, mode: currentMode };
    apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((result) => {
      if (!result.ok) {
        wrap.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        showPaneToast('toast-review', apiErrorText(result));
        return;
      }
      saveDraft(cardId, kind, '');
      reviewComposer = null;
      if (kind === 'rework') playMotif('rework');
      if (isAmend) playAmendTick();
      showVerdictToast(isAmend ? 'AMENDED' : VERDICT_TOAST_LABEL[kind], note);
      return poll();
    });
  }

  function wireReviewPane(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.addEventListener('click', (e) => {
      const thumb = e.target.closest('[data-lightbox]');
      if (thumb) {
        openLightbox(thumb.dataset.lightbox);
        return;
      }
      const approveBtn = e.target.closest('.review-approve');
      if (approveBtn) {
        openComposer(approveBtn.dataset.id, 'approved');
        return;
      }
      const reworkBtn = e.target.closest('.review-rework');
      if (reworkBtn) {
        openComposer(reworkBtn.dataset.id, 'rework');
        return;
      }
      const commentBtn = e.target.closest('.review-comment');
      if (commentBtn) {
        openComposer(commentBtn.dataset.id, 'comment');
        return;
      }
      const amendBtn = e.target.closest('.review-amend-btn');
      if (amendBtn) {
        const cardId = amendBtn.dataset.amendId;
        const card = findReviewCard(cardId);
        const lastEvent = card && card.events && card.events.length ? card.events[card.events.length - 1] : null;
        openComposer(cardId, 'amend', lastEvent ? lastEvent.note || '' : '');
        return;
      }
      const sendBtn = e.target.closest('.review-composer-send');
      if (sendBtn) {
        const wrap = sendBtn.closest('.review-composer');
        if (wrap) submitFromComposer(wrap.dataset.composerCard, wrap.dataset.composerKind);
        return;
      }
      const cancelBtn = e.target.closest('.review-composer-cancel');
      if (cancelBtn) {
        const wrap = cancelBtn.closest('.review-composer');
        if (wrap) saveDraft(wrap.dataset.composerCard, wrap.dataset.composerKind, '');
        closeComposer();
      }
    });
    el.addEventListener('input', (e) => {
      const ta = e.target.closest('.review-composer-text');
      if (!ta) return;
      ta.classList.remove('invalid');
      autoGrowComposer(ta);
      if (reviewComposer) {
        reviewComposer.draft = ta.value;
        saveDraft(reviewComposer.cardId, reviewComposer.kind, ta.value);
      }
    });
    el.addEventListener('keydown', (e) => {
      const ta = e.target.closest('.review-composer-text');
      if (!ta) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const wrap = ta.closest('.review-composer');
        if (wrap) submitFromComposer(wrap.dataset.composerCard, wrap.dataset.composerKind);
      } else if (e.key === 'Escape') {
        const wrap = ta.closest('.review-composer');
        if (wrap) saveDraft(wrap.dataset.composerCard, wrap.dataset.composerKind, '');
        closeComposer();
      }
    });
  }
  wireReviewPane('review-pending');
  wireReviewPane('review-history');

  const lightboxEl = document.getElementById('lightbox');
  function openLightbox(id) {
    const card = findReviewCard(id);
    if (!card) return;
    document.getElementById('lightbox-img').src = window.historicalShot(card.id);
    document.getElementById('lightbox-project').textContent = card.project;
    document.getElementById('lightbox-time').textContent = card.capturedAt ? relativeTime(card.capturedAt) : 'unknown time';
    const urlEl = document.getElementById('lightbox-url');
    if (card.url) {
      urlEl.href = card.url;
      urlEl.hidden = false;
    } else {
      urlEl.hidden = true;
    }
    document.getElementById('lightbox-note').textContent = card.note;
    lightboxEl.hidden = false;
  }
  function closeLightbox() {
    lightboxEl.hidden = true;
  }
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  lightboxEl.addEventListener('click', (e) => {
    if (e.target === lightboxEl) closeLightbox();
  });

  // ---------- ..//commons: {the ensemble} ----------

  const PERSONA_TIERS = ['devon', 'ara', 'vex', 'ledger'];
  const commonsUpdatesEl = document.getElementById('commons-updates');
  const commonsArchiveEl = document.getElementById('commons-archive');
  const commonsTranscriptEl = document.getElementById('commons-transcript');
  const commonsNewBadgeEl = document.getElementById('commons-new-badge');
  const commonsTopicNextEl = document.getElementById('commons-topic-next');
  const commonsTopicForm = document.getElementById('commons-topic-form');
  const commonsTopicInput = document.getElementById('commons-topic-input');
  const commonsTopicSendBtn = document.getElementById('commons-topic-send');

  let commonsJams = [];
  let commonsSelectedSlug = null;

  function personaTierClass(name) {
    const key = typeof name === 'string' ? name.toLowerCase() : '';
    return PERSONA_TIERS.includes(key) ? key : 'ledger';
  }

  function commonsTurnHtml(turn) {
    return `<div class="commons-turn">
      <span class="commons-who ${personaTierClass(turn.speaker)}">${escapeHtml(turn.speaker)}:</span>
      <span class="commons-text">${escapeHtml(turn.text)}</span>
    </div>`;
  }

  function renderCommonsTranscript(jam, isNewest, shouldReveal) {
    commonsNewBadgeEl.hidden = !isNewest;
    if (!jam) {
      commonsTranscriptEl.innerHTML = '<p class="empty">no jams yet &mdash; the first one lands at 14:00 or 00:00 IST</p>';
      return;
    }
    const topic = jam.topic ? `<p class="commons-topic">&ldquo;${escapeHtml(jam.topic)}&rdquo;</p>` : '';
    commonsTranscriptEl.innerHTML = topic + jam.turns.map(commonsTurnHtml).join('');
    if (shouldReveal && !reducedMotion() && typeof gsap !== 'undefined') {
      // as if being spoken: word-by-word across the whole transcript, in
      // speaking order — an information reveal (houseEase), not a toy
      let words = [];
      commonsTranscriptEl.querySelectorAll('.commons-text').forEach((el) => {
        words = words.concat(splitWordsFresh(el));
      });
      if (words.length) {
        gsap.set(words, { opacity: 0 });
        gsap.to(words, { opacity: 1, duration: 0.12, stagger: 0.02, ease: houseEase });
      }
    }
  }

  function renderCommonsUpdates(jam) {
    if (!jam || !jam.deptUpdates.length) {
      commonsUpdatesEl.innerHTML = '<p class="empty">no department updates yet</p>';
      return;
    }
    commonsUpdatesEl.innerHTML = jam.deptUpdates
      .map(
        (u) => `<div class="commons-update-card">
          <span class="commons-update-who commons-who ${personaTierClass(u.speaker)}">${escapeHtml(u.speaker)}</span>
          <span class="commons-update-text">${escapeHtml(u.text)}</span>
        </div>`
      )
      .join('');
  }

  function commonsArchiveLabel(jam, index) {
    const when = jam.capturedAt ? relativeTime(jam.capturedAt) : jam.slug;
    const topic = jam.topic ? jam.topic.slice(0, 48) + (jam.topic.length > 48 ? '…' : '') : jam.slug;
    return `${index === 0 ? '(latest) ' : ''}${when} — ${topic}`;
  }

  function renderCommonsArchive() {
    commonsArchiveEl.innerHTML = commonsJams
      .map((j, i) => `<option value="${escapeHtml(j.slug)}">${escapeHtml(commonsArchiveLabel(j, i))}</option>`)
      .join('');
    if (commonsJams.length) commonsArchiveEl.value = commonsSelectedSlug || commonsJams[0].slug;
  }

  function renderCommonsNextTopic(jams) {
    if (!commonsTopicNextEl) return;
    const next = jams && jams.nextTopic;
    commonsTopicNextEl.textContent = next ? `up next: “${next}”` : '';
  }

  // undefined = no baseline established yet (first render ever) — mirrors
  // checkJamNotifications' own baseline pattern so the word-reveal never
  // plays for a jam that was already there before this session started.
  let commonsRevealBaselineSlug;

  function renderCommons(jams) {
    commonsJams = (jams && jams.items) || [];
    const latest = commonsJams[0] || null;
    renderCommonsUpdates(latest);
    renderCommonsArchive();
    renderCommonsNextTopic(jams);
    // stick to the newest jam unless the operator has explicitly browsed
    // the archive to something that still exists in the current list
    if (!commonsJams.some((j) => j.slug === commonsSelectedSlug)) {
      commonsSelectedSlug = latest ? latest.slug : null;
    }
    const selected = commonsJams.find((j) => j.slug === commonsSelectedSlug) || null;
    const isNewest = Boolean(selected && latest && selected.slug === latest.slug);
    const latestSlug = latest ? latest.slug : null;
    const isFreshJam = commonsRevealBaselineSlug !== undefined && latestSlug !== null && latestSlug !== commonsRevealBaselineSlug;
    commonsRevealBaselineSlug = latestSlug;
    renderCommonsTranscript(selected, isNewest, isNewest && isFreshJam);
  }

  if (commonsArchiveEl) {
    commonsArchiveEl.addEventListener('change', (e) => {
      commonsSelectedSlug = e.target.value;
      const jam = commonsJams.find((j) => j.slug === commonsSelectedSlug) || null;
      const latest = commonsJams[0] || null;
      renderCommonsTranscript(jam, Boolean(jam && latest && jam.slug === latest.slug));
    });
  }

  if (commonsTopicForm) {
    commonsTopicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const topic = commonsTopicInput.value.trim().slice(0, 300);
      if (!topic) return;
      commonsTopicInput.disabled = true;
      commonsTopicSendBtn.disabled = true;
      apiFetch('./api/jam-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
        .then((result) => {
          if (!result.ok) {
            showPaneToast('toast-commons', apiErrorText(result));
            return;
          }
          hidePaneToast('toast-commons');
          commonsTopicInput.value = '';
          if (commonsTopicNextEl) commonsTopicNextEl.textContent = `up next: “${topic}”`;
        })
        .finally(() => {
          commonsTopicInput.disabled = false;
          commonsTopicSendBtn.disabled = false;
          commonsTopicInput.focus();
        });
    });
  }

  // A brand new jam file appearing is a face moment (like a pending review
  // card) worth a short held gaze, not a persistent one — the sculpture
  // releases back to ambient after this window rather than staying "on".
  const JAM_FACE_HOLD_MS = 20000;
  let jamFaceTimer = null;
  let seenLatestJamSlug = null;
  let jamNotifyBaseline = false;

  function checkJamNotifications(jams) {
    const items = (jams && jams.items) || [];
    const latest = items[0] || null;
    const latestSlug = latest ? latest.slug : null;
    if (jamNotifyBaseline && latestSlug && latestSlug !== seenLatestJamSlug) {
      showGlobalToast(`NEW JAM — ${latest.topic || 'the ensemble is jamming'}`);
      playMotif('jam-start');
      wfJamActive = true;
      clearTimeout(jamFaceTimer);
      jamFaceTimer = setTimeout(() => {
        wfJamActive = false;
      }, JAM_FACE_HOLD_MS);
    }
    seenLatestJamSlug = latestSlug;
    jamNotifyBaseline = true;
  }

  // ---------- ..//roadmap: {priorities} ----------

  const ROADMAP_HORIZONS = ['now', 'next', 'later', 'someday'];
  const ROADMAP_ALL_KEYS = ['now', 'next', 'later', 'someday', 'shipped'];
  // Dim phosphor tints only — never acid (see roadmap-item-top in style.css
  // for the one spot acid is allowed to appear in this pane). `idea` reuses
  // the exact muted cyan already established for the applications funnel
  // (APPLICATION_STAGE_COLORS.INTERVIEW) rather than inventing a new hue.
  const ROADMAP_CATEGORY_COLOR = {
    client: 'var(--ph-dim2)',
    studio: 'var(--ink-dim)',
    idea: '#6bd4ff',
    curiosity: '#b98bd6',
    learning: 'var(--amber-dim)',
    personal: '#d98bb0',
  };

  let roadmapEditingId = null;

  function findRoadmapItem(id) {
    if (!lastState || !lastState.roadmap) return null;
    for (const h of ROADMAP_ALL_KEYS) {
      const found = (lastState.roadmap[h] || []).find((it) => it.id === id);
      if (found) return found;
    }
    return null;
  }

  function roadmapChipHtml(category) {
    const color = ROADMAP_CATEGORY_COLOR[category];
    const style = color ? ` style="--chip-color:${color}"` : '';
    return `<span class="roadmap-chip"${style}>${escapeHtml(category)}</span>`;
  }

  function roadmapItemHtml(item, isTopNow) {
    const editing = roadmapEditingId === item.id;
    const textHtml = editing
      ? `<input type="text" class="roadmap-edit-input" data-edit-id="${escapeHtml(item.id)}" value="${escapeHtml(item.text)}" maxlength="300" />`
      : `<span class="roadmap-text" data-edit-trigger="${escapeHtml(item.id)}" role="button" tabindex="0">${escapeHtml(item.text)}</span>`;
    return `<div class="roadmap-item${isTopNow ? ' roadmap-item-top' : ''}" data-id="${escapeHtml(item.id)}">
      <button type="button" class="roadmap-arrow roadmap-promote" data-id="${escapeHtml(item.id)}" title="Promote" aria-label="Promote">&#9650;</button>
      <button type="button" class="roadmap-arrow roadmap-demote" data-id="${escapeHtml(item.id)}" title="Demote" aria-label="Demote">&#9660;</button>
      ${roadmapChipHtml(item.category)}
      ${textHtml}
      <label class="roadmap-done-wrap" title="Mark shipped">
        <input type="checkbox" class="roadmap-done-check" data-id="${escapeHtml(item.id)}" aria-label="Mark shipped" />
      </label>
    </div>`;
  }

  function roadmapItemsHtml(horizon, items) {
    if (!items.length) return '<p class="empty">nothing here</p>';
    return items.map((it, i) => roadmapItemHtml(it, horizon === 'now' && i === 0)).join('');
  }

  function roadmapShippedRowHtml(it) {
    return `<div class="roadmap-shipped-row">${roadmapChipHtml(it.category)}<span class="roadmap-shipped-text">${escapeHtml(it.text)}</span><span class="roadmap-shipped-date">${escapeHtml(it.doneAt || '')}</span></div>`;
  }

  function renderRoadmap(roadmap) {
    const r = roadmap || { now: [], next: [], later: [], someday: [], shipped: [] };
    ROADMAP_HORIZONS.forEach((h) => {
      const el = document.getElementById('roadmap-items-' + h);
      if (el) el.innerHTML = roadmapItemsHtml(h, r[h] || []);
    });
    const shippedEl = document.getElementById('roadmap-items-shipped');
    if (shippedEl) {
      const shipped = (r.shipped || []).slice().sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 20);
      shippedEl.innerHTML = shipped.length ? shipped.map(roadmapShippedRowHtml).join('') : '<p class="empty">nothing shipped yet</p>';
    }
  }

  function submitRoadmapMove(id, direction) {
    apiFetch('./api/roadmap/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, direction }),
    }).then((result) => {
      if (!result.ok) {
        showPaneToast('toast-roadmap', apiErrorText(result));
        return;
      }
      hidePaneToast('toast-roadmap');
      // promote is the direct-click moment worth a chime; demote is a quiet
      // administrative move, same distinction as playTaskTick's own doctrine
      if (direction === 'promote') playTaskTick();
      return poll();
    });
  }

  function submitRoadmapDone(id, checkboxEl) {
    if (checkboxEl) checkboxEl.disabled = true;
    apiFetch('./api/roadmap/done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then((result) => {
      if (!result.ok) {
        showPaneToast('toast-roadmap', apiErrorText(result));
        if (checkboxEl) checkboxEl.disabled = false;
        return;
      }
      hidePaneToast('toast-roadmap');
      playMotif('job-done');
      return poll();
    });
  }

  function cancelRoadmapEdit() {
    roadmapEditingId = null;
    renderRoadmap(lastState ? lastState.roadmap : null);
  }

  // Enter and blur both commit; Escape cancels. Guarding on
  // `roadmapEditingId === id` up front means whichever of Enter/blur fires
  // first wins and the other becomes a no-op, instead of double-submitting.
  function commitRoadmapEdit(id, value) {
    if (roadmapEditingId !== id) return;
    roadmapEditingId = null;
    const original = findRoadmapItem(id);
    const text = value.trim();
    if (!text || (original && text === original.text)) {
      renderRoadmap(lastState ? lastState.roadmap : null);
      return;
    }
    apiFetch('./api/roadmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text }),
    }).then((result) => {
      if (!result.ok) {
        showPaneToast('toast-roadmap', apiErrorText(result));
        return;
      }
      hidePaneToast('toast-roadmap');
      return poll();
    });
  }

  const roadmapBoardEl = document.getElementById('roadmap-board');
  if (roadmapBoardEl) {
    roadmapBoardEl.addEventListener('click', (e) => {
      const promoteBtn = e.target.closest('.roadmap-promote');
      if (promoteBtn) {
        submitRoadmapMove(promoteBtn.dataset.id, 'promote');
        return;
      }
      const demoteBtn = e.target.closest('.roadmap-demote');
      if (demoteBtn) {
        submitRoadmapMove(demoteBtn.dataset.id, 'demote');
        return;
      }
      const trigger = e.target.closest('[data-edit-trigger]');
      if (trigger) {
        roadmapEditingId = trigger.dataset.editTrigger;
        renderRoadmap(lastState ? lastState.roadmap : null);
        const input = document.querySelector('.roadmap-edit-input[data-edit-id="' + CSS.escape(roadmapEditingId) + '"]');
        if (input) {
          input.focus();
          input.select();
        }
      }
    });
    roadmapBoardEl.addEventListener('change', (e) => {
      const cb = e.target.closest('.roadmap-done-check');
      if (!cb) return;
      submitRoadmapDone(cb.dataset.id, cb);
    });
    roadmapBoardEl.addEventListener('keydown', (e) => {
      const input = e.target.closest('.roadmap-edit-input');
      if (!input) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRoadmapEdit(input.dataset.editId, input.value);
      } else if (e.key === 'Escape') {
        cancelRoadmapEdit();
      }
    });
    roadmapBoardEl.addEventListener('focusout', (e) => {
      const input = e.target.closest('.roadmap-edit-input');
      if (!input) return;
      commitRoadmapEdit(input.dataset.editId, input.value);
    });
  }

  ROADMAP_HORIZONS.forEach((horizon) => {
    const form = document.querySelector('.roadmap-add-form[data-add-horizon="' + horizon + '"]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const categorySel = form.querySelector('.roadmap-add-category');
      const input = form.querySelector('.roadmap-add-input');
      const sendBtn = form.querySelector('.roadmap-add-send');
      const text = input.value.trim().slice(0, 300);
      if (!text) return;
      const category = categorySel.value;
      input.disabled = true;
      categorySel.disabled = true;
      sendBtn.disabled = true;
      apiFetch('./api/roadmap/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon, category, text }),
      })
        .then((result) => {
          if (!result.ok) {
            showPaneToast('toast-roadmap', apiErrorText(result));
            return;
          }
          hidePaneToast('toast-roadmap');
          input.value = '';
          return poll();
        })
        .finally(() => {
          input.disabled = false;
          categorySel.disabled = false;
          sendBtn.disabled = false;
          input.focus();
        });
    });
  });

  // ---------- ..//library: {the study} ----------

  // Dim phosphor tints only, same taxonomy-not-decoration law as
  // ROADMAP_CATEGORY_COLOR — the one exception is the pane-local candle
  // "new today" marker on a lesson card (library-lesson-new) or a shelf
  // spine (shelf-spine.is-new), the Study's own single living-moment
  // accent (see style.css's --candle token comment).
  const LIBRARY_TOPIC_COLOR = {
    motion: 'var(--ph-dim2)',
    'creative-3d': '#6bd4ff',
    'web-craft': '#b98bd6',
    'ai-models': 'var(--amber-dim)',
    'studio-ops': 'var(--ink-dim)',
  };

  let libraryInboxCount = 0;
  let expandedLessonSlug = null;

  function libraryChipHtml(topic) {
    const color = LIBRARY_TOPIC_COLOR[topic];
    const style = color ? ` style="--chip-color:${color}"` : '';
    return `<span class="roadmap-chip"${style}>${escapeHtml(topic)}</span>`;
  }

  function lessonItemHtml(lesson) {
    const expanded = expandedLessonSlug === lesson.slug;
    const date = (lesson.capturedAt || '').slice(0, 10);
    const detail = expanded
      ? `<div class="library-lesson-body">
          <p class="library-lesson-text">${escapeHtml(lesson.body)}</p>
          ${lesson.source ? `<div class="library-lesson-meta">source: ${escapeHtml(lesson.source)}</div>` : ''}
          ${lesson.distilledFrom ? `<div class="library-lesson-meta">from: ${escapeHtml(lesson.distilledFrom)}</div>` : ''}
          ${lesson.appliesTo.length ? `<div class="library-lesson-meta">applies to: ${lesson.appliesTo.map(escapeHtml).join(', ')}</div>` : ''}
          ${lesson.proposalSkill ? `<div class="library-lesson-proposal">proposes amending <strong>${escapeHtml(lesson.proposalSkill)}</strong> — ${escapeHtml(lesson.proposalSummary || '')}${lesson.reviewCardId ? ` (review card filed, awaiting verdict)` : ''}</div>` : ''}
        </div>`
      : '';
    return `<div class="library-lesson${expanded ? ' expanded' : ''}${lesson.isNew ? ' library-lesson-new' : ''}" data-slug="${escapeHtml(lesson.slug)}">
      <div class="library-lesson-row" data-toggle-lesson="${escapeHtml(lesson.slug)}" role="button" tabindex="0">
        ${libraryChipHtml(lesson.topic)}
        <span class="library-lesson-title">${escapeHtml(lesson.title)}</span>
        <span class="library-lesson-date">${escapeHtml(date)}</span>
        <span class="library-lesson-arrow" aria-hidden="true">${expanded ? '&#9662;' : '&#9656;'}</span>
      </div>
      ${detail}
    </div>`;
  }

  function queueItemHtml(item, index, total) {
    return `<div class="library-queue-item" data-id="${escapeHtml(item.id)}">
      <div class="library-queue-arrows">
        <button type="button" class="library-queue-arrow" data-queue-move="up" data-id="${escapeHtml(item.id)}" ${index === 0 ? 'disabled' : ''} title="Move up" aria-label="Move up">&#9650;</button>
        <button type="button" class="library-queue-arrow" data-queue-move="down" data-id="${escapeHtml(item.id)}" ${index === total - 1 ? 'disabled' : ''} title="Move down" aria-label="Move down">&#9660;</button>
      </div>
      <div class="library-queue-main">
        <span class="library-queue-title">${escapeHtml(item.title)}</span>
        ${item.note ? `<span class="library-queue-note">${escapeHtml(item.note)}</span>` : ''}
      </div>
    </div>`;
  }

  // Kind-as-taxonomy, same dim-tint discipline as LIBRARY_TOPIC_COLOR — the
  // shelf's own "is-new" candle marker (style.css) is the one living-moment
  // exception, not these.
  const SHELF_KIND_COLOR = {
    book: 'var(--candle-dim)',
    movie: '#6bd4ff',
    paper: 'var(--ph-dim2)',
    link: 'var(--ink-dim)',
    person: '#b98bd6',
  };

  function shelfSpineHtml(item) {
    const color = SHELF_KIND_COLOR[item.kind] || 'var(--ink-dim)';
    const titleAttr = `${item.kind}${item.hasFile ? ' · uploaded' : ''}${item.note ? ' — ' + item.note : ''}`;
    const cls = `shelf-spine${item.hasFile ? ' has-file' : ''}${item.isNew ? ' is-new' : ''}`;
    return `<div class="${cls}" style="--spine-color:${color}" title="${escapeHtml(titleAttr)}">
      <span class="shelf-spine-title">${escapeHtml(item.title)}</span>
    </div>`;
  }

  function renderShelf(collection) {
    const items = collection || [];
    const gridEl = document.getElementById('shelf-grid');
    if (gridEl) {
      gridEl.innerHTML = items.length
        ? items.map(shelfSpineHtml).join('')
        : '<p class="empty">the shelf is bare</p>';
    }
    const countEl = document.getElementById('shelf-count');
    if (countEl) countEl.textContent = items.length ? String(items.length) : '';
  }

  function renderLibrary(library) {
    const lib = library || { lessons: [], queue: [], inbox: [], inboxCount: 0, collection: [] };
    const lessonsEl = document.getElementById('library-lessons');
    if (lessonsEl) {
      lessonsEl.innerHTML = lib.lessons.length
        ? lib.lessons.map(lessonItemHtml).join('')
        : '<p class="empty">no lessons distilled yet</p>';
    }
    const queueEl = document.getElementById('library-queue');
    if (queueEl) {
      queueEl.innerHTML = lib.queue.length
        ? lib.queue.map((it, i) => queueItemHtml(it, i, lib.queue.length)).join('')
        : '<p class="empty">queue empty</p>';
    }
    const queueCountEl = document.getElementById('library-queue-count');
    if (queueCountEl) queueCountEl.textContent = lib.queue.length ? String(lib.queue.length) : '';
    const inboxCountEl = document.getElementById('library-inbox-count');
    if (inboxCountEl) inboxCountEl.textContent = lib.inboxCount ? String(lib.inboxCount) : '';
    libraryInboxCount = lib.inboxCount || 0;
    renderShelf(lib.collection);
    renderRail();
  }

  const libraryLessonsEl = document.getElementById('library-lessons');
  if (libraryLessonsEl) {
    const toggleLesson = (slug) => {
      expandedLessonSlug = expandedLessonSlug === slug ? null : slug;
      renderLibrary(lastState ? lastState.library : null);
    };
    libraryLessonsEl.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-lesson]');
      if (toggle) toggleLesson(toggle.dataset.toggleLesson);
    });
    libraryLessonsEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const toggle = e.target.closest('[data-toggle-lesson]');
      if (!toggle) return;
      e.preventDefault();
      toggleLesson(toggle.dataset.toggleLesson);
    });
  }

  const libraryQueueEl = document.getElementById('library-queue');
  if (libraryQueueEl) {
    libraryQueueEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.library-queue-arrow');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      apiFetch('./api/library/queue/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: btn.dataset.id, direction: btn.dataset.queueMove }),
      }).then((result) => {
        if (!result.ok) {
          showPaneToast('toast-library', apiErrorText(result));
          btn.disabled = false;
          return;
        }
        hidePaneToast('toast-library');
        return poll();
      });
    });
  }

  const libraryInboxForm = document.getElementById('library-inbox-form');
  if (libraryInboxForm) {
    libraryInboxForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const urlInput = document.getElementById('library-inbox-url');
      const noteInput = document.getElementById('library-inbox-note');
      const sendBtn = document.getElementById('library-inbox-send');
      const note = noteInput.value.trim();
      const url = urlInput.value.trim();
      if (!note && !url) return;
      urlInput.disabled = true;
      noteInput.disabled = true;
      sendBtn.disabled = true;
      apiFetch('./api/library/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, url }),
      })
        .then((result) => {
          if (!result.ok) {
            showPaneToast('toast-library', apiErrorText(result));
            return;
          }
          hidePaneToast('toast-library');
          urlInput.value = '';
          noteInput.value = '';
          return poll();
        })
        .finally(() => {
          urlInput.disabled = false;
          noteInput.disabled = false;
          sendBtn.disabled = false;
        });
    });
  }

  // ---------- the shelf: "add to the shelf" (upload or typed reference) ----------

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('file read failed'));
      reader.onload = () => {
        // dataURL is "data:<mime>;base64,<payload>" — only the payload goes
        // to the server (it already knows the kind from the form, and
        // derives its own canonical mime from the extension).
        const result = String(reader.result || '');
        const idx = result.indexOf(',');
        resolve(idx === -1 ? result : result.slice(idx + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  const shelfForm = document.getElementById('shelf-form');
  if (shelfForm) {
    shelfForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const kindSel = document.getElementById('shelf-kind');
      const titleInput = document.getElementById('shelf-title');
      const noteInput = document.getElementById('shelf-note');
      const urlInput = document.getElementById('shelf-url');
      const fileInput = document.getElementById('shelf-file');
      const sendBtn = document.getElementById('shelf-send');

      const kind = kindSel.value;
      const title = titleInput.value.trim();
      const note = noteInput.value.trim();
      const url = urlInput.value.trim();
      const file = fileInput.files && fileInput.files[0];
      if (!file && !title) return;

      const fields = [kindSel, titleInput, noteInput, urlInput, fileInput, sendBtn];
      fields.forEach((el) => { el.disabled = true; });
      sendBtn.classList.add('lit');

      const clearForm = () => {
        titleInput.value = '';
        noteInput.value = '';
        urlInput.value = '';
        fileInput.value = '';
      };

      const request = file
        ? readFileAsBase64(file).then((dataBase64) =>
            apiFetch('./api/library/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, kind, title, note, dataBase64 }),
            })
          )
        : apiFetch('./api/library/collection/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, title, note, url }),
          });

      request
        .then((result) => {
          if (!result.ok) {
            showPaneToast('toast-library', apiErrorText(result));
            return;
          }
          hidePaneToast('toast-library');
          document.dispatchEvent(new CustomEvent('study:upload-landed'));
          clearForm();
          return poll();
        })
        .catch(() => showPaneToast('toast-library', 'could not read that file'))
        .finally(() => {
          fields.forEach((el) => { el.disabled = false; });
          sendBtn.classList.remove('lit');
        });
    });
  }

  // ---------- ask the librarian ----------

  const LIBRARIAN_MAX_LEN = 2000;
  const LIBRARIAN_DRAFT_KEY = 'hq-history-console-librarian-draft-v1';
  const librarianState = { busy: false, exchanges: [] };
  let librarianSeq = 0;
  let librarianThinkingTimer = null;

  const librarianForm = document.getElementById('librarian-form');
  const librarianInput = document.getElementById('librarian-input');
  const librarianSendBtn = document.getElementById('librarian-send');
  const librarianTranscript = document.getElementById('librarian-transcript');

  if (librarianInput) {
    try {
      librarianInput.value = localStorage.getItem(LIBRARIAN_DRAFT_KEY) || '';
    } catch {
      // private mode / quota exceeded — draft just doesn't survive a reload
    }
    librarianInput.addEventListener('input', () => {
      try {
        if (librarianInput.value) localStorage.setItem(LIBRARIAN_DRAFT_KEY, librarianInput.value);
        else localStorage.removeItem(LIBRARIAN_DRAFT_KEY);
      } catch {
        // same tolerance as saveLayout/saveDraft elsewhere
      }
    });
  }

  function startLibrarianThinkingAnimation() {
    if (librarianThinkingTimer) {
      clearInterval(librarianThinkingTimer);
      librarianThinkingTimer = null;
    }
    const pending = librarianState.exchanges.find((ex) => ex.status === 'pending');
    if (!pending || reducedMotion()) return;
    let i = 0;
    librarianThinkingTimer = setInterval(() => {
      const el = document.getElementById('librarian-thinking-' + pending.id);
      if (!el) {
        clearInterval(librarianThinkingTimer);
        librarianThinkingTimer = null;
        return;
      }
      i = (i + 1) % THINKING_FRAMES.length;
      el.textContent = THINKING_FRAMES[i];
    }, 220);
  }

  function renderLibrarian() {
    if (!librarianTranscript) return;
    if (!librarianState.exchanges.length) {
      librarianTranscript.innerHTML = '<p class="empty">no questions yet &mdash; ask about anything on the shelf</p>';
      return;
    }
    librarianTranscript.innerHTML = librarianState.exchanges
      .map((ex) => {
        const userHtml = `<div class="librarian-msg user">
          <div class="librarian-msg-head"><span class="who">YOU</span></div>
          <div class="librarian-msg-body">${escapeHtml(ex.question)}</div>
        </div>`;
        let agentHtml;
        if (ex.status === 'pending') {
          agentHtml = `<div class="librarian-msg agent thinking">
            <div class="librarian-msg-head"><span class="who">THE LIBRARIAN</span></div>
            <div class="librarian-msg-body"><span class="librarian-thinking-glyph" id="librarian-thinking-${ex.id}">${THINKING_FRAMES[0]}</span> turning pages&hellip;</div>
          </div>`;
        } else if (ex.status === 'error') {
          agentHtml = `<div class="librarian-msg error">
            <div class="librarian-msg-head"><span class="who">THE LIBRARIAN</span></div>
            <div class="librarian-msg-body">${escapeHtml(ex.errorMessage || 'the quill has stopped scratching')}</div>
          </div>`;
        } else {
          agentHtml = `<div class="librarian-msg agent">
            <div class="librarian-msg-head"><span class="who">THE LIBRARIAN</span></div>
            <div class="librarian-msg-body">${escapeHtml(ex.answer)}</div>
          </div>`;
        }
        return userHtml + agentHtml;
      })
      .join('');
    librarianTranscript.scrollTop = librarianTranscript.scrollHeight;
    startLibrarianThinkingAnimation();
  }

  if (librarianForm) {
    librarianForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (librarianState.busy) return;
      const message = librarianInput.value.trim().slice(0, LIBRARIAN_MAX_LEN);
      if (!message) return;

      const id = ++librarianSeq;
      librarianState.exchanges.push({ id, question: message, status: 'pending' });
      librarianState.busy = true;
      document.dispatchEvent(new CustomEvent('study:librarian-busy', { detail: { busy: true } }));
      librarianInput.value = '';
      try {
        localStorage.removeItem(LIBRARIAN_DRAFT_KEY);
      } catch {
        // best-effort
      }
      librarianInput.disabled = true;
      librarianSendBtn.disabled = true;
      renderLibrarian();

      apiFetch('./api/librarian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
        .then((result) => {
          const ex = librarianState.exchanges.find((x) => x.id === id);
          if (!ex) return;
          if (result.ok && result.body && typeof result.body.reply === 'string') {
            ex.status = 'done';
            ex.answer = result.body.reply || '(empty reply)';
            hidePaneToast('toast-library');
          } else {
            ex.status = 'error';
            ex.errorMessage = apiErrorText(result);
            showPaneToast('toast-library', ex.errorMessage);
          }
        })
        .finally(() => {
          librarianState.busy = false;
          document.dispatchEvent(new CustomEvent('study:librarian-busy', { detail: { busy: false } }));
          librarianInput.disabled = false;
          librarianSendBtn.disabled = false;
          renderLibrarian();
          librarianInput.focus();
        });
    });
  }

  // ---------- window manager: collapse / fullscreen / hide / float ----------

  const LAYOUT_KEY = 'hq-history-console-layout-v1';
  const FLOAT_KEY = 'hq-history-console-floating-v1';
  const PIN_KEY = 'hq-history-console-pinned-v1';
  const LOADOUTS_KEY = 'hq-history-console-loadouts-v1';
  const LOADOUT_ACTIVE_KEY = 'hq-history-console-loadout-active-v1';
  const FLOAT_QUERY = '(min-width: 1024px)';
  const gridEl = document.getElementById('grid');
  const railEl = document.getElementById('railnav');
  const loadoutStripEl = document.getElementById('loadout-strip');
  const snapOverlayEl = document.getElementById('snap-overlay');

  // `modes` gates rail visibility + floating-mode auto-tiling (see
  // visiblePanes()/renderRail() below) — omitted means "studio only", the
  // pre-PERSONAL-MODE default, so every pane declared before v0.13 keeps its
  // exact old behavior. `personalLabel` overrides the rail label only in
  // personal mode (agenda/review/pipeline are the same DOM pane in both
  // modes, re-themed and re-sourced, not duplicated — see render()).
  const PANES = [
    { id: 'agenda', label: '..//agenda', modes: ['studio', 'personal'] },
    { id: 'credits', label: '..//credits', modes: ['unavailable'] },
    { id: 'fuel', label: '..//fuel: {tank}', modes: ['unavailable'] },
    { id: 'rnd', label: '..//rnd: {learnings}', modes: ['unavailable'] },
    { id: 'roster', label: '..//roster' },
    { id: 'pipeline', label: '..//pipeline', personalLabel: '..//pipeline:{applications}', modes: ['unavailable'] },
    { id: 'tasks', label: '..//tasks: {zoh}', modes: ['studio', 'personal'] },
    { id: 'concierge', label: '..//concierge' },
    { id: 'links', label: '..//links' },
    { id: 'clients', label: '..//clients', modes: ['unavailable'] },
    { id: 'flow', label: '..//dataflow' },
    { id: 'review', label: '..//review', modes: ['studio', 'personal'] },
    { id: 'commons', label: '..//commons' },
    { id: 'roadmap', label: '..//roadmap', modes: ['unavailable'] },
    { id: 'library', label: '..//library' },
    { id: 'canvas', label: '..//canvas: {production floor}' },
    { id: 'bridge', label: '..//bridge: {light-a/v}', modes: ['unavailable'] },
    { id: 'quests', label: '..//quests', modes: ['unavailable'] },
    { id: 'pursuits', label: '..//pursuits', modes: ['unavailable'] },
    { id: 'assets', label: '..//assets', modes: ['unavailable'] },
  ];

  const DEFAULT_FLOAT = {
    agenda: { x: 24, y: 24, w: 460, h: 660 },
    credits: { x: 504, y: 24, w: 400, h: 300 },
    roster: { x: 924, y: 24, w: 400, h: 340 },
    pipeline: { x: 504, y: 344, w: 400, h: 340 },
    concierge: { x: 924, y: 384, w: 400, h: 420 },
    tasks: { x: 924, y: 804, w: 400, h: 420 },
    links: { x: 24, y: 704, w: 460, h: 320 },
    flow: { x: 504, y: 704, w: 820, h: 420 },
    review: { x: 24, y: 1044, w: 1300, h: 480 },
    commons: { x: 24, y: 1544, w: 1300, h: 480 },
    clients: { x: 24, y: 2044, w: 1300, h: 480 },
    roadmap: { x: 24, y: 2544, w: 1300, h: 560 },
    library: { x: 24, y: 3124, w: 1300, h: 560 },
    canvas: { x: 24, y: 3704, w: 1300, h: 780 },
    bridge: { x: 24, y: 4504, w: 1300, h: 680 },
    fuel: { x: 24, y: 5204, w: 900, h: 620 },
    rnd: { x: 24, y: 5844, w: 1300, h: 620 },
  };

  // PERSONAL MODE's own floating-mode defaults for panes it either adds
  // (quests/pursuits/assets) or reshapes (pipeline needs more width for the
  // 5-column applications funnel than the studio jobs-list ever did) —
  // layered on top of DEFAULT_FLOAT by paneFloatRect() so studio mode's
  // pipeline default stays untouched (pixel-identical requirement).
  const DEFAULT_FLOAT_PERSONAL = {
    quests: { x: 504, y: 24, w: 400, h: 300 },
    pursuits: { x: 924, y: 24, w: 400, h: 300 },
    pipeline: { x: 504, y: 344, w: 820, h: 340 },
    assets: { x: 504, y: 704, w: 820, h: 260 },
    tasks: { x: 924, y: 344, w: 400, h: 620 },
  };

  function loadLayout() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  function saveLayout() {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(paneLayout));
    } catch {
      // private mode / quota exceeded — layout just won't persist across reloads
    }
  }
  function loadFloat() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FLOAT_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  function saveFloat() {
    try {
      localStorage.setItem(FLOAT_KEY, JSON.stringify(floatState));
    } catch {
      // same private-mode/quota tolerance as saveLayout
    }
  }

  function loadPinned() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PIN_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  function savePinned() {
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(pinned));
    } catch {
      // private mode / quota tolerance, same as saveLayout
    }
  }
  function loadCustomLoadouts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOADOUTS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  function saveCustomLoadouts() {
    try {
      localStorage.setItem(LOADOUTS_KEY, JSON.stringify(customLoadouts));
    } catch {
      // private mode / quota tolerance
    }
  }
  function loadActiveLoadout() {
    try {
      return localStorage.getItem(LOADOUT_ACTIVE_KEY) || null;
    } catch {
      return null;
    }
  }
  function saveActiveLoadout() {
    try {
      localStorage.setItem(LOADOUT_ACTIVE_KEY, activeLoadout || '');
    } catch {
      // private mode / quota tolerance
    }
  }

  const paneLayout = loadLayout();
  const floatState = loadFloat();
  const pinned = loadPinned();
  const customLoadouts = loadCustomLoadouts();
  let activeLoadout = loadActiveLoadout();
  const floatMQ = window.matchMedia(FLOAT_QUERY);
  // Starts above the marquee ticker's fixed z-index (20) so a focused/
  // dragged pane never renders under it, even parked near the bottom edge.
  let zCounter = 30;
  let focusedPane = null;
  // guards summonPane()/staggerPaneTitle() from double-firing against scene
  // zero's own first-load cascade; flipped true once that settles (or
  // immediately if scene zero is skipped — see runSceneZero()).
  let bootComplete = false;

  function panes() {
    return Array.from(document.querySelectorAll('.term[data-pane]'));
  }

  // Panes relevant to the currently active mode only — used everywhere that
  // computes floating-mode geometry (canvas size, GRID/FOCUS auto-tiling) so
  // a pane hidden by [data-mode] CSS doesn't still claim canvas space. The
  // boot-time listener attachment loop deliberately uses the raw panes()
  // instead, since every pane needs its drag/resize handlers wired up
  // regardless of which mode is active when the page first loads.
  function visiblePanes() {
    return panes().filter((el) => {
      const def = PANES.find((p) => p.id === el.dataset.pane);
      return !def || !def.modes || def.modes.includes(currentMode);
    });
  }

  // ---------- pane summon (playful moment — see motion toolkit) ----------

  function staggerPaneTitle(pane) {
    if (reducedMotion() || typeof gsap === 'undefined') return;
    const h2 = pane.querySelector('.term-bar h2');
    if (!h2) return;
    const chars = getTitleChars(h2);
    if (!chars.length) return;
    gsap.fromTo(chars, { opacity: 0.15, y: 3 }, { opacity: 1, y: 0, duration: 0.22, stagger: 0.02, ease: playEase, overwrite: true });
  }

  // pane arriving from the rail (hidden -> visible) or, in floating mode, a
  // loadout switch bringing it into view — a fade + slight settle-in scale,
  // the personality ease so it reads as a deliberate summon, not a data update.
  function summonPane(pane) {
    if (!pane || !bootComplete) return; // scene zero owns the first-load cascade
    staggerPaneTitle(pane);
    if (reducedMotion() || typeof gsap === 'undefined') return;
    gsap.fromTo(pane, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.32, ease: playEase, clearProps: 'opacity,scale', overwrite: true });
  }

  function isFloatingMode() {
    return floatMQ.matches;
  }

  function paneFloatRect(id) {
    if (floatState[id]) return floatState[id];
    if (currentMode === 'personal' && DEFAULT_FLOAT_PERSONAL[id]) return DEFAULT_FLOAT_PERSONAL[id];
    return DEFAULT_FLOAT[id] || { x: 24, y: 24, w: 420, h: 340 };
  }

  function applyLayout() {
    let hasFullscreen = false;
    panes().forEach((pane) => {
      const id = pane.dataset.pane;
      const state = paneLayout[id] || 'normal';
      const isPinned = !!pinned[id];
      pane.classList.toggle('pane-collapsed', state === 'collapsed');
      pane.classList.toggle('pane-fullscreen', state === 'fullscreen');
      pane.classList.toggle('pane-hidden', state === 'hidden');
      pane.classList.toggle('pane-pinned', isPinned);
      if (state === 'fullscreen') hasFullscreen = true;
      pane.querySelectorAll('.term-controls .win-btn').forEach((btn) => {
        if (btn.dataset.action === 'collapse') btn.setAttribute('aria-pressed', String(state === 'collapsed'));
        if (btn.dataset.action === 'fullscreen') btn.setAttribute('aria-pressed', String(state === 'fullscreen'));
        if (btn.dataset.action === 'pin') btn.setAttribute('aria-pressed', String(isPinned));
      });
    });
    gridEl.classList.toggle('has-fullscreen', hasFullscreen);
    renderRail();
  }

  function togglePin(id) {
    pinned[id] = !pinned[id];
    if (!pinned[id]) delete pinned[id];
    savePinned();
    applyLayout();
  }

  function updateCanvasSize() {
    if (!isFloatingMode()) {
      gridEl.style.minWidth = '';
      gridEl.style.minHeight = '';
      return;
    }
    let maxX = 0;
    let maxY = 0;
    visiblePanes().forEach((pane) => {
      const raw = paneFloatRect(pane.dataset.pane);
      // x/w is clamped here (matching what applyFloating() actually
      // renders) so an unclamped stored rect can't reopen the self-
      // inflating min-width loop clampRectToSafeArea's viewport-width
      // measurement was built to avoid — see availableCanvasRect(). Height
      // stays unclamped: vertical scroll below the fold is intentional.
      const clamped = clampRectToSafeArea(raw);
      maxX = Math.max(maxX, clamped.x + clamped.w);
      maxY = Math.max(maxY, raw.y + raw.h);
    });
    gridEl.style.minWidth = maxX + 40 + 'px';
    gridEl.style.minHeight = maxY + 40 + 'px';
  }

  function applyFloating() {
    const floating = isFloatingMode();
    gridEl.classList.toggle('floating-mode', floating);
    let migrated = false;
    panes().forEach((pane) => {
      const id = pane.dataset.pane;
      if (!floating) {
        pane.style.left = '';
        pane.style.top = '';
        pane.style.width = '';
        pane.style.height = '';
        pane.style.zIndex = '';
        return;
      }
      const stored = paneFloatRect(id);
      const rect = clampRectToSafeArea(stored);
      // Only rewrite genuinely-persisted geometry (a pane that's never been
      // touched still falls back to DEFAULT_FLOAT every render, so clamping
      // it here shouldn't freeze it out of a wider viewport later). This is
      // the "migrate/sanitize existing localStorage geometry" step — stale
      // pre-rail-reservation or pre-this-pane-existed rects from an older
      // console version snap back inside and stay fixed from here on.
      if (floatState[id] && (rect.x !== stored.x || rect.y !== stored.y || rect.w !== stored.w || rect.h !== stored.h)) {
        floatState[id] = rect;
        migrated = true;
      }
      pane.style.left = rect.x + 'px';
      pane.style.top = rect.y + 'px';
      pane.style.width = rect.w + 'px';
      pane.style.height = rect.h + 'px';
      if (!pane.dataset.z) pane.dataset.z = String(++zCounter);
      pane.style.zIndex = pane.dataset.z;
    });
    if (migrated) saveFloat();
    updateCanvasSize();
    updateReadoutGeometry();
  }

  // ---------- utility-wear loadouts ----------
  // Layouts as packed configurations, not accidents: named presets that set
  // {visible, position, size, collapsed} per pane in one move. Built-ins are
  // computed relative to the current canvas size (not hard-coded pixels) so
  // they hold up at any desktop viewport width.

  const CANVAS_PAD = 24; // matches .grid.floating-mode padding — visual margin for tiled edges
  const TILE_GAP = 14; // matches the non-floating .grid gap
  const GRID_GAP = 16; // GRID loadout's own tile gap — wider, "see everything" needs the extra air
  const MIN_PANE_W = 260; // matches the resize-handle floor in the drag handler below
  const MIN_PANE_H = 160;
  const RAIL_RESERVED_W = 168; // matches `.grid { margin-right: 168px }` at >=1024px (style.css)

  function chromeHeightPx() {
    const topbarH = (document.querySelector('.topbar') || {}).offsetHeight || 57;
    const nowStripH = (document.getElementById('now-strip') || {}).offsetHeight || 28;
    const loadoutStripH = loadoutStripEl && isFloatingMode() ? loadoutStripEl.offsetHeight : 0;
    return topbarH + nowStripH + loadoutStripH;
  }

  // Canonical canvas rect used by loadout tiling AND snap zones — always
  // relative to a scrolled-to-top canvas so GRID/FOCUS and snap targets
  // agree on the same coordinate space regardless of current scroll. This
  // is also the single safe area every pane rect gets clamped into (see
  // clampRectToSafeArea). Deliberately measured off the viewport
  // (document.documentElement.clientWidth), NOT gridEl.clientWidth —
  // updateCanvasSize() sets gridEl's own min-width from the current (not-
  // yet-clamped) pane extents, so reading it back here would close a
  // self-inflating loop: an unclamped pane pushes minWidth out, which
  // widens the "safe" area, which stops clamping that same pane. Measuring
  // the viewport directly breaks that loop; the rail column is subtracted
  // by hand since it's only reserved via `.grid { margin-right }` (a CSS
  // rule this function has no other way to observe on a bloated box).
  function availableCanvasRect() {
    const railW = floatMQ.matches ? RAIL_RESERVED_W : 0;
    const viewportW = document.documentElement.clientWidth || window.innerWidth;
    const w = Math.max(320, viewportW - railW - CANVAS_PAD * 2);
    const h = Math.max(320, window.innerHeight - chromeHeightPx() - 34 /* marquee */ - CANVAS_PAD);
    return { x: CANVAS_PAD, y: CANVAS_PAD, w, h };
  }

  // Pulls a pane rect inside the safe area on the axes that are actually
  // hard boundaries: never under the nav rail or off the left/right edge
  // (no horizontal scroll exists to reach it), never under the header/
  // NOW-strip/loadout-strip band. The canvas's *bottom* is deliberately
  // unbounded — the default stacked arrangement (and any pane a user grows
  // tall) is meant to run below the fold and reach it by scrolling, so only
  // a minimum height is enforced, never a ceiling. The one clamp every
  // layout application (load, drag-end, resize-end, loadout switch) routes
  // through, so gutters stay consistent no matter which one triggered it.
  function clampRectToSafeArea(rect) {
    const area = availableCanvasRect();
    const w = Math.min(Math.max(rect.w, MIN_PANE_W), area.w);
    const h = Math.max(rect.h, MIN_PANE_H);
    const maxX = area.x + Math.max(0, area.w - w);
    const x = Math.min(Math.max(rect.x, area.x), maxX);
    const y = Math.max(rect.y, area.y);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }

  function buildOpsLoadout() {
    const area = availableCanvasRect();
    const colW = (area.w - TILE_GAP * 2) / 3;
    return {
      agenda: { x: area.x, y: area.y, w: colW, h: area.h },
      tasks: { x: area.x + colW + TILE_GAP, y: area.y, w: colW, h: area.h },
      commons: { x: area.x + (colW + TILE_GAP) * 2, y: area.y, w: colW, h: area.h },
    };
  }
  function buildReviewLoadout() {
    const area = availableCanvasRect();
    const leftW = Math.round(area.w * 0.62) - Math.round(TILE_GAP / 2);
    const rightW = area.w - leftW - TILE_GAP;
    return {
      review: { x: area.x, y: area.y, w: leftW, h: area.h },
      library: { x: area.x + leftW + TILE_GAP, y: area.y, w: rightW, h: area.h },
    };
  }
  // clients (portfolio, the centerpiece) replaces links in this loadout —
  // each card's expand already surfaces that client's own staging/live
  // link, so links's studio-wide github list is the least engagement-
  // specific of the three original panes here.
  function buildClientsLoadout() {
    const area = availableCanvasRect();
    const colW = (area.w - TILE_GAP * 2) / 3;
    return {
      review: { x: area.x, y: area.y, w: colW, h: area.h },
      tasks: { x: area.x + colW + TILE_GAP, y: area.y, w: colW, h: area.h },
      flow: { x: area.x + (colW + TILE_GAP) * 2, y: area.y, w: colW, h: area.h },
    };
  }
  // GRID: auto-tile ALL currently-non-hidden panes (plus anything pinned)
  // into an even, non-overlapping grid sized from the pane count alone.
  function computeGridLoadout() {
    const area = availableCanvasRect();
    const ids = PANES.filter((p) => !p.modes || p.modes.includes(currentMode))
      .map((p) => p.id)
      .filter((id) => pinned[id] || (paneLayout[id] || 'normal') !== 'hidden');
    if (!ids.length) return {};
    const n = ids.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = (area.w - GRID_GAP * (cols - 1)) / cols;
    const cellH = (area.h - GRID_GAP * (rows - 1)) / rows;
    const out = {};
    ids.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      out[id] = {
        x: Math.round(area.x + col * (cellW + GRID_GAP)),
        y: Math.round(area.y + row * (cellH + GRID_GAP)),
        w: Math.round(cellW),
        h: Math.round(cellH),
      };
    });
    return out;
  }
  // FOCUS: last-focused pane at 70% width + a slim right column of pinned minis.
  function computeFocusLoadout(seedId) {
    const area = availableCanvasRect();
    const seed = seedId || focusedPane || 'agenda';
    const mainW = Math.round(area.w * 0.7) - Math.round(TILE_GAP / 2);
    const railW = area.w - mainW - TILE_GAP;
    const out = {};
    out[seed] = { x: area.x, y: area.y, w: mainW, h: area.h };
    const minis = PANES.filter((p) => !p.modes || p.modes.includes(currentMode))
      .map((p) => p.id)
      .filter((id) => pinned[id] && id !== seed);
    if (minis.length) {
      const miniH = (area.h - TILE_GAP * (minis.length - 1)) / minis.length;
      minis.forEach((id, i) => {
        out[id] = {
          x: area.x + mainW + TILE_GAP,
          y: Math.round(area.y + i * (miniH + TILE_GAP)),
          w: railW,
          h: Math.round(miniH),
        };
      });
    }
    return out;
  }

  const BUILTIN_LOADOUTS = {
    OPS: { label: 'OPS', build: buildOpsLoadout },
    REVIEW: { label: 'REVIEW', build: buildReviewLoadout },
    CLIENTS: { label: 'CLIENTS', build: buildClientsLoadout },
    GRID: { label: 'GRID', build: computeGridLoadout },
    FOCUS: { label: 'FOCUS', build: (opts) => computeFocusLoadout(opts && opts.seed) },
  };
  const BUILTIN_LOADOUT_IDS = ['OPS', 'REVIEW', 'CLIENTS', 'GRID', 'FOCUS'];

  function loadoutDef(id) {
    return customLoadouts[id] || BUILTIN_LOADOUTS[id] || null;
  }

  function applyLoadout(id, opts) {
    opts = opts || {};
    if (!isFloatingMode()) return; // loadouts are a desktop-canvas concept — mobile stays stacked
    const def = loadoutDef(id);
    if (!def) return;
    const panesMap = def.custom ? def.panes : def.build(opts);

    const animate = !reducedMotion();
    if (animate) gridEl.classList.add('loadout-switching');

    PANES.forEach((p) => {
      const pid = p.id;
      const spec = panesMap[pid];
      if (spec) {
        paneLayout[pid] = spec.collapsed ? 'collapsed' : 'normal';
        floatState[pid] = clampRectToSafeArea({ x: spec.x, y: spec.y, w: spec.w, h: spec.h });
      } else if (pinned[pid]) {
        // pinned panes persist visible across loadout switches even when
        // the loadout itself doesn't place them — clamp in case its own
        // stored rect predates the pane count/viewport this loadout is
        // being applied against
        paneLayout[pid] = 'normal';
        floatState[pid] = clampRectToSafeArea(paneFloatRect(pid));
      } else {
        paneLayout[pid] = 'hidden';
      }
    });

    saveLayout();
    saveFloat();
    activeLoadout = id;
    saveActiveLoadout();
    applyLayout();
    applyFloating();
    renderLoadoutStrip();
    if (animate) {
      // titles of every pane the switch just placed perform the char-stagger
      // too (playful moment, same as a rail summon) — the whole arrangement
      // just changed, not just one pane.
      PANES.forEach((p) => {
        if (paneLayout[p.id] === 'hidden') return;
        const pane = document.querySelector('.term[data-pane="' + p.id + '"]');
        if (pane) staggerPaneTitle(pane);
      });
      setTimeout(() => gridEl.classList.remove('loadout-switching'), 360);
    }
  }

  function captureCurrentAsLoadout(rawName) {
    let name = (rawName || '').trim().toUpperCase().slice(0, 24);
    if (!name) return;
    if (BUILTIN_LOADOUT_IDS.includes(name)) name = name + ' 2';
    const panesMap = {};
    PANES.forEach((p) => {
      const state = paneLayout[p.id] || 'normal';
      if (state === 'hidden') return;
      const rect = paneFloatRect(p.id);
      panesMap[p.id] = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, collapsed: state === 'collapsed' };
    });
    customLoadouts[name] = { label: name, panes: panesMap, custom: true };
    saveCustomLoadouts();
    activeLoadout = name;
    saveActiveLoadout();
    renderLoadoutStrip();
    showGlobalToast(`LOADOUT SAVED — ${name}`);
  }

  function deleteCustomLoadout(name) {
    if (!customLoadouts[name]) return;
    delete customLoadouts[name];
    saveCustomLoadouts();
    if (activeLoadout === name) {
      activeLoadout = null;
      saveActiveLoadout();
    }
    renderLoadoutStrip();
    showGlobalToast(`LOADOUT DELETED — ${name}`);
  }

  function renderLoadoutStrip() {
    if (!loadoutStripEl) return;
    const customNames = Object.keys(customLoadouts).sort();
    const items = BUILTIN_LOADOUT_IDS.map((id, i) => ({ id, label: BUILTIN_LOADOUTS[id].label, hotkey: i + 1, custom: false }))
      .concat(customNames.map((name) => ({ id: name, label: customLoadouts[name].label || name, hotkey: null, custom: true })));
    loadoutStripEl.innerHTML = items.map((it) => {
      const active = activeLoadout === it.id;
      const title = it.custom ? 'custom loadout — right-click or long-press to delete' : `loadout ${it.hotkey}`;
      return `<button type="button" class="loadout-patch${active ? ' patch-active' : ''}${it.custom ? ' patch-custom' : ''}" data-loadout="${it.id}" title="${title}">` +
        `<i class="patch-webbing" aria-hidden="true"></i>` +
        (it.hotkey ? `<span class="patch-num">${it.hotkey}</span>` : '') +
        `<span class="patch-label">${it.label}</span></button>`;
    }).join('') + `<button type="button" class="loadout-patch patch-save" id="loadout-save-btn" title="save current arrangement as a loadout"><i class="patch-webbing" aria-hidden="true"></i><span class="patch-label">+ SAVE</span></button>`;
  }

  let loadoutLongPress = null;
  if (loadoutStripEl) {
    loadoutStripEl.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('#loadout-save-btn');
      if (saveBtn) {
        const name = window.prompt('Name this loadout:');
        if (name) captureCurrentAsLoadout(name);
        return;
      }
      const patch = e.target.closest('.loadout-patch[data-loadout]');
      if (patch) applyLoadout(patch.dataset.loadout);
    });
    loadoutStripEl.addEventListener('contextmenu', (e) => {
      const patch = e.target.closest('.loadout-patch.patch-custom[data-loadout]');
      if (!patch) return;
      e.preventDefault();
      if (window.confirm(`Delete loadout "${patch.dataset.loadout}"?`)) deleteCustomLoadout(patch.dataset.loadout);
    });
    loadoutStripEl.addEventListener('pointerdown', (e) => {
      const patch = e.target.closest('.loadout-patch.patch-custom[data-loadout]');
      if (!patch) return;
      clearTimeout(loadoutLongPress);
      loadoutLongPress = setTimeout(() => {
        if (window.confirm(`Delete loadout "${patch.dataset.loadout}"?`)) deleteCustomLoadout(patch.dataset.loadout);
      }, 650);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
      loadoutStripEl.addEventListener(ev, () => clearTimeout(loadoutLongPress));
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!isFloatingMode()) return;
    if (e.key < '1' || e.key > '5') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    // ..//canvas owns 1-9 for its own saved-viewpoint hotkeys while its
    // viewport has the pointer/focus — see the bridge comment above.
    if (window.HQCanvasWantsHotkeys && window.HQCanvasWantsHotkeys()) return;
    const id = BUILTIN_LOADOUT_IDS[Number(e.key) - 1];
    if (id) applyLoadout(id);
  });

  let reviewPendingCount = 0;

  function renderRail() {
    if (!railEl) return;
    railEl.innerHTML = PANES.filter((p) => !p.modes || p.modes.includes(currentMode)).map((p) => {
      const state = paneLayout[p.id] || 'normal';
      const isHidden = state === 'hidden';
      const isFocused = focusedPane === p.id;
      let badgeCount = 0;
      if (p.id === 'review') badgeCount = reviewPendingCount;
      else if (p.id === 'tasks') badgeCount = openTaskCount;
      else if (p.id === 'library') badgeCount = libraryInboxCount;
      const badge = badgeCount > 0 ? `<span class="rail-badge">${badgeCount}</span>` : '';
      const label = currentMode === 'personal' && p.personalLabel ? p.personalLabel : p.label;
      return `<button type="button" class="rail-item${isHidden ? ' rail-hidden' : ''}${isFocused ? ' rail-focused' : ''}" data-rail="${p.id}">
        <span class="rail-arrow">${isFocused ? '&#9656;' : ''}</span><span class="rail-label">${label}</span>${badge}
      </button>`;
    }).join('');
  }

  function focusPane(id, opts) {
    opts = opts || {};
    let summoned = false;
    if (opts.restore) {
      const current = paneLayout[id] || 'normal';
      if (current === 'hidden') {
        setPaneState(id, 'normal');
        summoned = true;
      }
    }
    focusedPane = id;
    panes().forEach((p) => p.classList.toggle('pane-focused', p.dataset.pane === id));
    const pane = document.querySelector('.term[data-pane="' + id + '"]');
    if (summoned) summonPane(pane);
    if (pane) {
      if (isFloatingMode()) {
        pane.dataset.z = String(++zCounter);
        pane.style.zIndex = pane.dataset.z;
      }
      if (opts.scroll) {
        pane.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }
    if (opts.hash !== false) {
      history.replaceState(null, '', '#' + id);
    }
    renderRail();
    updateReadoutGeometry();
  }

  function setPaneState(id, state) {
    if (state === 'fullscreen') {
      Object.keys(paneLayout).forEach((key) => {
        if (key !== id && paneLayout[key] === 'fullscreen') paneLayout[key] = 'normal';
      });
    }
    paneLayout[id] = state;
    saveLayout();
    applyLayout();
  }

  function toggleWinAction(id, action) {
    const current = paneLayout[id] || 'normal';
    if (action === 'collapse') setPaneState(id, current === 'collapsed' ? 'normal' : 'collapsed');
    else if (action === 'fullscreen') {
      // desktop canvas: [square] packs into the FOCUS loadout (this pane at
      // 70% + pinned minis) instead of the old exclusive-fullscreen mode.
      // Mobile stays stacked, so it keeps the original behavior.
      if (isFloatingMode()) applyLoadout('FOCUS', { seed: id });
      else setPaneState(id, current === 'fullscreen' ? 'normal' : 'fullscreen');
    } else if (action === 'hide') setPaneState(id, 'hidden');
    else if (action === 'pin') togglePin(id);
  }

  // ---------- floating drag + resize + snap-tiling ----------

  let dragState = null;

  // Snap zones share the same canonical rect as loadout tiling, so a
  // dropped pane lines up with where GRID/FOCUS would have put it.
  const SNAP_ZONE_IDS = ['left-half', 'right-half', 'tl-quad', 'tr-quad', 'bl-quad', 'br-quad'];
  function snapZoneSide(zid) {
    return zid.startsWith('right') || zid.startsWith('tr') || zid.startsWith('br') ? 'right' : 'left';
  }
  function snapZoneRects() {
    const area = availableCanvasRect();
    const halfW = area.w / 2;
    const halfH = area.h / 2;
    return {
      'left-half': { x: area.x, y: area.y, w: halfW, h: area.h },
      'right-half': { x: area.x + halfW, y: area.y, w: halfW, h: area.h },
      'tl-quad': { x: area.x, y: area.y, w: halfW, h: halfH },
      'tr-quad': { x: area.x + halfW, y: area.y, w: halfW, h: halfH },
      'bl-quad': { x: area.x, y: area.y + halfH, w: halfW, h: halfH },
      'br-quad': { x: area.x + halfW, y: area.y + halfH, w: halfW, h: halfH },
    };
  }
  function detectSnapZone(localX, localY) {
    const area = availableCanvasRect();
    const relX = (localX - area.x) / area.w;
    const relY = (localY - area.y) / area.h;
    if (relX < -0.05 || relX > 1.05 || relY < -0.05 || relY > 1.05) return null;
    const EDGE = 0.22;
    const CORNER = 0.3;
    const nearLeft = relX < EDGE;
    const nearRight = relX > 1 - EDGE;
    if (!nearLeft && !nearRight) return null;
    const nearTop = relY < CORNER;
    const nearBottom = relY > 1 - CORNER;
    if (nearLeft) return nearTop ? 'tl-quad' : nearBottom ? 'bl-quad' : 'left-half';
    return nearTop ? 'tr-quad' : nearBottom ? 'br-quad' : 'right-half';
  }
  function buildSnapOverlay() {
    if (!snapOverlayEl) return;
    const rects = snapZoneRects();
    snapOverlayEl.innerHTML = SNAP_ZONE_IDS.map((zid) => {
      const r = rects[zid];
      return `<div class="snap-zone" data-zone="${zid}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;"></div>`;
    }).join('');
  }
  function updateSnapOverlay(activeZone) {
    if (!snapOverlayEl) return;
    const activeSide = activeZone ? snapZoneSide(activeZone) : null;
    snapOverlayEl.querySelectorAll('.snap-zone').forEach((el) => {
      const zid = el.dataset.zone;
      el.classList.toggle('zone-hover', zid === activeZone);
      el.classList.toggle('zone-side-visible', !!activeSide && snapZoneSide(zid) === activeSide);
    });
  }

  function beginDrag(e, id, type) {
    if (!isFloatingMode() || e.button !== 0) return;
    e.preventDefault();
    focusPane(id, { hash: true });
    const stored = paneFloatRect(id);
    const pane = document.querySelector('.term[data-pane="' + id + '"]');
    // Read the pane's actual rendered box rather than the stored rect —
    // applyFloating() may have clamped x/w to keep the pane clear of the
    // fixed nav rail, and dragging/resizing must continue from where it
    // visually is, not from a stale stored value (which would otherwise
    // jump the pane on the first mousemove).
    const orig = pane
      ? Object.assign({}, stored, {
          x: parseFloat(pane.style.left) || stored.x,
          y: parseFloat(pane.style.top) || stored.y,
          w: parseFloat(pane.style.width) || stored.w,
          h: parseFloat(pane.style.height) || stored.h,
        })
      : stored;
    dragState = { type, id, startX: e.clientX, startY: e.clientY, orig, snapZone: null, snapDisabled: false };
    document.body.classList.add(type === 'resize' ? 'resizing' : 'dragging');
    if (type === 'move' && snapOverlayEl) {
      buildSnapOverlay();
      snapOverlayEl.classList.add('dragging-move');
    }
  }

  document.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const pane = document.querySelector('.term[data-pane="' + dragState.id + '"]');
    if (!pane) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const next = Object.assign({}, dragState.orig);
    if (dragState.type === 'move') {
      next.x = Math.max(0, dragState.orig.x + dx);
      next.y = Math.max(0, dragState.orig.y + dy);
      if (dragState.snapDisabled) {
        dragState.snapZone = null;
      } else {
        const gridBox = gridEl.getBoundingClientRect();
        dragState.snapZone = detectSnapZone(e.clientX - gridBox.left, e.clientY - gridBox.top);
      }
      updateSnapOverlay(dragState.snapZone);
    } else {
      next.w = Math.max(MIN_PANE_W, dragState.orig.w + dx);
      next.h = Math.max(MIN_PANE_H, dragState.orig.h + dy);
    }
    floatState[dragState.id] = next;
    pane.style.left = next.x + 'px';
    pane.style.top = next.y + 'px';
    pane.style.width = next.w + 'px';
    pane.style.height = next.h + 'px';
    updateCanvasSize();
    updateReadoutGeometry();
  });

  document.addEventListener('mouseup', () => {
    if (!dragState) return;
    if (dragState.type === 'move' && dragState.snapZone) {
      const r = snapZoneRects()[dragState.snapZone];
      const inset = 6;
      floatState[dragState.id] = {
        x: Math.round(r.x + inset),
        y: Math.round(r.y + inset),
        w: Math.round(r.w - inset * 2),
        h: Math.round(r.h - inset * 2),
      };
    }
    // drag-end / resize-end clamp — whatever the pane's rect ended up as
    // (free drag, or a snap-zone rect), it lands inside the safe area.
    floatState[dragState.id] = clampRectToSafeArea(floatState[dragState.id]);
    const pane = document.querySelector('.term[data-pane="' + dragState.id + '"]');
    if (pane) {
      const rect = floatState[dragState.id];
      pane.style.left = rect.x + 'px';
      pane.style.top = rect.y + 'px';
      pane.style.width = rect.w + 'px';
      pane.style.height = rect.h + 'px';
    }
    dragState = null;
    document.body.classList.remove('dragging', 'resizing');
    if (snapOverlayEl) {
      snapOverlayEl.classList.remove('dragging-move');
      snapOverlayEl.innerHTML = '';
    }
    updateCanvasSize();
    saveFloat();
  });

  panes().forEach((pane) => {
    const id = pane.dataset.pane;
    const bar = pane.querySelector('.term-bar');
    if (bar) {
      bar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.win-btn')) return;
        beginDrag(e, id, 'move');
      });
    }
    const handle = pane.querySelector('.resize-handle');
    if (handle) handle.addEventListener('mousedown', (e) => beginDrag(e, id, 'resize'));
    pane.addEventListener('mousedown', () => {
      if (isFloatingMode()) focusPane(id, { hash: true });
    });
  });

  document.addEventListener('click', (e) => {
    const winBtn = e.target.closest('.win-btn');
    if (winBtn) {
      const pane = winBtn.closest('.term[data-pane]');
      if (pane) toggleWinAction(pane.dataset.pane, winBtn.dataset.action);
      return;
    }
    const railBtn = e.target.closest('.rail-item');
    if (railBtn) {
      const id = railBtn.dataset.rail;
      // ..//canvas opens like FOCUS mode (design spec: "full-viewport pane")
      // rather than a normal small float — same FOCUS-loadout shortcut
      // [square] fullscreen already uses, just triggered from the rail too.
      // Runs before focusPane's own scrollIntoView below since it repositions
      // every pane's floatState (including this one, off whatever stale
      // coordinates it last had). scrollIntoView still isn't enough on its
      // own here: the pane's rect is mid CSS-transition the instant this
      // reads it (0ms into the loadout-switch tween == the OLD rect), so it
      // scrolls toward where the pane USED to be — an explicit scroll-to-top
      // afterward is what actually lands on FOCUS's near-origin layout.
      if (id === 'canvas' && isFloatingMode()) applyLoadout('FOCUS', { seed: 'canvas' });
      focusPane(id, { restore: true, scroll: true, hash: true });
      if (id === 'canvas' && isFloatingMode()) window.scrollTo({ top: 0, left: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (dragState && dragState.type === 'move') {
      // Esc cancels the snap, not the drag — the pane keeps following the
      // cursor free-form for the rest of this drag session.
      dragState.snapDisabled = true;
      dragState.snapZone = null;
      updateSnapOverlay(null);
      return;
    }
    if (lightboxEl && !lightboxEl.hidden) {
      closeLightbox();
      return;
    }
    const fsId = Object.keys(paneLayout).find((k) => paneLayout[k] === 'fullscreen');
    if (fsId) setPaneState(fsId, 'normal');
  });

  floatMQ.addEventListener ? floatMQ.addEventListener('change', applyFloating) : floatMQ.addListener(applyFloating);
  window.addEventListener('resize', updateCanvasSize);

  applyLayout();
  applyFloating();
  renderLoadoutStrip();

  // ---------- deep-link hash ----------

  function paneIdFromHash() {
    const h = (location.hash || '').replace('#', '');
    return PANES.some((p) => p.id === h) ? h : null;
  }

  const initialHashPane = paneIdFromHash();
  if (initialHashPane) {
    const seedCanvas = initialHashPane === 'canvas' && isFloatingMode();
    if (seedCanvas) applyLoadout('FOCUS', { seed: 'canvas' });
    focusPane(initialHashPane, { restore: true, hash: false, scroll: true });
    // see the rail-click handler's comment above on why scrollIntoView alone
    // can't be trusted here (mid-transition rect race).
    if (seedCanvas) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  window.addEventListener('hashchange', () => {
    const id = paneIdFromHash();
    if (id) {
      const seedCanvas = id === 'canvas' && isFloatingMode();
      if (seedCanvas) applyLoadout('FOCUS', { seed: 'canvas' });
      focusPane(id, { restore: true, scroll: true, hash: false });
      if (seedCanvas) window.scrollTo({ top: 0, left: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  });

  // ---------- system readout ----------

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function updateClock() {
    const el = document.getElementById('ro-clock');
    if (!el) return;
    const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
    el.textContent = `${pad2(ist.getUTCHours())}:${pad2(ist.getUTCMinutes())}:${pad2(ist.getUTCSeconds())} IST`;
  }

  // [reset layout] — the deliberate escape hatch for geometry the passive
  // safe-area clamp can't fully repair on its own (e.g. a loadout applied
  // before a pane existed, so it never got tiled a cell): clears stored
  // position/size/visibility for every pane relevant to the current mode,
  // then reapplies the active loadout (or the DEFAULT_FLOAT arrangement if
  // no loadout is active) fresh.
  function resetLayoutForCurrentMode() {
    if (!isFloatingMode()) return; // loadouts/canvas geometry are a desktop concept
    const modeLabel = currentMode === 'personal' ? 'PERSONAL' : 'STUDIO';
    if (!window.confirm(`Reset ${modeLabel} mode layout? This clears saved pane positions/sizes.`)) return;
    PANES.filter((p) => !p.modes || p.modes.includes(currentMode)).forEach((p) => {
      delete floatState[p.id];
      delete paneLayout[p.id];
    });
    saveFloat();
    saveLayout();
    if (activeLoadout && loadoutDef(activeLoadout)) {
      applyLoadout(activeLoadout);
    } else {
      applyLayout();
      applyFloating();
      renderLoadoutStrip();
    }
    showGlobalToast('LAYOUT RESET');
  }

  const layoutControlsEl = document.getElementById('ro-layout-controls');
  if (layoutControlsEl) {
    layoutControlsEl.innerHTML = '<button type="button" class="ro-chip" id="layout-reset-btn">[reset layout]</button>';
    const layoutResetBtn = document.getElementById('layout-reset-btn');
    if (layoutResetBtn) layoutResetBtn.addEventListener('click', resetLayoutForCurrentMode);
  }

  function updateReadoutDue() {
    const el = document.getElementById('ro-due');
    if (!el) return;
    const clients = (lastState && lastState.clients) || [];
    const withDue = clients.filter((c) => c.dueDays !== null);
    if (!withDue.length) {
      el.textContent = 'no due dates';
      return;
    }
    withDue.sort((a, b) => Math.abs(a.dueDays) - Math.abs(b.dueDays));
    const c = withDue[0];
    const meta = clientDueMeta(c);
    el.textContent = `${c.client} · ${meta.label}`;
  }

  function updateReadoutGeometry() {
    const el = document.getElementById('ro-geom');
    if (!el) return;
    if (!focusedPane) {
      el.textContent = 'none';
      return;
    }
    const pane = document.querySelector('.term[data-pane="' + focusedPane + '"]');
    if (!pane) {
      el.textContent = 'none';
      return;
    }
    if (isFloatingMode()) {
      const r = paneFloatRect(focusedPane);
      el.textContent = `${focusedPane} @ ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`;
    } else {
      const b = pane.getBoundingClientRect();
      el.textContent = `${focusedPane} ${Math.round(b.width)}×${Math.round(b.height)}`;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  // ---------- reticle: lerped crosshair ----------

  const reticleEl = document.getElementById('reticle');
  const reticleH = reticleEl.querySelector('.reticle-h');
  const reticleV = reticleEl.querySelector('.reticle-v');
  const reticleBox = reticleEl.querySelector('.reticle-box');
  const cursorCoordEl = document.getElementById('ro-cursor');

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let curX = targetX;
  let curY = targetY;
  let hasPointer = false;
  const RETICLE_LERP = 0.12;

  window.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    hasPointer = true;
  });

  function tickReticle() {
    if (!hasPointer) return;
    if (reducedMotion()) {
      curX = targetX;
      curY = targetY;
    } else {
      curX += (targetX - curX) * RETICLE_LERP;
      curY += (targetY - curY) * RETICLE_LERP;
    }
    // wfReticleDraw is a 0..1 scale scene zero drives on first load (a
    // self-draw flourish) — composed here rather than set independently,
    // since this function overwrites these transforms every frame anyway.
    const drawScale = wfReticleDraw !== 1 ? ` scale(${wfReticleDraw})` : '';
    reticleH.style.transform = `translateY(${curY}px)${drawScale}`;
    reticleV.style.transform = `translateX(${curX}px)${drawScale}`;
    reticleBox.style.transform = `translate(${curX}px, ${curY}px)${drawScale}`;
    reticleEl.style.opacity = '1';
    if (cursorCoordEl) cursorCoordEl.textContent = `x:${Math.round(curX)} y:${Math.round(curY)}`;
  }

  // ---------- ambient sculpture: The Form That Sometimes Faces You ----------
  // Art direction (~/studio-brain/References/ART DIRECTION — The Form That
  // Sometimes Faces You.md, posted mid-job — supersedes a plain "always a
  // face" reading of the v0.7 REWORK note): one shared ~1500-point cloud
  // samples two target surfaces. Resting: the continuously-morphing
  // supershape (Gielis superformula) — "the studio working." Event: a
  // semi-abstract low-poly mask/bust — "the studio addressing you" — that
  // coheres into place, staggered per point, only for specific face
  // moments, then disperses back. Deep idle never shows a face; it does
  // not watch you work. Hand-rolled 3D pipeline, no three.js, rendered as
  // soft depth-faded phosphor splats (gaussian-style radial falloff via
  // layered circles — an honest approximation, not literal Gaussian
  // Splatting reconstruction). Liveness tier (independent of which target
  // is showing): any running/verifying job raises morph speed ~1.6x and
  // brightness ~1.3x; a job landing on `done` triggers one radial ripple;
  // a rise in today's Gemini error count desaturates toward gray for 3s.

  const wfCanvas = document.getElementById('wireframe-canvas');
  const wfCtx = wfCanvas ? wfCanvas.getContext('2d') : null;
  const WF_DPR_CAP = 1.5;

  // houseEase (expo-out) is defined in the motion toolkit near the top of
  // this file — reused here unchanged for the morph/gaze/rotation easing.

  // ---- drag-to-spin pointer handling (state vars declared further below,
  // next to the rest of the rotation state) ----
  if (wfCanvas) {
    wfCanvas.addEventListener('pointerdown', (e) => {
      if (reducedMotion()) return;
      wfDragActive = true;
      wfDragPointerId = e.pointerId;
      wfDragLastX = e.clientX;
      wfDragLastY = e.clientY;
      wfDragLastTs = nowMs();
      wfDragYawVel = 0;
      wfDragPitchVel = 0;
      wfCanvas.classList.add('wf-dragging');
      try {
        wfCanvas.setPointerCapture(e.pointerId);
      } catch {
        // unsupported in some embedded webviews — drag still tracks fine via move/up on the canvas itself
      }
    });
    wfCanvas.addEventListener('pointermove', (e) => {
      if (!wfDragActive || e.pointerId !== wfDragPointerId) return;
      const ts = nowMs();
      const dt = Math.max(1, ts - wfDragLastTs);
      const dx = e.clientX - wfDragLastX;
      const dy = e.clientY - wfDragLastY;
      const dYaw = dx * WF_DRAG_SENS;
      const dPitch = clamp(-dy * WF_DRAG_SENS, -0.6, 0.6);
      wfDragYaw += dYaw;
      wfDragPitch = clamp(wfDragPitch + dPitch, -0.9, 0.9);
      wfDragYawVel = (dYaw / dt) * 1000; // rad/s
      wfDragPitchVel = (dPitch / dt) * 1000;
      wfDragLastX = e.clientX;
      wfDragLastY = e.clientY;
      wfDragLastTs = ts;
    });
    const endSculptureDrag = (e) => {
      if (!wfDragActive || (e && e.pointerId !== wfDragPointerId)) return;
      wfDragActive = false;
      wfDragPointerId = null;
      wfCanvas.classList.remove('wf-dragging');
      const speed = Math.hypot(wfDragYawVel, wfDragPitchVel); // rad/s at release — the "throw"
      if (speed > 1.5) playMotif('whoosh', clamp(speed / 12, 0, 1));
    };
    wfCanvas.addEventListener('pointerup', endSculptureDrag);
    wfCanvas.addEventListener('pointercancel', endSculptureDrag);
  }

  function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function wrapAngle(a) {
    const twoPi = Math.PI * 2;
    let r = a % twoPi;
    if (r > Math.PI) r -= twoPi;
    if (r < -Math.PI) r += twoPi;
    return r;
  }

  // ---- shared topology: ~1500-point lat/long grid, sampled by both targets ----

  const WF_LAT_SEGS = 30; // rings, pole to pole
  const WF_LON_SEGS = 50; // segments per ring
  const WF_ROWS = WF_LAT_SEGS + 1; // 31 * 50 = 1550 points
  const WF_POINT_COUNT = WF_ROWS * WF_LON_SEGS;

  // ---- target A: the supershape (Gielis superformula) — resting/working ----

  function superformula(theta, p) {
    const t = (p.m * theta) / 4;
    const term1 = Math.pow(Math.abs(Math.cos(t) / p.a), p.n2);
    const term2 = Math.pow(Math.abs(Math.sin(t) / p.b), p.n3);
    const r = Math.pow(term1 + term2, -1 / p.n1);
    // safety clamp: keeps the form elegant even mid-morph, never spiky/degenerate
    return clamp(Number.isFinite(r) ? r : 1, 0.3, 1.55);
  }

  // curated elegant range: bulbous/stellated/drop-like/crystalline, never spiky
  function randomSupershapeState() {
    const mkParams = () => ({
      m: Math.round(randRange(2, 9)),
      n1: randRange(0.7, 3.0),
      n2: randRange(0.5, 3.2),
      n3: randRange(0.5, 3.2),
      a: randRange(0.92, 1.1),
      b: randRange(0.92, 1.1),
    });
    return { lon: mkParams(), lat: mkParams() };
  }

  function lerpSuperParams(a, b, t) {
    return {
      m: a.m + (b.m - a.m) * t,
      n1: a.n1 + (b.n1 - a.n1) * t,
      n2: a.n2 + (b.n2 - a.n2) * t,
      n3: a.n3 + (b.n3 - a.n3) * t,
      a: a.a + (b.a - a.a) * t,
      b: a.b + (b.b - a.b) * t,
    };
  }

  function buildSupershapeVerts(paramsLon, paramsLat) {
    const lonR = new Array(WF_LON_SEGS);
    const lonCos = new Array(WF_LON_SEGS);
    const lonSin = new Array(WF_LON_SEGS);
    for (let j = 0; j < WF_LON_SEGS; j++) {
      const theta = (j / WF_LON_SEGS) * Math.PI * 2;
      lonR[j] = superformula(theta, paramsLon);
      lonCos[j] = Math.cos(theta);
      lonSin[j] = Math.sin(theta);
    }
    const latR = new Array(WF_ROWS);
    const latCos = new Array(WF_ROWS);
    const latSin = new Array(WF_ROWS);
    for (let i = 0; i < WF_ROWS; i++) {
      const phi = -Math.PI / 2 + (i / WF_LAT_SEGS) * Math.PI;
      latR[i] = superformula(phi, paramsLat);
      latCos[i] = Math.cos(phi);
      latSin[i] = Math.sin(phi);
    }
    const verts = new Array(WF_POINT_COUNT);
    for (let i = 0; i < WF_ROWS; i++) {
      const r2 = latR[i], cosPhi = latCos[i], sinPhi = latSin[i];
      const rowBase = i * WF_LON_SEGS;
      for (let j = 0; j < WF_LON_SEGS; j++) {
        const rr2cos = lonR[j] * r2 * cosPhi;
        verts[rowBase + j] = [rr2cos * lonCos[j], r2 * sinPhi, rr2cos * lonSin[j]];
      }
    }
    return verts;
  }

  // ---- target B: semi-abstract low-poly mask/bust (Noh-mask / helmet ----
  // energy, zero realism) — a fixed bold silhouette, not a morphing
  // expression; the same grid indices as the supershape so the two
  // targets can be lerped point-for-point.

  // flat plate, not a round egg — a Noh mask/helmet visor reads planar
  const FACE_RX = 0.85, FACE_RY = 1.05, FACE_RZ = 0.42; // bust proportions
  const FACE_HALF_WIDTH = 1.15; // radians either side of front the mask covers

  // few, bold, graphic on purpose — cheeks/lips/jaw read as portraiture,
  // which fights the "mask" brief; brow + sockets + a ridge + a slit is
  // enough, and amplitudes are large relative to the flat base plate so
  // depth-shading (near=bright/big, far=dim/small) actually reads as relief.
  const FACE_BUMPS = [
    // key, u (longitude, 0=front), v (latitude), spreadU, spreadV, amp
    ['brow', 0, 0.34, 0.5, 0.09, 0.22],
    ['eyeL', -0.26, 0.14, 0.15, 0.11, -0.38],
    ['eyeR', 0.26, 0.14, 0.15, 0.11, -0.38],
    ['nose', 0, -0.1, 0.11, 0.34, 0.42],
    ['mouth', 0, -0.48, 0.24, 0.06, -0.26],
  ];

  function faceZoneFactor(u) {
    return 1 - smoothstep(FACE_HALF_WIDTH * 0.6, FACE_HALF_WIDTH, Math.abs(u));
  }

  function faceDisplacement(u, v) {
    const zone = faceZoneFactor(u);
    if (zone <= 0.001) return 0;
    let d = 0;
    for (let i = 0; i < FACE_BUMPS.length; i++) {
      const [, ui, vi, su, sv, amp] = FACE_BUMPS[i];
      const du = u - ui, dv = v - vi;
      d += amp * Math.exp(-((du * du) / (2 * su * su) + (dv * dv) / (2 * sv * sv)));
    }
    return d * zone;
  }

  function buildFaceVerts() {
    const verts = new Array(WF_POINT_COUNT);
    for (let i = 0; i < WF_ROWS; i++) {
      const phi = -Math.PI / 2 + (i / WF_LAT_SEGS) * Math.PI;
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      const rowBase = i * WF_LON_SEGS;
      for (let j = 0; j < WF_LON_SEGS; j++) {
        const theta = (j / WF_LON_SEGS) * Math.PI * 2 - Math.PI;
        const r = 1 + faceDisplacement(theta, phi);
        verts[rowBase + j] = [
          FACE_RX * cosPhi * Math.sin(theta) * r,
          FACE_RY * sinPhi * r,
          FACE_RZ * cosPhi * Math.cos(theta) * r,
        ];
      }
    }
    return verts;
  }
  const faceVertsFixed = buildFaceVerts(); // fixed target, built once

  function rotateXYZFast(p, cosx, sinx, cosy, siny, cosz, sinz) {
    const x = p[0], y = p[1], z = p[2];
    const y1 = y * cosx - z * sinx, z1 = y * sinx + z * cosx;
    const x2 = x * cosy + z1 * siny, z2 = -x * siny + z1 * cosy;
    const x3 = x2 * cosz - y1 * sinz, y3 = x2 * sinz + y1 * cosz;
    return [x3, y3, z2];
  }

  function projectPoint(p, cx, cy, scale) {
    const focal = 4;
    const persp = focal / (focal + p[2]);
    return [cx + p[0] * scale * persp, cy + p[1] * scale * persp];
  }

  // ---- morph cycle (supershape only — "the form never stops becoming") ----
  let wfMorphFrom = randomSupershapeState();
  let wfMorphTo = randomSupershapeState();
  let wfMorphElapsed = 0;
  let wfMorphDuration = randRange(25000, 40000);

  // ---- cohere/disperse: shared cloud, staggered per-point transition ----
  const wfPointDelay = new Array(WF_POINT_COUNT);
  for (let i = 0; i < WF_POINT_COUNT; i++) wfPointDelay[i] = randRange(0, 0.6);
  const WF_TRANSITION_MS = 1800;
  let wfFaceTarget = 0; // 0 = supershape, 1 = mask
  let wfFaceness = 0; // settled blend value once a transition completes
  let wfTransitionFrom = 0;
  let wfTransitionStartTs = 0;
  let wfGazeStrength = 0.3; // ambient baseline; spikes on formation, softens away
  let wfJamActive = false; // set true for JAM_FACE_HOLD_MS by checkJamNotifications() when a new jam file appears

  let wfRotY = 0;
  let wfFaceYaw = 0; // eased toward 0 (facing camera) whenever a face is forming/showing/dispersing
  let wfFaceRoll = 0; // same treatment for roll — keeps the mask level instead of canted
  let wfRotZ = 0;
  let wfTargetOffsetX = 0;
  let wfTargetOffsetY = 0;
  let wfCurOffsetX = 0;
  let wfCurOffsetY = 0;
  const WF_MAX_TILT = (15 * Math.PI) / 180;
  let wfLastTs = 0;
  let wfDrawnStatic = false;
  let wfReticleDraw = 1; // 0..1 scale factor scene zero composes into tickReticle()'s per-frame transform

  // ---- drag-to-spin (creative-3d: "physics makes it honest") ----
  // a user-applied rotation offset on top of the ambient rotation above,
  // released into a hand-rolled damped spring rather than a linear decay —
  // throw it hard and it swings past center once or twice before resting
  // back at the ambient pose, exactly like a real suspended object would.
  let wfDragActive = false;
  let wfDragPointerId = null;
  let wfDragLastX = 0;
  let wfDragLastY = 0;
  let wfDragLastTs = 0;
  let wfDragYaw = 0;
  let wfDragPitch = 0;
  let wfDragYawVel = 0; // rad/s
  let wfDragPitchVel = 0; // rad/s
  const WF_DRAG_SENS = 0.008; // rad of offset per px of drag
  const WF_SPRING_OMEGA = 2.4; // settle speed
  const WF_SPRING_ZETA = 0.4; // damping ratio — <1 means a bit of swing-past before resting, the "spring" part

  // damped-spring integrator toward the ambient pose (0,0) — runs every
  // live frame except while actively dragging (drag sets the offset
  // directly in the pointermove handler above). Semi-implicit Euler is
  // plenty stable at these omega/dt magnitudes.
  function updateSculptureDrag(dtMs) {
    if (wfDragActive) return;
    if (!wfDragYaw && !wfDragPitch && !wfDragYawVel && !wfDragPitchVel) return;
    const dt = clamp(dtMs, 0, 64) / 1000;
    const k = WF_SPRING_OMEGA * WF_SPRING_OMEGA;
    const c = 2 * WF_SPRING_ZETA * WF_SPRING_OMEGA;
    wfDragYawVel += (-k * wfDragYaw - c * wfDragYawVel) * dt;
    wfDragPitchVel += (-k * wfDragPitch - c * wfDragPitchVel) * dt;
    wfDragYaw += wfDragYawVel * dt;
    wfDragPitch += wfDragPitchVel * dt;
    // fully settle once at rest — avoids eternal sub-visible float jitter
    if (Math.abs(wfDragYaw) < 0.0005 && Math.abs(wfDragYawVel) < 0.0005) { wfDragYaw = 0; wfDragYawVel = 0; }
    if (Math.abs(wfDragPitch) < 0.0005 && Math.abs(wfDragPitchVel) < 0.0005) { wfDragPitch = 0; wfDragPitchVel = 0; }
  }

  const WF_SCAN_PERIOD = 20000; // "blink" cadence — only once the mask has mostly formed
  const WF_SCAN_DURATION = 2000;
  let wfScanNextTs = 0;
  let wfScanActive = false;
  let wfScanStartTs = 0;
  let wfPrevScanRow = -1;

  let wfFrameMsSum = 0;
  let wfFrameMsCount = 0;
  let wfFrameMsLastLog = 0;

  // liveness tier — set from render(state) via updateSculptureLiveness()
  let wfRunningBoost = false;
  let wfRippleStartTs = 0;
  let wfDesaturateUntilTs = 0;
  const WF_RIPPLE_DURATION = 1200;
  const wfPrevJobStatus = new Map();
  let wfPrevErrorCount = null;

  function nowMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  // face moments (only these show a face — deep idle never does): a jam
  // that just landed (held for JAM_FACE_HOLD_MS), a concierge reply
  // rendering, a pending review card (holds until verdict), standup hour.
  function isStandupHour(state) {
    const standup = (state.cron || []).find((c) => /standup/i.test(c.name || ''));
    if (!standup) return false;
    const parts = /^(\d{1,2}):(\d{2})$/.exec(standup.time || '');
    if (!parts) return false;
    const fireHour = Number(parts[1]) + Number(parts[2]) / 60;
    return Math.abs(hoursDecimal(new Date()) - fireHour) <= 0.5;
  }

  function isFaceMoment(state) {
    if (wfJamActive) return true;
    if (typeof conciergeState !== 'undefined' && conciergeState.busy) return true;
    if (reviewPendingCount > 0) return true;
    if (isStandupHour(state)) return true;
    return false;
  }

  function updateSculptureLiveness(state) {
    const jobs = state.jobs || [];
    // Live orchestration (a bench tournament, a chain unit) is exactly as
    // "the studio is building" as a tracked running job — the sculpture's
    // excitement boost must not go flat just because nothing has a job/*.md.
    wfRunningBoost = jobs.some((j) => j.status === 'running' || j.status === 'verifying') || orchestrationActive(state);
    const now = nowMs();
    jobs.forEach((j) => {
      const prev = wfPrevJobStatus.get(j.slug);
      if ((prev === 'running' || prev === 'verifying') && j.status === 'done') {
        wfRippleStartTs = now;
        playMotif('job-done');
      }
      wfPrevJobStatus.set(j.slug, j.status);
    });
    const errorCount = ((state.gemini && state.gemini.errors429) || 0) + ((state.gemini && state.gemini.errors503) || 0);
    if (wfPrevErrorCount !== null && errorCount > wfPrevErrorCount) {
      wfDesaturateUntilTs = now + 3000;
      playMotif('error-spike');
    }
    wfPrevErrorCount = errorCount;

    const wantsFace = isFaceMoment(state) ? 1 : 0;
    if (wantsFace !== wfFaceTarget) {
      wfTransitionFrom = wfFaceness;
      wfTransitionStartTs = now;
      wfFaceTarget = wantsFace;
      if (wantsFace) wfGazeStrength = 1; // brief direct orientation on formation
    }
  }

  function resizeWireframeCanvas() {
    if (!wfCanvas || !wfCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, WF_DPR_CAP);
    const w = wfCanvas.clientWidth;
    const h = wfCanvas.clientHeight;
    wfCanvas.width = Math.max(1, Math.round(w * dpr));
    wfCanvas.height = Math.max(1, Math.round(h * dpr));
    wfCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wfDrawnStatic = false;
  }

  const PH_RGB = [58, 255, 94];
  const ACID_RGB = [109, 255, 60];
  const GRAY_RGB = [140, 148, 142];
  // PERSONAL MODE's violet palette — the sculpture's colors are hardcoded
  // RGB triplets (a per-frame Canvas2D fillStyle, not a CSS custom property),
  // so the [data-mode="personal"] CSS var overrides in style.css can't reach
  // them; these are the same --ph/--acid hex values from that CSS block,
  // pre-converted to RGB.
  const PH_RGB_PERSONAL = [124, 92, 191]; // #7c5cbf
  const ACID_RGB_PERSONAL = [196, 107, 255]; // #c46bff
  const SHIMMER_RGB = [210, 255, 225];
  const SHIMMER_RGB_PERSONAL = [230, 215, 255];
  function activePhRgb() {
    return currentMode === 'personal' ? PH_RGB_PERSONAL : PH_RGB;
  }
  function activeAcidRgb() {
    return currentMode === 'personal' ? ACID_RGB_PERSONAL : ACID_RGB;
  }
  function activeShimmerRgb() {
    return currentMode === 'personal' ? SHIMMER_RGB_PERSONAL : SHIMMER_RGB;
  }

  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function drawSculpture(ts) {
    if (!wfCtx || !wfCanvas) return;
    const w = wfCanvas.clientWidth;
    const h = wfCanvas.clientHeight;
    if (!w || !h) return;
    const reduced = reducedMotion();
    const paused = document.hidden || gridEl.classList.contains('has-fullscreen');
    const frameStart = (window.performance && performance.now) ? performance.now() : ts;

    let paramsLon, paramsLat, rx, ry, rz, rawProgress;

    if (reduced) {
      if (wfDrawnStatic) return;
      wfDrawnStatic = true;
      // one static elegant frame, deliberately mid-morph — parity of content, zero motion
      paramsLon = lerpSuperParams(wfMorphFrom.lon, wfMorphTo.lon, houseEase(0.4));
      paramsLat = lerpSuperParams(wfMorphFrom.lat, wfMorphTo.lat, houseEase(0.4));
      rx = 0.4; ry = 0.6; rz = 0.1;
      rawProgress = null; // uniform settled blend — no per-point stagger for a single static frame
    } else if (paused) {
      return;
    } else {
      const dt = wfLastTs ? Math.min(64, ts - wfLastTs) : 16;
      wfLastTs = ts;
      const excitement = wfRunningBoost ? 1.6 : 1;

      wfMorphElapsed += dt * excitement;
      let progress = wfMorphElapsed / wfMorphDuration;
      if (progress >= 1) {
        wfMorphFrom = wfMorphTo;
        wfMorphTo = randomSupershapeState();
        wfMorphElapsed = 0;
        wfMorphDuration = randRange(25000, 40000);
        progress = 0;
      }
      const eased = houseEase(clamp(progress, 0, 1));
      paramsLon = lerpSuperParams(wfMorphFrom.lon, wfMorphTo.lon, eased);
      paramsLat = lerpSuperParams(wfMorphFrom.lat, wfMorphTo.lat, eased);

      // settle whether we're forming/showing/dispersing a face BEFORE
      // deciding rotation — the mask has to actually face the camera to
      // read as "addressing you", so free ambient spin has to stop and
      // yaw has to ease toward 0 (front) whenever a face is in play.
      const progressToTargetForYaw = clamp((ts - wfTransitionStartTs) / WF_TRANSITION_MS, 0, 1);
      const settledAtSupershape = wfFaceTarget === 0 && progressToTargetForYaw >= 1;
      if (settledAtSupershape) {
        wfRotY += dt * 0.00016 * excitement;
        wfFaceYaw = wrapAngle(wfRotY);
        wfRotZ += dt * 0.00006 * excitement;
        wfFaceRoll = wrapAngle(wfRotZ);
      } else {
        // hold level and face-on: yaw and roll both ease to 0, pitch
        // settles to a small neutral tilt — otherwise accumulated ambient
        // spin/roll rotates the mask's features off-axis right when it's
        // supposed to be looking straight at you
        wfFaceYaw += (0 - wfFaceYaw) * Math.min(1, dt / 900);
        wfRotY = wfFaceYaw; // keep synced so free-spin resumes from here, not a stale angle
        wfFaceRoll += (0 - wfFaceRoll) * Math.min(1, dt / 900);
        wfRotZ = wfFaceRoll;
      }

      // gaze: spikes to a direct cursor-orientation on formation (set in
      // updateSculptureLiveness), then softens back to an ambient baseline —
      // "meet eyes, never hold them"
      wfGazeStrength += (0.3 - wfGazeStrength) * Math.min(1, dt / 2400);
      const effectiveTilt = WF_MAX_TILT * (0.5 + wfGazeStrength);

      const nx = clamp((curX / window.innerWidth) * 2 - 1, -1, 1);
      const ny = clamp((curY / window.innerHeight) * 2 - 1, -1, 1);
      wfTargetOffsetX = ny * effectiveTilt;
      wfTargetOffsetY = nx * effectiveTilt;
      wfCurOffsetX += (wfTargetOffsetX - wfCurOffsetX) * 0.05;
      wfCurOffsetY += (wfTargetOffsetY - wfCurOffsetY) * 0.05;

      updateSculptureDrag(dt);

      const basePitch = settledAtSupershape ? 0.35 + Math.sin(ts * 0.00004) * 0.18 : 0.08;
      rx = basePitch + wfCurOffsetX + wfDragPitch;
      ry = wfFaceYaw + wfCurOffsetY + wfDragYaw;
      rz = wfRotZ;

      // "blink" shimmer only once the mask has mostly formed — a supershape doesn't blink
      if (wfFaceness > 0.5) {
        if (!wfScanNextTs) wfScanNextTs = ts + WF_SCAN_PERIOD;
        if (!wfScanActive && ts >= wfScanNextTs) {
          wfScanActive = true;
          wfScanStartTs = ts;
          wfPrevScanRow = -1;
        }
        if (wfScanActive && ts - wfScanStartTs >= WF_SCAN_DURATION) {
          wfScanActive = false;
          wfScanNextTs = ts + WF_SCAN_PERIOD;
        }
      } else {
        wfScanActive = false;
        wfScanNextTs = 0;
      }

      if (progressToTargetForYaw >= 1) {
        wfFaceness = wfFaceTarget;
        rawProgress = null; // settled — uniform blend, cheaper path
      } else {
        rawProgress = progressToTargetForYaw;
      }
    }

    const superVerts = buildSupershapeVerts(paramsLon, paramsLat);
    const verts = new Array(WF_POINT_COUNT);
    if (rawProgress !== null) {
      for (let i = 0; i < WF_POINT_COUNT; i++) {
        const localRaw = clamp((rawProgress - wfPointDelay[i]) / (1 - wfPointDelay[i]), 0, 1);
        const t = wfTransitionFrom + (wfFaceTarget - wfTransitionFrom) * houseEase(localRaw);
        const a = superVerts[i], b = faceVertsFixed[i];
        verts[i] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
    } else if (wfFaceness <= 0.001) {
      for (let i = 0; i < WF_POINT_COUNT; i++) verts[i] = superVerts[i];
    } else if (wfFaceness >= 0.999) {
      for (let i = 0; i < WF_POINT_COUNT; i++) verts[i] = faceVertsFixed[i];
    } else {
      const t = wfFaceness;
      for (let i = 0; i < WF_POINT_COUNT; i++) {
        const a = superVerts[i], b = faceVertsFixed[i];
        verts[i] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
    }

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.18;

    const cosx = Math.cos(rx), sinx = Math.sin(rx);
    const cosy = Math.cos(ry), siny = Math.sin(ry);
    const cosz = Math.cos(rz), sinz = Math.sin(rz);

    let zMin = Infinity, zMax = -Infinity;
    const rotated = new Array(verts.length);
    for (let i = 0; i < verts.length; i++) {
      const rp = rotateXYZFast(verts[i], cosx, sinx, cosy, siny, cosz, sinz);
      rotated[i] = rp;
      if (rp[2] < zMin) zMin = rp[2];
      if (rp[2] > zMax) zMax = rp[2];
    }
    const projected = new Array(rotated.length);
    for (let i = 0; i < rotated.length; i++) {
      projected[i] = projectPoint(rotated[i], cx, cy, scale);
    }

    wfCtx.clearRect(0, 0, w, h);

    const now = nowMs();
    const brightnessMult = wfRunningBoost ? 1.3 : 1;
    const desatT = wfDesaturateUntilTs > now ? clamp((wfDesaturateUntilTs - now) / 3000, 0, 1) : 0;
    const [cr, cg, cb] = mixRgb(wfRunningBoost ? activeAcidRgb() : activePhRgb(), GRAY_RGB, desatT);

    // depth-fade + soft splat: two concentric layers per bucket (outer
    // soft halo, inner bright core) approximate a gaussian falloff without
    // per-point gradient allocation. The mask's relief (eye sockets, nose
    // ridge) is small next to the full cloud's z range, so contrast is
    // punched up toward the near cluster as faceness rises — otherwise the
    // features wash out into 1-2 of the 10 brightness buckets.
    const trueZSpan = Math.max(1e-4, zMax - zMin);
    const zSpan = Math.max(1e-4, trueZSpan * (1 - wfFaceness * 0.65));
    const OPACITY_FAR = 0.1;
    const OPACITY_NEAR = 0.5;
    const SIZE_FAR = 1.1;
    const SIZE_NEAR = 3.1;
    const BUCKETS = 10;
    const buckets = Array.from({ length: BUCKETS }, () => []);
    for (let i = 0; i < rotated.length; i++) {
      const t = 1 - clamp((rotated[i][2] - zMin) / zSpan, 0, 1); // smaller z = nearer camera
      buckets[Math.min(BUCKETS - 1, Math.floor(t * BUCKETS))].push(i);
    }
    for (let bi = 0; bi < BUCKETS; bi++) {
      const list = buckets[bi];
      if (!list.length) continue;
      const bt = (bi + 0.5) / BUCKETS;
      const alpha = clamp((OPACITY_FAR + (OPACITY_NEAR - OPACITY_FAR) * bt) * brightnessMult, 0, 0.95);
      const size = SIZE_FAR + (SIZE_NEAR - SIZE_FAR) * bt;

      const outer = new Path2D();
      const inner = new Path2D();
      for (let k = 0; k < list.length; k++) {
        const p = projected[list[k]];
        outer.moveTo(p[0] + size * 1.9, p[1]);
        outer.arc(p[0], p[1], size * 1.9, 0, Math.PI * 2);
        inner.moveTo(p[0] + size * 0.7, p[1]);
        inner.arc(p[0], p[1], size * 0.7, 0, Math.PI * 2);
      }
      wfCtx.fillStyle = `rgba(${cr},${cg},${cb},${(alpha * 0.35).toFixed(3)})`;
      wfCtx.fill(outer);
      wfCtx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`;
      wfCtx.fill(inner);
    }

    // shimmer ripple = blink: one latitude row sweeps chin-to-crown over
    // ~2s every ~20s, full brightness with a fading echo trailing it —
    // only runs once the mask has mostly formed (gated above)
    if (!reduced && !paused && wfScanActive) {
      const scanT = clamp((ts - wfScanStartTs) / WF_SCAN_DURATION, 0, 1);
      const row = Math.min(WF_LAT_SEGS, Math.round(scanT * WF_LAT_SEGS));
      const [shr, shg, shb] = activeShimmerRgb();
      const drawRow = (rowIdx, alphaMul, sizeMul) => {
        if (rowIdx < 0) return;
        wfCtx.fillStyle = `rgba(${shr},${shg},${shb},${(0.9 * alphaMul).toFixed(3)})`;
        for (let j = 0; j < WF_LON_SEGS; j++) {
          const p = projected[rowIdx * WF_LON_SEGS + j];
          wfCtx.beginPath();
          wfCtx.arc(p[0], p[1], SIZE_NEAR * 0.9 * sizeMul, 0, Math.PI * 2);
          wfCtx.fill();
        }
      };
      if (wfPrevScanRow >= 0 && wfPrevScanRow !== row) drawRow(wfPrevScanRow, 0.35, 0.7);
      drawRow(row, 1, 1);
      wfPrevScanRow = row;
    }

    // job->done ripple: one radial wave sweeping outward from center
    if (!reduced && wfRippleStartTs) {
      const rippleT = (now - wfRippleStartTs) / WF_RIPPLE_DURATION;
      if (rippleT >= 1) {
        wfRippleStartTs = 0;
      } else {
        const maxRadius = Math.min(w, h) * 0.9;
        const ringRadius = rippleT * maxRadius;
        const ringWidth = 46;
        const fade = 1 - rippleT;
        for (let i = 0; i < projected.length; i++) {
          const p = projected[i];
          const dist = Math.hypot(p[0] - cx, p[1] - cy);
          const boost = Math.exp(-((dist - ringRadius) * (dist - ringRadius)) / (2 * ringWidth * ringWidth)) * fade;
          if (boost < 0.03) continue;
          const acidRgb = activeAcidRgb();
          wfCtx.fillStyle = `rgba(${acidRgb[0]},${acidRgb[1]},${acidRgb[2]},${(boost * 0.8).toFixed(3)})`;
          wfCtx.beginPath();
          wfCtx.arc(p[0], p[1], 1.6 + boost * 3, 0, Math.PI * 2);
          wfCtx.fill();
        }
      }
    }

    if (window.performance && performance.now) {
      wfFrameMsSum += performance.now() - frameStart;
      wfFrameMsCount++;
      if (ts - wfFrameMsLastLog > 5000) {
        console.debug(`[sculpture] avg frame cost ${(wfFrameMsSum / wfFrameMsCount).toFixed(2)}ms over ${wfFrameMsCount} frames`);
        wfFrameMsSum = 0;
        wfFrameMsCount = 0;
        wfFrameMsLastLog = ts;
      }
    }
  }

  resizeWireframeCanvas();
  window.addEventListener('resize', resizeWireframeCanvas);

  requestAnimationFrame(function loop(ts) {
    tickReticle();
    drawSculpture(ts);
    requestAnimationFrame(loop);
  });

  // ---------- now strip: always narrating, never empty ----------

  const nowStripEl = document.getElementById('now-strip');
  const nowStripInnerEl = document.getElementById('now-strip-inner');

  // nearest upcoming agenda item today — a future cron fire, else the
  // soonest client due date, else an honest "nothing else scheduled".
  function nearestAgendaItem(state) {
    const nowHour = hoursDecimal(new Date());
    const cronToday = (state.cron || [])
      .map((c) => {
        const parts = /^(\d{1,2}):(\d{2})$/.exec(c.time || '');
        if (!parts) return null;
        return { name: c.name, startHour: Number(parts[1]) + Number(parts[2]) / 60 };
      })
      .filter((c) => c && c.startHour >= nowHour)
      .sort((a, b) => a.startHour - b.startHour);
    if (cronToday.length) return `${cronToday[0].name} at ${formatHM(cronToday[0].startHour)}`;

    const dueClients = (state.clients || [])
      .filter((c) => c.dueDays !== null && c.dueDays >= 0)
      .sort((a, b) => a.dueDays - b.dueDays);
    if (dueClients.length) {
      const c = dueClients[0];
      return `${c.client} ${c.dueDays === 0 ? 'due today' : `due in ${c.dueDays}d`}`;
    }
    return 'nothing else scheduled today';
  }

  // word-stagger, only when the verb actually changes (quiet<->running,
  // running->verifying, or a different job takes over) — never on every
  // 5s poll just because a relative-time string ticked over
  let nowStripLastKey = null;
  function staggerNowStrip() {
    if (reducedMotion() || typeof gsap === 'undefined') return;
    const words = splitWordsFresh(nowStripInnerEl);
    if (!words.length) return;
    gsap.fromTo(words, { opacity: 0.15, y: 3 }, { opacity: 1, y: 0, duration: 0.22, stagger: 0.045, ease: houseEase, overwrite: true });
  }

  function renderNowStrip(state) {
    if (!nowStripEl || !nowStripInnerEl) return;
    const jobs = state.jobs || [];
    const overdueTasks = (state.tasks || []).filter((t) => t.overdue).length;
    const overdueHtml = overdueTasks > 0
      ? ` <span class="now-sep">&middot;</span> <span class="now-overdue">${overdueTasks} TASK${overdueTasks === 1 ? '' : 'S'} OVERDUE</span>`
      : '';
    const active = jobs.find((j) => j.status === 'running' || j.status === 'verifying');
    const units = activeOrchestrationUnits(state);
    const engines = orchestrationEngineCount(state);
    const orchKey = active ? '' : `orch:${units.map((u) => u.name).join(',')}:${engines}`;
    const key = (active ? `${active.status}:${active.slug}` : orchKey || 'quiet') + `:overdue${overdueTasks}`;
    const changed = key !== nowStripLastKey;
    nowStripLastKey = key;
    if (active) {
      const verb = active.status === 'verifying' ? 'VERIFYING' : 'RUNNING';
      const milestone = active.milestonesTotal ? `${active.milestonesDone}/${active.milestonesTotal}` : '—';
      const current = active.current ? ` — ${escapeHtml(active.current)}` : '';
      nowStripInnerEl.innerHTML = `<span class="now-verb">${verb}</span> <span class="now-project">${escapeHtml(active.project || active.slug)}</span> <span class="now-sep">&middot;</span> ${escapeHtml(milestone)}${current}${overdueHtml}`;
      nowStripEl.classList.add('now-active');
      nowStripEl.classList.remove('now-quiet');
      if (changed) staggerNowStrip();
      return;
    }
    // The studio can be building without a job/*.md tracking it — a bench
    // tournament or a chain unit running raw `claude -p`/`opencode run`
    // engines. The NOW strip must say so rather than reading "all quiet"
    // while three engines are live (the bug Zoh actually caught).
    if (units.length || engines > 0) {
      const unitNames = units.map((u) => escapeHtml(u.name)).join(', ');
      const engineText = engines > 0 ? `${engines} engine${engines === 1 ? '' : 's'} building` : '';
      const body = unitNames && engineText
        ? `<span class="now-project">${unitNames}</span> <span class="now-sep">&middot;</span> ${engineText}`
        : `<span class="now-project">${unitNames || engineText}</span>`;
      nowStripInnerEl.innerHTML = `<span class="now-verb">ORCHESTRATION</span> ${body}${overdueHtml}`;
      nowStripEl.classList.add('now-active');
      nowStripEl.classList.remove('now-quiet');
      if (changed) staggerNowStrip();
      return;
    }
    const withTime = jobs.filter((j) => j.updatedAt);
    const lastEventText = withTime.length
      ? `last event ${relativeTime(withTime.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt)}`
      : 'no activity yet';
    const next = nearestAgendaItem(state);
    nowStripInnerEl.innerHTML = `<span class="now-quiet-label">all quiet</span> <span class="now-sep">&middot;</span> ${escapeHtml(lastEventText)} <span class="now-sep">&middot;</span> next: ${escapeHtml(next)}${overdueHtml}`;
    nowStripEl.classList.add('now-quiet');
    nowStripEl.classList.remove('now-active');
    if (changed) staggerNowStrip();
  }

  // ---------- sound identity (Tone.js, CDN — degrades to silence if it fails to load) ----------
  // Motifs are short, quiet, triangle/sine through a tape-ish lowpass —
  // never louder than a notification chime. Hard-capped at one sound per
  // 10s window (extras are dropped, never queued); reduced-motion users
  // get zero autonomous sounds, matching the visual-motion doctrine.

  const SOUND_KEY = 'hq-history-console-sound-v1';

  function loadSoundPrefs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SOUND_KEY) || '{}');
      return {
        enabled: parsed.enabled === true,
        muted: parsed.muted === true,
        volume: typeof parsed.volume === 'number' ? clamp(parsed.volume, 0, 1) : 0.6,
      };
    } catch {
      return { enabled: false, muted: false, volume: 0.6 };
    }
  }
  const soundPrefs = loadSoundPrefs();
  function saveSoundPrefs() {
    try {
      localStorage.setItem(SOUND_KEY, JSON.stringify(soundPrefs));
    } catch {
      // private mode / quota exceeded — same tolerance as layout persistence
    }
  }

  function hasTone() {
    return typeof window.Tone !== 'undefined';
  }

  let toneStarted = false;
  let toneSynth = null;
  let toneNoise = null;
  let toneNoiseFilter = null;
  let toneGain = null;
  let lastMotifTs = 0;
  const MOTIF_COOLDOWN_MS = 10000;

  async function ensureToneStarted() {
    if (!hasTone()) return false;
    if (toneStarted) return true;
    try {
      await Tone.start();
      toneSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.008, decay: 0.18, sustain: 0.04, release: 0.35 },
      });
      const lowpass = new Tone.Filter(1600, 'lowpass'); // tape-ish, keeps it soft
      toneGain = new Tone.Gain(soundPrefs.volume);
      toneSynth.chain(lowpass, toneGain, Tone.Destination);
      // the sculpture's drag-release whoosh — filtered noise, brightness/
      // volume driven by throw velocity in playMotif('whoosh', intensity)
      toneNoiseFilter = new Tone.Filter(500, 'lowpass');
      toneNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0 },
      });
      toneNoise.chain(toneNoiseFilter, toneGain, Tone.Destination);
      toneStarted = true;
    } catch {
      toneStarted = false;
    }
    return toneStarted;
  }

  // review-needed = two ascending pentatonic notes; job done = single warm
  // ping; rework verdict = low third; error spike = muted thud; jam start
  // = 3-note arpeggio, fired by checkJamNotifications() on a new jam file;
  // mode-personal/mode-studio = the PERSONAL MODE toggle chime; whoosh =
  // filtered noise burst on sculpture drag-release, brightness/volume
  // scaled by intensity (0..1, from throw velocity). In PERSONAL MODE every
  // pitched note is transposed down a minor third — same instrument, lower
  // voice, not a different sound identity.
  function down3(note) {
    if (currentMode !== 'personal' || !hasTone()) return note;
    try {
      return Tone.Frequency(note).transpose(-3).toNote();
    } catch {
      return note;
    }
  }
  async function playMotif(kind, intensity) {
    if (!soundPrefs.enabled || soundPrefs.muted) return;
    if (reducedMotion()) return;
    const now = Date.now();
    if (now - lastMotifTs < MOTIF_COOLDOWN_MS) return;
    const ok = await ensureToneStarted();
    if (!ok || !toneSynth) return;
    lastMotifTs = now;
    const t = Tone.now();
    switch (kind) {
      case 'review-needed':
        toneSynth.triggerAttackRelease(down3('C5'), '16n', t);
        toneSynth.triggerAttackRelease(down3('E5'), '16n', t + 0.15);
        break;
      case 'job-done':
        toneSynth.triggerAttackRelease(down3('A4'), '8n', t);
        break;
      case 'rework':
        toneSynth.triggerAttackRelease([down3('D3'), down3('F3')], '8n', t);
        break;
      case 'error-spike':
        toneSynth.triggerAttackRelease(down3('C2'), '32n', t, 0.4);
        break;
      case 'jam-start':
        toneSynth.triggerAttackRelease(down3('C4'), '16n', t);
        toneSynth.triggerAttackRelease(down3('E4'), '16n', t + 0.12);
        toneSynth.triggerAttackRelease(down3('G4'), '16n', t + 0.24);
        break;
      case 'mode-personal':
        toneSynth.triggerAttackRelease(down3('E4'), '16n', t);
        toneSynth.triggerAttackRelease(down3('B4'), '8n', t + 0.13);
        break;
      case 'mode-studio':
        toneSynth.triggerAttackRelease('B4', '16n', t);
        toneSynth.triggerAttackRelease('E5', '8n', t + 0.13);
        break;
      case 'whoosh': {
        if (!toneNoise) break;
        const amt = clamp(typeof intensity === 'number' ? intensity : 0.5, 0, 1);
        toneNoiseFilter.frequency.value = 350 + amt * 2200;
        toneNoise.volume.value = -24 + amt * 12; // dB — quiet even at max, a whoosh not a crash
        toneNoise.triggerAttackRelease('8n', t);
        break;
      }
      default:
        break;
    }
  }

  // Task check-off tick: a soft two-note upward chime, deliberately NOT
  // routed through playMotif() — it skips MOTIF_COOLDOWN_MS on purpose.
  // Every other motif is an autonomous notification the console fires at
  // the operator (hence the shared 10s cap); this one only ever fires in
  // direct response to the operator's own click, so checking off several
  // tasks in a row should tick every time, not just once per 10s.
  async function playTaskTick() {
    if (!soundPrefs.enabled || soundPrefs.muted) return;
    if (reducedMotion()) return;
    const ok = await ensureToneStarted();
    if (!ok || !toneSynth) return;
    const t = Tone.now();
    toneSynth.triggerAttackRelease(down3('G5'), '32n', t);
    toneSynth.triggerAttackRelease(down3('C6'), '32n', t + 0.055);
  }

  // AMEND tick: a quieter, single-note cousin of playTaskTick — same
  // deliberate skip of MOTIF_COOLDOWN_MS (a direct-click response), pitched
  // down so it reads as "correction" rather than "done".
  async function playAmendTick() {
    if (!soundPrefs.enabled || soundPrefs.muted) return;
    if (reducedMotion()) return;
    const ok = await ensureToneStarted();
    if (!ok || !toneSynth) return;
    const t = Tone.now();
    toneSynth.triggerAttackRelease(down3('E5'), '16n', t);
  }

  const soundControlsEl = document.getElementById('ro-sound-controls');

  function renderSoundControls() {
    if (!soundControlsEl) return;
    if (!soundPrefs.enabled) {
      soundControlsEl.innerHTML = '<button type="button" class="ro-chip" id="sound-enable-btn">[enable sound]</button>';
      const btn = document.getElementById('sound-enable-btn');
      if (btn) {
        btn.addEventListener('click', async () => {
          soundPrefs.enabled = true;
          saveSoundPrefs();
          await ensureToneStarted();
          renderSoundControls();
        });
      }
      return;
    }
    soundControlsEl.innerHTML = `
      <button type="button" class="ro-chip${soundPrefs.muted ? ' active' : ''}" id="sound-mute-btn" aria-pressed="${soundPrefs.muted}">${soundPrefs.muted ? 'MUTED' : 'MUTE'}</button>
      <input type="range" class="ro-slider" id="sound-volume" min="0" max="1" step="0.05" value="${soundPrefs.volume}" aria-label="sound volume">
    `;
    const muteBtn = document.getElementById('sound-mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        soundPrefs.muted = !soundPrefs.muted;
        saveSoundPrefs();
        renderSoundControls();
      });
    }
    const volumeInput = document.getElementById('sound-volume');
    if (volumeInput) {
      volumeInput.addEventListener('input', (e) => {
        soundPrefs.volume = clamp(Number(e.target.value), 0, 1);
        if (toneGain) toneGain.gain.value = soundPrefs.volume;
        saveSoundPrefs();
      });
    }
  }
  renderSoundControls();

  // AudioContext needs a user gesture — if sound was already enabled in a
  // past session, arm the actual Tone.start() on the first click/keydown
  // this load rather than replaying the enable chip.
  if (soundPrefs.enabled) {
    const resumeToneOnGesture = () => {
      ensureToneStarted();
      window.removeEventListener('pointerdown', resumeToneOnGesture);
      window.removeEventListener('keydown', resumeToneOnGesture);
    };
    window.addEventListener('pointerdown', resumeToneOnGesture, { once: true });
    window.addEventListener('keydown', resumeToneOnGesture, { once: true });
  }

  // ---------- optional browser notifications toggle ----------

  const NOTIFY_KEY = 'hq-history-console-notify-v1';
  function loadNotifyPref() {
    try {
      return localStorage.getItem(NOTIFY_KEY) === '1';
    } catch {
      return false;
    }
  }
  let notifyEnabled = loadNotifyPref() && typeof Notification !== 'undefined' && Notification.permission === 'granted';

  const notifyControlsEl = document.getElementById('ro-notify-controls');
  function renderNotifyControls() {
    if (!notifyControlsEl) return;
    if (typeof Notification === 'undefined') {
      notifyControlsEl.innerHTML = '<span class="ro-unavailable">unsupported</span>';
      return;
    }
    if (notifyEnabled) {
      notifyControlsEl.innerHTML = '<span class="ro-chip active">ON</span>';
      return;
    }
    notifyControlsEl.innerHTML = '<button type="button" class="ro-chip" id="notify-enable-btn">[browser notifications]</button>';
    const btn = document.getElementById('notify-enable-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        // permission is only ever requested from this explicit opt-in click
        const perm = await Notification.requestPermission();
        notifyEnabled = perm === 'granted';
        try {
          localStorage.setItem(NOTIFY_KEY, notifyEnabled ? '1' : '0');
        } catch {
          // private mode / quota — choice just won't persist across reloads
        }
        renderNotifyControls();
      });
    }
  }
  renderNotifyControls();

  // ---------- session / logout (v0.16) ----------

  function goToLogin() {
    window.location.href = './login';
  }

  function renderSessionControls() {
    const el = document.getElementById('ro-session-controls');
    if (!el) return;
    el.innerHTML = '<button type="button" class="ro-chip" id="logout-btn">LOGOUT</button>';
    const btn = document.getElementById('logout-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        apiFetch('./api/logout', { method: 'POST' }).finally(goToLogin);
      });
    }
  }
  renderSessionControls();

  // ---------- PERSONAL MODE (press 0): toggle + readout chip ----------

  function renderModeControls() {
    const el = document.getElementById('ro-mode-controls');
    if (!el) return;
    const personal = currentMode === 'personal';
    el.innerHTML = `<button type="button" class="ro-chip${personal ? ' active' : ''}" id="mode-toggle-btn" aria-pressed="${personal}">${personal ? 'PERSONAL' : 'STUDIO'} (0)</button>`;
    const btn = document.getElementById('mode-toggle-btn');
    if (btn) btn.addEventListener('click', toggleMode);
  }

  // Everything that must re-run when the mode flips: theme attribute, the
  // pipeline pane's swapped label/body (it's one shared DOM pane, not a
  // duplicate — see render()), rail contents, the readout chip, and an
  // immediate poll so the newly-relevant vault's data shows up right away
  // instead of waiting for the next 5s tick.
  function applyModeUI() {
    document.documentElement.setAttribute('data-mode', currentMode);
    const pipelineArg = document.getElementById('pipeline-arg');
    if (pipelineArg) pipelineArg.textContent = currentMode === 'personal' ? '{applications}' : '{jobs}';
    const funnelEl = document.getElementById('applications-funnel');
    if (funnelEl) funnelEl.hidden = currentMode !== 'personal';
    applyLayout();
    // paneFloatRect() reads currentMode (via DEFAULT_FLOAT_PERSONAL) — the
    // rects only actually reach the DOM once applyFloating() re-runs, so a
    // mode switch must force it, not just wait for the next resize/drag.
    applyFloating();
    renderModeControls();
  }

  // A mode flip is a genuine "something just happened" moment — the fourth
  // reserved playEase spot (alongside loadout switches, pane summon, review
  // card arrival): every currently-visible pane pops in with a staggered
  // settle instead of just silently re-rendering, echoing scene zero's
  // cascade but quick and purely celebratory.
  function bounceModeSwitch() {
    if (reducedMotion() || typeof gsap === 'undefined') return;
    const visible = visiblePanes();
    if (visible.length) {
      gsap.fromTo(
        visible,
        { opacity: 0.4, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.36, stagger: 0.04, ease: playEase, clearProps: 'opacity,scale', overwrite: true }
      );
    }
    const chip = document.getElementById('mode-toggle-btn');
    if (chip) gsap.fromTo(chip, { scale: 1.35 }, { scale: 1, duration: 0.4, ease: playEase, clearProps: 'scale' });
  }

  function setMode(mode) {
    const next = mode === 'personal' ? 'personal' : 'studio';
    if (next === currentMode) return;
    currentMode = next;
    saveMode(currentMode);
    applyModeUI();
    showGlobalToast(currentMode === 'personal' ? 'PERSONAL MODE — the violet universe' : 'STUDIO MODE');
    playMotif(currentMode === 'personal' ? 'mode-personal' : 'mode-studio');
    bounceModeSwitch();
    poll();
  }

  function toggleMode() {
    setMode(currentMode === 'personal' ? 'studio' : 'personal');
  }

  renderModeControls();
  applyModeUI();

  document.addEventListener('keydown', (e) => {
    if (e.key !== '0') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    toggleMode();
  });

  // ---------- provenance line ----------
  // dim, honest credit for the skills that shaped this choreography pass —
  // provenance labeling per motion-studio/creative-3d, nothing more.
  const CREDIT_SKILLS = ['motion-studio', 'web-animation', 'creative-3d'];
  const roCreditsEl = document.getElementById('ro-credits');
  let creditIdx = 0;
  function tickCredits() {
    if (!roCreditsEl) return;
    const show = () => {
      roCreditsEl.textContent = CREDIT_SKILLS[creditIdx % CREDIT_SKILLS.length];
      creditIdx++;
    };
    if (reducedMotion()) {
      show();
      return;
    }
    roCreditsEl.style.opacity = '0';
    setTimeout(() => {
      show();
      roCreditsEl.style.opacity = '0.7';
    }, 220);
  }
  tickCredits();
  setInterval(tickCredits, 6000);

  // ---------- review notifications: badge + toast + motif + Notification API ----------

  const globalToastEl = document.getElementById('global-toast');
  const globalToastTextEl = document.getElementById('global-toast-text');
  let globalToastTimer = null;

  function showGlobalToast(text) {
    if (!globalToastEl || !globalToastTextEl) return;
    globalToastTextEl.textContent = text;
    globalToastEl.classList.add('visible');
    clearTimeout(globalToastTimer);
    globalToastTimer = setTimeout(() => globalToastEl.classList.remove('visible'), 6000);
  }

  if (globalToastEl) {
    globalToastEl.addEventListener('click', () => {
      globalToastEl.classList.remove('visible');
      focusPane('review', { scroll: true });
    });
  }

  let seenPendingReviewIds = new Set();
  let reviewNotifyBaseline = false;

  function checkReviewNotifications(state) {
    const pending = (state.review || []).filter((c) => c.status === 'pending');
    const pendingIds = new Set(pending.map((c) => c.id));
    const freshCards = pending.filter((c) => !seenPendingReviewIds.has(c.id));

    // don't fire on the first poll — only on cards that appear after that baseline
    if (reviewNotifyBaseline && freshCards.length) {
      const label = freshCards.length === 1 ? freshCards[0].title : `${freshCards.length} new cards waiting`;
      showGlobalToast(`REVIEW NEEDED — ${label}`);
      playMotif('review-needed');
      if (notifyEnabled && typeof Notification !== 'undefined') {
        try {
          new Notification('HQ Console — review needed', { body: label });
        } catch {
          // notification construction can throw in odd permission states — non-fatal
        }
      }
      // arrival is a playful moment (see motion toolkit) — a fresh card
      // settles into the pending stack rather than just appearing
      if (!reducedMotion() && typeof gsap !== 'undefined') {
        freshCards.forEach((c) => {
          const card = document.querySelector('.review-card[data-id="' + CSS.escape(c.id) + '"]');
          if (card) gsap.fromTo(card, { opacity: 0, scale: 0.96, y: -6 }, { opacity: 1, scale: 1, y: 0, duration: 0.34, ease: playEase, clearProps: 'opacity,scale,transform' });
        });
      }
    }
    seenPendingReviewIds = pendingIds;
    reviewNotifyBaseline = true;
    reviewPendingCount = pending.length;
    renderRail();
  }

  // ---------- top-level render ----------

  function render(state) {
    lastState = state;
    updatedEl.removeAttribute('data-iso');
    updatedEl.textContent = 'ARCHIVED / JUL–OCT 2026';
    if (currentMode === 'personal') {
      renderQuests(state.quests);
      renderPursuits(state.pursuits);
      renderApplications(state.applications);
      renderAssets(state.assets);
      renderPersonalAgenda(state);
    } else {
      renderCredits(state.gemini, state.claudeCode, state.agentsActive, state.openrouter);
      renderJobs(state.jobs);
      renderClients(state.clients);
      renderClientsPortfolio(state.clients);
      renderAgenda(state);
      renderRoster(state.roster);
      updateFlow(state.git, state.jobs);
      renderLinks(state.links);
      renderCommons(state.jams);
      checkJamNotifications(state.jams);
      // studio-only pane — same in-progress-edit guard as the review
      // composer, so a poll mid-edit can't yank the cursor away.
      if (!roadmapEditingId) renderRoadmap(state.roadmap);
      renderLibrary(state.library);
      // ..//canvas: {THE PRODUCTION FLOOR} owns its own flow-data poll
      // (public/canvas.js) since flow JSON can be sizable and is only
      // needed while that pane is actually open — this just hands it the
      // ops-truth slice (state.jobs/state.orchestration) the NOW-RUNNING
      // dock reads, same inputs renderNowStrip() below already uses.
      if (typeof window.HQCanvas !== 'undefined' && window.HQCanvas.onState) window.HQCanvas.onState(state);
    }
    // shared ambient chrome — ticker/review/now-strip/sculpture/readout all
    // work unmodified in both modes: buildPersonalState() aliases
    // state.jobs/state.clients/state.cron so this code never needs a branch.
    renderTicker(state.ticker);
    // Skip while a composer is open — a full innerHTML replace on every 5s
    // poll would blow away in-progress typing (draft state itself is safe
    // either way, see reviewComposer/localStorage, but the cursor/focus
    // isn't). closeComposer()/submitFromComposer() both re-render from
    // lastState directly once the composer closes, so nothing goes stale.
    if (!reviewComposer) renderReview(state.review);
    checkReviewNotifications(state);
    renderTasks(state.tasks);
    renderNowStrip(state);
    updateSculptureLiveness(state);
    updateReadoutDue();
  }

  // ---------- scene zero: staged first-load entrance ----------
  // Gated before first paint by an inline script in index.html's <head>
  // (adds html.scene-zero-pending, which CSS uses to pre-hide the pieces
  // below — see style.css). Reduced-motion and same-session reloads never
  // get here at all: the class is never added, so there's nothing to
  // reveal and bootComplete is set immediately. Uses houseEase throughout
  // (an entrance is an information beat, not a playful one — see motion
  // toolkit) except pane cascade, which reuses the same expo-out too:
  // scene zero isn't one of playEase's three named playful moments.
  function runSceneZero() {
    const pending = document.documentElement.classList.contains('scene-zero-pending');
    document.documentElement.classList.remove('scene-zero-pending');
    if (!pending || typeof gsap === 'undefined') {
      bootComplete = true;
      return;
    }
    const crtGridEl = document.querySelector('.crt-grid');
    const paneEls = PANES.map((p) => document.querySelector('.term[data-pane="' + p.id + '"]')).filter(Boolean);

    if (crtGridEl) gsap.set(crtGridEl, { opacity: 0 });
    if (wfCanvas) gsap.set(wfCanvas, { opacity: 0, scale: 0.9 });
    gsap.set(paneEls, { opacity: 0, y: 8 });
    const reticleDraw = { v: 0 };

    const tl = gsap.timeline({
      defaults: { ease: houseEase },
      onComplete: () => {
        bootComplete = true;
      },
    });
    if (crtGridEl) tl.to(crtGridEl, { opacity: 1, duration: 0.35 }, 0);
    tl.to(reticleDraw, { v: 1, duration: 0.35, onUpdate: () => { wfReticleDraw = reticleDraw.v; } }, 0.05);
    if (wfCanvas) tl.to(wfCanvas, { opacity: 1, scale: 1, duration: 0.4 }, 0.1);
    if (paneEls.length) tl.to(paneEls, { opacity: 1, y: 0, duration: 0.32, stagger: 0.06, clearProps: 'opacity,transform' }, 0.08);
  }

  // ---------- ..//canvas bridge ----------

  // public/canvas.js is a separate <script> (its own closure) — it needs a
  // few things from here rather than reimplementing them: the review-gate
  // node's "eye" reuses the EXACT v0.16 verdict composer/lightbox (same
  // reviewComposer state, same POST /api/review flow) instead of a second
  // implementation, and the rest are small shared utilities so canvas.js's
  // toasts/motifs/easing match the rest of the console.
  window.HQReviewBridge = {
    cardHtml: reviewCardHtml,
    wire: wireReviewPane,
    openLightbox,
    findCard: findReviewCard,
  };
  window.HQConsole = {
    reducedMotion,
    houseEase,
    playEase,
    apiFetch,
    apiErrorText,
    escapeHtml,
    relativeTime,
    showGlobalToast,
    playMotif,
    focusPane: (id, opts) => focusPane(id, opts),
    currentMode: () => currentMode,
  };
  // canvas.js sets this true while the pointer hovers its viewport (or the
  // pane is the focused one), so its own 1-9 viewpoint hotkeys don't fight
  // with the loadout-switch keydown handler above for the 1-5 overlap.
  window.HQCanvasWantsHotkeys = () => false;

  // ---------- boot ----------

  initTelegram();
  poll();
  setInterval(poll, POLL_MS);
  pollFuel();
  setInterval(pollFuel, FUEL_POLL_MS);
  pollRnd();
  setInterval(pollRnd, RND_POLL_MS);
  setInterval(() => {
    const el = document.getElementById('updated');
    if (el && el.dataset.iso) el.textContent = `updated ${relativeTime(el.dataset.iso)}`;
  }, 1000);
  runSceneZero();
})();
