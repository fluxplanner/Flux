/* ============================================================
   insights.js — the pattern engine and the headline numbers
   ------------------------------------------------------------
   Imported by the home, meds, seizures, and profile views.

   This is the part of the app most likely to be believed, so it is
   the part most obliged to be careful. Three rules:

   1. NEVER INVENT A PATTERN. Every check returns null when the data
      behind it is too thin. An empty Patterns screen is a correct
      answer; a confident-sounding coincidence is not.

   2. REPORT THE EVIDENCE, NOT JUST THE CONCLUSION. Every insight
      carries the counts it came from, and the UI shows them.
      "3 of 4 seizures" is checkable. "You often have seizures after
      missed doses" is not.

   3. SAY "ASSOCIATED WITH", NEVER "CAUSED BY". Four seizures is not
      a study. DISCLAIMER below renders under the results, and Home
      puts a short version under the one insight it shows.

   Every count of doses goes through store.dosesOn(), which only
   returns what was actually scheduled on that day. That is what stops
   a medication added today from turning the last month red.
   ============================================================ */

import {
  dayKey, addDays, parseStamp, daysBetween, lastNDays, minutesOf,
  tally, plural, prettySeconds,
} from './util.js';
import { effectiveStatus, doseStatus, dosesOn } from './store.js';

export const DISCLAIMER =
  'These are associations in your own log, not medical conclusions. ' +
  'Patterns can appear by chance, especially with few entries. ' +
  'Bring them to your neurologist rather than acting on them alone.';

/** Below this many seizures, correlation output is noise. */
const MIN_SEIZURES = 3;

const avg = (nums) => nums.reduce((a, b) => a + b, 0) / nums.length;
const dayOf = (s) => s.at.split('T')[0];

/* ============================================================
   Shared counting
   ============================================================ */

/**
 * Doses on time over a window of past days (today excluded — it is
 * still in progress). `skipRecent` shifts the window back.
 */
function adherenceOver(state, days, skipRecent = 0) {
  const today = dayKey();
  let good = 0;
  let total = 0;

  for (let back = skipRecent + 1; back <= days; back++) {
    const day = addDays(today, -back);
    for (const { med, time } of dosesOn(day, state)) {
      total++;
      if (effectiveStatus(day, med.id, time, state) === 'taken') good++;
    }
  }
  return { good, total };
}

/** Consecutive days back from yesterday with every scheduled dose taken on time. */
function currentStreak(state) {
  const today = dayKey();
  let streak = 0;

  for (let back = 1; back <= 365; back++) {
    const day = addDays(today, -back);
    const doses = dosesOn(day, state);
    if (!doses.length) break;
    const allTaken = doses.every(({ med, time }) =>
      effectiveStatus(day, med.id, time, state) === 'taken');
    if (!allTaken) break;
    streak++;
  }
  return streak;
}

/* ============================================================
   Insights
   ============================================================ */

/**
 * Every insight worth showing, strongest first.
 * Returns [] rather than placeholder text when there is nothing real.
 */
export function insights(state) {
  const sz = state.seizures || [];
  if (sz.length < 2) return [];

  return [
    doseProximity(state, sz),
    sleepPattern(state, sz),
    stressPattern(state, sz),
    triggerPattern(sz),
    timeOfDayPattern(sz),
    placePattern(sz),
    adherenceTrend(state),
    frequencyTrend(sz),
  ]
    .filter(Boolean)
    .sort((a, b) => b.strength - a.strength);
}

/** The single most useful thing to surface on the home screen. */
export function topInsight(state) {
  return insights(state)[0] || null;
}

/* ---- 1. Seizures after a missed or late dose ----
   The correlation the brief asked for first, and the most actionable:
   unlike sleep or stress, a missed dose is something the app can
   directly help prevent. It is also the one most likely to be acted
   on, so it has three bars to clear before it says anything:

   - Only doses due BEFORE the seizure, in the 48 hours before it (a
     missed antiepileptic dose affects blood levels for well over a
     day). A dose missed after a seizure, often because of it, says
     nothing about what came first.
   - Only doses marked missed or late. One nobody logged may well have
     been taken, and a seizure day is exactly when logging slips.
   - It has to beat chance. Someone with a late dose every few days
     has one in plenty of ordinary 48-hour stretches, so the same check
     runs over the stretches with no seizure in them, and the seizures
     have to come after a missed or late dose clearly more often. */

