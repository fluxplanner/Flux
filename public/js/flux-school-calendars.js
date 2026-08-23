/**
 * flux-school-calendars.js — load a school's published year into the planner.
 *
 * Source for IAE: "2026-2029 IA Tri-Campus Graphic Calendars with AB Days", the
 * official PDF linked from iatoday.org/ia-east/calendars-schedules (footer:
 * "Modified May 22, 2026"). Read from the printed grid, not inferred.
 *
 * A/B days are NOT stored per-date. Flux already computes them in
 * getCycleDayLabel() by counting weekdays from an anchor, and that is exactly
 * how IAE's rotation behaves: a closure does not pause the cycle, it consumes
 * the slot that day would have been. A snow day landing on an A day just means
 * the next school day is a B day. So the whole year reduces to one anchor.
 *
 * Verified against the printed calendar: anchor 2026-08-19 = A reproduces all 20
 * of September's school days, including across the Sep 4 and Labor Day closures,
 * and matches the PDF's blue/white shading throughout (white = A, blue = B).
 */
(function () {
  'use strict';

  const IAE_2026_27 = {
    id: 'iae-2026-27',
    school: 'International Academy East',
    year: '2026–2027',
    firstDay: '2026-08-19',
    lastDay: '2027-06-10',
    // Drives getCycleDayLabel(). pattern + anchor is the entire A/B definition.
    cycle: { pattern: ['A', 'B'], anchorDate: '2026-08-19', skipWeekends: true },

    /** No students in the building. Staff-only days are included — from a
     *  student's point of view they are days off just the same. */
    noSchool: [
      ['2026-08-17', 'No school — Professional Development'],
      ['2026-08-18', 'No school — Teacher Workday'],
      ['2026-09-04', 'No school'],
      ['2026-09-07', 'No school — Labor Day'],
      ['2026-10-30', 'No school — Conference Compensation'],
      ['2026-11-02', 'No school — Professional Development'],
      ['2026-11-03', 'No school — All-staff D3'],
      ['2026-11-25', 'No school — Thanksgiving break'],
      ['2026-11-26', 'No school — Thanksgiving'],
      ['2026-11-27', 'No school — Thanksgiving break'],
      ['2026-12-21', 'No school — Winter break'],
      ['2026-12-22', 'No school — Winter break'],
      ['2026-12-23', 'No school — Winter break'],
      ['2026-12-24', 'No school — Winter break'],
      ['2026-12-25', 'No school — Winter break'],
      ['2026-12-28', 'No school — Winter break'],
      ['2026-12-29', 'No school — Winter break'],
      ['2026-12-30', 'No school — Winter break'],
      ['2026-12-31', 'No school — Winter break'],
      ['2027-01-01', 'No school — New Year’s Day'],
      ['2027-01-18', 'No school — MLK Day'],
      ['2027-02-15', 'No school — Mid-winter break'],
      ['2027-02-16', 'No school — Mid-winter break'],
      ['2027-02-17', 'No school — Mid-winter break'],
      ['2027-02-18', 'No school — Mid-winter break'],
      ['2027-02-19', 'No school — Mid-winter break'],
      ['2027-03-10', 'No school — All-staff D3'],
      ['2027-03-26', 'No school'],
      ['2027-03-29', 'No school — Spring break'],
      ['2027-03-30', 'No school — Spring break'],
      ['2027-03-31', 'No school — Spring break'],
      ['2027-04-01', 'No school — Spring break'],
      ['2027-04-02', 'No school — Spring break'],
      ['2027-05-31', 'No school — Memorial Day'],
    ],

    /** 11 a.m. dismissal — the "Half day (AM)" bell schedule in
     *  flux-school-presets.js is the one that applies on these dates. */
    earlyRelease: [
      ['2026-09-23', 'Early release — 11am dismissal'],
      ['2026-10-23', 'Early release — 11am dismissal'],
      ['2026-10-29', 'Early release — 11am dismissal (conferences)'],
      ['2027-01-15', 'Early release — 11am dismissal'],
      ['2027-03-09', 'Early release — 11am dismissal'],
      ['2027-04-09', 'Early release — 11am dismissal'],
      ['2027-04-26', 'Early release — 11am dismissal'],
      ['2027-06-09', 'Early release — 11am dismissal'],
      ['2027-06-10', 'Early release — 11am dismissal'],
    ],

    /** Full days of school, but exams. */
    midterms: [
      ['2026-12-15', 'Midterms — full day of school'],
      ['2026-12-16', 'Midterms — full day of school'],
      ['2026-12-17', 'Midterms — full day of school'],
      ['2026-12-18', 'Midterms — full day of school'],
    ],

    milestones: [
      ['2026-08-19', 'First day of school'],
      ['2026-10-23', 'End of quarter 1'],
      ['2027-01-15', 'End of quarter 2'],
      ['2027-04-09', 'End of quarter 3'],
      ['2027-06-10', 'Last day of school · End of quarter 4'],
    ],
  };

  const YEARS = { iae: IAE_2026_27 };

  function get(id) {
    return YEARS[String(id || '').toLowerCase()] || null;
  }

  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function lsSave(k, v) { if (typeof window.save === 'function') window.save(k, v); }

  /** Every dated row, flattened, tagged so a re-run can replace cleanly. */
  function eventsFor(id) {
    const y = get(id);
    if (!y) return [];
    const out = [];
    const add = (rows, kind) => (rows || []).forEach(function (row) {
      out.push({
        id: y.id + ':' + kind + ':' + row[0],
        title: row[1],
        date: row[0],
        time: '',
        notes: y.school + ' · ' + y.year,
        scope: 'school',
        kind: 'school',
        src: y.id,
      });
    });
    add(y.noSchool, 'off');
    add(y.earlyRelease, 'er');
    add(y.midterms, 'exam');
    add(y.milestones, 'milestone');
    return out;
  }

  /**
   * Load the year: set the A/B anchor and drop the dated events in.
   * Re-runnable — everything tagged with this year's id is replaced, and
   * nothing the student created is touched.
   */
  function applyYear(id) {
    const y = get(id);
    if (!y) {
      if (typeof showToast === 'function') showToast('That school year is not available.', 'error');
      return { ok: false, added: 0 };
    }

    lsSave('flux_cycle_config', {
      enabled: true,
      pattern: y.cycle.pattern.slice(),
      anchorDate: y.cycle.anchorDate,
      skipWeekends: y.cycle.skipWeekends !== false,
    });

    const mine = eventsFor(id);
    const kept = ls('flux_events', []).filter(function (e) {
      return String(e && e.src) !== y.id;
    });
    lsSave('flux_events', kept.concat(mine));

    try { if (typeof syncKey === 'function') syncKey('events', 1); } catch (e) { /* offline */ }
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (e) { /* not mounted */ }

    if (typeof showToast === 'function') {
      showToast(y.school + ' ' + y.year + ' loaded — ' + mine.length + ' dates, A/B days on.', 'success');
    }
    return { ok: true, added: mine.length };
  }

  window.FluxSchoolCalendars = { get, eventsFor, applyYear, YEARS };
})();
