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

  function scan() {
    sections = [].slice.call(document.querySelectorAll('[data-fs]')).map(function (s) {
      return {
        el: s, last: -1,
        lift: s.hasAttribute('data-fs-lift'), counts: s.querySelectorAll('[data-fs-count]')
      };
    });
    logo = document.querySelector('[data-fs-logo]');
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
      if (s.lift) lift(s, p);
      for (var c = 0; c < s.counts.length; c++) count(s.counts[c], p);
      // For page scripts that draw their own scene from the progress.
      s.el.dispatchEvent(new CustomEvent('fs-progress', { detail: p }));
    }
    for (var b = 0; b < bars.length; b++) {
      var sel = bars[b].getAttribute('data-fs-progress');
      var sc = (sel && document.querySelector(sel)) || document.scrollingElement || document.documentElement;
      var max = sc.scrollHeight - sc.clientHeight;
      bars[b].style.setProperty('--fs-page', max > 0 ? Math.min(1, sc.scrollTop / max).toFixed(4) : '0');
    }
  }

  // ── The Flux mark: rise, one lap of light, sink back ───────────────────
  var logo = null;
  var pins = null;
  var root = document.documentElement;
  function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }

  // Pins sit on the mark's own path, so they are built from it: each
  // "Label@fraction@colour" in data-fs-pins goes at that share of the way
  // round, labelled above the line on the upper half and below on the lower.
  function buildPins() {
    var g = logo.querySelector('[data-fs-pins]');
    var path = logo.querySelector('.fs-logo-comet');
    if (!g || !path || !path.getTotalLength) return [];
    var NS = 'http://www.w3.org/2000/svg';
    var len = path.getTotalLength();
    return g.getAttribute('data-fs-pins').split('|').map(function (spec) {
      var bits = spec.split('@');
      var f = parseFloat(bits[1]);
      var pt = path.getPointAtLength(len * f);
      var el = document.createElementNS(NS, 'g');
      el.setAttribute('class', 'fs-pin');
      el.style.color = bits[2];
      var rect = document.createElementNS(NS, 'rect');
      var text = document.createElementNS(NS, 'text');
      var dot = document.createElementNS(NS, 'circle');
      text.textContent = bits[0];
      el.appendChild(rect); el.appendChild(text); el.appendChild(dot);
      g.appendChild(el);
      var w = text.getComputedTextLength() || bits[0].length * 8.4;
      var above = pt.y < 0;
      var ty = above ? pt.y - 22 : pt.y + 36;
      text.setAttribute('x', String(pt.x - w / 2));
      text.setAttribute('y', String(ty));
      rect.setAttribute('x', String(pt.x - w / 2 - 11));
      rect.setAttribute('y', String(ty - 16));
      rect.setAttribute('width', String(w + 22));
      rect.setAttribute('height', '23');
      rect.setAttribute('rx', '11.5');
      dot.setAttribute('cx', String(pt.x));
      dot.setAttribute('cy', String(pt.y));
      dot.setAttribute('r', '6');
      dot.setAttribute('fill', bits[2]);
      return { el: el, f: f };
    });
  }

  function lift(s, p) {
    // Low-power mode hides the mark; then the section just lists the features.
    if (!logo || !logo.getClientRects().length) { s.el.classList.add('fs-static'); return; }
    s.el.classList.remove('fs-static');
    if (reduce) return;
    if (!pins) pins = buildPins();
    var up = smooth(p / 0.16) * smooth((1 - p) / 0.2);
    var lap = Math.min(1, Math.max(0, (p - 0.14) / 0.58));
    root.style.setProperty('--fs-lift', up.toFixed(3));
    root.style.setProperty('--fs-comet', lap.toFixed(4));
    for (var i = 0; i < pins.length; i++) pins[i].el.classList.toggle('on', lap > 0 && lap >= pins[i].f);
  }

  // data-fs-count="118" counts up as its section scrolls (data-from: when).
  function count(el, p) {
    var to = parseFloat(el.getAttribute('data-fs-count')) || 0;
    var from = parseFloat(el.getAttribute('data-from')) || 0;
    var k = reduce ? 1 : Math.min(1, Math.max(0, (p - from) / 0.3));
    el.textContent = String(Math.round(to * k));
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
