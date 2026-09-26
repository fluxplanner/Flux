/* ════════════════════════════════════════════════════════════════════════
   FLUX · login-refresh.js — audience toggle for the login hero.
   Swaps headline / sub / AI demo line between the student and educator
   pitch. Purely presentational; auth flows untouched.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COPY = {
    // The demo lines are the first of each list in app.js (LOGIN_DEMO_LINES and
    // LOGIN_DEMO_LINES_STAFF); the rotator carries on from them. They used to
    // be requests to Flux AI, which has no tab any more.
    student: {
      headline: 'Your whole school life,<br><span class="grad">in flow.</span>',
      sub: 'Flux keeps tasks, classes, study tools, grades and focus in one calm place — and connects students with the teachers, counselors and schools behind them.',
      demo: 'Count down to the SAT from any day on your calendar.'
    },
    teacher: {
      headline: 'Teach all day.<br><span class="grad">Still have a life.</span>',
      sub: 'Lesson Hub, rosters, classroom tools, caseloads and school ops in Work mode — and a private planner for everything after the last bell. One account, two lives, zero overlap.',
      demo: "See today's classes bell by bell, with lesson notes for each period."
    }
  };

  // Audience-gated marketing sections: [data-aud-show="student"] only renders
  // on the student tab, [data-aud-show="staff"] only on the staff tab.
  function applyAudience(aud) {
    var want = aud === 'teacher' ? 'staff' : 'student';
    document.querySelectorAll('[data-aud-show]').forEach(function (el) {
      el.classList.toggle('lx-aud-hidden', el.getAttribute('data-aud-show') !== want);
    });
  }

  function init() {
    var tabs = document.querySelectorAll('#loginScreen .lx-aud-tab');
    var headline = document.getElementById('lxHeadline');
    var sub = document.getElementById('lxSub');
    var demo = document.getElementById('loginDemoLineLeft');
    var copyWrap = document.querySelector('#loginScreen .lx-hero-copy');
    if (!tabs.length || !headline || !sub) return;

    applyAudience('student');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var aud = tab.getAttribute('data-aud');
        var c = COPY[aud];
        if (!c || tab.classList.contains('is-on')) return;
        tabs.forEach(function (t) {
          t.classList.toggle('is-on', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        applyAudience(aud);
        if (copyWrap) copyWrap.classList.add('lx-aud-swapping');
        setTimeout(function () {
          headline.innerHTML = c.headline;
          sub.textContent = c.sub;
          if (demo) demo.textContent = c.demo;
          if (copyWrap) copyWrap.classList.remove('lx-aud-swapping');
        }, 220);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
