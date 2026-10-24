/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR OVERRIDES
   ---------------------------------------------------------------------------
   The editor at /editor/ saves to localStorage on the same origin as the app,
   so anything traced or dragged there can show up here immediately — reload
   and look, no export, no paste, no redeploy.

   This is for iterating, not for shipping. It only exists on the device that
   did the editing; every attendee still sees whatever is baked into
   terrain.js and data.js. When the trails are right, export from the editor
   and bake them in for good.
   ═══════════════════════════════════════════════════════════════════════ */

import { VENUES, AMENITIES } from './data.js';
import { TERRAIN } from './terrain.js';

const KEY = 'shroomsabha-editor';

export function applyEditorOverrides () {
  let edit;
  try { edit = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  if (!edit) return null;

  const applied = { routes: 0, pins: 0 };

  /* Routes: replace wholesale. The editor starts from the traced set, so what
     it holds is always the complete picture rather than a diff. */
  if (Array.isArray(edit.routes) && edit.routes.length) {
    TERRAIN.routes.length = 0;
    TERRAIN.routes.push(...edit.routes);
    applied.routes = edit.routes.length;
  }

  /* Pins: mutate in place, so PINNED and every lookup table see it too. */
  if (edit.pins) {
    const byId = new Map([...VENUES, ...AMENITIES].map(v => [v.id, v]));
    for (const [id, xy] of Object.entries(edit.pins)) {
      const target = byId.get(id);
      if (!target || !Array.isArray(xy)) continue;
      target.x = xy[0];
      target.y = xy[1];
      applied.pins++;
    }
  }

  return (applied.routes || applied.pins) ? applied : null;
}

/** Throw the local edits away and go back to what is baked in. */
export function clearEditorOverrides () {
  const raw = localStorage.getItem(KEY);
  if (raw) localStorage.setItem(KEY + '-backup', raw);
  localStorage.removeItem(KEY);
}

export const hasOverrides = () => !!localStorage.getItem(KEY);
