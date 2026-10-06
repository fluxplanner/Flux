/* ============================================================================
   FLUX × SYNARA  ·  flux-synara-link.js
   Synara (synara.html) runs on the same site as the planner. When a student
   turns on "Show in my Flux Planner" in Synara (You → Flux Planner), Synara
   writes a small summary to localStorage["synara.flux"]:

     { v: 1, meds: [{ name, dose, color, added, ended,
                      schedule: [{ from: "YYYY-MM-DD", times: ["HH:MM"] }] }] }

   Only medication names, doses and times. The planner reads it to put dose
   times on the calendar and a safety-card shortcut on School info. It never
   saves, syncs or sends it anywhere: these items are drawn at render time and
   are not in flux_events, so neither cloud sync nor the AI context sees them.
   Turning the setting off in Synara removes the key, and they disappear.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'synara.flux';
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

  /** The summary, validated; null when Synara has not shared anything. */
  function feed() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    var d;
    try { d = JSON.parse(raw); } catch (e) { return null; }
    if (!d || d.v !== 1 || !Array.isArray(d.meds)) return null;
    var meds = d.meds.slice(0, 50).map(function (m) {
      if (!m || !DAY.test(m.added)) return null;
      var schedule = (Array.isArray(m.schedule) ? m.schedule : [])
        .filter(function (e) { return e && DAY.test(e.from) && Array.isArray(e.times); })
        .map(function (e) { return { from: e.from, times: e.times.filter(function (t) { return TIME.test(t); }).slice(0, 24) }; })
        .sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
      return {
        name: str(m.name, 80) || 'Medication',
        dose: str(m.dose, 40),
        added: m.added,
        ended: DAY.test(m.ended) ? m.ended : null,
        schedule: schedule,
      };
    }).filter(Boolean);
    return { meds: meds };
  }

  /* Same rule as Synara's store.timesOn: nothing before it was added or from
     the day it was stopped; otherwise the latest schedule entry that applies. */
  function timesOn(med, day) {
    if (day < med.added || (med.ended && day >= med.ended)) return [];
    var times = [];
    for (var i = 0; i < med.schedule.length; i++) {
      if (med.schedule[i].from <= day) times = med.schedule[i].times;
    }
    return times;
  }

  /** Calendar items for one day, shaped like the planner's virtual events. */
  function dosesForDate(day) {
    if (!DAY.test(day)) return [];
    var f = feed();
    if (!f) return [];
    var out = [];
    f.meds.forEach(function (med, i) {
      timesOn(med, day).forEach(function (t) {
        out.push({
          id: 'sy_' + i + '_' + t,
          title: med.dose ? med.name + ' ' + med.dose : med.name,
          time: t,
          date: day,
          scope: 'outside',
          _synara: true,
        });
      });
    });
    return out;
  }

  var PULSE = '<svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 19h4l2.5-6.5L16.5 23l2.8-7H26"/></svg>';

  /** School info: a shortcut to the safety card, while Synara is linked. */
  function decorateSchool() {
    var stack = document.querySelector('#school .flux-stack');
    if (!stack) return;
    var card = document.getElementById('fxSynaraSchool');
    if (!feed()) { if (card) card.remove(); return; }
    if (card) return;
    card = document.createElement('div');
    card.className = 'card';
    card.id = 'fxSynaraSchool';
    card.style.cssText = 'border-color:rgba(156,122,255,.4);background:linear-gradient(155deg,rgba(156,122,255,.12),transparent 60%),var(--card)';
    card.innerHTML = ''
      + '<div style="display:flex;gap:12px;align-items:center">'
      + '<span style="flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:#fff;background:linear-gradient(135deg,#9c7aff,#5926d4)">' + PULSE + '</span>'
      + '<div style="flex:1;min-width:0"><h3 style="margin:0">Seizure safety card</h3>'
      + '<div style="font-size:.8rem;color:var(--muted2)">From Synara: what to do if you have a seizure at school, ready for a teacher, the nurse or a coach.</div></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + '<a class="btn-sec" href="synara.html#/safety" style="text-decoration:none">Open my safety card</a>'
      + '<a class="btn-sec" href="synara.html#/sos" style="text-decoration:none">Emergency card</a>'
      + '</div>';
    stack.insertBefore(card, stack.firstChild);
  }

  window.FluxSynara = { feed: feed, dosesForDate: dosesForDate, decorateSchool: decorateSchool };
})();
