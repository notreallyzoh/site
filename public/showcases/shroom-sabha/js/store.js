/* Local state. Everything lives on the device — no accounts, no server,
   no network. Survives being offline for three days in a valley. */

const KEY = 'portfolio-shroomsabha-preview-v1';

const BLANK = {
  v: 1,
  saved: [],        // session ids the user starred
  stamps: [],       // venue ids visited        → {id, at}
  checkins: [],     // session ids attended     → {id, at}
  badges: [],       // badge ids earned
  seed: 0,          // per-device seed, so everyone's mycelium looks different
  night: null,      // null = auto by clock, 0/1 = user override
  remind: true,     // in-app reminders on
  lead: 10,         // minutes before start
  notified: [],     // session ids already fired
  offlineSaved: 0,  // bytes precached, 0 = not yet
  seenInstall: true,
  seenBoot: false,
  stay: null,       // which bed is yours — the way back at 2am
  notes: {},        // sessionId -> what you wrote down
  saver: false,     // battery saver: drop everything decorative
  lite: false,      // flat map instead of the 3D one
  name: ''          // what the chat and your spore print call you
};

let state = load();

function load () {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...BLANK, seed: (Math.random() * 1e9) | 0 };
    const parsed = JSON.parse(raw);
    return { ...BLANK, ...parsed, seed: parsed.seed || ((Math.random() * 1e9) | 0) };
  } catch {
    return { ...BLANK, seed: (Math.random() * 1e9) | 0 };
  }
}

let writeTimer = 0;
function persist () {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }, 120);
}

const listeners = new Set();
export function onChange (fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit (what) { listeners.forEach(fn => fn(what, state)); }

export const get = () => state;

export function set (patch, what = 'state') {
  state = { ...state, ...patch };
  persist();
  emit(what);
}

/* ── stars ─────────────────────────────────────────────────────────────── */
export const isSaved = id => state.saved.includes(id);

export function toggleSaved (id) {
  const on = !isSaved(id);
  set({ saved: on ? [...state.saved, id] : state.saved.filter(x => x !== id) }, 'saved');
  return on;
}

/* ── stamps (venues visited) ───────────────────────────────────────────── */
export const isStamped = id => state.stamps.some(s => s.id === id);

export function stamp (id) {
  if (isStamped(id)) return false;
  set({ stamps: [...state.stamps, { id, at: Date.now() }] }, 'stamps');
  return true;
}

/* ── check-ins (sessions attended) ─────────────────────────────────────── */
export const isCheckedIn = id => state.checkins.some(c => c.id === id);

export function checkIn (id) {
  if (isCheckedIn(id)) return false;
  set({ checkins: [...state.checkins, { id, at: Date.now() }] }, 'checkins');
  return true;
}

/* ── badges ────────────────────────────────────────────────────────────── */
export const hasBadge = id => state.badges.includes(id);

export function award (id) {
  if (hasBadge(id)) return false;
  set({ badges: [...state.badges, id] }, 'badges');
  return true;
}

/* ── reminders already fired ───────────────────────────────────────────── */
export const wasNotified = id => state.notified.includes(id);
export function markNotified (id) {
  if (wasNotified(id)) return;
  set({ notified: [...state.notified, id] }, 'notified');
}

/* ── notes ─────────────────────────────────────────────────────────────
   A line per session, written in the room. This is the seed of the diary. */
export const noteFor = id => state.notes[id] || '';

export function setNote (id, text) {
  const notes = { ...state.notes };
  if (text.trim()) notes[id] = text; else delete notes[id];
  set({ notes }, 'notes');
}

export const noteCount = () => Object.keys(state.notes).length;

/* ── wipe (offered in About, for testing a fresh run) ──────────────────── */
export function reset () {
  state = { ...BLANK, seed: (Math.random() * 1e9) | 0, seenBoot: true };
  persist();
  emit('reset');
}
