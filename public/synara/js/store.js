/* ============================================================
   store.js — application state and persistence
   ------------------------------------------------------------
   This is the ONLY file that knows where data physically lives.

   Everything here is async even though localStorage is synchronous.
   That is the whole point: the ask was "on device for now with space
   for cloud sync later", and the expensive version of that migration
   is the one where every call site has to change from sync to async.
   So the seam is async from day one, and swapping in a server later
   is `setBackend(supabaseBackend)` plus one object implementing
   read/write/clear.

   Imported by main.js, insights.js, notify.js, and every view.
   ============================================================ */

import { dayKey, stamp, timeOf, uid, minutesOf, parseStamp } from './util.js';

/* The key name is historical; the shape inside is versioned separately. */
const STORAGE_KEY = 'synara.v2';
const SCHEMA_VERSION = 3;

/* ============================================================
   Backends
   ------------------------------------------------------------
   A backend is any object with { name, read(), write(state),
   clear() } returning promises.
   ============================================================ */

const localBackend = {
  name: 'local',

  async read() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      return text ? JSON.parse(text) : null;
    } catch (err) {
      // Corrupt JSON, or storage blocked in a private window. Never take
      // the app down over it — start clean and log why.
      console.warn('[synara] could not read local state:', err);
      return null;
    }
  },

  async write(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch (err) {
      console.error('[synara] could not save state:', err);
      throw new Error('save-failed');
    }
  },

  async clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[synara] could not clear state:', err);
    }
  },
};

let backend = localBackend;

/** Point the app at a different persistence layer (a server, or a test double). */
export function setBackend(next) {
  backend = next;
}

/* ============================================================
   State shape
   ------------------------------------------------------------
   Date formats are fixed across the app (see util.js):
     day key   "YYYY-MM-DD"
     timestamp "YYYY-MM-DDTHH:mm"   local, no offset
     time      "HH:MM"              24-hour
   ============================================================ */

export function emptyState() {
  return {
    v: SCHEMA_VERSION,

    profile: {
      name: '', pronouns: '', grade: '', school: '',
      seizureType: '', diagnosed: '',
      neurologist: '', neuroPhone: '',
      allergies: '', bloodType: '',
      // Rescue medication, in the words of their seizure action plan:
      // what it is, when it's given, and where it's kept. Optional — not
      // everyone has one — and shown on the emergency and printed cards.
      rescueMed: '',
    },

    /* meds[] — {id, name, dose, form, notes, color, added, addedAt, ended, schedule}

       A medication carries its whole schedule history, not just its
       current times:

         added     first day it is tracked
         addedAt   "HH:MM" it was added that day (null if unknown). Doses
                   already past their grace window by then were never
                   tracked, so they can't count as missed.
         ended     first day it is NO LONGER tracked (null while current)
         schedule  [{from, times}] ascending — each entry applies from
                   its `from` day until the next entry starts

       Without this, history gets rewritten after the fact. Adding a med
       today used to mark every earlier day as missed (0% adherence on
       day one), moving the 8pm dose to 9pm re-read the entire past
       against 9pm, and deleting a med erased its history from every
       statistic. What was scheduled on a given day has to stay fixed
       once that day has happened. */
    meds: [],

    /* doses — { "YYYY-MM-DD": { "<medId>|HH:MM": {status, at} } }
       status is taken | late | missed; absence means "not logged". */
    doses: {},

    /* seizures[] — newest first; see addSeizure() for fields */
    seizures: [],

    /* checkins — { "YYYY-MM-DD": {sleepHours, sleepQuality, stress, mood, notes, at} }
       Without a daily check-in there is nothing to correlate seizures
       against for sleep and stress. */
    checkins: {},

    /* contacts[] — {id, name, relation, phone, primary} */
    contacts: [],

    /* The first-aid steps are filled in from the start, deliberately.
       Seizure first aid is the same for everyone — it is not personal
       data — and a new user's emergency card rendering as empty
       headings would be worse than useless in the moment it is needed.
       Only the genuinely personal fields start blank.

       Wording follows standard public guidance (Epilepsy Foundation
       "Stay, Safe, Side"; CDC seizure first aid). It covers seizures
       where someone stiffens and shakes AND ones where they stare or
       wander, and it leaves room for a rescue-medicine plan rather
       than contradicting one. The card itself tells the user to
       confirm it with a neurologist. */
    card: {
      looksLike: '',
      during: [
        'Stay with them and start timing the seizure.',
        'If they are stiffening or shaking, gently help them down to the floor.',
        'Move anything hard or sharp out of the way.',
        'If they are on the floor, put something soft under their head.',
        'Loosen anything tight around their neck.',
        'If they are not aware or not awake, gently turn them onto their side.',
        'If they are confused or wandering, stay beside them and gently guide them away from danger, like stairs, roads, or water. Don\'t grab or hold them.',
        'If they have a seizure action plan, follow it. Only give rescue medicine if you are trained to.',
        'Stay calm and speak normally — they may be able to hear you.',
      ],
      // No exception, as the Epilepsy Foundation and CDC put it: rescue
      // medicine is the action plan's business (the step above and the
      // Rescue medication block), not something a bystander should read
      // as permission to put anything in a seizing person's mouth.
      doNot: [
        'Do NOT put anything in their mouth. They cannot swallow their tongue.',
        'Do NOT hold them down or try to stop the movements.',
        'Do NOT give food, drink, or pills until they are fully awake.',
        'Do NOT crowd them — ask other people to step back.',
      ],
      after: [
        'Stay with them until they are fully alert and know where they are.',
        'Tell them calmly what happened — they may not remember.',
        'Let them rest somewhere quiet.',
        'Call their emergency contact.',
        'Write down the time it started and how long it lasted.',
      ],
      callEms: [
        'The seizure lasts longer than 5 minutes.',
        'A second seizure starts soon after the first.',
        'They do not wake up or return to normal afterwards.',
        'They are having trouble breathing, or their lips stay blue.',
        'They were injured, or it happened in water.',
        'It looks different from their usual seizures.',
        'They have diabetes or a heart condition, or are pregnant.',
        'Rescue medicine was given, or their seizure plan says to call.',
      ],
      forTeacher: '',
      forNurse: '',
      forCoach: '',
      updated: '',
    },

    settings: {
      theme: 'system',        // system | light | dark
      remindersOn: false,
      reminderLead: 0,        // minutes before the scheduled time
      quietHours: null,       // {from:"22:00", to:"07:00"} or null
      seeded: false,
      fluxLink: false,        // inside Flux: show dose times in the Flux Planner (fluxlink.js)
      noMeds: false,          // said in the intro they take no medication (setup.js)
      setupHidden: false,     // hid the "Finish setting up" list on Home
    },
  };
}

