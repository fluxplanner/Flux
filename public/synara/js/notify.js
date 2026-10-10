/* ============================================================
   notify.js — dose reminders
   ------------------------------------------------------------
   Imported by main.js (start) and views/profile.js (enable/disable).

   READ THIS BEFORE TRUSTING IT WITH A REAL DOSE.

   A website cannot reliably remind you to take medication. What this
   file does is schedule notifications with setTimeout while the tab
   is alive. That means:

     - Works: app open, or backgrounded in the browser on desktop
       and Android. Chrome on Android only shows notifications
       through a service worker, so they go through Flux's (main.js
       registers it) whenever there is one.
     - Does not work: browser fully closed, phone restarted, or iOS
       Safari with the tab evicted from memory — which it will be.

   Making this actually dependable needs a push server firing Web Push
   (Android/desktop, and iOS 16.4+ only once installed to the home
   screen), or a native app with local notifications. That is the
   single strongest argument for React Native + Expo in v2, and the
   UI says so plainly rather than implying a guarantee it cannot keep.
   ============================================================ */

import { dayKey, addDays, parseStamp, minutesOf, prettyTime } from './util.js';
import * as store from './store.js';

/* Relative to the page. Inside Flux the page is synara.html at the site
   root, where icons/ holds the planner's icon, so Synara's is elsewhere
   (the same rule as the Flux logo in ui.js). */
const ICON = typeof document !== 'undefined' && document.documentElement.dataset.host === 'flux'
  ? 'public/synara/icons/icon-192.png'
  : 'icons/icon-192.png';

/** Honest capability string for the settings screen. */
export function support() {
  if (!('Notification' in window)) {
    return { ok: false, reason: 'This browser does not support notifications.' };
  }
  if (location.protocol === 'file:') {
    return { ok: false, reason: 'Notifications need the app served over https.' };
  }

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (iOS && !standalone) {
    return {
      ok: false,
      reason: 'On iPhone, add Synara to your Home Screen first (Share, then Add to ' +
              'Home Screen) and open it from there. Safari only allows notifications for those.',
    };
  }

  // Android browsers show notifications only through a service worker.
  if (/Android/i.test(navigator.userAgent) && !('serviceWorker' in navigator)) {
    return {
      ok: false,
      reason: 'This browser can’t show reminders on Android. Open Synara in Chrome, ' +
              'or keep a phone alarm.',
    };
  }

  return { ok: true, reason: '' };
}

export function permission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

/** Ask the browser for permission. Returns the resulting state. */
export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/* ============================================================
   Scheduling
   ============================================================ */

let timers = [];

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function inQuietHours(settings, date) {
  const q = settings.quietHours;
  if (!q) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const from = minutesOf(q.from);
  const to = minutesOf(q.to);
  // Quiet hours usually wrap midnight (22:00 → 07:00).
  return from > to ? (now >= from || now < to) : (now >= from && now < to);
}

/* Set when a notification couldn't be shown on this device, so the
   settings card says so instead of "On". Cleared when one gets through. */
let failed = false;

export function lastFailed() {
  return failed;
}

/**
 * Show one notification; true if it was shown. Through the service
 * worker when there is one: Chrome on Android allows nothing else (the
 * page's own `new Notification()` throws there). Otherwise from the
 * page. `hash` is where tapping it should land.
 */
async function show(title, options, hash = '') {
  if (permission() !== 'granted') return false;
  const opts = {
    icon: ICON,
    badge: ICON,
    ...options,
    data: { url: location.href.split('#')[0] + hash },
  };

  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.active) {
      await reg.showNotification(title, opts);
      return true;
    }
  } catch (err) {
    console.warn('[synara] the service worker could not show a notification:', err);
  }

  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      if (hash) location.hash = hash;
      n.close();
    };
    return true;
  } catch (err) {
    console.warn('[synara] could not show notification:', err);
    return false;
  }
}

async function fire(day, med, time) {
  const fresh = store.get();
  if (!fresh.settings.remindersOn) return;
  if (inQuietHours(fresh.settings, new Date())) return;
  // Re-check: they may have taken it in the meantime.
  if (store.doseStatus(day, med.id, time, fresh) !== 'pending') return;

  failed = !(await show('Time for your medication', {
    body: `${[med.name, med.dose].filter(Boolean).join(' ')} — ${prettyTime(time)}`,
    tag: `synara-${med.id}-${time}`,   // replaces rather than stacks
  }, '#/meds'));
}

/**
 * Schedule every remaining dose for today, and plan again just after
 * midnight, so a tab left open overnight still reminds the next day.
 *
 * Re-run whenever meds or settings change — it clears first, so it is
 * safe to call repeatedly.
 */
export function schedule() {
  clearTimers();

  const state = store.get();
  const { remindersOn, reminderLead } = state.settings;
  if (!remindersOn) return 0;
  if (permission() !== 'granted') return 0;

  const now = new Date();
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  let scheduled = 0;

  // Tomorrow too, for an early reminder that falls before midnight
  // (a 12:15 AM dose, 30 minutes early). dosesOn() only returns what is
  // scheduled that day, so a stopped med or an old time never fires.
  for (const day of [today, tomorrow]) {
    for (const { med, time } of store.dosesOn(day, state)) {
      // Already dealt with? Don't nag.
      if (store.doseStatus(day, med.id, time, state) !== 'pending') continue;

      // A real date rather than minutes since midnight: on the days the
      // clocks change, counting minutes fired an hour early or late.
      const at = parseStamp(`${day}T${time}`);
      at.setMinutes(at.getMinutes() - (reminderLead || 0));
      if (at <= now) continue;

      // Under two days: far inside setTimeout's ~24-day limit.
      timers.push(setTimeout(() => fire(day, med, time), at - now));
      scheduled++;
    }
  }

  timers.push(setTimeout(schedule, parseStamp(`${tomorrow}T00:00`) - now + 5000));
  return scheduled;
}

/** Called once at boot. */
export function start() {
  schedule();
  store.subscribe(schedule);

  // Timers do not survive the tab being frozen or the device sleeping,
  // so rebuild the schedule whenever we come back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule();
  });
}

/**
 * A one-off notification so the student can confirm it actually works.
 * Resolves to 'sent', 'not-allowed' or 'failed'.
 */
export async function test() {
  if (permission() !== 'granted') return 'not-allowed';
  const shown = await show('Synara reminders are on', {
    body: 'This is what a dose reminder will look like.',
    tag: 'synara-test',
  });
  failed = !shown;
  return shown ? 'sent' : 'failed';
}
