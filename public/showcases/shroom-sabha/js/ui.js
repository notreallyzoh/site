/* Every pane, every card. Rendering only — no state lives here. */

import {
  FESTIVAL, VENUES, VENUE_BY_ID, SESSIONS, SESSION_BY_ID, CARE, SPORES,
  VENUES_CONFIRMED, PINNED, AMENITIES, pinFor, VENUE_PHOTOS
} from './data.js';
import * as store from './store.js';
import * as photos from './photos.js';
import * as myc from './mycelium.js';
import * as notify from './notify.js';
import * as offline from './offline.js';
import { toast, buzz, burstAt, bloom, TAP, KNOCK, BLOOM } from './fx.js';
import * as tools from './tools.js';

/* ────────────────────────────────────────────────────────────── meta ──── */

const KIND = {
  meal:      { g: '🍲', label: 'Food' },
  ritual:    { g: '🕯', label: 'Ceremony' },
  talk:      { g: '🎤', label: 'Talk' },
  lab:       { g: '🧫', label: 'Hands-on' },
  foray:     { g: '🧺', label: 'Foray' },
  movement:  { g: '🌀', label: 'Movement' },
  music:     { g: '🎶', label: 'Music' },
  film:      { g: '🎞', label: 'Film' },
  logistics: { g: '📋', label: 'Logistics' }
};

const VKIND = {
  stage:  { g: '🏛', label: 'Programme spaces' },
  eat:    { g: '🍲', label: 'Food, coffee & wares' },
  water:  { g: '💧', label: 'Water' },
  stay:   { g: '🛖', label: 'Where you sleep' },
  work:   { g: '🔧', label: 'The farm at work' },
  sacred: { g: '🪔', label: 'Sacred ground' },
  nature: { g: '🌿', label: 'Land' },
  gate:   { g: '🚪', label: 'Ways in and out' }
};

const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  /* The handset's ink runs x 4.2-19.0, y 3.5-20.5 — its optical centre is up
     and to the left of the box centre, which is why it sat off-centre in a
     circle. Shifted so the shape is centred, not the viewBox. */
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(0.4 0.75)"><path d="M6.2 3.5h3l1.5 3.8-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 3.8 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2z"/></g></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M6.5 10.5L12 16l5.5-5.5M4.5 20h15"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15M12 4v11M7.5 10.5L12 15l4.5-4.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.5L12 3.5l4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>'
};

/* ──────────────────────────────────────────────────────────── helpers ─── */

const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Times are shown in festival local time no matter where the phone thinks
   it is — the ISO string already carries +05:30, so read it directly. */
const clock = iso => {
  const h = +iso.slice(11, 13), m = iso.slice(14, 16);
  return { t: `${h % 12 || 12}:${m}`, ap: h < 12 ? 'am' : 'pm', h };
};
const ms = iso => new Date(iso).getTime();
const range = s => `${clock(s.start).t}${clock(s.start).ap}–${clock(s.end).t}${clock(s.end).ap}`;

const isNow = (s, now) => now >= ms(s.start) && now < ms(s.end);
const isPast = (s, now) => now >= ms(s.end);

function overlaps (a, b) {
  return ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);
}

function daySessions (day) {
  return SESSIONS.filter(s => s.day === day).sort((a, b) =>
    ms(a.start) - ms(b.start) || (a.track || '').localeCompare(b.track || ''));
}

/** Group same-start sessions so parallel tracks render as one bracketed fork. */
function groupSlots (list) {
  const out = [];
  for (const s of list) {
    const prev = out[out.length - 1];
    if (prev && prev[0].start === s.start) prev.push(s);
    else out.push([s]);
  }
  return out;
}

function currentDay () {
  const now = Date.now();
  for (const d of FESTIVAL.days) {
    const end = ms(`${d.date}T23:59:59+05:30`);
    if (now <= end) return d.id;
  }
  return FESTIVAL.days[FESTIVAL.days.length - 1].id;
}

function countdown (target) {
  const d = target - Date.now();
  if (d <= 0) return null;
  const mins = Math.floor(d / 60e3);
  if (mins < 60) return { n: mins, u: mins === 1 ? 'min' : 'mins' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { n: hrs, u: hrs === 1 ? 'hour' : 'hours' };
  const days = Math.floor(hrs / 24);
  return { n: days, u: days === 1 ? 'day' : 'days' };
}

/* ═══════════════════════════════════════════════════════════ wiring ════ */

let deps = {};
let activeDay = currentDay();
let activeTab = 'schedule';

export function initUI (d) {
  deps = d;

  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) { buzz(TAP); showTab(t.dataset.tab); }
  });

  /* one delegated handler for every card action in the sheet */
  $('#sheetBody').addEventListener('click', onSheetClick);
  $('#sheetBody').addEventListener('input', e => {
    const box = e.target.closest('[data-note]');
    if (box) { store.setNote(box.dataset.note, box.value); return; }
    const act = e.target.closest('[data-act]');
    if (act && actions[act.dataset.act]) actions[act.dataset.act](act);
  });
  $('#searchResults').addEventListener('click', onSheetClick);

  store.onChange(what => {
    updateSavedCount();
    if (what === 'saved' && (activeTab === 'saved' || activeTab === 'schedule')) renderTab(activeTab);
    if (what === 'stamps' || what === 'checkins' || what === 'badges') {
      if (activeTab === 'saved') renderTab('saved');
    }
  });

  updateSavedCount();
  showTab('schedule', { quiet: true });
  renderNow();
  setInterval(renderNow, 30_000);
}

function onSheetClick (e) {
  const star = e.target.closest('[data-star]');
  if (star) {
    e.stopPropagation();
    const on = store.toggleSaved(star.dataset.star);
    star.setAttribute('aria-pressed', String(on));
    buzz(on ? KNOCK : TAP);
    if (on) burstAt(star, { count: 12, spread: .7 });
    if (star.classList.contains('btn')) {
      star.classList.toggle('btn--ghost', on);
      star.innerHTML = `${ICON.star} ${on ? 'Saved' : 'Add to My Sabha'}`;
    }
    return;
  }

  /*
   * A bare data-venue means "take me to this place" — the chip on a card, a
   * row under "Also here". But a search result carries data-venue as context
   * alongside data-session and data-act, and this branch used to swallow it:
   * tapping a programme result opened the venue instead of the session, and
   * because closeSearch() lives in the searchGo action, the search panel was
   * left sitting over the whole app. So yield to the more specific handlers.
   */
  const at = e.target.closest('[data-venue]');
  if (at && !at.dataset.act && !at.dataset.session) {
    e.stopPropagation();
    buzz(TAP);
    openVenue(at.dataset.venue);
    return;
  }

  const check = e.target.closest('[data-checkin]');
  if (check) { e.stopPropagation(); doCheckIn(check.dataset.checkin); return; }

  const stampBtn = e.target.closest('[data-stamp]');
  if (stampBtn) { e.stopPropagation(); doStamp(stampBtn.dataset.stamp); return; }

  const walk = e.target.closest('[data-walk]');
  if (walk) {
    e.stopPropagation();
    const [wx, wy] = walk.dataset.walk.split(',').map(Number);
    if (deps.walkTo?.(wx, wy, walk.dataset.walkName || 'there')) {
      deps.sheet?.go('peek');       // get out of the way of the map
    }
    return;
  }

  const act = e.target.closest('[data-act]');
  if (act) { e.stopPropagation(); actions[act.dataset.act]?.(act); return; }

  const card = e.target.closest('[data-session]');
  if (card) { buzz(TAP); openSession(card.dataset.session); }
}