const SLIPPED = new Set(['missed', 'late']);

/**
 * The doses due on `day`: when (minutes after midnight), and whether
 * each was marked missed or late. Kept in `cache` for one pass, since
 * neighbouring seizures and stretches ask about the same days.
 */
function dayDoses(state, day, cache) {
  let list = cache.get(day);
  if (!list) {
    list = dosesOn(day, state).map(({ med, time }) => ({
      mins: minutesOf(time),
      slipped: SLIPPED.has(doseStatus(day, med.id, time, state)),
    }));
    cache.set(day, list);
  }
  return list;
}

/** The 48 hours before a seizure: any dose due, and any marked missed or late. */
function beforeSeizure(state, s, cache) {
  const [day, time] = s.at.split('T');
  const at = minutesOf(time);
  let due = false;
  let slipped = false;
  const look = (d, inWindow) => {
    for (const dose of dayDoses(state, d, cache)) {
      if (!inWindow(dose.mins)) continue;
      due = true;
      if (dose.slipped) slipped = true;
    }
  };
  look(addDays(day, -2), (m) => m >= at);   // from this time two days before
  look(addDays(day, -1), () => true);
  look(day, (m) => m < at);                 // up to the seizure, not after
  return { due, slipped };
}

/**
 * The chance baseline: of the 48-hour stretches (each day and the one
 * before it) with doses due and no seizure, how many had a dose marked
 * missed or late? From when tracking began, at most a year back.
 */
function slipBaseline(state, seizureDays, cache) {
  const today = dayKey();
  const yearAgo = addDays(today, -366);
  const first = state.meds.reduce((min, m) => (m.added < min ? m.added : min), today);
  const flags = (day) => {
    const list = dayDoses(state, day, cache);
    return { due: list.length > 0, slipped: list.some((d) => d.slipped) };
  };
  let prevDay = first > yearAgo ? first : yearAgo;
  let prev = flags(prevDay);
  let stretches = 0;
  let slipped = 0;

  for (let day = addDays(prevDay, 1); day < today; day = addDays(day, 1)) {
    const cur = flags(day);
    const seizureFree = !seizureDays.has(day) && !seizureDays.has(prevDay);
    if (seizureFree && (prev.due || cur.due)) {
      stretches++;
      if (prev.slipped || cur.slipped) slipped++;
    }
    prevDay = day;
    prev = cur;
  }
  return { stretches, slipped };
}

/**
 * How often luck alone would give `k` or more out of `n` when each has
 * chance `p` (0 < p < 1): the upper tail of a binomial. Summed in logs,
 * so a long record can't underflow it.
 */
function chanceOfAtLeast(k, n, p) {
  let log = n * Math.log(1 - p);          // none of the n
  const odds = Math.log(p / (1 - p));
  let total = 0;
  for (let i = 0; i <= n; i++) {
    if (i >= k) total += Math.exp(log);
    log += Math.log((n - i) / (i + 1)) + odds;
  }
  return Math.min(1, total);
}

