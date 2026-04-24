/* ════════════════════════════════════════════════════════════════════════
   FLUX · Daily progress ring + 7-day streak + panic mode visuals
   ------------------------------------------------------------------------
   - Computes today's tasks (due today + past due), calculates done/total
   - Animates ring stroke-dashoffset and updates micro-copy
   - Renders 7 streak day pills from completed task history
   - Toggles body.flux-panic when any task is within 12h → CSS handles styling
   - Adds a small dot to the "Home" bottom-nav tab when panic is active
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const CIRCUMFERENCE = 2 * Math.PI * 52; // must match CSS r=52

  function ymd(d){ const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); }

  function getTasks(){ return Array.isArray(window.tasks) ? window.tasks : []; }

  function isToday(dateStr){
    if(!dateStr) return false;
    return dateStr === ymd(new Date());
  }
  function isPast(dateStr){
    if(!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    return d < today;
  }
  function dueWithin(ms){
    const now = Date.now();
    return getTasks().filter(t => {
      if(t.done || !t.date) return false;
      const d = new Date(t.date);
      // If due time present, use it; else end-of-day
      const t2 = new Date(d);
      t2.setHours(23,59,59,999);
      const dt = t2 - now;
      return dt >= 0 && dt <= ms;
    });
  }

  function computeTodayProgress(){
    const tasks = getTasks();
    const today = ymd(new Date());
    const todays = tasks.filter(t => t.date === today || (isPast(t.date) && !t.done));
    const done = todays.filter(t => t.done).length;
    const total = todays.length;
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function microCopy(pct, total){
    if(total === 0) return 'No tasks today — breathe.';
    if(pct === 0)   return "Let's get started.";
    if(pct < 25)    return 'Small start. Keep going.';
    if(pct < 50)    return 'Momentum building ↗';
    if(pct < 75)    return "You're in the zone.";
    if(pct < 100)   return 'Almost there — finish strong.';
    return "Done for today. Go rest. 🎉";
  }

  function renderRing(){
    const done = document.getElementById('fluxProgressDone');
    const total = document.getElementById('fluxProgressTotal');
    const micro = document.getElementById('fluxProgressMicro');
    const ring  = document.querySelector('.flux-progress-ring-fg');
    if(!done || !total || !ring) return;

    const p = computeTodayProgress();
    done.textContent = String(p.done);
    total.textContent = String(p.total);
    if(micro) micro.textContent = microCopy(p.pct, p.total);

    const offset = CIRCUMFERENCE * (1 - Math.min(1, p.pct / 100));
    ring.style.strokeDashoffset = String(offset);
    ring.style.strokeDasharray = String(CIRCUMFERENCE);

    // Hide the row entirely if there are literally no tasks (keeps hero clean)
    const row = document.getElementById('fluxProgressRow');
    if(row && p.total === 0){
      // Don't hide — show "No tasks today — breathe." instead to feel alive
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 7-day streak display
  // ─────────────────────────────────────────────────────────────────
  function renderStreak(){
    const row = document.getElementById('fluxStreakRow');
    const countEl = document.getElementById('fluxStreakCount');
    if(!row) return;

    const tasks = getTasks();
    const days = [];
    const today = new Date(); today.setHours(0,0,0,0);

    // Build set of completion dates (any task completed on that date counts)
    const completionDates = new Set();
    tasks.forEach(t => {
      if(!t.done) return;
      const completedAt = t.completedAt || t.updatedAt || null;
      if(completedAt){
        const d = new Date(completedAt);
        completionDates.add(ymd(d));
      }
    });

    // Generate last 7 days (oldest → today)
    for(let i = 6; i >= 0; i--){
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        date: d,
        ymd: ymd(d),
        filled: completionDates.has(ymd(d)),
        isToday: i === 0,
      });
    }

    // Calculate current streak (consecutive days ending at today)
    let streak = 0;
    for(let i = days.length - 1; i >= 0; i--){
      if(days[i].filled) streak++;
      else break;
    }

    row.innerHTML = days.map(d => `
      <div class="flux-streak-day ${d.filled?'filled':''} ${d.isToday?'today':''}"
           title="${d.date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}${d.filled?' · ✓':''}"></div>
    `).join('');
    if(countEl) countEl.textContent = String(streak);
  }

  // ─────────────────────────────────────────────────────────────────
  // Panic-mode body class + urgent task cards + nav dot
  // ─────────────────────────────────────────────────────────────────
  function updatePanic(){
    const urgentTasks = dueWithin(12 * 60 * 60 * 1000); // next 12h
    const panic = urgentTasks.length > 0;
    document.body.classList.toggle('flux-panic', panic);

    // Mark urgent task cards
    document.querySelectorAll('.task-card').forEach(card => {
      const id = card.getAttribute('data-task-id');
      if(!id){ card.classList.remove('flux-task-urgent'); return; }
      const isUrg = urgentTasks.some(t => String(t.id) === String(id));
      card.classList.toggle('flux-task-urgent', isUrg);
    });

    // Add a small alert dot on bottom nav "Home" tab
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

  // ─────────────────────────────────────────────────────────────────
  // Public update function — called from renderStats() & after events
  // ─────────────────────────────────────────────────────────────────
  function update(){
    try{ renderRing(); }catch(e){}
    try{ renderStreak(); }catch(e){}
    try{ updatePanic(); }catch(e){}
  }
  try{ window.fluxUpdateProgressStreak = update; }catch(e){}

  // Hook into renderStats / renderTasks chain
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for app.js to be loaded
    setTimeout(() => {
      // Wrap existing renderStats
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
          // Urgent tagging depends on DOM — run after re-render
          try{ updatePanic(); }catch(e){}
          return r;
        };
      }
      update();
    }, 300);

    // Refresh every minute (for the 12h window to stay accurate)
    setInterval(update, 60 * 1000);
  });
})();