/* ============================================================
   Validation
   ------------------------------------------------------------
   Every load goes through here — localStorage, an imported backup,
   and later a server. Once import exists, stored data can come from a
   file somebody else made, and several templates put ids and times
   straight into HTML attributes. So anything that reaches markup must
   match a strict format here, or it is replaced or dropped. This is
   the line between "a corrupt backup is ignored" and "a crafted
   backup runs script".
   ============================================================ */

const ID_RE    = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_RE   = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE  = /^([01]\d|2[0-3]):[0-5]\d$/;
const STAMP_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

const STATUSES = new Set(['taken', 'late', 'missed']);
const COLORS   = new Set(['violet', 'mint', 'amber', 'rose', 'blue']);
const FORMS    = new Set(['tablet', 'capsule', 'liquid', 'patch', 'injection', 'other']);
const THEMES   = new Set(['system', 'light', 'dark']);

const isDay = (v) => typeof v === 'string' && DAY_RE.test(v);
const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');

/* Profile fields are short (a name, a grade), except the rescue
   medication, which is copied from a seizure action plan: what it is,
   when it is given, when to call 911, where it is kept. The edit sheet
   refuses to save more than this rather than cutting it off. */
export const RESCUE_MED_MAX = 600;
const PROFILE_MAX = { rescueMed: RESCUE_MED_MAX };
const profileStr = (key, v) => str(v, PROFILE_MAX[key] || 200);
const num = (v, lo, hi, fallback) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const strList = (v) => (Array.isArray(v) ? v.map((x) => str(x, 600)).filter(Boolean).slice(0, 30) : null);
const safeId = (v, prefix) => (typeof v === 'string' && ID_RE.test(v) ? v : uid(prefix));

export const isTime = (v) => typeof v === 'string' && TIME_RE.test(v);
export const isStamp = (v) => typeof v === 'string' && STAMP_RE.test(v);

