/* ════════════════════════════════════════════════════════════════════════
   FLUX · Right-click context menu on task cards (desktop)
   ------------------------------------------------------------------------
   • Right-click any .task-item on desktop → styled context menu at cursor
   • Items: Complete, Edit, Set due today, Set due tomorrow, Ask Flux AI,
           Duplicate, Delete
   • Closes on click outside / Escape / blur
   • Smooth fade-in; positioned within viewport
   • Skipped on mobile (touch uses swipe + long-press bottom sheet)
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function isMobile(){
    try{ return window.matchMedia('(pointer: coarse)').matches; } catch(e){ return false; }
  }

  function closeMenu(){
    const m = document.getElementById('fluxTaskCtxMenu');
    if(m){ m.classList.add('flux-ctx-closing'); setTimeout(()=>m.remove(), 120); }
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(e){
    if(e.key === 'Escape'){ closeMenu(); }
  }

  function ymd(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  function setDue(tid, offsetDays){
    if(!Array.isArray(window.tasks)) return;
    const t = window.tasks.find(x => x.id === tid);
    if(!t) return;
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + offsetDays);
    t.date = ymd(d);
    if(typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
    if(typeof window.save === 'function') window.save('tasks', window.tasks);
    if(typeof window.syncKey === 'function') window.syncKey('tasks', window.tasks);
    if(typeof window.renderTasks === 'function') window.renderTasks();
    if(typeof window.renderCalendar === 'function') window.renderCalendar();
    if(typeof window.renderStats === 'function') window.renderStats();
    if(typeof window.showToast === 'function'){
      window.showToast(offsetDays===0?'Due today':'Due tomorrow','success');
    }
  }

  function duplicateTaskLocal(tid){
    if(!Array.isArray(window.tasks)) return;
    const t = window.tasks.find(x => x.id === tid);
    if(!t) return;
    const copy = Object.assign({}, t, {
      id: Date.now() + Math.floor(Math.random()*1000),
      name: (t.name||'Untitled') + ' (copy)',
      done: false,
      completedAt: null,
      createdAt: Date.now(),
    });
    window.tasks.unshift(copy);
    if(typeof window.save === 'function') window.save('tasks', window.tasks);
    if(typeof window.syncKey === 'function') window.syncKey('tasks', window.tasks);
    if(typeof window.renderTasks === 'function') window.renderTasks();
    if(typeof window.renderStats === 'function') window.renderStats();
    if(typeof window.showToast === 'function') window.showToast('Task duplicated','success');
  }

  function actions(tid){
    return [
      { id:'complete', label:'Complete', icon:'✓', fn:()=>{ if(typeof window.toggleTask==='function') window.toggleTask(tid); } },
      { id:'edit',     label:'Edit',     icon:'✎', fn:()=>{ if(typeof window.openEdit==='function') window.openEdit(tid); } },
      { id:'today',    label:'Set due today',    icon:'📅', fn:()=>setDue(tid, 0) },
      { id:'tomorrow', label:'Set due tomorrow', icon:'➡',  fn:()=>setDue(tid, 1) },
      { id:'ask',      label:'Ask Flux AI', icon:'✦', accent:true, fn:()=>{ if(typeof window.askFluxAIAboutTask==='function') window.askFluxAIAboutTask(tid); } },
      { id:'dup',      label:'Duplicate', icon:'⎘', fn:()=>duplicateTaskLocal(tid) },
      { type:'sep' },
      { id:'del',      label:'Delete', icon:'🗑', danger:true, fn:()=>{ if(typeof window.deleteTask==='function') window.deleteTask(tid); } },
    ];
  }

  function openMenu(x, y, tid){
    closeMenu();
    const m = document.createElement('div');
    m.id = 'fluxTaskCtxMenu';
    m.className = 'flux-ctx-menu';
    m.setAttribute('role','menu');
    m.setAttribute('aria-label','Task actions');

    m.innerHTML = actions(tid).map(a => {
      if(a.type === 'sep') return `<div class="flux-ctx-sep" role="separator"></div>`;
      const cls = ['flux-ctx-item'];
      if(a.accent) cls.push('accent');
      if(a.danger) cls.push('danger');
      return `<button type="button" role="menuitem" class="${cls.join(' ')}" data-ctx-id="${a.id}"><span class="flux-ctx-ico" aria-hidden="true">${a.icon}</span><span class="flux-ctx-lbl">${a.label}</span></button>`;
    }).join('');

    document.body.appendChild(m);

    // Wire actions
    m.addEventListener('click', e => {
      const btn = e.target.closest('button[data-ctx-id]');
      if(!btn) return;
      const id = btn.getAttribute('data-ctx-id');
      const action = actions(tid).find(a => a.id === id);
      closeMenu();
      if(action && typeof action.fn === 'function'){
        try{ action.fn(); } catch(err){ console.error('[flux-ctx]', err); }
      }
    });

    // Position within viewport
    const r = m.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let px = x, py = y;
    if(px + r.width + 8 > vw) px = vw - r.width - 8;
    if(py + r.height + 8 > vh) py = vh - r.height - 8;
    if(px < 8) px = 8;
    if(py < 8) py = 8;
    m.style.left = px + 'px';
    m.style.top  = py + 'px';

    // Entry animation via class
    requestAnimationFrame(()=>m.classList.add('flux-ctx-open'));

    document.addEventListener('keydown', onKey, true);
  }

  // Global listeners — click outside / scroll to close
  document.addEventListener('click', (e) => {
    const m = document.getElementById('fluxTaskCtxMenu');
    if(m && !m.contains(e.target)) closeMenu();
  }, true);
  window.addEventListener('scroll', closeMenu, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);

  // Context menu handler attached via delegation
  document.addEventListener('contextmenu', (e) => {
    if(isMobile()) return; // skip on touch devices
    const row = e.target.closest('.task-item[data-task-id]');
    if(!row) return;
    const tid = parseInt(row.dataset.taskId, 10);
    if(!Number.isFinite(tid)) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY, tid);
  });

  try{ window.fluxCloseTaskCtx = closeMenu; }catch(e){}
})();
