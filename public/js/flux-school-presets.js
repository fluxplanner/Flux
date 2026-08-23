/**
 * flux-school-presets.js — one-tap bell-schedule presets for known schools.
 *
 * Adding classes by hand means typing a period, a start time and an end time for
 * every block. At a school on a fixed bell schedule that is the same eight rows
 * for every student, so it is worth shipping as a preset: pick the school, get
 * the periods and times filled in, then just type the class names.
 *
 * A preset only supplies the *timetable*. It never invents class names, and the
 * caller is responsible for not clobbering classes the student already entered.
 *
 * Self-contained IIFE. Exposes window.FluxSchoolPresets.
 */
(function () {
  'use strict';

  /* ── International Academy East ──────────────────────────────────────────
   * Times supplied by IAE directly. Three bell schedules run there:
   *
   *   Full day     7:45–2:35   90-minute blocks
   *   Seminar day  7:45–2:35   shortened blocks + a 35-minute seminar last
   *   Half day     7:45–11:00  45-minute blocks, 5-minute passing, no lunch
   *
   * A3/B3 is the long block on full and seminar days because A, B and C lunches
   * all sit inside it. Half days carry no lunch at all, which is why every block
   * is the same length: 45 + 5 passing, four times, lands exactly on 11:00 —
   * matching the school's published 11 a.m. dismissal.
   *
   * Classes alternate A/B day. `days` uses the "A Day"/"B Day" wording that
   * parseClassPeriodInput() already produces, so these rows behave exactly like
   * hand-typed "A1" / "B3" entries everywhere else in the app.
   */
  const IAE = {
    id: 'iae',
    name: 'International Academy East',
    short: 'IAE',
    note: 'A/B day block schedule · 7:45–2:35',
    // The variant a student gets when they apply the preset.
    variant: 'full',
    variants: {
      full: {
        label: 'Full day',
        hours: '7:45 a.m. – 2:35 p.m.',
        blocks: [
          { n: 1, start: '07:45', end: '09:15' },
          { n: 2, start: '09:20', end: '10:50' },
          { n: 3, start: '10:55', end: '12:55', note: 'includes A/B/C lunches' },
          { n: 4, start: '13:05', end: '14:35' },
        ],
      },
      seminar: {
        label: 'Seminar day',
        hours: '7:45 a.m. – 2:35 p.m.',
        blocks: [
          { n: 1, start: '07:45', end: '09:05' },
          { n: 2, start: '09:10', end: '10:30' },
          { n: 3, start: '10:35', end: '12:30', note: 'includes A/B/C lunches' },
          { n: 4, start: '12:35', end: '13:55' },
        ],
        // Seminar is not an A/B class — it runs at the end of every seminar day.
        extra: { label: 'Seminar', start: '14:00', end: '14:35' },
      },
      half: {
        label: 'Half day (AM)',
        hours: '7:45 a.m. – 11:00 a.m.',
        blocks: [
          { n: 1, start: '07:45', end: '08:30' },
          { n: 2, start: '08:35', end: '09:20' },
          { n: 3, start: '09:25', end: '10:10' },
          { n: 4, start: '10:15', end: '11:00' },
        ],
      },
    },
  };

  const PRESETS = { iae: IAE };

  function get(id) {
    return PRESETS[String(id || '').toLowerCase()] || null;
  }

  function list() {
    return Object.values(PRESETS).map((p) => ({
      id: p.id, name: p.name, short: p.short, note: p.note,
    }));
  }

  /** "07:45" -> "7:45 AM", for confirmation copy only. */
  function pretty(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) return String(hhmm || '');
    let h = parseInt(m[1], 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return h + ':' + m[2] + ' ' + suffix;
  }

  /**
   * The eight timetable rows (A1–A4, B1–B4) for a preset variant, in the shape
   * the rest of the app stores classes in. Names are intentionally blank — the
   * student fills those in.
   */
  function rowsFor(presetId, variantId) {
    const p = get(presetId);
    if (!p) return [];
    const v = p.variants[variantId || p.variant];
    if (!v) return [];
    const rows = [];
    ['A', 'B'].forEach((letter) => {
      v.blocks.forEach((b) => {
        rows.push({
          period: b.n,
          periodLabel: letter + b.n,
          days: letter === 'A' ? 'A Day' : 'B Day',
          name: '',
          teacher: '',
          room: '',
          timeStart: b.start,
          timeEnd: b.end,
        });
      });
    });
    return rows;
  }

  window.FluxSchoolPresets = { get, list, rowsFor, pretty, PRESETS };
})();