/* ═══════════════════════════════════════════════════════ session detail ══ */

export function openSession (id) {
  const s = SESSION_BY_ID[id];
  if (!s) return;
  const v = VENUE_BY_ID[s.venue];
  const pin = pinFor(s.venue);
  const day = FESTIVAL.days.find(d => d.id === s.day);
  const now = Date.now();
  const pane = $('#pane-session');

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-on'));
  document.querySelectorAll('.pane').forEach(p => { p.hidden = true; });
  pane.hidden = false;
  activeTab = 'session';

  const kind = KIND[s.kind] || {};
  const saved = store.isSaved(s.id);
  const checked = store.isCheckedIn(s.id);
  const canCheck = myc.canCheckIn(s, now) && !checked;
  const live = isNow(s, now);
  const showGuess = !VENUES_CONFIRMED && s.venueGuess;

  /* anything else running at the same time — the parallel-track choice */
  const clashes = SESSIONS.filter(o => o.id !== s.id && overlaps(o, s) &&
    o.kind !== 'meal' && o.kind !== 'logistics');

  const others = v ? SESSIONS.filter(o => o.venue === s.venue && o.id !== s.id &&
    ms(o.end) > now).sort((a, b) => ms(a.start) - ms(b.start)).slice(0, 4) : [];

  pane.innerHTML = `
    <button class="btn btn--ghost btn--sm" data-act="backSchedule" type="button"
            style="margin-bottom:16px">← Schedule</button>

    <div class="shead">
      <span class="when">${esc(day?.short || '')} September · ${esc(range(s))}</span>
      <h2>${esc(s.title)}</h2>
      ${s.sub ? `<p class="sub2">${esc(s.sub)}</p>` : ''}
      ${live ? '<p class="live-now"><span class="now-pulse"></span> Happening right now</p>' : ''}
      ${s.host ? `<p class="host2">with <b>${esc(s.host)}</b></p>` : ''}
      ${s.blurb ? `<p class="blurb2">${esc(s.blurb)}</p>` : ''}
      <div class="meta-row">
        ${kind.label ? `<span class="track-chip">${kind.g} ${esc(kind.label)}</span>` : ''}
        ${s.track ? `<span class="track-chip">Track ${esc(s.track)}</span>` : ''}
        ${checked ? '<span class="track-chip" style="color:var(--k-lab)">✓ You were there</span>' : ''}
      </div>
    </div>

    ${v ? `
      <div class="sec">
        <h3>Where</h3>
        <button class="row" data-venue="${esc(s.venue)}" type="button">
          <span class="row-k" aria-hidden="true">${VKIND[v.kind]?.g || '📍'}</span>
          <span class="row-b">
            <b>${esc(v.name)}${showGuess ? ' <span class="q" title="Venue not yet confirmed">?</span>' : ''}</b>
            <span>${esc(v.role || '')}${v.alias ? ` · also called the ${esc(v.alias)}` : ''}</span>
          </span>
        </button>
        ${showGuess ? '<p class="hint">This venue is our best guess and is still being confirmed.</p>' : ''}
      </div>` : ''}

    <div class="btn-row">
      <button class="btn ${saved ? 'btn--ghost' : ''}" data-star="${esc(s.id)}"
              aria-pressed="${saved}" type="button">
        ${ICON.star} ${saved ? 'Saved' : 'Add to My Sabha'}
      </button>
      ${canCheck ? `<button class="btn" data-checkin="${esc(s.id)}" type="button">${ICON.check} I'm here</button>` : ''}
    </div>
    <div class="btn-row">
      <button class="btn btn--ghost btn--sm" data-act="icsOne" data-id="${esc(s.id)}" type="button">
        ${ICON.cal} Add just this to calendar
      </button>
    </div>

    <div class="sec">
      <h3>Your note</h3>
      <textarea class="note-box" data-note="${esc(s.id)}" rows="3"
        placeholder="Something you want to remember — a name, a species, a smell.">${esc(store.noteFor(s.id))}</textarea>
      <p class="hint">Saved on this phone as you type. It goes into your diary at the end.</p>
    </div>

    ${clashes.length ? `
      <div class="sec">
        <h3>At the same time</h3>
        ${clashes.map(c => cardHTML(c, now, { tight: true, showTime: true })).join('')}
        <p class="hint">These run in parallel — you can only be at one.</p>
      </div>` : ''}

    ${others.length ? `
      <div class="sec">
        <h3>Also at ${esc(v.name)}</h3>
        ${others.map(o => cardHTML(o, now, { tight: true, showTime: true })).join('')}
      </div>` : ''}
  `;

  if (pin) deps.map?.focusVenue(pin.id);
  $('#sheetBody').scrollTop = 0;
  if (deps.sheet?.state() === 'peek') deps.sheet.go('half');
}

/* ═══════════════════════════════════════════════════════════ now bar ═══ */

export function renderNow () {
  const host = $('#nowStrip');
  const now = Date.now();
  const live = SESSIONS.filter(s => isNow(s, now)).sort((a, b) => ms(a.end) - ms(b.end));
  const next = SESSIONS.filter(s => ms(s.start) > now).sort((a, b) => ms(a.start) - ms(b.start));

  const festEnd = ms(SESSIONS[SESSIONS.length - 1].end);
  if (now > festEnd) {
    host.innerHTML = `
      <div class="now-body">
        <div class="eyebrow">That was the Sabha</div>
        <div class="now-title">Take your spore print</div>
        <div class="now-meta">Three days of it, on one card</div>
      </div>
      <button class="now-go" data-act="toSaved" type="button" aria-label="Open My Sabha">${ICON.arrow}</button>`;
    return;
  }

  const pick = live[0] || next[0];
  if (!pick) { host.innerHTML = ''; return; }

  const onNow = !!live[0];
  const v = VENUE_BY_ID[pick.venue];
  const target = onNow ? ms(pick.end) : ms(pick.start);
  const c = countdown(target);
  const also = onNow && live.length > 1 ? ` · +${live.length - 1} more` : '';

  host.innerHTML = `
    ${onNow ? '<span class="now-pulse" aria-hidden="true"></span>' : ''}
    <div class="now-body">
      <div class="eyebrow">${onNow ? 'On now' : 'Next up'}${esc(also)}</div>
      <div class="now-title">${esc(pick.title)}</div>
      <div class="now-meta">${v ? esc(v.name) : ''}${pick.host ? ' · ' + esc(pick.host) : ''}</div>
    </div>
    ${c ? `<div class="now-count mono"><b>${c.n}</b>${esc(c.u)}${onNow ? ' left' : ''}</div>` : ''}
    <button class="now-go" data-act="goNow" data-id="${esc(pick.id)}" type="button"
            aria-label="Show ${esc(pick.title)} on the map">${ICON.arrow}</button>`;
}

/* ═══════════════════════════════════════════════════════════ tabs ══════ */

/**
 * @param {string} name
 * @param {object} [opt] `quiet: true` renders without disturbing the sheet —
 *                       used on boot so the map gets the first word.
 */
export function showTab (name, opt = {}) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-on', t.dataset.tab === name));
  document.querySelectorAll('.pane').forEach(p => { p.hidden = true; });
  const pane = $(`#pane-${name}`);
  if (pane) pane.hidden = false;
  renderTab(name);
  if (!opt.quiet && deps.sheet && deps.sheet.state() === 'peek') deps.sheet.go('half');
  $('#sheetBody').scrollTop = 0;
  if (name !== 'places') deps.map?.spotlight(null);
}

