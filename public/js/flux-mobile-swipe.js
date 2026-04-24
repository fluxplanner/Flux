/* ════════════════════════════════════════════════════════════════════════
   FLUX · Mobile swipe gestures on task cards
   ------------------------------------------------------------------------
   • Swipe right past 80px  →  toggle complete (green check reveal)
   • Swipe left past 80px   →  delete task   (red trash reveal)
   • Below threshold, animates back to resting
   • Mobile only (≤900px); mouse/desktop uses existing click interactions
   • Only binds once per task row; idempotent across re-renders
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const TH = 80;          // threshold in px to trigger action
  const MAX_DRAG = 140;   // clamp so the row doesn't fly off screen
  const ANIM_BACK_MS = 180;
  const ANIM_OUT_MS = 220;

  function isMobile(){
    try{ return window.matchMedia('(max-width: 900px)').matches && matchMedia('(pointer: coarse)').matches; }
    catch(e){ return window.innerWidth <= 900; }
  }

  function getTaskId(el){
    if(!el) return null;
    const raw = el.dataset && el.dataset.taskId;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }

  function ensureSwipeBg(row){
    if(row.querySelector(':scope > .task-swipe-bg')) return;
    const bg = document.createElement('div');
    bg.className = 'task-swipe-bg';
    bg.innerHTML = `
      <span class="task-swipe-ico task-swipe-ico-check" aria-hidden="true">✓</span>
      <span class="task-swipe-ico task-swipe-ico-trash" aria-hidden="true">🗑</span>
    `;
    row.insertBefore(bg, row.firstChild);
  }

  function wrapInner(row){
    // Wrap the row's non-bg children in a single inner element we can transform.
    if(row.querySelector(':scope > .task-swipe-inner')) return row.querySelector(':scope > .task-swipe-inner');
    const inner = document.createElement('div');
    inner.className = 'task-swipe-inner';
    const bg = row.querySelector(':scope > .task-swipe-bg');
    const children = Array.from(row.childNodes).filter(n => n !== bg);
    children.forEach(n => inner.appendChild(n));
    row.appendChild(inner);
    return inner;
  }

  function bindRow(row){
    if(row.__fluxSwipeBound) return;
    row.__fluxSwipeBound = true;
    const tid = getTaskId(row);
    if(!tid) return;

    ensureSwipeBg(row);
    const inner = wrapInner(row);
    row.classList.add('task-swipeable');

    let startX = 0, startY = 0;
    let curDx = 0;
    let tracking = false;
    let locked = null; // 'h' | 'v' | null

    const onStart = (e) => {
      if(!isMobile()) return;
      if(e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      curDx = 0;
      tracking = true;
      locked = null;
      inner.style.transition = 'none';
      row.classList.add('task-swipe-active');
    };

    const onMove = (e) => {
      if(!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Lock axis on first meaningful movement to not interfere with vertical scroll
      if(!locked){
        if(Math.abs(dx) > 6 || Math.abs(dy) > 6){
          locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        }
      }
      if(locked !== 'h') return;
      e.preventDefault();
      const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
      curDx = clamped;
      inner.style.transform = `translateX(${clamped}px)`;
      // Color the background bias
      if(clamped > 0){
        row.classList.add('task-swipe-right');
        row.classList.remove('task-swipe-left');
      } else if(clamped < 0){
        row.classList.add('task-swipe-left');
        row.classList.remove('task-swipe-right');
      } else {
        row.classList.remove('task-swipe-left', 'task-swipe-right');
      }
      row.classList.toggle('task-swipe-armed', Math.abs(clamped) >= TH);
    };

    const finish = () => {
      if(!tracking) return;
      tracking = false;
      row.classList.remove('task-swipe-active', 'task-swipe-armed');
      const dir = curDx > 0 ? 1 : -1;
      const fired = Math.abs(curDx) >= TH;
      if(fired){
        // Animate row off-screen in the swipe direction, then fire action
        inner.style.transition = `transform ${ANIM_OUT_MS}ms cubic-bezier(.35,.05,.25,1), opacity ${ANIM_OUT_MS}ms ease`;
        inner.style.transform = `translateX(${dir * (row.offsetWidth + 40)}px)`;
        inner.style.opacity = '0';
        setTimeout(() => {
          try{
            if(dir > 0){
              // Complete (right swipe)
              if(typeof window.toggleTask === 'function') window.toggleTask(tid);
            } else {
              // Delete (left swipe)
              if(typeof window.deleteTask === 'function'){
                // Bypass the confirm dialog by calling a direct remove if available;
                // fall back to deleteTask otherwise.
                if(typeof window.deleteTaskDirect === 'function'){
                  window.deleteTaskDirect(tid);
                } else {
                  window.deleteTask(tid);
                }
              }
            }
          } catch(err){ console.error('[flux-swipe] action failed', err); }
          // Reset transform just in case the row is reused by virtual scrolling
          inner.style.transition = '';
          inner.style.transform = '';
          inner.style.opacity = '';
          row.classList.remove('task-swipe-left','task-swipe-right');
        }, ANIM_OUT_MS);
      } else {
        inner.style.transition = `transform ${ANIM_BACK_MS}ms cubic-bezier(.2,.85,.3,1.1)`;
        inner.style.transform = 'translateX(0)';
        setTimeout(() => {
          inner.style.transition = '';
          row.classList.remove('task-swipe-left','task-swipe-right');
        }, ANIM_BACK_MS);
      }
      curDx = 0;
    };

    row.addEventListener('touchstart', onStart, { passive: true });
    row.addEventListener('touchmove', onMove, { passive: false });
    row.addEventListener('touchend', finish);
    row.addEventListener('touchcancel', finish);
  }

  function scanAndBind(){
    if(!isMobile()) return;
    // The main task list (#taskList) + mobile dashboard compact today-list rows
    const rows = document.querySelectorAll('#taskList .task-item[data-task-id], #calDayTasks .task-item[data-task-id]');
    rows.forEach(bindRow);
  }

  // Re-scan after every renderTasks / renderCalendar pass
  const prevAfter = window.fluxAfterRenderTasks;
  window.fluxAfterRenderTasks = function(){
    try{ if(typeof prevAfter === 'function') prevAfter(); } catch(e){}
    scanAndBind();
  };
  const prevAfterCal = window.fluxAfterRenderCalendar;
  window.fluxAfterRenderCalendar = function(){
    try{ if(typeof prevAfterCal === 'function') prevAfterCal(); } catch(e){}
    scanAndBind();
  };

  document.addEventListener('DOMContentLoaded', scanAndBind);
  // Guard: also scan on app-visible event if present
  document.addEventListener('flux:app-visible', scanAndBind);
})();