function doseProximity(state, sz) {
  if (sz.length < MIN_SEIZURES || !state.meds.length) return null;

  let followed = 0;
  let checkable = 0;
  const followedDays = new Set();
  const cache = new Map();

  for (const s of sz) {
    const { due, slipped } = beforeSeizure(state, s, cache);
    // No dose due in the 48 hours before (before any medication was
    // tracked): it can't say anything either way, so it stays out.
    if (!due) continue;
    checkable++;
    if (slipped) {
      followed++;
      followedDays.add(dayOf(s));
    }
  }

  // Several seizures on one day after the same dose are one occasion,
  // not a pattern. It takes at least two different days.
  if (checkable < MIN_SEIZURES || followed < 2 || followedDays.size < 2) return null;

  const pct = Math.round((followed / checkable) * 100);
  if (pct < 60) return null;   // at 50% it is a coin flip

  // Two weeks of ordinary stretches, at least, to compare against.
  const base = slipBaseline(state, new Set(sz.map(dayOf)), cache);
  if (base.stretches < 14) return null;

  // Plus one each way, so a short spotless record can't make the
  // baseline 0% and every missed dose look like a finding. Below 5%,
  // chance alone would rarely line them up like this.
  const chance = (base.slipped + 1) / (base.stretches + 2);
  if (chanceOfAtLeast(followed, checkable, chance) >= 0.05) return null;

  // 1 of 300 is still one, not "0%".
  const basePct = base.slipped ? Math.max(1, Math.round((base.slipped / base.stretches) * 100)) : 0;

  return {
    id: 'dose-proximity',
    tone: 'alert',
    icon: 'pill',
    title: `${followed} of your ${checkable} seizures came after a missed or late dose`,
    detail:
      `Each of those ${plural(followed, 'seizure')} came less than 48 hours after a dose ` +
      'marked missed or late. ' +
      (base.slipped
        ? `Only ${basePct}% of your 48-hour stretches without a seizure had one. `
        : 'None of your 48-hour stretches without a seizure had one. ') +
      'That doesn\'t show the dose caused the seizure. Talk it over with your neurologist, ' +
      'and don\'t change how you take your medicine on your own.',
    evidence: `${followed}/${checkable} seizures · ${pct}% vs ${basePct}% otherwise`,
    strength: 100 + pct,
  };
}

/* ---- 2. Sleep ---- */

function splitByCheckin(state, sz, field) {
  const seizureDays = new Set(sz.map(dayOf));
  const onSeizureDays = [];
  const onOtherDays = [];
  for (const [day, c] of Object.entries(state.checkins || {})) {
    if (typeof c[field] !== 'number') continue;
    (seizureDays.has(day) ? onSeizureDays : onOtherDays).push(c[field]);
  }
  return { onSeizureDays, onOtherDays };
}

function sleepPattern(state, sz) {
  const { onSeizureDays, onOtherDays } = splitByCheckin(state, sz, 'sleepHours');
  if (onSeizureDays.length < MIN_SEIZURES || onOtherDays.length < 10) return null;

  const withSeizure = avg(onSeizureDays);
  const without = avg(onOtherDays);
  const gap = without - withSeizure;

  // Under 45 minutes is inside the noise of self-reported sleep.
  if (gap < 0.75) return null;

  return {
    id: 'sleep',
    tone: 'alert',
    icon: 'moon',
    title: `You slept ${gap.toFixed(1)} hours less before seizure days`,
    detail:
      `The nights before a seizure averaged ${withSeizure.toFixed(1)} hours, against ` +
      `${without.toFixed(1)} on every other night. Short sleep is one of the most ` +
      'commonly reported seizure triggers.',
    evidence: `${onSeizureDays.length} seizure nights vs ${onOtherDays.length} others`,
    strength: 90 + Math.min(20, gap * 10),
  };
}

/* ---- 3. Stress ---- */

function stressPattern(state, sz) {
  const { onSeizureDays, onOtherDays } = splitByCheckin(state, sz, 'stress');
  if (onSeizureDays.length < MIN_SEIZURES || onOtherDays.length < 10) return null;

  const withSeizure = avg(onSeizureDays);
  const without = avg(onOtherDays);
  const gap = withSeizure - without;

  if (gap < 0.8) return null;   // on a 1–5 scale

  return {
    id: 'stress',
    tone: 'watch',
    icon: 'wave',
    title: 'Seizure days were higher-stress days',
    detail:
      `You rated stress ${withSeizure.toFixed(1)} out of 5 on seizure days, against ` +
      `${without.toFixed(1)} otherwise. Stress often shows up alongside other commonly ` +
      'reported triggers, like short sleep and skipped meals.',
    evidence: `${onSeizureDays.length} seizure days vs ${onOtherDays.length} others`,
    strength: 70 + gap * 10,
  };
}

/* ---- 4. Most common trigger ---- */

