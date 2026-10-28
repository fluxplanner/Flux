/* ============================================================================
   FLUX IB NOTES  ·  flux-ib-notes.js
   Starter notes for each unit of flux-ib-syllabus.js, so a student can open a
   unit and have a study guide, flashcards and questions straight away. Flux
   Tutor builds all of those only from notes, so these are the notes.

   The notes live in public/data/ib-notes/<subject>.json as
   { "<unit title>": "<markdown>" } and are fetched when a set is started, so the
   page does not carry every subject’s text. SUBJECTS lists the files that
   exist; test/unit/ib-notes.test.mjs checks every unit of each listed subject
   has notes, so has() can answer without a fetch.

   They are written to the IB guide’s topics and are a starting point: the set
   they create says so, and a student adds their own class notes beside them.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxIbNotes) return;

  var SUBJECTS = ['biology', 'chemistry', 'physics', 'ess', 'math-aa', 'math-ai', 'economics', 'global-politics', 'history', 'psychology', 'business', 'geography', 'cs', 'english-lit', 'english-langlit', 'french-b', 'spanish-b', 'german-b', 'visual-arts', 'music', 'tok', 'myp-langlit', 'myp-langacq', 'myp-ins', 'myp-sciences', 'myp-maths', 'myp-arts', 'myp-phe', 'myp-design', 'myp-pp'];
  var cache = {};

  function sidOf(unitId) { return String(unitId || '').split(':')[0]; }
  function has(unitId) { return SUBJECTS.indexOf(sidOf(unitId)) >= 0; }

  /** The markdown for one unit, or '' if it cannot be loaded. */
  function load(unitId) {
    var sid = sidOf(unitId);
    if (!has(unitId)) return Promise.resolve('');
    if (!cache[sid]) {
      cache[sid] = fetch('public/data/ib-notes/' + encodeURIComponent(sid) + '.json', { cache: 'no-cache' })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .catch(function () { delete cache[sid]; return {}; });
    }
    // Keyed by unit title, not id: an id can shift if units are reordered, a title cannot without meaning to.
    var IB = root.FluxIbSyllabus, u = IB && IB.unit(unitId), key = u ? u.title : '';
    return cache[sid].then(function (map) { return typeof map[key] === 'string' ? map[key] : ''; });
  }

  root.FluxIbNotes = {
    SOURCE_NAME: 'Flux starter notes (check them against your class notes)',
    subjects: function () { return SUBJECTS.slice(); },
    has: has,
    load: load,
  };
})();
