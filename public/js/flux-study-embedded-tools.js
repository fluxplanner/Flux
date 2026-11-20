/* FLUX · flux-study-embedded-tools.js
   The free tool pages that fit no standalone Flux app live in the planner's
   Study tools (Azfer, 2026-11-18). Each is the tool page itself, shown inline
   through flux-tool-embed.js, so there is one copy of every tool:
     Science toolkit  Units, Formulae
     English          Cite
     Get organised    Score, Plan, Timetable, Timer
   The rest went into Periodic Table (Balance), Grapher (Data, Lab), Pixel
   (Graph Paper) and Flashcards (Spell). */
(function () {
  'use strict';
  var TOOLS = {
    labgraph: [
      ['units', 'Units with working', '📏', 'unit conversion dimensional analysis significant figures sig figs working quiz length mass volume temperature pressure energy'],
      ['formulae', 'Formula sheets + solver', '📐', 'formula sheet physics chemistry biology equation solve substitute working pad'],
    ],
    english: [
      ['cite', 'Citations', '❝', 'citation bibliography mla apa chicago harvard in-text works cited bibtex reference'],
    ],
    organise: [
      ['score', 'Grade calculator', '📊', 'grade calculator weighted what-if target gpa ib 4.0 5.0 score needed'],
      ['plan', 'Plan it out', '🗓', 'study plan deadline sessions schedule spread work assignments ics'],
      ['timetable', 'Timetable to calendar', '🗂', 'bell schedule timetable a/b day ics calendar export google apple outlook'],
      ['timer', 'Classroom timer', '⏱', 'countdown timer intervals metronome tap tempo stopwatch laps'],
    ],
  };
  function boot() {
    var H = window.fluxStudyHub, E = window.FluxToolEmbed;
    if (!H || !H.register || !E) { setTimeout(boot, 60); return; }
    Object.keys(TOOLS).forEach(function (subject) {
      H.register(subject, TOOLS[subject].map(function (t) {
        return {
          id: 'page-' + t[0], name: t[1], icon: t[2], desc: t[3],
          render: function (body) { E.mount(body, t[0] + '.html', t[1]); },
        };
      }));
    });
  }
  boot();
})();
