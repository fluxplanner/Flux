/* ════════════════════════════════════════════════════════════════════════
   FLUX · login-refresh.js — audience toggle for the login hero.
   Swaps headline / sub / AI demo line between the student and educator
   pitch. Purely presentational; auth flows untouched.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COPY = {
    student: {
      headline: 'Your whole school life,<br><span class="grad">in flow.</span>',
      sub: 'Flux keeps tasks, classes, notes, grades and focus in one calm place — and connects students with the teachers, counselors and schools behind them.',
      demo: 'Quiz me on cellular respiration — 5 questions, AP Bio style.'
    },
    teacher: {
      headline: 'Teach all day.<br><span class="grad">Still have a life.</span>',
      sub: 'Lesson hub, gradebook, caseload and school ops in Work mode — and a private personal planner for everything after the last bell. One account, two lives, zero overlap.',
      demo: 'Plan Thursday around my bell schedule and remind me about the staff meeting at 3.'
    }
  };

  function init() {
    var tabs = document.querySelectorAll('#loginScreen .lx-aud-tab');
    var headline = document.getElementById('lxHeadline');
    var sub = document.getElementById('lxSub');
    var demo = document.getElementById('loginDemoLineLeft');
    var copyWrap = document.querySelector('#loginScreen .lx-hero-copy');
    if (!tabs.length || !headline || !sub) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var aud = tab.getAttribute('data-aud');
        var c = COPY[aud];
        if (!c || tab.classList.contains('is-on')) return;
        tabs.forEach(function (t) {
          t.classList.toggle('is-on', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
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