/** Sorted, de-duplicated, valid "HH:MM" strings only. */
export function normTimes(times) {
  if (!Array.isArray(times)) return [];
  return [...new Set(times.filter(isTime))].sort();
}

function sanitizeMed(m, firstDoseDay) {
  const today = dayKey();
  const added = isDay(m.added) ? m.added : (firstDoseDay || today);

  let schedule;
  if (Array.isArray(m.schedule) && m.schedule.length) {
    schedule = m.schedule
      .filter((e) => e && isDay(e.from))
      .map((e) => ({ from: e.from, times: normTimes(e.times) }))
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  } else {
    // Schema 2 kept only the current times. The best available reading
    // of the past is that they applied from the day tracking began.
    schedule = [{ from: added, times: normTimes(m.times) }];
  }
  if (!schedule.length) schedule = [{ from: added, times: [] }];
  // The first entry must start the day tracking started, or the days
  // between the two would read as "nothing scheduled".
  schedule[0].from = added;

  let ended = isDay(m.ended) ? m.ended : null;
  // Schema 2 marked a deleted med active:false with no date. Treat it as
  // ending today so everything before stays in the record.
  if (!ended && m.active === false) ended = today;

  return {
    id: safeId(m.id, 'med'),
    name: str(m.name, 120),
    dose: str(m.dose, 60),
    form: FORMS.has(m.form) ? m.form : 'tablet',
    notes: str(m.notes, 600),
    color: COLORS.has(m.color) ? m.color : 'violet',
    added,
    addedAt: isTime(m.addedAt) ? m.addedAt : null,
    ended,
    schedule,
  };
}

function sanitizeDoses(doses, validMedIds) {
  const out = {};
  if (!doses || typeof doses !== 'object') return out;
  for (const [day, entries] of Object.entries(doses)) {
    if (!isDay(day) || !entries || typeof entries !== 'object') continue;
    const clean = {};
    for (const [key, entry] of Object.entries(entries)) {
      const [medId, time] = key.split('|');
      if (!validMedIds.has(medId) || !isTime(time)) continue;
      if (!entry || !STATUSES.has(entry.status)) continue;
      clean[key] = { status: entry.status, at: isStamp(entry.at) ? entry.at : `${day}T00:00` };
    }
    if (Object.keys(clean).length) out[day] = clean;
  }
  return out;
}

function sanitizeSeizure(s) {
  if (!s || !isStamp(s.at)) return null;
  return {
    id: safeId(s.id, 'sz'),
    at: s.at,
    duration: Math.round(num(Number(s.duration), 0, 7200, 0)),
    type: str(s.type, 80),
    trigger: str(s.trigger, 80),
    place: str(s.place, 120),
    aura: str(s.aura, 300),
    injury: s.injury === true,
    emsCalled: s.emsCalled === true,
    notes: str(s.notes, 4000),
    logged: isStamp(s.logged) ? s.logged : s.at,
  };
}

function sanitizeCheckins(checkins) {
  const out = {};
  if (!checkins || typeof checkins !== 'object') return out;
  for (const [day, c] of Object.entries(checkins)) {
    if (!isDay(day) || !c || typeof c !== 'object') continue;
    const stress = num(c.stress, 1, 5, null);
    out[day] = {
      sleepHours: num(c.sleepHours, 0, 24, null),
      sleepQuality: ['poor', 'ok', 'good'].includes(c.sleepQuality) ? c.sleepQuality : null,
      stress: stress == null ? null : Math.round(stress),
      mood: ['low', 'ok'].includes(c.mood) ? c.mood : null,
      notes: str(c.notes, 600),
      at: isStamp(c.at) ? c.at : `${day}T00:00`,
    };
  }
  return out;
}

function sanitizeContact(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    id: safeId(c.id, 'c'),
    name: str(c.name, 120),
    relation: str(c.relation, 80),
    phone: str(c.phone, 40),
    primary: c.primary === true,
  };
}

/** Earliest day a med appears in the dose log, for dating schema-2 meds. */
function firstDoseDays(doses) {
  const first = new Map();
  if (!doses || typeof doses !== 'object') return first;
  for (const day of Object.keys(doses).sort()) {
    for (const key of Object.keys(doses[day] || {})) {
      const medId = key.split('|')[0];
      if (!first.has(medId)) first.set(medId, day);
    }
  }
  return first;
}

const byNewest = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