function renderTab (name) {
  ({
    schedule: renderSchedule,
    saved: renderSaved,
    places: renderPlaces,
    care: renderCare,
    about: renderAbout
  })[name]?.();
}

function updateSavedCount () {
  const n = store.get().saved.length;
  const el = $('#savedCount');
  if (el) el.textContent = n ? String(n) : '';
}

/* ═══════════════════════════════════════════════════════ schedule ══════ */

let nowFilter = false;

function renderSchedule () {
  const bar = $('#daybar');
  const today = currentDay();
  bar.innerHTML =
    FESTIVAL.days.map(d => `
      <button class="day ${!nowFilter && d.id === activeDay ? 'is-on' : ''} ${d.id === today ? 'is-today' : ''}"
              data-act="day" data-id="${d.id}" type="button">
        <b>${esc(d.label)}</b><span>${esc(d.short)}</span>
      </button>`).join('') +
    `<button class="day day--now ${nowFilter ? 'is-on' : ''}" data-act="nowFilter" type="button">
       <b>Now</b><span>Free?</span>
     </button>`;

  const now = Date.now();
  $('#scheduleList').innerHTML = nowFilter ? nowListHTML(now)
    : groupSlots(daySessions(activeDay)).map(g => slotHTML(g, now)).join('');
}

/* "I have forty minutes — what can I actually do?" On now, then starting
   soon, then the next meal, and nothing else. */
function nowListHTML (now) {
  const SOON = 90 * 60e3;
  const live = SESSIONS.filter(s => isNow(s, now));
  const soon = SESSIONS.filter(s => ms(s.start) > now && ms(s.start) - now < SOON)
    .sort((a, b) => ms(a.start) - ms(b.start));
  const nextMeal = SESSIONS.find(s => s.kind === 'meal' && ms(s.start) > now);

  if (!live.length && !soon.length) {
    const next = SESSIONS.filter(s => ms(s.start) > now).sort((a, b) => ms(a.start) - ms(b.start))[0];
    return `<div class="empty"><div class="g" aria-hidden="true">🌙</div>
      <p>Nothing running just now.${next ? ` Next is <b>${esc(next.title)}</b> at ${esc(clock(next.start).t)}${esc(clock(next.start).ap)}.` : ''}</p></div>`;
  }

  const block = (title, items, opts) => items.length ? `
    <div class="sec"><h3>${esc(title)}</h3>
      ${items.map(s => cardHTML(s, now, { showTime: true, tight: true, ...opts })).join('')}
    </div>` : '';

  return block('On now', live) +
         block('Starting soon', soon) +
         (nextMeal && !live.includes(nextMeal) && !soon.includes(nextMeal)
           ? block('Next meal', [nextMeal]) : '');
}

function slotHTML (group, now) {
  const first = group[0];
  const c = clock(first.start);
  const live = group.some(s => isNow(s, now));
  const past = group.every(s => isPast(s, now));

  const inner = group.length > 1
    ? `<div class="fork"><span class="fork-label">Pick one</span>${group.map(s => cardHTML(s, now)).join('')}</div>`
    : (first.kind === 'meal' || first.kind === 'logistics' ? thinHTML(first) : cardHTML(first, now));

  return `
    <div class="slot ${live ? 'is-now' : ''} ${past ? 'is-past' : ''}">
      <span class="slot-dot" aria-hidden="true"></span>
      <div class="slot-time mono">${c.t}<i>${c.ap}</i></div>
      ${inner}
    </div>`;
}

function thinHTML (s) {
  const v = VENUE_BY_ID[s.venue];
  return `
    <button class="thin" data-session="${esc(s.id)}" type="button">
      <span aria-hidden="true">${KIND[s.kind]?.g || '·'}</span>
      <b>${esc(s.title)}${s.sub ? ' ' + esc(s.sub) : ''}</b>
      <span>${v ? esc(v.name) : ''}</span>
    </button>`;
}

