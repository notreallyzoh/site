/* Reminders.
   ---------------------------------------------------------------------------
   Three layers, because a valley in Dakshina Kannada is not a good place to
   rely on a push server:

   1. CALENDAR (.ics)  — the reliable one. The phone's own alarms, no
                         permissions, no network, works if the app is closed
                         and the battery saver is on.
   2. IN-APP           — a timer that fires a real Notification whenever the
                         app has been opened recently. Catches up on any it
                         slept through. No server involved.
   3. WEB PUSH         — deliberately not built. It needs a live connection at
                         the moment of firing, and on iOS only reaches
                         installed PWAs. See README for the Worker sketch.   */

import { SESSIONS, SESSION_BY_ID, VENUE_BY_ID, FESTIVAL, pinFor } from './data.js';
import * as store from './store.js';
import { toast } from './fx.js';

let swReg = null;
let timers = [];

export function attach (registration) { swReg = registration; }

export const canNotify = () => 'Notification' in window;
export const permission = () => canNotify() ? Notification.permission : 'unsupported';

export async function ask () {
  if (!canNotify()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); }
  catch { return 'denied'; }
}

/* ────────────────────────────────────────────────────────── scheduling ── */

const LOOKAHEAD = 6 * 60 * 60e3;   // only hold timers for the next six hours

export function reschedule () {
  timers.forEach(clearTimeout);
  timers = [];

  const s = store.get();
  if (!s.remind || permission() !== 'granted') return;

  const now = Date.now();
  const lead = (s.lead ?? 10) * 60e3;

  for (const id of s.saved) {
    const sess = SESSION_BY_ID[id];
    if (!sess || store.wasNotified(id)) continue;
    const at = new Date(sess.start).getTime() - lead;
    const delay = at - now;
    if (delay <= 0 || delay > LOOKAHEAD) continue;
    timers.push(setTimeout(() => fire(sess), delay));
  }
}

/** Anything that should have fired while we were asleep. */
export function catchUp () {
  const s = store.get();
  if (!s.remind || permission() !== 'granted') return;
  const now = Date.now();
  const lead = (s.lead ?? 10) * 60e3;

  for (const id of s.saved) {
    const sess = SESSION_BY_ID[id];
    if (!sess || store.wasNotified(id)) continue;
    const at = new Date(sess.start).getTime();
    if (now >= at - lead && now < at + 20 * 60e3) fire(sess);
  }
  reschedule();
}

function fire (sess) {
  store.markNotified(sess.id);
  const v = VENUE_BY_ID[sess.venue];
  const mins = Math.max(0, Math.round((new Date(sess.start).getTime() - Date.now()) / 60e3));
  const when = mins <= 1 ? 'starting now' : `in ${mins} min`;
  const body = [
    v ? `${v.name}${v.role ? ' · ' + v.role : ''}` : null,
    sess.host ? `with ${sess.host}` : null,
    sess.blurb
  ].filter(Boolean).join('\n');

  const title = `${sess.title} — ${when}`;
  const opts = {
    body,
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    tag: sess.id,
    data: { sessionId: sess.id, venueId: pinFor(sess.venue)?.id },
    vibrate: [0, 30, 60, 30],
    requireInteraction: false
  };

  try {
    if (swReg?.showNotification) swReg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* some browsers refuse non-SW notifications */ }
}

/* ─────────────────────────────────────────────────────────────── .ics ─── */

const pad = n => String(n).padStart(2, '0');
const toUTC = iso => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
};
const esc = t => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

/** RFC5545 wants lines under 75 octets. */
function fold (line) {
  const out = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); }
  out.push(s);
  return out.join('\r\n');
}

export function buildICS (ids, leadMin = 10) {
  const list = (ids && ids.length ? ids : SESSIONS.map(s => s.id))
    .map(id => SESSION_BY_ID[id]).filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));

  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shroom Sabha 2026//Farm Map//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('Shroom Sabha 2026')}`,
    'X-WR-TIMEZONE:Asia/Kolkata'
  ];

  const stamp = toUTC(new Date().toISOString());

  for (const s of list) {
    const v = VENUE_BY_ID[s.venue];
    const where = v ? `${v.name}${v.role ? ', ' + v.role : ''}, ${FESTIVAL.place}` : FESTIVAL.place;
    const desc = [s.sub, s.host ? `With ${s.host}` : null, s.blurb].filter(Boolean).join('. ');

    L.push('BEGIN:VEVENT');
    L.push(`UID:${s.id}@shroomsabha2026`);
    L.push(`DTSTAMP:${stamp}`);
    L.push(`DTSTART:${toUTC(s.start)}`);
    L.push(`DTEND:${toUTC(s.end || s.start)}`);
    L.push(fold(`SUMMARY:${esc(s.title)}`));
    if (desc) L.push(fold(`DESCRIPTION:${esc(desc)}`));
    L.push(fold(`LOCATION:${esc(where)}`));
    L.push('BEGIN:VALARM');
    L.push(`TRIGGER:-PT${Math.max(0, leadMin | 0)}M`);
    L.push('ACTION:DISPLAY');
    L.push(fold(`DESCRIPTION:${esc(s.title)} — ${esc(v ? v.name : FESTIVAL.place)}`));
    L.push('END:VALARM');
    L.push('END:VEVENT');
  }

  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

export function downloadICS (ids, filename = 'shroom-sabha-2026.ics') {
  const text = buildICS(ids, store.get().lead ?? 10);
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(`<b>${ids?.length || SESSIONS.length}</b> events sent to your calendar`);
}

/* ──────────────────────────────────────────────────────────────── boot ── */

export function start () {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') catchUp();
  });
  store.onChange(w => { if (w === 'saved' || w === 'state') reschedule(); });
  catchUp();
}