/* The card's core first-aid lists. An empty one would silently drop
   "What to do", "Do NOT" or "Call 911 if" from the emergency screen and
   print an empty box, so empty means "use the standard steps". Only
   "Afterwards" may be cleared. */
export const CORE_STEPS = new Set(['during', 'doNot', 'callEms']);

/** The standard first-aid list for one of the card's step fields. */
export function defaultSteps(field) {
  return [...(emptyState().card[field] || [])];
}

/* Earlier versions of the standard steps. A list still exactly like one
   of these was never edited, so it moves to today's wording: the steps
   added since (a seizure where they wander, rescue medicine, more reasons
   to call 911) reach cards made before them, not just new ones. A list
   the student changed is theirs and is left alone. */
const FIRST_STEPS = {
  during: [
    'Stay with them and start timing the seizure.',
    'Move anything hard or sharp out of the way.',
    'Put something soft under their head.',
    'Loosen anything tight around their neck.',
    'If they are not aware or not awake, gently turn them onto their side.',
    'Stay calm and speak normally — they may be able to hear you.',
  ],
  doNot: [
    'Do NOT put anything in their mouth. They cannot swallow their tongue.',
    'Do NOT hold them down or try to stop the movements.',
    'Do NOT give food, drink, or pills until they are fully awake.',
    'Do NOT crowd them — ask other people to step back.',
  ],
  callEms: [
    'The seizure lasts longer than 5 minutes.',
    'A second seizure starts soon after the first.',
    'They do not wake up or return to normal afterwards.',
    'They are having trouble breathing, or their lips stay blue.',
    'They were injured, or it happened in water.',
  ],
};

/* A pre-release wording of "Do NOT" made rescue medicine an exception
   to "nothing in their mouth". EF and CDC guidance has no exception, so a
   card that still has it, untouched, goes back to today's line. */
const OLD_STEPS = {
  during: [FIRST_STEPS.during],
  doNot: [FIRST_STEPS.doNot, [
    'Do NOT put anything in their mouth — they cannot swallow their tongue. Rescue medicine from their seizure plan is the only exception.',
    'Do NOT hold them down or try to stop the movements.',
    'Do NOT give food, drink, or pills until they are fully awake.',
    'Do NOT crowd them — ask other people to step back.',
  ]],
  callEms: [FIRST_STEPS.callEms],
};

const sameList = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
const untouched = (key, list) => (OLD_STEPS[key] || []).some((old) => sameList(list, old));

/**
 * Bring any stored shape up to the current one, validating as it goes.
 * Exported for tests; the app reaches it through init() and importJSON().
 */
export function migrate(stored) {
  const base = emptyState();
  const src = stored && typeof stored === 'object' ? stored : {};

  const first = firstDoseDays(src.doses);
  const meds = (Array.isArray(src.meds) ? src.meds : [])
    .filter((m) => m && typeof m === 'object')
    .map((m) => sanitizeMed(m, first.get(m.id)));
  const medIds = new Set(meds.map((m) => m.id));

  const seizures = (Array.isArray(src.seizures) ? src.seizures : [])
    .map(sanitizeSeizure)
    .filter(Boolean)
    .sort(byNewest);

  const contacts = (Array.isArray(src.contacts) ? src.contacts : [])
    .map(sanitizeContact)
    .filter(Boolean);
  let seenPrimary = false;
  for (const c of contacts) {         // at most one first-call contact
    if (c.primary && seenPrimary) c.primary = false;
    if (c.primary) seenPrimary = true;
  }

  const profile = { ...base.profile };
  if (src.profile && typeof src.profile === 'object') {
    for (const key of Object.keys(base.profile)) profile[key] = profileStr(key, src.profile[key]);
  }

  const card = { ...base.card };
  if (src.card && typeof src.card === 'object') {
    for (const key of ['during', 'doNot', 'after', 'callEms']) {
      const list = strList(src.card[key]);
      if (!list) continue;
      // An empty core list keeps the standard steps (see CORE_STEPS), and
      // one never edited since an earlier version gets today's (OLD_STEPS).
      if (!list.length && CORE_STEPS.has(key)) continue;
      if (untouched(key, list)) continue;
      card[key] = list;
    }
    for (const key of ['looksLike', 'forTeacher', 'forNurse', 'forCoach']) {
      if (typeof src.card[key] === 'string') card[key] = str(src.card[key]);
    }
    card.updated = isDay(src.card.updated) ? src.card.updated : '';
  }

  const s = src.settings && typeof src.settings === 'object' ? src.settings : {};
  const q = s.quietHours;
  const settings = {
    theme: THEMES.has(s.theme) ? s.theme : 'system',
    remindersOn: s.remindersOn === true,
    reminderLead: Math.round(num(s.reminderLead, 0, 120, 0)),
    quietHours: q && isTime(q.from) && isTime(q.to) ? { from: q.from, to: q.to } : null,
    seeded: s.seeded === true,
    fluxLink: s.fluxLink === true,
    noMeds: s.noMeds === true,
    setupHidden: s.setupHidden === true,
  };

  return {
    v: SCHEMA_VERSION,
    profile,
    meds,
    doses: sanitizeDoses(src.doses, medIds),
    seizures,
    checkins: sanitizeCheckins(src.checkins),
    contacts,
    card,
    settings,
  };
}

