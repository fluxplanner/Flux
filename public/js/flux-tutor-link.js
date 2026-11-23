/* ============================================================================
   FLUX × TUTOR  ·  flux-tutor-link.js
   Flux Tutor (teacher.html) writes "flux_tutor_agenda" in this browser: the
   exam date of each study set, the IB exam session, and how many flashcards
   are due today. The planner draws those on its calendar, the same way it
   draws Synara and Aorta reminders (flux-synara-link.js, flux-aorta-link.js),
   with `_src: 'tutor'` so the day view labels them and links back to Tutor.

   Read only: nothing here is saved into the planner's own data, so cloud
   sync and Flux AI's context never see it.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxTutorLink) return;

  var KEY = 'flux_tutor_agenda';
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var HREF = /^teacher\.html#[A-Za-z0-9_\-\/?=&%.:]{0,200}$/;

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function read() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || 'null');
      return a && Array.isArray(a.items) ? a.items.slice(0, 80) : [];
    } catch (e) { return []; }
  }

  /** Calendar items for one day, shaped like the planner's linked items. */
  function itemsForDate(day) {
    if (!DAY.test(day)) return [];
    return read().filter(function (x) {
      if (!x || x.date !== day) return false;
      // "Cards due" is only true today: an old note must not show as due later.
      return x.kind !== 'study' || day === today();
    }).map(function (x, i) {
      return {
        id: 'ft_' + day + '_' + i,
        title: str(x.title, 140) || 'Flux Tutor',
        date: day,
        time: '',
        scope: 'school',
        _synara: true,
        _src: 'tutor',
        _kind: x.kind === 'exam' ? 'exam' : 'study',
        _href: HREF.test(String(x.href || '')) ? x.href : 'teacher.html#home',
      };
    });
  }

  // Tutor open in another tab: redraw the calendar when its agenda changes.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (err) { /* calendar not up yet */ }
  });

  window.FluxTutorLink = { itemsForDate: itemsForDate };
})();
