/* ════════════════════════════════════════════════════════════════
   FLUX PLANNER — PERFORMANCE & BOOT POLISH (Part 5)
   ────────────────────────────────────────────────────────────────
   • will-change hints on frequently-animated elements
   • Boot skeleton cleanup safety net

   The dashboard boot shimmer is inserted directly into #taskList
   in index.html so it paints *before* JS loads. renderTasks()
   naturally replaces it once data is ready.
   ════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // ─── Safety net: if renderTasks somehow never runs, drop the skel ───
  function killBootSkel(){
    var s = document.getElementById('fluxBootSkel');
    if (!s) return;
    s.style.transition = 'opacity .22s ease';
    s.style.opacity = '0';
    setTimeout(function(){ if (s.parentNode) s.parentNode.removeChild(s); }, 240);
  }
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(killBootSkel, 1800);
  });

  // ─── will-change hints for frequently-animated elements ─────────
  // Applied after first paint so they don't fight the initial layout.
  // Re-applied after major re-renders via requestIdleCallback.
  function hintWillChange(){
    var sels = '.bnav, .more-sheet, .more-sheet-overlay, .panel, '
             + '.modal-overlay .modal, .task-item, .toast, #fluxToastStack, '
             + '.ai-bub, .ref-tool-modal';
    var els = document.querySelectorAll(sels);
    for (var i=0; i<els.length; i++){
      try {
        if (!els[i].style.willChange) els[i].style.willChange = 'transform, opacity';
      } catch(e){}
    }
  }
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(hintWillChange, 400);
  });

  ['renderTasks','renderCalendar','renderStats'].forEach(function(n){
    var wait = setInterval(function(){
      if (typeof window[n] !== 'function') return;
      clearInterval(wait);
      var orig = window[n];
      window[n] = function(){
        var r = orig.apply(this, arguments);
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(hintWillChange, {timeout: 500});
        } else {
          setTimeout(hintWillChange, 120);
        }
        return r;
      };
    }, 180);
  });

  window.FluxPerf = { killBootSkel: killBootSkel };

})();