/* ============================================================
   Live state + subscriptions
   ============================================================ */

let state = emptyState();
const listeners = new Set();

/* Nothing may be written until the stored record has been read. Without
   this, any write that ran before init() — a module that failed to load,
   a stray handler — would save an EMPTY record over the real one. That
   happened once in testing; on a health record it must be impossible. */
let ready = false;

/** Read-only-by-convention access to the current state. */
export function get() {
  return state;
}

/** Subscribe to every committed change. Returns an unsubscribe fn. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('[synara] listener threw:', err);
    }
  }
}

/* ============================================================
   Saving
   ------------------------------------------------------------
   A change only becomes the app's state once it is saved. If the save
   fails (storage full, or blocked), nothing changes: the screen and
   the stored record keep matching, and the student is told. Changing
   memory first used to leave the two apart, so the NEXT save quietly
   stored a value nobody had seen — a dose tapped to "taken" twice
   during a full-storage spell was later saved as "missed".

   One exception. If nothing is stored on this device at all and it
   can't save (a private window, storage switched off), refusing every
   change would leave the app unusable, the emergency card included.
   Then Synara runs in memory, and says so on every screen.
   ============================================================ */

let hasRecord = false;    // a record is stored on this device
let memoryOnly = false;   // nothing can be saved; running in memory
let saveFailed = false;   // the last attempt to save failed

/**
 * 'ok', 'failing' (a record is stored but changes can't be saved right
 * now), or 'memory' (nothing is saved on this device at all).
 */
export function saveStatus() {
  if (memoryOnly) return 'memory';
  return saveFailed ? 'failing' : 'ok';
}

/** JSON in, JSON out: the state never holds anything else. */
const copy = (s) => JSON.parse(JSON.stringify(s));

/** Save `next`; only then make it the state. See above for memory mode. */
async function commit(next) {
  try {
    await backend.write(next);
    hasRecord = true;
    memoryOnly = false;
    saveFailed = false;
  } catch (err) {
    saveFailed = true;
    if (hasRecord) {
      notify();      // repaint with the unchanged state, and the warning
      throw err;
    }
    memoryOnly = true;
  }
  state = next;
  notify();
  return state;
}

/**
 * Change and persist in one step. `mutator` changes a copy of the
 * state; the copy replaces it once saved. Writes are awaited so a
 * future network backend naturally applies backpressure.
 */
export async function update(mutator) {
  if (!ready) throw new Error('not-ready');
  const next = copy(state);
  mutator(next);
  return commit(next);
}

/**
 * Re-render without saving. For view-only changes like switching a
 * sub-tab, which used to rewrite the whole record just to repaint.
 */
export function refresh() {
  notify();
}

/* ============================================================
   Boot
   ============================================================ */

/* Another tab, or the installed app, wrote to storage. Adopt its state
   rather than letting the next save here silently overwrite it — with
   Synara installed AND open in a browser tab, last-write-wins would
   quietly lose whichever dose was logged in the other window. */
function onExternalChange(e) {
  if (e.key !== STORAGE_KEY) return;
  try {
    state = e.newValue ? migrate(JSON.parse(e.newValue)) : emptyState();
    hasRecord = !!e.newValue;
    // What's on screen is now what's stored, not something held in memory.
    if (hasRecord) memoryOnly = false;
    ready = true;
    notify();
  } catch (err) {
    console.warn('[synara] ignored an unreadable change from another tab:', err);
  }
}

let listeningForOtherTabs = false;