function triggerPattern(sz) {
  if (sz.length < MIN_SEIZURES) return null;

  const ranked = tally(sz.map((s) => s.trigger).filter((t) => t && t !== 'None known'));
  if (!ranked.length || ranked[0].count < 2) return null;

  const top = ranked[0];
  const pct = Math.round((top.count / sz.length) * 100);

  return {
    id: 'trigger',
    tone: 'watch',
    icon: 'bolt',
    title: `"${top.value}" is your most logged trigger`,
    detail:
      `You recorded it for ${plural(top.count, 'seizure')} out of ${sz.length}. ` +
      (ranked.length > 1
        ? `Next most common: ${ranked.slice(1, 3).map((r) => `${r.value} (${r.count})`).join(', ')}.`
        : 'It is the only trigger you have logged so far.'),
    evidence: `${top.count}/${sz.length} seizures · ${pct}%`,
    strength: 60 + pct / 2,
  };
}

/* ---- 5. Time-of-day clustering ----
   Four-hour blocks. Finer buckets look precise but are meaningless at
   these sample sizes. */

const BLOCKS = [
  { from: 0,  to: 4,  label: 'late at night (12am–4am)' },
  { from: 4,  to: 8,  label: 'early in the morning (4am–8am)' },
  { from: 8,  to: 12, label: 'in the morning (8am–12pm)' },
  { from: 12, to: 16, label: 'in the early afternoon (12pm–4pm)' },
  { from: 16, to: 20, label: 'in the late afternoon (4pm–8pm)' },
  { from: 20, to: 24, label: 'in the evening (8pm–12am)' },
];

function timeOfDayPattern(sz) {
  if (sz.length < MIN_SEIZURES) return null;

  const counts = new Array(BLOCKS.length).fill(0);
  for (const s of sz) {
    const hour = parseStamp(s.at).getHours();
    counts[BLOCKS.findIndex((b) => hour >= b.from && hour < b.to)]++;
  }

  let best = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
  // "Most" has to mean more than half: 2 of 4 is not most.
  if (counts[best] < 2 || counts[best] * 2 <= sz.length) return null;

  const pct = Math.round((counts[best] / sz.length) * 100);

  return {
    id: 'time-of-day',
    tone: 'neutral',
    icon: 'clock',
    title: `Most of your seizures happened ${BLOCKS[best].label}`,
    detail:
      `${counts[best]} of ${sz.length} were in that window. Timing can line up by chance. ` +
      'If it keeps happening, mention it to your neurologist.',
    evidence: `${counts[best]}/${sz.length} seizures · ${pct}%`,
    strength: 40 + pct / 2,
  };
}

/* ---- 6. Where they happen ---- */

function placePattern(sz) {
  if (sz.length < MIN_SEIZURES) return null;

  const ranked = tally(sz.map((s) => s.place).filter(Boolean));
  if (!ranked.length) return null;

  const atSchool = sz.filter((s) => /school/i.test(s.place || '')).length;
  if (atSchool < 2 && ranked[0].count < 2) return null;

  return {
    id: 'place',
    tone: 'neutral',
    icon: 'pin',
    title: atSchool >= 2
      ? `${atSchool} of ${sz.length} happened at school`
      : `Most often at: ${ranked[0].value}`,
    detail: atSchool >= 2
      ? 'Worth making sure the staff actually around you — not just the front office — ' +
        'have seen your safety card. Printing it from the Safety tab is the easiest way.'
      : `You logged ${plural(ranked[0].count, 'seizure')} there out of ${sz.length}.`,
    evidence: atSchool >= 2
      ? `${atSchool}/${sz.length} seizures`
      : `${ranked[0].count}/${sz.length} seizures`,
    strength: 35,
  };
}

/* ---- 7. Adherence trend ---- */

function adherenceTrend(state) {
  const recent = adherenceOver(state, 14);
  const earlier = adherenceOver(state, 45, 14);
  if (recent.total < 10 || earlier.total < 10) return null;

  const rPct = Math.round((recent.good / recent.total) * 100);
  const ePct = Math.round((earlier.good / earlier.total) * 100);
  const delta = rPct - ePct;
  if (Math.abs(delta) < 8) return null;   // noise

  const improving = delta > 0;

  return {
    id: 'adherence-trend',
    tone: improving ? 'good' : 'alert',
    icon: improving ? 'trend-up' : 'trend-down',
    title: improving
      ? `Your dose consistency is up ${delta} points`
      : `Your dose consistency has slipped ${Math.abs(delta)} points`,
    detail:
      `${rPct}% of doses taken on time over the last 14 days, against ${ePct}% in the ` +
      'month before.' + (improving ? ' Keep going.' : ' Worth a look at which dose is slipping.'),
    evidence: `${recent.good}/${recent.total} recent · ${earlier.good}/${earlier.total} before`,
    strength: improving ? 50 : 85,
  };
}