function cardHTML (s, now = Date.now(), opts = {}) {
  const v = VENUE_BY_ID[s.venue];
  const saved = store.isSaved(s.id);
  const kind = KIND[s.kind] || {};
  const showGuess = !VENUES_CONFIRMED && s.venueGuess;
  const canCheck = myc.canCheckIn(s, now) && !store.isCheckedIn(s.id);
  const checked = store.isCheckedIn(s.id);

  return `
    <div class="card ${opts.clash ? 'is-clash' : ''}" data-session="${esc(s.id)}"
         style="--k:var(--k-${esc(s.kind)})">
      <div class="card-top">
        <h3>${esc(s.title)}${s.sub ? `<span class="sub">${esc(s.sub)}</span>` : ''}</h3>
        <button class="star" data-star="${esc(s.id)}" type="button"
                aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Add to'} My Sabha">
          ${ICON.star}
        </button>
      </div>
      ${s.host ? `<p class="host">with ${esc(s.host)}</p>` : ''}
      ${s.blurb && !opts.tight ? `<p class="blurb">${esc(s.blurb)}</p>` : ''}
      <div class="card-foot">
        ${v ? `<button class="at" data-venue="${esc(s.venue)}" type="button">
                 ${ICON.pin}${esc(v.name)}${v.role ? ` <i>· ${esc(v.role)}</i>` : ''}
                 ${showGuess ? '<span class="q" title="Venue not yet confirmed">?</span>' : ''}
               </button>` : ''}
        ${opts.showTime ? `<span class="track-chip mono">${esc(range(s))}</span>` : ''}
        ${s.track ? `<span class="track-chip">Track ${esc(s.track)}</span>` : ''}
        ${kind.label ? `<span class="track-chip">${kind.g} ${esc(kind.label)}</span>` : ''}
        ${checked ? '<span class="track-chip" style="color:var(--k-lab)">✓ Attended</span>' : ''}
        ${canCheck ? `<button class="btn btn-sm" data-checkin="${esc(s.id)}" type="button">I'm here</button>` : ''}
      </div>
      ${opts.clash ? `<div class="clash-note">⚠ Clashes with ${esc(opts.clash)}</div>` : ''}
    </div>`;
}

/* ═══════════════════════════════════════════════════ my sabha / passport ═ */

function renderSaved () {
  const pane = $('#pane-saved');
  const s = store.get();
  const r = myc.rank();
  const T = myc.totals();

  const saved = s.saved.map(id => SESSION_BY_ID[id]).filter(Boolean)
    .sort((a, b) => ms(a.start) - ms(b.start));

  /* clash detection across the parallel tracks */
  const clashOf = new Map();
  for (let i = 0; i < saved.length; i++) {
    for (let j = i + 1; j < saved.length; j++) {
      if (overlaps(saved[i], saved[j])) {
        clashOf.set(saved[i].id, saved[j].title);
        clashOf.set(saved[j].id, saved[i].title);
      }
    }
  }

  const byDay = FESTIVAL.days.map(d => ({
    day: d,
    items: saved.filter(x => x.day === d.id)
  })).filter(g => g.items.length);

  pane.innerHTML = `
    <div class="myc-hero">
      <div class="myc-rank">
        <h2>${esc(r.name)}</h2>
        <span>${r.points} pts</span>
      </div>
      <p class="myc-sub">${esc(r.note)}${r.next ? ` · ${r.next.at - r.points} more to ${esc(r.next.name)}` : ''}</p>
      <div class="myc-bar"><i id="mycBar"></i></div>
      <canvas class="myc-canvas" id="mycCanvas" aria-label="Your mycelium network, grown from the places you visited"></canvas>
    </div>

    <div class="stats">
      <div class="stat"><b>${s.stamps.length}</b><span>of ${T.venues} places</span></div>
      <div class="stat"><b>${s.checkins.length}</b><span>attended</span></div>
      <div class="stat"><b>${s.badges.length}</b><span>of ${T.badges} badges</span></div>
    </div>

    <div class="sec">
      <h3>Spore trail</h3>
      <div class="badges">
        ${myc.BADGES.map(b => `
          <div class="badge ${store.hasBadge(b.id) ? 'is-got' : ''}">
            <div class="g" aria-hidden="true">${b.glyph}</div>
            <b>${esc(b.name)}</b><span>${esc(b.hint)}</span>
          </div>`).join('')}
      </div>
      <p class="hint">Stamps come from tapping <b>I'm here</b> on a place while you are standing in it, and from checking into sessions as they happen.</p>
    </div>

    <div class="sec">
      <h3>Your schedule ${saved.length ? `· ${saved.length}` : ''}</h3>
      ${clashOf.size ? `<p class="hint" style="color:var(--rust);margin-bottom:10px">
        ⚠ ${clashOf.size / 2} clash${clashOf.size > 2 ? 'es' : ''} in your picks — the tracks run in parallel.</p>` : ''}
      ${saved.length ? byDay.map(g => `
        <p class="eyebrow" style="margin:16px 0 8px">${esc(g.day.label)} · ${esc(g.day.short)} September</p>
        ${g.items.map(x => cardHTML(x, Date.now(), { showTime: true, tight: true, clash: clashOf.get(x.id) })).join('')}
      `).join('') : `
        <div class="empty">
          <div class="g" aria-hidden="true">🍄</div>
          <p>Nothing starred yet. Tap the star on any session and it lands here — with a calendar file and a nudge before it starts.</p>
        </div>`}
    </div>

    ${saved.length ? `
      <div class="btn-row">
        <button class="btn" data-act="ics" type="button">${ICON.cal} Add to calendar</button>
        <button class="btn btn--ghost" data-act="print" type="button">${ICON.share} Spore print</button>
      </div>
      <p class="hint">The calendar file is the reliable one — your phone's own alarms, no signal needed.</p>
    ` : `<button class="btn btn--ghost btn--block" data-act="print" type="button">${ICON.share} Make a spore print</button>`}
  `;

  requestAnimationFrame(() => {
    const bar = $('#mycBar');
    if (bar) bar.style.width = `${Math.round(r.progress * 100)}%`;
    const cv = $('#mycCanvas');
    if (cv) myc.drawNetwork(cv, {
      seed: s.seed, stamps: s.stamps.length,
      fruits: Math.floor(s.checkins.length / 3)
    });
  });
}

/* ═══════════════════════════════════════════════════════════ places ════ */

function renderPlaces () {
  const pane = $('#pane-places');
  const order = ['stage', 'eat', 'water', 'stay', 'sacred', 'work', 'nature', 'gate'];
  const groups = order.map(k => ({ k, items: VENUES.filter(v => v.kind === k) })).filter(g => g.items.length);

  pane.innerHTML = groups.map(g => `
    <div class="sec">
      <h3>${VKIND[g.k].g} ${esc(VKIND[g.k].label)}</h3>
      ${g.items.map(v => {
        const pin = pinFor(v.id);
        const stamped = store.isStamped(pin?.id);
        return `
          <button class="row" data-venue="${esc(v.id)}" type="button">
            <span class="row-k" aria-hidden="true">${stamped ? '✓' : VKIND[v.kind].g}</span>
            <span class="row-b">
              <b>${esc(v.name)}</b>
              <span>${v.role ? esc(v.role) : ''}${v.alias ? ` · also called the ${esc(v.alias)}` : ''}</span>
            </span>
          </button>`;
      }).join('')}
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════ venue ═════ */

export function openVenue (id) {
  const v = VENUE_BY_ID[id];
  if (!v) return;
  const pin = pinFor(id);
  const pane = $('#pane-venue');

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-on'));
  document.querySelectorAll('.pane').forEach(p => { p.hidden = true; });
  pane.hidden = false;
  activeTab = 'venue';

  const here = SESSIONS.filter(s => s.venue === id).sort((a, b) => ms(a.start) - ms(b.start));
  const now = Date.now();
  const upcoming = here.filter(s => ms(s.end) > now);
  const stamped = store.isStamped(pin?.id);

  /* other things that share this pin */
  const shares = VENUES.filter(x => x.at === pin?.id && x.id !== id);

  pane.innerHTML = `
    <div class="vshot" id="vshot" hidden><img alt=""></div>
    <div class="vhead">
      <div class="eyebrow">${VKIND[v.kind]?.g || ''} ${esc(VKIND[v.kind]?.label || 'Place')}</div>
      <h2>${esc(v.name)}</h2>
      ${v.role ? `<span class="role">${esc(v.role)}</span>` : ''}
      ${v.alias ? `<p class="alias">Also called the ${esc(v.alias)}</p>` : ''}
      ${v.blurb ? `<p>${esc(v.blurb)}</p>` : ''}
    </div>

    ${pin ? `<button class="stamp-btn ${stamped ? 'is-done' : ''}" data-stamp="${esc(pin.id)}" type="button">
        ${stamped ? ICON.check + ' Stamped' : ICON.pin + " I'm here"}
      </button>
      ${!stamped ? '<p class="hint">Tap it when you are actually standing here. It feeds your mycelium.</p>' : ''}
      ${deps.geo?.isGeoReferenced?.() ? `<div class="btn-row">
        <button class="btn btn--ghost" type="button"
                data-walk="${pin.x},${pin.y}" data-walk-name="${esc(v.name)}">
          ${ICON.pin} Walk me there
        </button></div>` : ''}`
    : ''}

    ${shares.length ? `<div class="sec"><h3>Also here</h3>
      ${shares.map(x => `<button class="row" data-venue="${esc(x.id)}" type="button">
          <span class="row-k" aria-hidden="true">${VKIND[x.kind].g}</span>
          <span class="row-b"><b>${esc(x.name)}</b><span>${esc(x.role || '')}</span></span>
        </button>`).join('')}</div>` : ''}

    <div class="sec">
      <h3>${upcoming.length ? 'Coming up here' : 'Programme here'}</h3>
      ${here.length
        ? (upcoming.length ? upcoming : here).slice(0, 12).map(s => {
            const d = FESTIVAL.days.find(x => x.id === s.day);
            return cardHTML(s, now, { showTime: true, tight: true }).replace(
              '<div class="card-foot">',
              `<div class="card-foot"><span class="track-chip">${esc(d?.short || '')}</span>`);
          }).join('')
        : '<div class="empty"><p>Nothing scheduled here — it is part of the farm rather than the programme.</p></div>'}
    </div>

    <button class="btn btn--ghost btn--block" data-act="backSchedule" type="button" style="margin-top:20px">
      Back to the schedule
    </button>`;

  showVenuePhoto(id, pin?.id);

  if (pin) deps.map?.focusVenue(pin.id);
  $('#sheetBody').scrollTop = 0;
  if (deps.sheet?.state() === 'peek') deps.sheet.go('half');
}

/*
 * A shipped photo wins; a locally captured one is the fallback. That order
 * matters during the recce itself — whoever is walking the farm sees their own
 * picture on the pin straight away, and everyone else sees nothing until the
 * files are actually in the build.
 */
let vshotUrl = null;

async function showVenuePhoto (venueId, pinId) {
  if (vshotUrl) { URL.revokeObjectURL(vshotUrl); vshotUrl = null; }
  const box = $('#vshot');
  if (!box) return;
  const img = box.querySelector('img');

  const shipped = VENUE_PHOTOS[venueId] || (pinId && VENUE_PHOTOS[pinId]);
  if (shipped) {
    img.src = `assets/venues/${shipped}`;
    box.hidden = false;
    return;
  }

  try {
    const u = await photos.url(venueId) || (pinId ? await photos.url(pinId) : null);
    if (!u) { box.hidden = true; return; }
    vshotUrl = u;
    img.src = u;
    box.hidden = false;
  } catch { box.hidden = true; }
}

/* ═══════════════════════════════════════════════════════════ care ══════ */

/* The practical things, grouped so you can get to one in two taps. Order is
   deliberate: the thing you need most urgently is first. */
const FIND = [
  { type: 'firstaid', label: 'First aid',  glyph: '⛑' },
  { type: 'toilet',   label: 'Toilets',    glyph: '🚻' },
  { type: 'water',    label: 'Drinking water', glyph: '🚰' },
  { type: 'food',     label: 'Food',       glyph: '🍲' },
  { type: 'shower',   label: 'Showers',    glyph: '🚿' },
  { type: 'sport',    label: 'Games',      glyph: '⚽' }
];

function renderCare () {
  const pane = $('#pane-care');
  const counts = Object.fromEntries(
    FIND.map(f => [f.type, AMENITIES.filter(a => a.type === f.type).length]));

  const stay = VENUE_BY_ID[store.get().stay];

  pane.innerHTML = `
    <div class="sec">
      <h3>Right now</h3>
      <div class="quick">
        <button class="quick-b quick-b--sos" data-act="sos" type="button">
          <span class="quick-g" aria-hidden="true">📡</span>
          <b>Send my location</b>
          <span>Texts First Aid where you are</span>
        </button>
        <button class="quick-b" data-act="torch" type="button">
          <span class="quick-g" aria-hidden="true">🔦</span>
          <b>Torch</b>
          <span>Amber, kind to night eyes</span>
        </button>
        ${stay ? `
        <button class="quick-b" data-venue="${esc(stay.id)}" type="button">
          <span class="quick-g" aria-hidden="true">🛏</span>
          <b>Take me back</b>
          <span>${esc(stay.name)}</span>
        </button>` : `
        <button class="quick-b" data-act="pickStay" type="button">
          <span class="quick-g" aria-hidden="true">🛏</span>
          <b>Set my bed</b>
          <span>So you can find it later</span>
        </button>`}
      </div>
    </div>

    <div class="sec">
      <h3>Find your way</h3>
      <div class="finder">
        ${FIND.filter(f => counts[f.type]).map(f => `
          <button class="find" data-act="findAmenity" data-type="${esc(f.type)}" type="button">
            <span class="find-g" aria-hidden="true">${f.glyph}</span>
            <b>${esc(f.label)}</b>
            <span class="find-n">${counts[f.type]} on the farm</span>
          </button>`).join('')}
      </div>
      <p class="hint">Tap one and the map flies to the nearest, counting from wherever you are looking now.</p>
    </div>

    <div class="sec">
      <h3>If you need a hand</h3>
      ${CARE.contacts.filter(c => c.urgent).map(c => `
        <a class="tel" href="tel:${esc(c.tel)}">
          <span class="tel-ico" aria-hidden="true">${ICON.phone}</span>
          <span class="tel-txt"><b>${esc(c.label)}</b><span>${esc(c.detail)} · ${esc(c.tel)}</span></span>
        </a>`).join('')}
      <p class="hint">${esc(CARE.medkit)} If you cannot reach anyone, find any Shroom Sabha crew member.</p>
    </div>

    <div class="sec">
      <h3>Good people to know</h3>
      ${CARE.contacts.filter(c => !c.urgent).map(c => `
        <a class="tel tel--calm" href="tel:${esc(c.tel)}">
          <span class="tel-ico" aria-hidden="true">${ICON.phone}</span>
          <span class="tel-txt"><b>${esc(c.label)}</b><span>${esc(c.detail)} · ${esc(c.tel)}</span></span>
        </a>`).join('')}
    </div>

    ${CARE.sections.map(sec => `
      <div class="sec">
        <div class="panel ${sec.danger ? 'panel--danger' : ''}">
          <h4>${esc(sec.title)}</h4>
          <ul>${sec.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
        </div>
      </div>`).join('')}

    <p class="hint" style="margin-top:20px">The original guide supports offline use. Offline installation is disabled in this portfolio preview.</p>`;

  /* reading the ethics is worth a badge — quietly */
  if (!store.hasBadge('ethics')) {
    setTimeout(() => {
      if (activeTab === 'care') { store.award('ethics'); afterProgress(['ethics']); }
    }, 3500);
  }
}

/* ═══════════════════════════════════════════════════════════ about ═════ */

function renderAbout () {
  const pane = $('#pane-about');
  const s = store.get();
  const light = tools.lightToday();
  const perm = notify.permission();
  const savedBytes = s.offlineSaved;

  pane.innerHTML = `
    <div class="sec">
      <h3>${esc(FESTIVAL.billing)}</h3>
      ${FESTIVAL.about.map(p => `<p style="font-size:14px;color:var(--t2);line-height:1.6;margin-bottom:10px">${esc(p)}</p>`).join('')}
      <p class="hint">${esc(FESTIVAL.address)}</p>
      <div class="btn-row">
        <a class="btn btn--ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FESTIVAL.address)}"
           target="_blank" rel="noopener">${ICON.pin} Get directions</a>
      </div>
    </div>

    <div class="sec">
      <h3>Keep it on this phone</h3>
      <div class="saver ${savedBytes ? 'is-done' : ''}" id="saver">
        <div class="saver-top">
          <span class="saver-ring" id="saverRing" style="--p:${savedBytes ? 100 : 0}">${ICON.save}</span>
          <span class="saver-txt">
            <b id="saverTitle">${savedBytes ? 'Saved to this device' : 'Save the whole app'}</b>
            <span id="saverSub">${savedBytes
              ? `${offline.fmtBytes(savedBytes)} · map, schedule and care pages all work with no signal`
              : 'Map, schedule, care pages and fonts. Do it now while you have bars.'}</span>
          </span>
        </div>
        <div class="btn-row">
          <button class="btn ${savedBytes ? 'btn--ghost' : ''}" data-act="saveOffline" type="button" id="saverBtn">
            ${ICON.down} ${savedBytes ? 'Save again' : 'Save for offline'}
          </button>
        </div>
      </div>
      <div class="btn-row" id="installRow" ${offline.isStandalone() ? 'hidden' : ''}>
        <button class="btn btn--ghost btn--block" data-act="install" type="button">Add to home screen</button>
      </div>
      <p class="hint">${esc(offline.installHint())}</p>
    </div>

    <div class="sec">
      <h3>Reminders</h3>
      <div class="panel">
        <p>Two ways to be nudged before something you starred:</p>
        <div class="btn-row">
          <button class="btn" data-act="ics" type="button">${ICON.cal} Calendar file</button>
          <button class="btn btn--ghost" data-act="askNotify" type="button" ${perm === 'granted' ? 'disabled' : ''}>
            ${perm === 'granted' ? '✓ Alerts on' : perm === 'denied' ? 'Alerts blocked' : 'Turn on alerts'}
          </button>
        </div>
        <p class="hint">The calendar file is the one to trust — it uses your phone's own alarms and needs no signal. In-app alerts only fire while the app has been opened recently.</p>
      </div>
    </div>

    <div class="sec">
      <h3>Light today</h3>
      <div class="panel light-row">
        <div><b id="sunUp">—</b><span>Sunrise</span></div>
        <div><b id="sunDown">—</b><span>Sunset</span></div>
        <div><b id="sunDark">—</b><span>Dark by</span></div>
      </div>
      <p class="hint">Worked out on your phone from the farm's latitude — no signal needed.
        Night mode follows these rather than a fixed clock.</p>
    </div>

    <div class="sec">
      <h3>Finding your way</h3>
      <div class="panel">
        <p style="font-size:14px;color:var(--t2);line-height:1.6;margin:0 0 12px" id="geoState"></p>
        <div class="btn-row">
          <span class="hint">GPS calibration is not included in this portfolio preview.</span>
        </div>
        <p class="hint">Mark where the landmarks really are by standing at them.
          Works with no signal. Once four are marked, the map can show where you
          are and point you at things.</p>
      </div>
    </div>

    <div class="sec">
      <h3>How the map draws</h3>
      <div class="panel">
        <label class="toggle">
          <input type="checkbox" id="liteToggle">
          <span><b>Lite map</b>
          <span>The flat map instead of the 3D one. Lighter on an old phone, and it loads faster on a bad connection. Everything else works the same.</span></span>
        </label>
        <p class="hint" id="viewOut"></p>
      </div>
    </div>

    <div class="sec">
      <h3>Battery</h3>
      <div class="panel">
        <label class="toggle">
          <input type="checkbox" data-act="saver" ${s.saver ? 'checked' : ''}>
          <span><b>Battery saver</b>
          <span>Stops the sky, the drifting spores and the swaying trees. The map, the schedule and the phone numbers all keep working.</span></span>
        </label>
        <p class="hint" id="battOut"></p>
      </div>
    </div>

    <div class="sec">
      <h3>You</h3>
      <div class="panel">
        <label class="field">
          <span>What should we call you?</span>
          <input type="text" data-act="name" value="${esc(s.name || '')}"
                 placeholder="Your name" maxlength="24" autocomplete="nickname">
        </label>
        <p class="hint">Used on your spore print, and on the messages you send the crew.</p>
      </div>
    </div>

    <div class="sec">
      <h3>Spore of wisdom</h3>
      <div class="panel"><p id="sporeFact">${esc(SPORES[(Math.random() * SPORES.length) | 0])}</p>
      <div class="btn-row"><button class="btn btn--ghost btn--sm" data-act="nextSpore" type="button">Another</button></div></div>
    </div>

    <div class="sec">
      <h3>This map</h3>
      <p class="hint">Illustration and identity by the Shroom Sabha team. Built as an offline-first web app — no accounts, no tracking, nothing leaves your phone.</p>
      <div class="btn-row">
        <button class="btn btn--ghost btn--sm" data-act="reset" type="button">Reset my progress</button>
      </div>
    </div>`;

  requestAnimationFrame(async () => {
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    set('sunUp', light.sunriseText);
    set('sunDown', light.sunsetText);
    set('sunDark', light.duskText);
    const gs = $('#geoState');
    if (gs) {
      const T = deps.geo?.current?.();
      const q = deps.geo?.quality?.(T);
      gs.innerHTML = T
        ? `This phone knows where the farm is — <b>${T.n} spots</b> marked, ` +
          `${q?.label === 'unchecked' ? 'not yet checkable' : `worst error ${T.worst.toFixed(0)} m`}. ` +
          'The locate button at the bottom left works.'
        : 'Nobody has walked the farm yet, so the map knows its shape but not ' +
          'where it sits on Earth. Until then there is no live dot.';
    }

    const vo = $('#viewOut');
    if (vo) {
      if (deps.map?.didFallBack?.()) {
        /* Explain, do not offer a switch: the renderer is chosen automatically
           and a manual override only invited people to fight it. */
        vo.textContent =
          'This phone could not run the 3D map, so you are on the lite one. ' +
          'Everything works the same — all the places, routes and details are here.';
      } else {
        vo.textContent = deps.map?.isIsometric?.()
          ? 'You are on the 3D map.'
          : 'You are on the lite map.';
      }
    }
    const b = await tools.batteryState();
    if (b) set('battOut',
      `${b.level}% ${b.charging ? 'and charging' : 'left'}${b.level < 25 && !b.charging ? ' — worth turning saver on' : ''}`);
  });
}

/* ═══════════════════════════════════════════════════════════ search ════ */

export function renderSearch (q) {
  const host = $('#searchResults');
  const query = q.trim().toLowerCase();

  if (!query) {
    host.innerHTML = `<div class="empty"><div class="g" aria-hidden="true">🔎</div>
      <p>Search a session, a host, or anywhere on the farm.</p></div>`;
    deps.map?.spotlight(null);
    return;
  }

  const hit = t => String(t || '').toLowerCase().includes(query);

  const venues = VENUES.filter(v => hit(v.name) || hit(v.role) || hit(v.alias) || hit(v.blurb));
  const sessions = SESSIONS.filter(s => hit(s.title) || hit(s.sub) || hit(s.host) || hit(s.blurb));

  if (!venues.length && !sessions.length) {
    host.innerHTML = `<div class="empty"><div class="g" aria-hidden="true">🕸</div>
      <p>Nothing by that name. Try a host, or part of a title.</p></div>`;
    return;
  }

  host.innerHTML = `
    ${venues.length ? `<div class="sec"><h3>Places</h3>${venues.map(v => `
      <button class="row" data-venue="${esc(v.id)}" data-act="searchGo" type="button">
        <span class="row-k" aria-hidden="true">${VKIND[v.kind].g}</span>
        <span class="row-b"><b>${esc(v.name)}</b><span>${esc(v.role || '')}</span></span>
      </button>`).join('')}</div>` : ''}

    ${sessions.length ? `<div class="sec"><h3>Programme</h3>${sessions.map(s => {
      const v = VENUE_BY_ID[s.venue];
      const d = FESTIVAL.days.find(x => x.id === s.day);
      return `
        <button class="row" data-session="${esc(s.id)}" data-act="searchGo"
                data-venue="${esc(s.venue || '')}" type="button">
          <span class="row-k" aria-hidden="true">${KIND[s.kind]?.g || '·'}</span>
          <span class="row-b"><b>${esc(s.title)}</b>
            <span>${esc(d?.short || '')} · ${esc(range(s))}${v ? ' · ' + esc(v.name) : ''}</span></span>
        </button>`;
    }).join('')}</div>` : ''}`;

  deps.map?.spotlight([...venues.map(v => v.id), ...sessions.map(s => s.venue).filter(Boolean)]);
}

/* ═══════════════════════════════════════════════════ progress actions ══ */

function afterProgress (freshBadges) {
  const fresh = freshBadges || myc.checkBadges();
  const before = myc.rank();
  if (fresh.length) {
    const b = myc.BADGES.find(x => x.id === fresh[0]);
    setTimeout(() => toast(`${b.glyph} <b>${esc(b.name)}</b> — ${esc(b.hint)}`, 3400), 700);
  }
  return before;
}

function doStamp (venueId) {
  const rankBefore = myc.rank().index;
  const ok = store.stamp(venueId);
  if (!ok) { toast('Already stamped'); return; }

  buzz(BLOOM);
  deps.map?.celebrate(venueId);
  const v = VENUE_BY_ID[venueId];
  toast(`🍄 <b>${esc(v?.name || 'Stamped')}</b> added to your trail`);
  afterProgress();
  checkRankUp(rankBefore);
  if (activeTab === 'venue') openVenue(venueId);
}

function doCheckIn (sessionId) {
  const s = SESSION_BY_ID[sessionId];
  if (!s) return;
  if (!myc.canCheckIn(s)) { toast('You can check in around the time it runs'); return; }

  const rankBefore = myc.rank().index;
  store.checkIn(sessionId);
  const pin = pinFor(s.venue);
  if (pin) store.stamp(pin.id);

  buzz(KNOCK);
  toast(`✓ <b>${esc(s.title)}</b> — you were there`);
  afterProgress();
  checkRankUp(rankBefore);
  renderTab(activeTab === 'venue' ? 'schedule' : activeTab);
  if (activeTab === 'schedule') renderSchedule();
}

function checkRankUp (before) {
  const after = myc.rank();
  if (after.index > before) {
    bloom();
    buzz(BLOOM);
    setTimeout(() => toast(`Your network is now a <b>${esc(after.name)}</b> — ${esc(after.note)}`, 4200), 1200);
  }
}

/* ═══════════════════════════════════════════════════════════ actions ═══ */

const actions = {
  day (btn) {
    activeDay = +btn.dataset.id;
    nowFilter = false;
    buzz(TAP);
    renderSchedule();
  },

  goNow (btn) {
    openSession(btn.dataset.id);
  },

  toSaved () { showTab('saved'); },

  torch () { deps.torch?.open(); },

  async sos () {
    buzz(KNOCK);
    const s = store.get();
    const near = VENUE_BY_ID[s.stay]?.name;
    await tools.shareLocation({ name: s.name, near });
  },

  pickStay () {
    const stays = VENUES.filter(v => v.kind === 'stay');
    const pane = $('#pane-care');
    pane.insertAdjacentHTML('afterbegin', `
      <div class="sec" id="stayPicker">
        <h3>Where are you sleeping?</h3>
        <div class="finder">
          ${stays.map(v => `
            <button class="find" data-act="setStay" data-id="${esc(v.id)}" type="button">
              <span class="find-g" aria-hidden="true">🛏</span>
              <b>${esc(v.name)}</b>
              <span class="find-n">${esc(v.role || '')}</span>
            </button>`).join('')}
        </div>
      </div>`);
    $('#sheetBody').scrollTop = 0;
  },

  setStay (btn) {
    store.set({ stay: btn.dataset.id }, 'stay');
    buzz(KNOCK);
    toast(`🛏 <b>${esc(VENUE_BY_ID[btn.dataset.id].name)}</b> is your bed. It will always be one tap away.`);
    renderCare();
  },

  nowFilter () {
    nowFilter = !nowFilter;
    buzz(TAP);
    renderSchedule();
  },

  /* nearest amenity of a type, measured from the middle of the current view */
  findAmenity (btn) {
    const type = btn.dataset.type;
    const list = AMENITIES.filter(a => a.type === type);
    if (!list.length) return;
    const c = deps.map?.center?.() || { x: .5, y: .5 };
    let best = list[0], bd = Infinity;
    for (const a of list) {
      const d = (a.x - c.x) ** 2 + (a.y - c.y) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    buzz(TAP);
    deps.map?.focusAmenity?.(best.id);
    deps.sheet?.go('peek');
    toast(`${esc(best.note || type)} — flying you there`);
  },

  backSchedule () { showTab('schedule'); deps.map?.clearHighlight(); },

  searchGo (btn) {
    deps.closeSearch?.();
    if (btn.dataset.session) openSession(btn.dataset.session);
    else if (btn.dataset.venue) openVenue(btn.dataset.venue);
  },

  icsOne (btn) {
    notify.downloadICS([btn.dataset.id], `${btn.dataset.id}.ics`);
  },

  ics () {
    const ids = store.get().saved;
    notify.downloadICS(ids.length ? ids : null,
      ids.length ? 'my-shroom-sabha-2026.ics' : 'shroom-sabha-2026-full.ics');
  },

  async askNotify (btn) {
    const res = await notify.ask();
    if (res === 'granted') {
      toast('Alerts on. You will get a nudge before anything you star.');
      notify.reschedule();
    } else if (res === 'denied') {
      toast('Alerts blocked — use the calendar file instead.');
    }
    renderAbout();
  },

  async install () {
    if (offline.canPrompt()) {
      const out = await offline.promptInstall();
      if (out !== 'accepted') toast(offline.installHint(), 4000);
    } else {
      toast(offline.installHint(), 4500);
    }
  },

  async saveOffline (btn) {
    const ring = $('#saverRing'), title = $('#saverTitle'), sub = $('#saverSub');
    btn.disabled = true;
    title.textContent = 'Saving…';

    /* Chrome only grants persistent storage to sites it considers "installed".
       A plain tab is refused, and an unprotected cache can be evicted between
       sessions — which looks exactly like the app breaking for no reason. */
    const persisted = await offline.requestPersistence();

    try {
      const res = await offline.saveEverything(p => {
        const pct = Math.round(p.done / p.total * 100);
        ring.style.setProperty('--p', pct);
        sub.textContent = `${p.done} of ${p.total} files · ${offline.fmtBytes(p.bytes)}`;
      });

      /* The worker now reports what it could not store. Saying "saved" over a
         partial save is how the missing app shell went unnoticed for days. */
      const missed = (res.failed || []).length;
      store.set({ offlineSaved: res.bytes });
      ring.style.setProperty('--p', 100);

      if (missed) {
        title.textContent = 'Saved, but not all of it';
        sub.textContent = `${res.total - missed} of ${res.total} files. Try again on a better connection.`;
        toast(`${missed} file${missed > 1 ? 's' : ''} did not save. Tap Save again.`, 5000);
      } else if (persisted) {
        title.textContent = 'Saved to this device';
        sub.textContent = `${offline.fmtBytes(res.bytes)} · everything works with no signal now`;
        $('#saver').classList.add('is-done');
        buzz(BLOOM);
        toast(`<b>${offline.fmtBytes(res.bytes)}</b> saved. Turn off your data and try it.`, 4000);
      } else {
        /* Saved, but the browser may bin it. Add to Home Screen is what
           actually earns persistence, so say that rather than claim safety. */
        title.textContent = 'Saved — now add it to your home screen';
        sub.textContent = `${offline.fmtBytes(res.bytes)} saved, but your browser can still clear it. ` +
          'Adding it to your home screen is what makes it stick.';
        $('#saver').classList.add('is-done');
        buzz(BLOOM);
        toast('Saved. Add it to your home screen so the phone cannot clear it.', 6000);
      }
    } catch (err) {
      title.textContent = 'Could not save';
      sub.textContent = err.message + ' — try again with a better connection.';
    } finally {
      btn.disabled = false;
    }
  },

  icsOne (btn) {
    notify.downloadICS([btn.dataset.id], `${btn.dataset.id}.ics`);
  },

  ics () {
    const ids = store.get().saved;
    notify.downloadICS(ids.length ? ids : null,
      ids.length ? 'my-shroom-sabha-2026.ics' : 'shroom-sabha-2026-full.ics');
  },

  async askNotify (btn) {
    const res = await notify.ask();
    if (res === 'granted') {
      toast('Alerts on. You will get a nudge before anything you star.');
      notify.reschedule();
    } else if (res === 'denied') {
      toast('Alerts blocked — use the calendar file instead.');
    }
    renderAbout();
  },

  async install () {
    if (offline.canPrompt()) {
      const out = await offline.promptInstall();
      if (out !== 'accepted') toast(offline.installHint(), 4000);
    } else {
      toast(offline.installHint(), 4500);
    }
  },

  async saveOffline (btn) {
    const ring = $('#saverRing'), title = $('#saverTitle'), sub = $('#saverSub');
    btn.disabled = true;
    title.textContent = 'Saving…';

    /* Chrome only grants persistent storage to sites it considers "installed".
       A plain tab is refused, and an unprotected cache can be evicted between
       sessions — which looks exactly like the app breaking for no reason. */
    const persisted = await offline.requestPersistence();

    try {
      const res = await offline.saveEverything(p => {
        const pct = Math.round(p.done / p.total * 100);
        ring.style.setProperty('--p', pct);
        sub.textContent = `${p.done} of ${p.total} files · ${offline.fmtBytes(p.bytes)}`;
      });

      /* The worker now reports what it could not store. Saying "saved" over a
         partial save is how the missing app shell went unnoticed for days. */
      const missed = (res.failed || []).length;
      store.set({ offlineSaved: res.bytes });
      ring.style.setProperty('--p', 100);

      if (missed) {
        title.textContent = 'Saved, but not all of it';
        sub.textContent = `${res.total - missed} of ${res.total} files. Try again on a better connection.`;
        toast(`${missed} file${missed > 1 ? 's' : ''} did not save. Tap Save again.`, 5000);
      } else if (persisted) {
        title.textContent = 'Saved to this device';
        sub.textContent = `${offline.fmtBytes(res.bytes)} · everything works with no signal now`;
        $('#saver').classList.add('is-done');
        buzz(BLOOM);
        toast(`<b>${offline.fmtBytes(res.bytes)}</b> saved. Turn off your data and try it.`, 4000);
      } else {
        /* Saved, but the browser may bin it. Add to Home Screen is what
           actually earns persistence, so say that rather than claim safety. */
        title.textContent = 'Saved — now add it to your home screen';
        sub.textContent = `${offline.fmtBytes(res.bytes)} saved, but your browser can still clear it. ` +
          'Adding it to your home screen is what makes it stick.';
        $('#saver').classList.add('is-done');
        buzz(BLOOM);
        toast('Saved. Add it to your home screen so the phone cannot clear it.', 6000);
      }
    } catch (err) {
      title.textContent = 'Could not save';
      sub.textContent = err.message + ' — try again with a better connection.';
    } finally {
      btn.disabled = false;
    }
  },

  night (el) {
    const on = el.type === 'checkbox' ? el.checked : !(store.get().night === 1);
    store.set({ night: on ? 1 : 0 });
    deps.applyNight?.();
    toast(on ? '🌒 Night mode' : '☀ Day mode');
  },

  retry3d () {
    const q = new URLSearchParams(location.search);
    q.set('iso', '1');
    q.delete('lite');
    location.search = q;
  },

  async print () {
    toast('Making your spore print…', 1600);
    try {
      const { blob } = await myc.sporePrint();
      const file = new File([blob], 'shroom-sabha-2026.png', { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Shroom Sabha 2026' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'shroom-sabha-2026.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Spore print saved to your downloads');
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Could not make the print');
    }
  },

  saver (btn) {
    const on = btn.checked;
    store.set({ saver: on });
    tools.applySaver(on);
    toast(on ? 'Battery saver on — the map stays, the flourishes go' : 'Everything back on');
  },

  name (btn) { store.set({ name: btn.value.trim() }); },

  nextSpore () {
    const el = $('#sporeFact');
    if (!el) return;
    let next = SPORES[(Math.random() * SPORES.length) | 0];
    let guard = 0;
    while (next === el.textContent && guard++ < 6) next = SPORES[(Math.random() * SPORES.length) | 0];
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = next; el.style.opacity = '1'; }, 180);
    el.style.transition = 'opacity .18s';
  },

  reset () {
    if (!confirm('Clear your stamps, badges and starred sessions on this device?')) return;
    store.reset();
    toast('Reset. Fresh spore.');
    renderTab(activeTab);
  }
};

export { activeDay, activeTab };