/* The record exactly as it was read, when loading it changed it — a
   migration (a new field, today's first-aid wording). A migration is not
   an edit: sync.js compares this against the hash it saved at the last
   sync, so an update alone never looks like a change to upload or to
   argue over with another device. */
let readBeforeMigration = null;

/** JSON of the stored record before this load migrated it, or null. */
export function premigrated() {
  return readBeforeMigration;
}

/** True once a record exists here: stored, or held in memory because
    this browser can't save. The first-run intro starts a record afresh,
    so it never opens over one. */
export function hasData() {
  return hasRecord || memoryOnly;
}

/**
 * Load persisted state, migrating if needed.
 *
 * Deliberately does NOT seed. A real student opening this for the first
 * time must not find someone else's medical history already in it.
 * main.js asks instead, and nothing is written until they choose.
 */
export async function init() {
  if (!listeningForOtherTabs && backend === localBackend && typeof window !== 'undefined') {
    window.addEventListener('storage', onExternalChange);
    listeningForOtherTabs = true;
  }

  const stored = await backend.read();
  ready = true;
  if (!stored) {
    state = emptyState();
    return { state, firstRun: true };
  }

  hasRecord = true;
  state = migrate(stored);
  // Saving the upgraded shape back is a nicety, not a reason to fail to
  // start. The record was read, so it can be shown — and the emergency
  // card opened — even when storage is too full to write it back.
  if (JSON.stringify(state) !== JSON.stringify(stored)) {
    readBeforeMigration = JSON.stringify(stored);
    try {
      await backend.write(state);
    } catch (err) {
      console.warn('[synara] could not save the upgraded record:', err);
      saveFailed = true;
    }
  }
  return { state, firstRun: false };
}

/**
 * Delete the record entirely, leaving storage as if the app had never
 * run — so the next start asks the first-run question again, rather
 * than silently persisting an empty record.
 */
export async function wipe() {
  await backend.clear();
  hasRecord = false;
  state = emptyState();
  notify();
}

/**
 * Replace everything with an empty record, optionally re-seeding. The
 * old record stays stored until the new one has saved over it.
 */
export async function reset({ seedFn } = {}) {
  if (!ready) throw new Error('not-ready');
  const next = emptyState();
  if (seedFn) {
    seedFn(next);
    next.settings.seeded = true;
  }
  // The same shape a reload would give, so nothing differs until then.
  return commit(migrate(next));
}

/* ============================================================
   Medication schedule
   ============================================================ */

/** The times a med was scheduled on `day` — [] outside its tracked span. */
export function timesOn(med, day) {
  if (day < med.added) return [];
  if (med.ended && day >= med.ended) return [];
  let times = [];
  for (const entry of med.schedule) {
    if (entry.from <= day) times = entry.times;
    else break;
  }
  // Added at 3pm with an 8am dose: that morning's dose was over before
  // Synara knew about it, so it isn't "7h overdue" and never counts as
  // missed. A dose still inside its grace window stays, to be logged.
  if (day === med.added && med.addedAt) {
    const from = minutesOf(med.addedAt) - GRACE_MINUTES;
    times = times.filter((t) => minutesOf(t) >= from);
  }
  return times;
}

/** The schedule in force now (the latest entry). */
export function currentTimes(med) {
  const last = med.schedule[med.schedule.length - 1];
  return last ? last.times : [];
}

export function isActive(med, today = dayKey()) {
  return !med.ended || med.ended > today;
}

/** Meds being taken now. History goes through dosesOn() instead. */
export function activeMeds(s = state) {
  const today = dayKey();
  return s.meds.filter((m) => isActive(m, today));
}

/**
 * Every dose that was scheduled on `day`, in time order — including
 * meds since stopped, for the days they were still being taken. The
 * statistics, the calendar, the today list, and reminders all go
 * through this, so they cannot disagree about what was due.
 */
export function dosesOn(day, s = state) {
  const out = [];
  for (const med of s.meds) {
    for (const time of timesOn(med, day)) out.push({ med, time });
  }
  return out.sort((a, b) =>
    minutesOf(a.time) - minutesOf(b.time) || a.med.name.localeCompare(b.med.name));
}

/* ============================================================
   Domain operations
   ------------------------------------------------------------
   Views call these rather than reaching into state, so the shape
   stays owned by this file.
   ============================================================ */

/* ---- Meds ---- */

