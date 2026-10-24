/* Shroom Sabha 2026 — a photo of each place, taken from its own pin
   ---------------------------------------------------------------------------
   Two reasons this lives in IndexedDB rather than localStorage:

     · localStorage is a ~5 MB string store, and one untouched phone photo is
       3–6 MB. Two of them and the recce data itself gets evicted — losing the
       GPS fixes, which are the expensive part, to save a picture.
     · IndexedDB holds Blobs natively, so nothing has to be base64'd on the way
       in and out. Base64 costs a third more bytes and a main-thread stall on
       every read.

   Photos are downscaled before they are ever stored. A phone camera hands back
   4000 px of detail for a card that will be shown at 400; keeping the rest is
   pure cost, on a device that is out in a field with no signal and a finite
   battery.                                                                    */

const DB = 'shroomsabha-photos';
const STORE = 'photos';
const VERSION = 1;

let dbp = null;

function open () {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx (mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out?.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/* ═══════════════════════════════════════════════════════════════ storing ══ */

/**
 * Shrink a camera file to something worth keeping, then store it under a
 * landmark id.
 *
 * @param {string} id    landmark id — one photo per landmark, replaced on retake
 * @param {File}   file  whatever the camera handed back
 * @param {object} [meta] anything worth remembering alongside it
 */
export async function put (id, file, meta = {}) {
  const blob = await downscale(file);
  const rec = {
    blob,
    type: blob.type,
    bytes: blob.size,
    at: Date.now(),
    ...meta
  };
  await tx('readwrite', s => s.put(rec, id));
  return rec;
}

export async function get (id) {
  return tx('readonly', s => s.get(id));
}

export async function remove (id) {
  return tx('readwrite', s => s.delete(id));
}

/** Every id that has a photo, so a list can show ticks without loading blobs. */
export async function ids () {
  const keys = await tx('readonly', s => s.getAllKeys());
  return keys || [];
}

/** id → {bytes, at}, for the export summary. Still does not load the pixels. */
export async function summary () {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const out = {};
    const req = t.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) { resolve(out); return; }
      out[c.key] = { bytes: c.value.bytes, at: c.value.at };
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clear () {
  return tx('readwrite', s => s.clear());
}

/** A URL for showing one. Caller owns it — revoke when the node goes away. */
export async function url (id) {
  const rec = await get(id);
  return rec?.blob ? URL.createObjectURL(rec.blob) : null;
}

/** Files named by landmark, ready for the share sheet. */
export async function files () {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const out = [];
    const req = t.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) { resolve(out); return; }
      const ext = (c.value.type || '').includes('png') ? 'png' : 'jpg';
      out.push(new File([c.value.blob], `${c.key}.${ext}`, { type: c.value.type }));
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/* ══════════════════════════════════════════════════════════ downscaling ══ */

const MAX_EDGE = 1600;   // plenty for a full-bleed card on any phone
const QUALITY = 0.78;

/**
 * Resize to fit MAX_EDGE and re-encode as JPEG. Typically turns a 4 MB camera
 * file into 200–400 KB with no visible difference at the size it gets shown.
 *
 * createImageBitmap is used rather than an <img> because it decodes off the
 * main thread — on a mid-range phone a 12 MP decode blocks for long enough to
 * drop the tap feedback, which reads as the button not having worked.
 */
export async function downscale (file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file;                       // exotic format — keep the original
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const blob = await new Promise(res =>
    canvas.toBlob(res, 'image/jpeg', QUALITY));

  /* If re-encoding somehow made it bigger — a small screenshot, say — keep
     whichever is smaller. */
  return (blob && blob.size < file.size) ? blob : file;
}

export function fmtBytes (n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
