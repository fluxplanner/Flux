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

  // ─── will-change hints (narrow + debounced) ────────────────────
  // Never hint .panel: dozens of full-screen panels → each promoted to
  // its own compositor layer → GPU churn and scroll jank. Same for .ai-bub
  // (many bubbles). Re-running on every renderTasks was especially costly.
  function hintWillChange(){
    var sels = '.bnav, .more-sheet, .more-sheet-overlay, '
             + '.modal-overlay .modal, .toast, #fluxToastStack, .ref-tool-modal';
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

  var _hintDebounce = null;
  function scheduleHintWillChange(){
    clearTimeout(_hintDebounce);
    _hintDebounce = setTimeout(function(){
      _hintDebounce = null;
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(hintWillChange, { timeout: 1800 });
      } else {
        setTimeout(hintWillChange, 400);
      }
    }, 800);
  }

  ['renderTasks','renderCalendar','renderStats'].forEach(function(n){
    var wait = setInterval(function(){
      if (typeof window[n] !== 'function') return;
      clearInterval(wait);
      var orig = window[n];
      window[n] = function(){
        var r = orig.apply(this, arguments);
        scheduleHintWillChange();
        return r;
      };
    }, 180);
  });

  window.FluxPerf = { killBootSkel: killBootSkel };

})();
