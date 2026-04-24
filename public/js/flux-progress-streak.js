/* ════════════════════════════════════════════════════════════════════════
   FLUX · Urgent task / panic mode visuals
   ------------------------------------------------------------------------
   - Toggles body.flux-panic when any task is within 12h → CSS handles styling
   - Marks urgent task cards, adds a dot on the Home bottom-nav tab
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function getTasks(){ return Array.isArray(window.tasks) ? window.tasks : []; }

  function dueWithin(ms){
    const now = Date.now();
    return getTasks().filter(t => {
      if(t.done || !t.date) return false;
      const d = new Date(t.date);
      const t2 = new Date(d);
      t2.setHours(23,59,59,999);
      const dt = t2 - now;
      return dt >= 0 && dt <= ms;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Panic-mode body class + urgent task cards + nav dot
  // ─────────────────────────────────────────────────────────────────
  function updatePanic(){
    const urgentTasks = dueWithin(12 * 60 * 60 * 1000); // next 12h
    const panic = urgentTasks.length > 0;
    document.body.classList.toggle('flux-panic', panic);

    document.querySelectorAll('.task-card').forEach(card => {
      const id = card.getAttribute('data-task-id');
      if(!id){ card.classList.remove('flux-task-urgent'); return; }
      const isUrg = urgentTasks.some(t => String(t.id) === String(id));
      card.classList.toggle('flux-task-urgent', isUrg);
    });

    const homeTabBtn = document.querySelector('.bnav-item[data-tab="dashboard"]');
    if(homeTabBtn){
      let dot = homeTabBtn.querySelector('.flux-nav-panic-dot');
      if(panic){
        if(!dot){
          dot = document.createElement('span');
          dot.className = 'flux-nav-panic-dot';
          dot.setAttribute('aria-label', 'You have urgent tasks');
          homeTabBtn.appendChild(dot);
        }
      } else if(dot){
        dot.remove();
      }
    }
  }

  function update(){
    try{ updatePanic(); }catch(e){}
  }
  try{ window.fluxUpdateProgressStreak = update; }catch(e){}

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const orig = window.renderStats;
      if(typeof orig === 'function'){
        window.renderStats = function(){
          const r = orig.apply(this, arguments);
          update();
          return r;
        };
      }
      const origRT = window.renderTasks;
      if(typeof origRT === 'function'){
        window.renderTasks = function(){
          const r = origRT.apply(this, arguments);
          try{ updatePanic(); }catch(e){}
          return r;
        };
      }
      update();
    }, 300);

    setInterval(update, 60 * 1000);
  });
})();
