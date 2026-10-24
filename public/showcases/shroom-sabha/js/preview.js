
import { toast } from './fx.js';
// Keep the original interaction model, with external actions disabled for exhibition.
document.addEventListener('click', e => {
  const action = e.target.closest('a[href^="tel:"], a[href^="sms:"], [data-act="sos"], [data-act="saveOffline"], [data-act="install"], [data-act="askNotify"], #locateBtn');
  if (!action) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  toast('Portfolio preview — calls, location sharing and installation are disabled. Explore the map, save sessions or stamp a place instead.', 5000);
}, true);