export function addMed({ name, dose = '', form = 'tablet', times = [], notes = '', color = 'violet' }) {
  const today = dayKey();
  return update((s) => {
    s.meds.push({
      id: uid('med'),
      name: str(name, 120).trim(),
      dose: str(dose, 60).trim(),
      form: FORMS.has(form) ? form : 'tablet',
      notes: str(notes, 600).trim(),
      color: COLORS.has(color) ? color : 'violet',
      added: today,
      addedAt: timeOf(),
      ended: null,
      schedule: [{ from: today, times: normTimes(times) }],
    });
  });
}

/**
 * Edit a med. A change of times starts a new schedule entry from today
 * and leaves every earlier day exactly as it was.
 */
export function updateMed(id, patch) {
  const today = dayKey();
  return update((s) => {
    const med = s.meds.find((m) => m.id === id);
    if (!med) return;

    if (typeof patch.name === 'string') med.name = str(patch.name, 120).trim();
    if (typeof patch.dose === 'string') med.dose = str(patch.dose, 60).trim();
    if (typeof patch.notes === 'string') med.notes = str(patch.notes, 600).trim();
    if (FORMS.has(patch.form)) med.form = patch.form;
    if (COLORS.has(patch.color)) med.color = patch.color;

    if (Array.isArray(patch.times)) {
      const next = normTimes(patch.times);
      if (next.join() === currentTimes(med).join()) return;

      const last = med.schedule[med.schedule.length - 1];
      if (last.from === today) {
        // A second edit on the same day replaces that day's entry
        // rather than stacking a zero-length one.
        last.times = next;
        const prev = med.schedule[med.schedule.length - 2];
        if (prev && prev.times.join() === next.join()) med.schedule.pop();
      } else {
        med.schedule.push({ from: today, times: next });
      }
    }
  });
}

/**
 * Stop tracking a med from today. Its history stays in every statistic
 * for the days it was being taken — a neurologist may well ask about a
 * medication that was stopped. One added and removed on the same day
 * has no history worth keeping, so that one is deleted outright.
 */
export function removeMed(id) {
  const today = dayKey();
  return update((s) => {
    const med = s.meds.find((m) => m.id === id);
    if (!med) return;

    if (med.added >= today) {
      s.meds = s.meds.filter((m) => m.id !== id);
      for (const day of Object.keys(s.doses)) {
        for (const key of Object.keys(s.doses[day])) {
          if (key.startsWith(`${id}|`)) delete s.doses[day][key];
        }
        if (!Object.keys(s.doses[day]).length) delete s.doses[day];
      }
      return;
    }
    med.ended = today;
  });
}

/**
 * Start a stopped med again from today, on the times it last had. The
 * days it was stopped become an empty schedule entry — a gap — so they
 * can never be counted as missed doses.
 */
export function restartMed(id) {
  const today = dayKey();
  return update((s) => {
    const med = s.meds.find((m) => m.id === id);
    if (!med || !med.ended) return;
    const times = currentTimes(med);
    if (med.ended < today) {
      med.schedule.push({ from: med.ended, times: [] });
      med.schedule.push({ from: today, times });
    }
    med.ended = null;
  });
}

/* ---- Doses ---- */

export const doseKey = (medId, time) => `${medId}|${time}`;

export function setDoseStatus(day, medId, time, status) {
  return update((s) => {
    if (status === 'pending') {
      if (s.doses[day]) {
        delete s.doses[day][doseKey(medId, time)];
        if (!Object.keys(s.doses[day]).length) delete s.doses[day];
      }
      return;
    }
    if (!STATUSES.has(status)) return;
    if (!s.doses[day]) s.doses[day] = {};
    s.doses[day][doseKey(medId, time)] = { status, at: stamp() };
  });
}

/** Raw logged status, or 'pending' if never marked. */
export function doseStatus(day, medId, time, s = state) {
  const entry = s.doses[day] && s.doses[day][doseKey(medId, time)];
  return entry ? entry.status : 'pending';
}

/** Minutes after the scheduled time before an unlogged dose counts as missed. */
export const GRACE_MINUTES = 60;

/**
 * Status for statistics, where "never marked and the time has passed"
 * has to count as missed — otherwise adherence would quietly round up
 * every time someone forgets to log, and that is the number that must
 * not lie. Callers pass only doses that were actually scheduled
 * (see dosesOn), so a day before a med existed can never count here.
 */