/* ---- 8. Frequency trend ---- */

function frequencyTrend(sz) {
  if (sz.length < 4) return null;

  const today = dayKey();
  const oldest = sz.map(dayOf).sort()[0];
  const span = daysBetween(oldest, today);
  if (span < 30) return null;

  // Two windows of exactly `half` days, so "the N days before" is true.
  // The oldest seizure only marks where the log starts, so it falls just
  // outside them, as does anything dated after today. Fewer than four
  // inside them is too few to call a trend.
  const half = Math.floor(span / 2);
  const midpoint = addDays(today, -half);
  const floor = addDays(today, -2 * half);
  const recent = sz.filter((s) => dayOf(s) > midpoint && dayOf(s) <= today).length;
  const earlier = sz.filter((s) => dayOf(s) > floor && dayOf(s) <= midpoint).length;
  if (recent + earlier < 4 || recent === earlier) return null;

  const fewer = recent < earlier;

  return {
    id: 'frequency',
    tone: fewer ? 'good' : 'alert',
    icon: fewer ? 'sun' : 'alert',
    title: fewer
      ? 'Fewer seizures in the most recent stretch'
      : 'More seizures in the most recent stretch',
    detail:
      `${plural(recent, 'seizure')} in the last ${half} days, against ${earlier} in the ` +
      `${half} days before. Over a window this short a change like this can easily be ` +
      'chance — worth watching, not concluding.',
    evidence: `${recent} recent vs ${earlier} earlier`,
    strength: fewer ? 45 : 80,
  };
}

/* ============================================================
   Headline numbers — home dashboard, Patterns header, profile
   ============================================================ */

export function summary(state) {
  const sz = state.seizures || [];
  const today = dayKey();

  const { good, total } = adherenceOver(state, 30);
  const adherence = total ? Math.round((good / total) * 100) : null;

  // Don't trust array order — an imported or synced record may not be sorted.
  const lastSeizure = sz.length ? sz.map(dayOf).sort().pop() : null;
  // One dated after today (a device with its clock wrong) reads as
  // today, never as "-3 days since".
  const daysSince = lastSeizure ? Math.max(0, daysBetween(lastSeizure, today)) : null;
  // Today and the 29 days before it: 30 days, and nothing from the future.
  const last30 = sz.filter((s) => {
    const back = daysBetween(dayOf(s), today);
    return back >= 0 && back < 30;
  }).length;

  const durations = sz.map((s) => s.duration).filter((d) => d > 0);
  const avgDuration = durations.length ? Math.round(avg(durations)) : null;

  return {
    adherence,
    adherenceGood: good,
    adherenceTotal: total,
    daysSince,
    lastSeizure,
    seizuresLast30: last30,
    totalSeizures: sz.length,
    avgDuration,
    avgDurationLabel: avgDuration ? prettySeconds(avgDuration) : null,
    streak: currentStreak(state),
  };
}

/** Per-day rollup for the adherence calendar. */
export function calendarDays(state, days = 28) {
  const seizureDays = new Set((state.seizures || []).map(dayOf));
  const today = dayKey();

  return lastNDays(days).map((day) => {
    let taken = 0;
    let total = 0;
    let worst = 'none';

    for (const { med, time } of dosesOn(day, state)) {
      // Today is still in progress: an unlogged morning dose shouldn't
      // paint today red at 2pm while it can still be logged.
      const status = day === today
        ? doseStatus(day, med.id, time, state)
        : effectiveStatus(day, med.id, time, state);
      if (status === 'pending') continue;
      total++;
      if (status === 'taken') taken++;
      if (status === 'missed') worst = 'missed';
      else if (status === 'late' && worst !== 'missed') worst = 'late';
      else if (worst === 'none') worst = 'taken';
    }

    return {
      day,
      taken,
      total,
      status: total === 0 ? 'none' : worst,
      seizure: seizureDays.has(day),
    };
  });
}
