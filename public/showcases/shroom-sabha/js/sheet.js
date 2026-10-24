/* The underground. A three-position bottom sheet with real drag physics.
   On wide screens it stops being a sheet and becomes a docked rail — that is
   handled in CSS; this module simply goes quiet. */

import { buzz, REDUCED } from './fx.js';

const STATES = ['peek', 'half', 'full'];

let sheet, grip, body, isWide = false;
let listeners = new Set();

export function initSheet () {
  sheet = document.getElementById('sheet');
  grip = document.getElementById('grip');
  body = document.getElementById('sheetBody');

  const mq = matchMedia('(min-width: 820px)');
  isWide = mq.matches;
  mq.addEventListener('change', e => { isWide = e.matches; if (isWide) sheet.style.transform = ''; });

  bindDrag();

  grip.addEventListener('click', () => {
    const i = STATES.indexOf(state());
    go(i >= STATES.length - 1 ? 'peek' : STATES[i + 1]);
  });
  grip.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); grip.click(); }
  });

  return { go, state, onState, peek: () => go('peek'), half: () => go('half'), full: () => go('full') };
}

export const state = () => sheet?.dataset.state || 'peek';
export function onState (fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function go (next) {
  if (!sheet || isWide) { listeners.forEach(f => f('full')); return; }
  if (!STATES.includes(next) || next === state()) {
    listeners.forEach(f => f(state()));
    return;
  }
  sheet.style.transform = '';
  sheet.dataset.state = next;
  grip.setAttribute('aria-label', next === 'full' ? 'Collapse guide' : 'Expand guide');
  listeners.forEach(f => f(next));
}

/* ─────────────────────────────────────────────────────────────── drag ─── */

function anchors () {
  const h = sheet.offsetHeight;
  const peekPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek')) || 128;
  return { full: 0, half: innerHeight * 0.46, peek: h - peekPx };
}

function bindDrag () {
  let dragging = false, startY = 0, startT = 0, curT = 0, lastY = 0, lastTime = 0, vel = 0;
  let fromBody = false;

  const currentTranslate = () => {
    const m = new DOMMatrixReadOnly(getComputedStyle(sheet).transform);
    return m.m42 || 0;
  };

  const begin = (e, viaBody) => {
    if (isWide) return;
    dragging = true; fromBody = viaBody;
    startY = lastY = e.clientY;
    startT = curT = currentTranslate();
    lastTime = performance.now();
    vel = 0;
    sheet.classList.add('is-dragging');
  };

  const move = e => {
    if (!dragging) return;
    const dy = e.clientY - startY;

    /* dragging down from a body scrolled to the top is allowed; dragging up
       inside the body should scroll the body instead */
    if (fromBody && dy < 0 && state() === 'full') { end(e); return; }

    const a = anchors();
    let y = startT + dy;
    if (y < a.full) y = a.full - Math.pow(a.full - y, 0.55);       // rubber band
    if (y > a.peek) y = a.peek + Math.pow(y - a.peek, 0.55);
    curT = y;
    sheet.style.transform = `translate3d(0,${y}px,0)`;

    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    vel = (e.clientY - lastY) / dt;
    lastY = e.clientY; lastTime = now;
    if (e.cancelable) e.preventDefault();
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    const a = anchors();

    /* a decisive flick wins over proximity */
    let target;
    if (Math.abs(vel) > 0.45) {
      const order = ['full', 'half', 'peek'];
      const here = order.indexOf(nearest(curT, a));
      const dir = vel > 0 ? 1 : -1;
      target = order[Math.min(order.length - 1, Math.max(0, here + dir))];
    } else {
      target = nearest(curT, a);
    }
    sheet.style.transform = '';
    if (target !== state()) buzz(6);
    sheet.dataset.state = target;
    grip.setAttribute('aria-label', target === 'full' ? 'Collapse guide' : 'Expand guide');
    listeners.forEach(f => f(target));
  };

  const nearest = (y, a) => {
    let best = 'peek', bestD = Infinity;
    for (const k of STATES) {
      const d = Math.abs(y - a[k]);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  };

  grip.addEventListener('pointerdown', e => {
    grip.setPointerCapture(e.pointerId);
    begin(e, false);
  });
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  /* pull down from the top of the scrolled content */
  body.addEventListener('pointerdown', e => {
    if (body.scrollTop > 0) return;
    if (e.target.closest('button,a,input')) return;
    begin(e, true);
  });
  body.addEventListener('pointermove', e => {
    if (!dragging) return;
    if (body.scrollTop > 0) { end(e); return; }
    move(e);
  });
  body.addEventListener('pointerup', end);
  body.addEventListener('pointercancel', end);

  /* tapping the peek strip opens it */
  sheet.querySelector('.now')?.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    if (state() === 'peek') go('half');
  });
}

export const reduced = REDUCED;
