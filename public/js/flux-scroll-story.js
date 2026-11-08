/**
 * Flux scroll story — drives public/css/flux-scroll-story.css (see the
 * comment there for the pieces). Plain script, no library, no flags: it
 * runs the same on landing.html, suite.html, partners.html,
 * synara-welcome.html and the planner's sign-in screen in index.html.
 *
 * The planner's sign-in screen scrolls inside #loginScreen, not the page,
 * so scroll is listened for on the document in the capture phase, which
 * hears every scroller. Positions come from getBoundingClientRect, which
 * is the same whichever element scrolls.
 *
 * Updates run straight from the scroll event, not requestAnimationFrame:
 * the work is small, and rAF is paused in background and preview tabs.
 */
(function () {
  'use strict';
  if (window.FluxScrollStory) return;

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var sections = [];
  var bars = [];

  // "Every *class* counts." → one span per word; *word* marks an accent.
  // Built with DOM nodes, never innerHTML, so the text can't become markup.
  function splitWords(el) {
    if (el.getAttribute('data-fs-split')) return;
    el.setAttribute('data-fs-split', '1');
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'w' + (/^\*.*\*[^\w]*$/.test(w) ? ' accent' : '');
      span.textContent = w.replace(/\*/g, '');
      if (i) el.appendChild(document.createTextNode(' '));
      el.appendChild(span);
    });
  }

  function scan() {
    document.querySelectorAll('[data-fs-words]').forEach(splitWords);
    sections = [].slice.call(document.querySelectorAll('[data-fs]')).map(function (s) {
      return { el: s, words: s.querySelectorAll('.w'), last: -1 };
    });
    bars = [].slice.call(document.querySelectorAll('[data-fs-progress]'));
    document.querySelectorAll('[data-fs-stagger]').forEach(function (box) {
      [].slice.call(box.children).forEach(function (c, i) {
        if (!c.hasAttribute('data-fs-reveal')) c.setAttribute('data-fs-reveal', box.getAttribute('data-fs-stagger') || 'up');
        c.style.setProperty('--i', String(i % 8));
      });
    });
  }

  function update() {
    var vh = window.innerHeight || 1;
    revealVisible(vh);
    for (var n = 0; n < sections.length; n++) {
      var s = sections[n];
      var r = s.el.getBoundingClientRect();
      if (!r.height) continue; // hidden (e.g. the sign-in screen after sign-in)
      var span = r.height - vh;
      var p = reduce ? 1 : (span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1);
      var key = Math.round(p * 1000);
      if (key === s.last) continue;
      s.last = key;
      s.el.style.setProperty('--p', (key / 1000).toFixed(3));
      if (s.words.length) {
        var lit = Math.round(p * 1.2 * s.words.length);
        for (var i = 0; i < s.words.length; i++) s.words[i].classList.toggle('on', i < lit);
      }
    }
    for (var b = 0; b < bars.length; b++) {
      var sel = bars[b].getAttribute('data-fs-progress');
      var sc = (sel && document.querySelector(sel)) || document.scrollingElement || document.documentElement;
      var max = sc.scrollHeight - sc.clientHeight;
      bars[b].style.setProperty('--fs-page', max > 0 ? Math.min(1, sc.scrollTop / max).toFixed(4) : '0');
    }
  }

  // Reveals are checked on scroll rather than with IntersectionObserver:
  // the observer never fires in a document the browser isn't painting
  // (preview panes, some in-app browsers), which left blocks invisible.
  // Anything at or above 92% of the screen height shows, including blocks
  // jumped past by a link.
  var pending = [];
  function reveal() {
    pending = [].slice.call(document.querySelectorAll('[data-fs-reveal]:not(.fs-on)'));
    if (reduce) { pending.forEach(function (e) { e.classList.add('fs-on'); }); pending = []; }
  }
  function revealVisible(vh) {
    if (!pending.length) return;
    pending = pending.filter(function (e) {
      if (e.getBoundingClientRect().top < vh * 0.92) { e.classList.add('fs-on'); return false; }
      return true;
    });
  }

  function init() {
    scan();
    reveal();
    update();
  }

  document.addEventListener('scroll', update, { capture: true, passive: true });
  window.addEventListener('resize', update);
  // The sign-in screen is display:none until the app decides to show it;
  // re-measure once the page has settled.
  window.addEventListener('load', update);

  window.FluxScrollStory = { refresh: init, update: update };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
