/* "Save the whole thing to this phone."
   ---------------------------------------------------------------------------
   The service worker caches as you browse anyway, but that is invisible and
   only covers what you happened to open. This gives the user an explicit,
   visible act: one tap downloads every asset, reports progress, asks the
   browser for persistent storage so it will not be evicted, and then says
   plainly how many kilobytes are now sitting on the device.

   Do it once on the bus. Then the farm can have no signal at all.        */

import { toast } from './fx.js';
import * as store from './store.js';

export const supported = () => 'serviceWorker' in navigator;

let registration = null;
export function attach (reg) { registration = reg; }

/** Ask the browser not to evict us. Chrome grants it to installed PWAs. */
export async function requestPersistence () {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

export async function estimate () {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { used: e.usage || 0, quota: e.quota || 0 } : null;
  } catch { return null; }
}

/**
 * Precache everything, reporting progress.
 * @param {(p:{done:number,total:number,bytes:number})=>void} onProgress
 */
export function saveEverything (onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!registration?.active) return reject(new Error('Service worker not ready yet'));

    const ch = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Timed out')), 90_000);

    ch.port1.onmessage = e => {
      const m = e.data || {};
      if (m.type === 'progress') onProgress(m);
      else if (m.type === 'done') { clearTimeout(timeout); resolve(m); }
      else if (m.type === 'error') { clearTimeout(timeout); reject(new Error(m.message || 'Failed')); }
    };

    registration.active.postMessage({ type: 'PRECACHE' }, [ch.port2]);
  });
}

export const fmtBytes = b => {
  if (!b) return '0 KB';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

/* ───────────────────────────────────────────────── install to homescreen ─ */

let deferredPrompt = null;
const installListeners = new Set();

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPrompt = () => !!deferredPrompt;

export function onInstallable (fn) { installListeners.add(fn); return () => installListeners.delete(fn); }

addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installListeners.forEach(f => f(true));
});

addEventListener('appinstalled', () => {
  deferredPrompt = null;
  store.set({ seenInstall: true });
  toast('Installed. It will open without a browser now.');
  installListeners.forEach(f => f(false));
});

export async function promptInstall () {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installListeners.forEach(f => f(false));
  return outcome;
}

/** Platform-specific words, because iOS has no install prompt. */
export function installHint () {
  if (isStandalone()) return 'Already installed on this device.';
  if (isIOS()) return 'Tap Share, then "Add to Home Screen".';
  if (canPrompt()) return 'Install it once and it works with no signal.';
  return 'Use your browser menu → "Add to Home screen".';
}