export function effectiveStatus(day, medId, time, s = state) {
  const logged = doseStatus(day, medId, time, s);
  if (logged !== 'pending') return logged;

  // Real clock time, not the date: a 11:30pm dose still has its hour of
  // grace after midnight, rather than turning "missed" at 12:00.
  // Whole minutes, as everywhere else that counts down to a dose.
  const late = minutesLate(day, time);
  return late > GRACE_MINUTES ? 'missed' : 'pending';
}

/** Minutes since a dose was due, to the minute (negative if still ahead). */
export function minutesLate(day, time) {
  return Math.round((parseStamp(stamp()) - parseStamp(`${day}T${time}`)) / 60000);
}

/* ---- Seizures ---- */

export function addSeizure({
  at, duration = 0, type = '', trigger = '', place = '',
  aura = '', injury = false, emsCalled = false, notes = '',
}) {
  return update((s) => {
    const entry = sanitizeSeizure({
      id: uid('sz'), at: at || stamp(), duration: Number(duration) || 0,
      type, trigger, place, aura, injury: !!injury, emsCalled: !!emsCalled,
      notes: (notes || '').trim(), logged: stamp(),
    });
    if (!entry) return;
    s.seizures.push(entry);
    s.seizures.sort(byNewest);
  });
}

export function updateSeizure(id, patch) {
  return update((s) => {
    const i = s.seizures.findIndex((x) => x.id === id);
    if (i < 0) return;
    const next = sanitizeSeizure({ ...s.seizures[i], ...patch, id });
    if (!next) return;
    s.seizures[i] = next;
    s.seizures.sort(byNewest);
  });
}

export function removeSeizure(id) {
  return update((s) => {
    s.seizures = s.seizures.filter((x) => x.id !== id);
  });
}

/* ---- Daily check-in ---- */

export function setCheckin(day, patch) {
  return update((s) => {
    s.checkins[day] = { ...(s.checkins[day] || {}), ...patch, at: stamp() };
  });
}

export function getCheckin(day, s = state) {
  return s.checkins[day] || null;
}

/* ---- Contacts ---- */

export function addContact({ name, relation = '', phone, primary = false }) {
  return update((s) => {
    if (primary) s.contacts.forEach((c) => { c.primary = false; });
    s.contacts.push({
      id: uid('c'),
      name: str(name, 120).trim(),
      relation: str(relation, 80).trim(),
      phone: str(phone, 40).trim(),
      primary: !!primary,
    });
  });
}

export function updateContact(id, patch) {
  return update((s) => {
    const c = s.contacts.find((x) => x.id === id);
    if (!c) return;
    if (patch.primary) s.contacts.forEach((x) => { x.primary = false; });
    if (typeof patch.name === 'string') c.name = str(patch.name, 120).trim();
    if (typeof patch.relation === 'string') c.relation = str(patch.relation, 80).trim();
    if (typeof patch.phone === 'string') c.phone = str(patch.phone, 40).trim();
    if (typeof patch.primary === 'boolean') c.primary = patch.primary;
  });
}

export function removeContact(id) {
  return update((s) => {
    s.contacts = s.contacts.filter((x) => x.id !== id);
  });
}

/* ---- Card, profile, settings ---- */

export function updateCard(patch) {
  return update((s) => {
    Object.assign(s.card, patch, { updated: dayKey() });
  });
}

export function updateProfile(patch) {
  return update((s) => {
    for (const key of Object.keys(s.profile)) {
      if (typeof patch[key] === 'string') s.profile[key] = profileStr(key, patch[key].trim());
    }
  });
}

export function updateSettings(patch) {
  return update((s) => Object.assign(s.settings, patch));
}

/* ---- Export / import ----

   Export alone is not a backup — it only becomes one once it can be
   restored. Both exist, and import goes through the same validation
   as every other load. */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

/** True for something shaped like an exported Synara record. */
export function isBackup(parsed) {
  return !!parsed && typeof parsed === 'object' &&
    Array.isArray(parsed.meds) && Array.isArray(parsed.seizures) &&
    !!parsed.doses && typeof parsed.doses === 'object';
}

/**
 * Replace the whole record with an exported file. Throws
 * Error('not-json'), Error('not-synara') or Error('save-failed')
 * without touching anything.
 */
export async function importJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('not-json');
  }
  if (!isBackup(parsed)) throw new Error('not-synara');
  if (!ready) throw new Error('not-ready');
  return commit(migrate(parsed));
}
