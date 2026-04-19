/* ════════════════════════════════════════════════════════════════
   FLUX PRO — Premium feature layer (JS)
   Features: focus mode (F), achievements, year heatmap,
   cursor spotlight, pinned task, skeleton loaders, progress rings,
   view transitions, right-click ctx menu, arrow-key nav, density,
   daily reflection, pomodoro auto-link, celebration confetti.
   ════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

// Wait for app to be ready
function whenReady(fn){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',fn,{once:true});
  } else fn();
}

// ────────────────────────────────────────────────────────────────
// Cursor spotlight (subtle radial follow)
// ────────────────────────────────────────────────────────────────
function initCursorSpotlight(){
  const noHover = window.matchMedia('(hover: none)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tooSmall = window.innerWidth < 769;
  const stored = localStorage.getItem('flux_cursor_spotlight');
  const on = stored === null ? true : stored === '1';
  if(noHover || tooSmall || reducedMotion){
    document.body.dataset.fluxCursor = 'off';
  } else {
    document.body.dataset.fluxCursor = on ? 'on' : 'off';
  }
  // Always attach mousemove (cheap; it's gated by the data-attr in CSS)
  if(noHover || reducedMotion) return;
  let raf = null;
  document.addEventListener('mousemove', e=>{
    if(raf) return;
    raf = requestAnimationFrame(()=>{
      document.documentElement.style.setProperty('--flux-cursor-x', e.clientX+'px');
      document.documentElement.style.setProperty('--flux-cursor-y', e.clientY+'px');
      raf = null;
    });
  }, {passive:true});
}

function initMeshBackground(){
  const stored = localStorage.getItem('flux_mesh_bg');
  const on = stored === null ? true : stored === '1';
  document.body.dataset.fluxMesh = on ? 'on' : 'off';
}

// ────────────────────────────────────────────────────────────────
// Magnetic button effect (button follows cursor slightly)
// ────────────────────────────────────────────────────────────────
function applyMagneticButtons(){
  if(window.matchMedia('(hover: none)').matches) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('mousemove', e=>{
    const t = e.target;
    if(!(t instanceof Element)) return;
    const btn = t.closest('.topbar-new-task-btn');
    if(btn){
      const r = btn.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * 100;
      const my = ((e.clientY - r.top) / r.height) * 100;
      btn.style.setProperty('--mx', mx+'%');
      btn.style.setProperty('--my', my+'%');
    }
  }, {passive:true});
}

// ────────────────────────────────────────────────────────────────
// Achievement system
// ────────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  {id:'first_task',  icon:'✦', kicker:'STARTED',     title:'Welcome to Flux',         desc:'You created your first task.', test:s=>s.totalCreated>=1},
  {id:'first_done',  icon:'✓', kicker:'FIRST WIN',   title:'First task complete',     desc:'One down. Many more to go.',   test:s=>s.totalDone>=1},
  {id:'ten_done',    icon:'⚡', kicker:'WARMING UP',  title:'Ten down',                desc:'10 tasks completed.',          test:s=>s.totalDone>=10},
  {id:'fifty_done',  icon:'🔥', kicker:'IN THE ZONE', title:'Half-century',            desc:'50 tasks completed.',          test:s=>s.totalDone>=50},
  {id:'hundred_done',icon:'★', kicker:'CENTURION',   title:'100 tasks done',          desc:'You are unstoppable.',          test:s=>s.totalDone>=100},
  {id:'streak_3',    icon:'◈', kicker:'CONSISTENT',  title:'3-day streak',            desc:'Three days in a row.',          test:s=>s.streak>=3},
  {id:'streak_7',    icon:'✧', kicker:'WEEK STRONG', title:'7-day streak',            desc:'A full week of momentum.',      test:s=>s.streak>=7},
  {id:'streak_30',   icon:'◆', kicker:'UNSTOPPABLE', title:'30-day streak',           desc:'A month of disciplined focus.', test:s=>s.streak>=30},
  {id:'all_done',    icon:'✓', kicker:'INBOX ZERO',  title:'Inbox zero',              desc:'No undone tasks. Beautiful.',   test:s=>s.totalCreated>=5 && s.undone===0},
  {id:'perfect_day', icon:'☀', kicker:'PERFECT DAY', title:'Perfect day',             desc:'Finished every task due today.',test:s=>s.todayDone>=3 && s.todayUndone===0},
  {id:'night_owl',   icon:'🌙', kicker:'NIGHT OWL',   title:'Night owl',               desc:'Crushed a task after midnight.', test:s=>s.lateNight===true},
  {id:'early_bird',  icon:'🌅', kicker:'EARLY BIRD',  title:'Early bird',              desc:'Knocked out a task before 7am.',test:s=>s.earlyBird===true},
  {id:'focus_60',    icon:'⏱', kicker:'DEEP FOCUS',  title:'60 minutes of focus',     desc:'A full Pomodoro session done.', test:s=>s.totalFocusMin>=60},
  {id:'focus_300',   icon:'⌛', kicker:'MASTER',      title:'5 hours of focus',        desc:'Cumulative deep work milestone.',test:s=>s.totalFocusMin>=300},
  {id:'ai_friend',   icon:'✦', kicker:'AI USER',     title:'AI conversation',         desc:'You chatted with Flux AI.',     test:s=>s.aiMessages>=5},
  {id:'grade_track', icon:'📊', kicker:'TRACKER',     title:'Grade tracker',           desc:'You logged your first grade.',  test:s=>s.gradeCount>=1},
];

function getAchievementStats(){
  const tasks = (window.tasks)||[];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0,10);
  const todayTasks = tasks.filter(t=>t.date===todayStr || t.due===todayStr);
  const stats = {
    totalCreated: tasks.length,
    totalDone:    tasks.filter(t=>t.done).length,
    undone:       tasks.filter(t=>!t.done).length,
    todayDone:    todayTasks.filter(t=>t.done).length,
    todayUndone:  todayTasks.filter(t=>!t.done).length,
    streak:       parseInt(localStorage.getItem('flux_streak_count')||'0',10) || 0,
    totalFocusMin:parseInt(localStorage.getItem('flux_total_focus_min')||'0',10) || 0,
    aiMessages:   parseInt(localStorage.getItem('flux_ai_msg_count')||'0',10) || 0,
    gradeCount:   Object.keys((window.grades)||{}).length,
    lateNight:    localStorage.getItem('flux_milestone_late_night')==='1',
    earlyBird:    localStorage.getItem('flux_milestone_early_bird')==='1',
  };
  return stats;
}

function getEarnedAchievements(){
  try{ return JSON.parse(localStorage.getItem('flux_achievements_earned')||'[]'); }
  catch(e){ return []; }
}
function saveEarnedAchievements(arr){
  try{ localStorage.setItem('flux_achievements_earned', JSON.stringify(arr)); }catch(e){}
}

let _achievementQueue = [];
let _achievementShowing = false;
function showAchievement(a){
  _achievementQueue.push(a);
  if(_achievementShowing) return;
  _showNextAchievement();
}
function _showNextAchievement(){
  if(_achievementQueue.length===0){ _achievementShowing=false; return; }
  _achievementShowing = true;
  const a = _achievementQueue.shift();
  const el = document.createElement('div');
  el.className = 'flux-achievement';
  el.setAttribute('role','status');
  el.innerHTML = `
    <div class="flux-achievement-icon">${a.icon}</div>
    <div class="flux-achievement-content">
      <div class="flux-achievement-kicker">${a.kicker}</div>
      <div class="flux-achievement-title">${a.title}</div>
      <div class="flux-achievement-desc">${a.desc}</div>
    </div>`;
  el.addEventListener('click', ()=>dismiss());
  document.body.appendChild(el);
  // Audio cue
  try{ playAchievementSound(); }catch(e){}
  let dismissed = false;
  function dismiss(){
    if(dismissed) return;
    dismissed = true;
    el.classList.add('leaving');
    setTimeout(()=>{ el.remove(); _showNextAchievement(); }, 350);
  }
  setTimeout(dismiss, 4500);
}

function checkAchievements(){
  const stats = getAchievementStats();
  const earned = new Set(getEarnedAchievements());
  let changed = false;
  // First-ever check: silently absorb anything already true so users don't get a popup avalanche
  const isFirstCheck = localStorage.getItem('flux_achievements_seeded') !== '1';
  for(const a of ACHIEVEMENTS){
    if(earned.has(a.id)) continue;
    try{
      if(a.test(stats)){
        earned.add(a.id);
        changed = true;
        if(!isFirstCheck) showAchievement(a);
      }
    }catch(e){}
  }
  if(changed) saveEarnedAchievements([...earned]);
  if(isFirstCheck) localStorage.setItem('flux_achievements_seeded','1');
}

function playAchievementSound(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i)=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i*0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i*0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i*0.08 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i*0.08);
      osc.stop(now + i*0.08 + 0.45);
    });
    setTimeout(()=>ctx.close(), 1000);
  }catch(e){}
}

// ────────────────────────────────────────────────────────────────
// Focus mode (zen single-task view)
// ────────────────────────────────────────────────────────────────
function setupFocusBar(){
  if(document.getElementById('fluxFocusBar')) return;
  const bar = document.createElement('div');
  bar.id = 'fluxFocusBar';
  bar.innerHTML = `
    <span class="ffx-dot"></span>
    <span>FOCUS MODE</span>
    <button onclick="window.fluxToggleFocusMode()" class="ffx-exit" title="Exit focus mode (F or Esc)">Exit ✕</button>`;
  document.body.appendChild(bar);
}
function _toast(msg, kind){
  if(typeof window.showToast === 'function') return window.showToast(msg, kind||'info');
  if(typeof window.toast === 'function') return window.toast(msg);
}
function toggleFocusMode(){
  setupFocusBar();
  const on = document.body.dataset.fluxFocusMode === 'on';
  if(on){
    document.body.dataset.fluxFocusMode = 'off';
    _toast('Focus mode off');
  } else {
    document.body.dataset.fluxFocusMode = 'on';
    if(typeof window.nav === 'function') try{ window.nav('dashboard'); }catch(e){}
    _toast('Focus mode on — F or Esc to exit','success');
  }
}
window.fluxToggleFocusMode = toggleFocusMode;

// ────────────────────────────────────────────────────────────────
// Year contribution heatmap
// ────────────────────────────────────────────────────────────────
function getDateStr(d){ const x=new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10); }

function buildYearHeatmap(){
  const tasks = (window.tasks)||[];
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today); start.setDate(start.getDate() - 364);
  while(start.getDay() !== 0){ start.setDate(start.getDate() - 1); }
  const counts = {};
  for(const t of tasks){
    if(!t.done || !t.completedAt) continue;
    const d = getDateStr(new Date(t.completedAt));
    counts[d] = (counts[d]||0) + 1;
  }
  const cells = [];
  const cur = new Date(start);
  let total = 0, max = 0;
  while(cur <= today){
    const ds = getDateStr(cur);
    const c = counts[ds] || 0;
    total += c;
    if(c > max) max = c;
    let lvl = 0;
    if(c >= 8) lvl = 4;
    else if(c >= 5) lvl = 3;
    else if(c >= 2) lvl = 2;
    else if(c >= 1) lvl = 1;
    cells.push({date: ds, count: c, level: lvl, isToday: ds === getDateStr(today)});
    cur.setDate(cur.getDate() + 1);
  }
  const cellsHtml = cells.map(c=>{
    const ttl = c.count === 0 ? `No tasks completed on ${c.date}` :
               (c.count === 1 ? `1 task on ${c.date}` : `${c.count} tasks on ${c.date}`);
    return `<div class="flux-yh-cell${c.isToday ? ' today' : ''}" data-l="${c.level}" title="${ttl}"></div>`;
  }).join('');
  const activeDays = cells.filter(c=>c.count>0).length;
  return `
    <div class="flux-year-heatmap card" id="fluxYearHeatmap">
      <div class="flux-year-heatmap-head">
        <div class="flux-year-heatmap-title">Year in tasks</div>
        <div class="flux-year-heatmap-stats">${total} done · ${activeDays} active days</div>
      </div>
      <div class="flux-year-heatmap-grid">${cellsHtml}</div>
      <div class="flux-year-heatmap-legend">
        <span>Less</span>
        <div class="flux-yh-cell" data-l="0"></div>
        <div class="flux-yh-cell" data-l="1"></div>
        <div class="flux-yh-cell" data-l="2"></div>
        <div class="flux-yh-cell" data-l="3"></div>
        <div class="flux-yh-cell" data-l="4"></div>
        <span>More</span>
      </div>
    </div>`;
}

function injectYearHeatmap(){
  const stats = document.getElementById('stats');
  if(!stats) return;
  let host = document.getElementById('fluxYearHeatmapHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'fluxYearHeatmapHost';
    host.style.marginTop = '18px';
    stats.insertBefore(host, stats.firstChild);
  }
  host.innerHTML = buildYearHeatmap();
}

// ────────────────────────────────────────────────────────────────
// Pinned task on dashboard
// ────────────────────────────────────────────────────────────────
function getPinnedTaskId(){ return localStorage.getItem('flux_pinned_task') || ''; }
function setPinnedTaskId(id){
  if(id) localStorage.setItem('flux_pinned_task', id);
  else localStorage.removeItem('flux_pinned_task');
}
window.fluxPinTask = function(id){
  const cur = getPinnedTaskId();
  if(cur === String(id)){
    setPinnedTaskId('');
    _toast('Unpinned');
  } else {
    setPinnedTaskId(String(id));
    _toast('Pinned to dashboard','success');
  }
  renderPinnedTask();
};
window.fluxUnpinTask = function(){
  setPinnedTaskId('');
  renderPinnedTask();
  _toast('Unpinned');
};

function renderPinnedTask(){
  const dash = document.getElementById('dashboard');
  if(!dash) return;
  let host = document.getElementById('fluxPinnedTaskHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'fluxPinnedTaskHost';
    const greet = dash.querySelector('.dash-v2-greet');
    if(greet && greet.parentNode === dash){
      greet.insertAdjacentElement('afterend', host);
    } else {
      dash.insertBefore(host, dash.firstChild);
    }
  }
  const pinId = getPinnedTaskId();
  if(!pinId){ host.innerHTML = ''; return; }
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id) === pinId);
  if(!t){ host.innerHTML = ''; return; }
  const subj = t.subject || '—';
  const dueDate = t.date || t.due;
  const dueLabel = dueDate ? new Date(dueDate+'T00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}) : 'no date';
  const minLabel = (t.estTime || t.estMin) ? `~${t.estTime||t.estMin}m` : '';
  const doneCls = t.done ? ' style="text-decoration:line-through;opacity:.55"' : '';
  host.innerHTML = `
    <div class="flux-pinned-task">
      <div class="flux-pin-icon">📌</div>
      <div class="flux-pin-body">
        <div class="flux-pin-kicker">PINNED</div>
        <div class="flux-pin-name"${doneCls}>${escapeHtml(t.name||t.text||'Task')}</div>
        <div class="flux-pin-meta">${escapeHtml(subj)} · ${dueLabel}${minLabel?' · '+minLabel:''}</div>
      </div>
      <div class="flux-pin-actions">
        ${t.done ? '' : `<button class="flux-pin-btn" onclick="window.fluxCompletePinnedTask()" title="Mark complete">✓ Done</button>`}
        <button class="flux-pin-btn" onclick="window.fluxOpenPinnedTask()" title="Open task">Open</button>
        <button class="flux-pin-btn unpin" onclick="window.fluxUnpinTask()" title="Unpin">×</button>
      </div>
    </div>`;
}
window.fluxCompletePinnedTask = function(){
  const id = getPinnedTaskId();
  if(!id) return;
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id)===String(id));
  if(!t) return;
  if(typeof window.toggleTask === 'function') window.toggleTask(t.id);
  renderPinnedTask();
};
window.fluxOpenPinnedTask = function(){
  const id = getPinnedTaskId();
  if(!id) return;
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id)===String(id));
  if(!t) return;
  if(typeof window.openEdit === 'function') window.openEdit(t.id);
};

function escapeHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ────────────────────────────────────────────────────────────────
// Right-click context menu for tasks
// ────────────────────────────────────────────────────────────────
let _ctxMenuEl = null;
function closeCtxMenu(){ if(_ctxMenuEl){ _ctxMenuEl.remove(); _ctxMenuEl = null; } }
function openCtxMenu(x, y, items){
  closeCtxMenu();
  const el = document.createElement('div');
  el.className = 'flux-ctx-menu';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.innerHTML = items.map(it=>{
    if(it === 'sep') return '<div class="flux-ctx-divider"></div>';
    const cls = it.danger ? ' danger' : '';
    return `<div class="flux-ctx-item${cls}" data-act="${it.id}">
      <span class="flux-ctx-icon">${it.icon||''}</span>
      <span>${it.label}</span>
      ${it.shortcut?`<span class="flux-ctx-shortcut">${it.shortcut}</span>`:''}
    </div>`;
  }).join('');
  el.addEventListener('click', e=>{
    const item = e.target.closest('[data-act]');
    if(item){
      const id = item.dataset.act;
      const found = items.find(x=>x.id === id);
      if(found && found.action) found.action();
      closeCtxMenu();
    }
  });
  document.body.appendChild(el);
  _ctxMenuEl = el;
  // Keep within viewport
  const r = el.getBoundingClientRect();
  if(r.right > window.innerWidth - 8) el.style.left = (window.innerWidth - r.width - 8) + 'px';
  if(r.bottom > window.innerHeight - 8) el.style.top = (window.innerHeight - r.height - 8) + 'px';
}
document.addEventListener('click', e=>{ if(_ctxMenuEl && !_ctxMenuEl.contains(e.target)) closeCtxMenu(); });
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && _ctxMenuEl) closeCtxMenu(); });
document.addEventListener('scroll', ()=>closeCtxMenu(), true);

document.addEventListener('contextmenu', e=>{
  const taskItem = e.target.closest('.task-item, [data-task-id]');
  if(!taskItem) return;
  const rawTid = taskItem.dataset.taskId || (taskItem.id||'').replace(/^task-/, '');
  if(!rawTid) return;
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id) === String(rawTid));
  if(!t) return;
  const realId = t.id;
  e.preventDefault();
  const isPinned = getPinnedTaskId() === String(realId);
  openCtxMenu(e.clientX, e.clientY, [
    {id:'done', icon:t.done?'↺':'✓', label:t.done?'Mark undone':'Mark done', shortcut:'Space',
      action:()=>{ if(typeof window.toggleTask==='function') window.toggleTask(realId); }},
    {id:'edit', icon:'✎', label:'Edit task', shortcut:'E',
      action:()=>{ if(typeof window.openEdit==='function') window.openEdit(realId); }},
    {id:'pin',  icon:isPinned?'📍':'📌', label:isPinned?'Unpin from dashboard':'Pin to dashboard',
      action:()=>{ window.fluxPinTask(realId); }},
    {id:'today',icon:'📅', label:'Due today',
      action:()=>{ window.fluxSetTaskDate && window.fluxSetTaskDate(realId, new Date().toISOString().slice(0,10)); }},
    {id:'tomorrow',icon:'🌅', label:'Due tomorrow',
      action:()=>{ const d=new Date(); d.setDate(d.getDate()+1); window.fluxSetTaskDate && window.fluxSetTaskDate(realId, d.toISOString().slice(0,10)); }},
    'sep',
    {id:'ai',   icon:'✦', label:'Ask AI about this',
      action:()=>{ window.fluxAskAIAbout && window.fluxAskAIAbout(realId); }},
    {id:'duplicate', icon:'❏', label:'Duplicate task',
      action:()=>{ window.fluxDuplicateTask && window.fluxDuplicateTask(realId); }},
    'sep',
    {id:'del', icon:'🗑', label:'Delete task', danger:true, shortcut:'⌫',
      action:()=>{ if(confirm('Delete this task?') && typeof window.deleteTask==='function') window.deleteTask(realId); }},
  ]);
}, true);

window.fluxSetTaskDate = function(id, dateStr){
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id)===String(id));
  if(!t) return;
  t.date = dateStr;
  if(typeof window.save === 'function') window.save('tasks', tasks);
  if(typeof window.renderTasks === 'function') window.renderTasks();
  if(typeof window.showToast === 'function') window.showToast('Date updated','success');
  else if(typeof window.toast === 'function') window.toast('Date updated');
};

window.fluxDuplicateTask = function(id){
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id)===String(id));
  if(!t) return;
  const copy = JSON.parse(JSON.stringify(t));
  copy.id = Date.now() + Math.floor(Math.random()*1000);
  copy.done = false;
  delete copy.completedAt;
  copy.name = (copy.name||copy.text||'Task') + ' (copy)';
  if(copy.text) copy.text = copy.name;
  tasks.push(copy);
  if(typeof window.save === 'function') window.save('tasks', tasks);
  if(typeof window.renderTasks === 'function') window.renderTasks();
  if(typeof window.showToast === 'function') window.showToast('Duplicated','success');
  else if(typeof window.toast === 'function') window.toast('Duplicated');
};

window.fluxAskAIAbout = function(id){
  const tasks = (window.tasks)||[];
  const t = tasks.find(x=>String(x.id)===String(id));
  if(!t) return;
  if(typeof window.nav === 'function') try{ window.nav('ai'); }catch(e){}
  setTimeout(()=>{
    const input = document.getElementById('fluxAIInput') || document.getElementById('aiInput');
    if(input){
      const subj = t.subject ? ` (${t.subject})` : '';
      input.value = `Help me with my task: "${t.name||t.text}"${subj}. Suggest a good approach and time breakdown.`;
      input.focus();
    }
  }, 280);
};

// ────────────────────────────────────────────────────────────────
// Arrow-key task navigation
// ────────────────────────────────────────────────────────────────
let _kbdFocusIndex = -1;
function getNavigableTasks(){
  return Array.from(document.querySelectorAll('.task-item, [data-task-id]'))
    .filter(el => el.offsetParent !== null);
}
function clearKbdFocus(){
  document.querySelectorAll('.task-item.flux-kbd-focus').forEach(el=>el.classList.remove('flux-kbd-focus'));
}
function setKbdFocus(idx){
  const list = getNavigableTasks();
  if(list.length === 0){ _kbdFocusIndex = -1; return; }
  _kbdFocusIndex = Math.max(0, Math.min(list.length - 1, idx));
  clearKbdFocus();
  const el = list[_kbdFocusIndex];
  el.classList.add('flux-kbd-focus');
  el.scrollIntoView({block:'nearest', behavior:'smooth'});
}
document.addEventListener('keydown', e=>{
  // Bail on inputs / modals
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName||'').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
  if(document.querySelector('.modal.show, .modal[style*="display: flex"], #commandPalette[style*="display: flex"]')) return;

  if(e.key === 'ArrowDown' || e.key === 'j'){
    const list = getNavigableTasks();
    if(list.length === 0) return;
    e.preventDefault();
    setKbdFocus(_kbdFocusIndex < 0 ? 0 : _kbdFocusIndex + 1);
  } else if(e.key === 'ArrowUp' || e.key === 'k'){
    const list = getNavigableTasks();
    if(list.length === 0) return;
    e.preventDefault();
    setKbdFocus(_kbdFocusIndex < 0 ? 0 : _kbdFocusIndex - 1);
  } else if(_kbdFocusIndex >= 0){
    const list = getNavigableTasks();
    const el = list[_kbdFocusIndex];
    if(!el) return;
    const rawTid = el.dataset.taskId || (el.id||'').replace(/^task-/,'');
    if(!rawTid) return;
    const tasks = (window.tasks)||[];
    const t = tasks.find(x=>String(x.id)===String(rawTid));
    if(!t) return;
    const realId = t.id;
    if(e.key === ' ' || e.key === 'Enter'){
      e.preventDefault();
      if(typeof window.toggleTask === 'function') window.toggleTask(realId);
    } else if(e.key === 'e' || e.key === 'E'){
      e.preventDefault();
      if(typeof window.openEdit === 'function') window.openEdit(realId);
    } else if(e.key === 'Backspace' || e.key === 'Delete'){
      e.preventDefault();
      if(confirm('Delete this task?') && typeof window.deleteTask === 'function') window.deleteTask(realId);
    } else if(e.key === 'p' || e.key === 'P'){
      e.preventDefault();
      window.fluxPinTask(realId);
    }
  }
}, true);

// ────────────────────────────────────────────────────────────────
// Density toggle
// ────────────────────────────────────────────────────────────────
function applyDensity(){
  const d = localStorage.getItem('flux_density') || 'normal';
  if(d === 'normal') document.body.removeAttribute('data-flux-density');
  else document.body.dataset.fluxDensity = d;
}
window.fluxToggleDensity = function(){
  const cur = localStorage.getItem('flux_density') || 'normal';
  const next = cur === 'normal' ? 'compact' : (cur === 'compact' ? 'comfy' : 'normal');
  localStorage.setItem('flux_density', next);
  applyDensity();
  refreshDensityButtons();
  _toast(`Density: ${next}`,'info');
};
window.fluxSetDensity = function(mode){
  if(!['normal','compact','comfy'].includes(mode)) mode = 'normal';
  localStorage.setItem('flux_density', mode);
  applyDensity();
  refreshDensityButtons();
  _toast(`Density: ${mode}`,'info');
};
function refreshDensityButtons(){
  const cur = localStorage.getItem('flux_density') || 'normal';
  document.querySelectorAll('[data-density]').forEach(b=>{
    if(b.dataset.density === cur){
      b.style.background = 'rgba(var(--accent-rgb),.18)';
      b.style.borderColor = 'rgba(var(--accent-rgb),.4)';
      b.style.color = 'var(--accent)';
    } else {
      b.style.background = '';
      b.style.borderColor = '';
      b.style.color = '';
    }
  });
}

// ────────────────────────────────────────────────────────────────
// Smooth view transitions between tabs
// ────────────────────────────────────────────────────────────────
function wrapNavForTransitions(){
  // Existing panel animation in styles.css is already great; skip to avoid double-animations.
  return;
}

// ────────────────────────────────────────────────────────────────
// Better task completion celebration
// ────────────────────────────────────────────────────────────────
function celebrateCompletion(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Light sparkle overlay
  const messages = ['✓','✦','★','◈','✧','◆'];
  const msg = messages[Math.floor(Math.random()*messages.length)];
  const overlay = document.createElement('div');
  overlay.className = 'flux-celebrate-overlay';
  overlay.textContent = msg;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('show'));
  setTimeout(()=>overlay.remove(), 1000);
  // Also play a subtle chime
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i)=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i*0.05);
      gain.gain.exponentialRampToValueAtTime(0.05, now + i*0.05 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i*0.05 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i*0.05);
      osc.stop(now + i*0.05 + 0.35);
    });
    setTimeout(()=>ctx.close(), 700);
  }catch(e){}
}

function hookTaskCompletion(){
  if(typeof window.toggleTask !== 'function') return;
  if(window.__flux_toggle_wrapped) return;
  window.__flux_toggle_wrapped = true;
  const orig = window.toggleTask;
  window.toggleTask = function(id){
    const tasks = window.tasks || [];
    const t = tasks.find(x=>String(x.id)===String(id));
    const wasUndone = t && !t.done;
    const result = orig.apply(this, arguments);
    if(wasUndone){
      celebrateCompletion();
      // Mark milestones
      const h = new Date().getHours();
      if(h >= 0 && h < 5) localStorage.setItem('flux_milestone_late_night','1');
      if(h >= 5 && h < 7) localStorage.setItem('flux_milestone_early_bird','1');
      // Re-check after a moment
      setTimeout(checkAchievements, 400);
      setTimeout(renderPinnedTask, 200);
    }
    return result;
  };
}

// ────────────────────────────────────────────────────────────────
// Daily reflection prompt (after 9pm, once per day)
// ────────────────────────────────────────────────────────────────
function maybeShowReflectionPrompt(){
  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const lastShown = localStorage.getItem('flux_reflect_last_shown');
  if(lastShown === todayStr) return;
  if(now.getHours() < 21) return;
  const tasks = (window.tasks)||[];
  const todayTasks = tasks.filter(t=>t.due===todayStr);
  if(todayTasks.length === 0) return;
  const dash = document.getElementById('dashboard');
  if(!dash || dash.style.display === 'none') return;
  let host = document.getElementById('fluxReflectHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'fluxReflectHost';
    const insertBefore = dash.querySelector('.dash-v2-greet');
    if(insertBefore) insertBefore.insertAdjacentElement('afterend', host);
    else dash.insertBefore(host, dash.firstChild);
  }
  const done = todayTasks.filter(t=>t.done).length;
  const total = todayTasks.length;
  host.innerHTML = `
    <div class="flux-reflect-banner" id="fluxReflectBanner">
      <div class="flux-reflect-icon">🌙</div>
      <div class="flux-reflect-body">
        <div class="flux-reflect-title">How was today?</div>
        <div class="flux-reflect-sub">${done} of ${total} planned tasks done. Take a minute to reflect with Flux AI.</div>
      </div>
      <button onclick="window.fluxStartReflection()">Reflect</button>
      <button class="flux-reflect-x" onclick="window.fluxDismissReflection()">×</button>
    </div>`;
}
window.fluxStartReflection = function(){
  const todayStr = new Date().toISOString().slice(0,10);
  localStorage.setItem('flux_reflect_last_shown', todayStr);
  document.getElementById('fluxReflectBanner')?.remove();
  if(typeof window.nav === 'function') try{ window.nav('flux-ai'); }catch(e){}
  setTimeout(()=>{
    const input = document.getElementById('fluxAIInput') || document.getElementById('aiInput');
    if(input){
      input.value = "Help me reflect on today. What went well? What did I struggle with? What should I prioritize tomorrow?";
      input.focus();
    }
  }, 280);
};
window.fluxDismissReflection = function(){
  localStorage.setItem('flux_reflect_last_shown', new Date().toISOString().slice(0,10));
  document.getElementById('fluxReflectBanner')?.remove();
};

// ────────────────────────────────────────────────────────────────
// Pomodoro auto-link to last active task
// ────────────────────────────────────────────────────────────────
function trackLastActiveTask(){
  document.addEventListener('click', e=>{
    const t = e.target.closest('.task-item, [data-task-id]');
    if(!t) return;
    const tid = t.dataset.taskId || (t.id||'').replace(/^task-/,'');
    if(tid) localStorage.setItem('flux_last_active_task', tid);
  }, true);
}
window.fluxGetLastActiveTask = function(){
  const id = localStorage.getItem('flux_last_active_task');
  if(!id) return null;
  const tasks = (window.tasks)||[];
  return tasks.find(t=>String(t.id)===id) || null;
};

// ────────────────────────────────────────────────────────────────
// Skeleton loader helper (for AI responses)
// ────────────────────────────────────────────────────────────────
window.fluxSkeleton = function(lines = 3){
  const arr = [];
  for(let i=0; i<lines; i++){
    const w = ['','medium','short'][i % 3];
    arr.push(`<div class="flux-skel flux-skel-line ${w}"></div>`);
  }
  return `<div class="flux-skel-block">${arr.join('')}</div>`;
};

// ────────────────────────────────────────────────────────────────
// Visibility: render pinned task and reflection on dashboard renders
// ────────────────────────────────────────────────────────────────
function hookDashboardRender(){
  if(typeof window.renderTasks !== 'function') return;
  if(window.__flux_render_wrapped) return;
  window.__flux_render_wrapped = true;
  const orig = window.renderTasks;
  window.renderTasks = function(){
    const result = orig.apply(this, arguments);
    setTimeout(()=>{
      renderPinnedTask();
      renderDailyProgressRing();
      maybeShowReflectionPrompt();
    }, 50);
    return result;
  };
}

function hookStatsRender(){
  if(typeof window.renderStats !== 'function') return;
  if(window.__flux_stats_wrapped) return;
  window.__flux_stats_wrapped = true;
  const orig = window.renderStats;
  window.renderStats = function(){
    const result = orig.apply(this, arguments);
    setTimeout(injectYearHeatmap, 50);
    return result;
  };
}

// ────────────────────────────────────────────────────────────────
// Add keyboard shortcuts: F (focus mode), D (density)
// ────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e=>{
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName||'').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
  if(document.querySelector('.modal.show, .modal[style*="display: flex"]')) return;
  if(e.key === 'f' || e.key === 'F'){ e.preventDefault(); toggleFocusMode(); }
  else if(e.key === 'Escape' && document.body.dataset.fluxFocusMode === 'on'){ e.preventDefault(); toggleFocusMode(); }
  else if(e.key === '+' || (e.key === '=' && e.shiftKey)){ e.preventDefault(); window.fluxOpenQuickAdd(); }
}, true);

// ────────────────────────────────────────────────────────────────
// Daily progress ring widget on dashboard
// ────────────────────────────────────────────────────────────────
function renderDailyProgressRing(){
  const dash = document.getElementById('dashboard');
  if(!dash) return;
  const tasks = (window.tasks)||[];
  const todayStr = new Date().toISOString().slice(0,10);
  const todayTasks = tasks.filter(t=>t.date===todayStr || t.due===todayStr);
  if(todayTasks.length === 0){
    document.getElementById('fluxDailyRingHost')?.remove();
    return;
  }
  const done = todayTasks.filter(t=>t.done).length;
  const total = todayTasks.length;
  const pct = total === 0 ? 0 : Math.round(done/total * 100);
  const r = 28;
  const C = 2 * Math.PI * r;
  const offset = C - (C * pct/100);

  // Streak (simple: number of consecutive days with at least 1 done task)
  const streak = computeStreak();

  let host = document.getElementById('fluxDailyRingHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'fluxDailyRingHost';
    host.style.cssText = 'display:flex;gap:12px;align-items:stretch;margin-bottom:14px;flex-wrap:wrap';
    const pinHost = document.getElementById('fluxPinnedTaskHost');
    if(pinHost) pinHost.insertAdjacentElement('afterend', host);
    else {
      const greet = dash.querySelector('.dash-v2-greet');
      if(greet) greet.insertAdjacentElement('afterend', host);
      else dash.insertBefore(host, dash.firstChild);
    }
  }

  host.innerHTML = `
    <div class="card flux-daily-ring-card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;flex:1;min-width:200px">
      <div class="flux-prog-ring" style="width:64px;height:64px">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle class="ring-bg" cx="32" cy="32" r="${r}" stroke-width="6"/>
          <circle class="ring-fg" cx="32" cy="32" r="${r}" stroke-width="6"
            stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
        </svg>
        <div class="flux-prog-ring-label">
          <div class="flux-prog-ring-num">${pct}%</div>
        </div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);font-weight:700;font-family:'JetBrains Mono',monospace">TODAY</div>
        <div style="font-size:1.05rem;font-weight:800;letter-spacing:-.01em;margin:1px 0 2px">${done} of ${total} ${pct === 100 ? 'done · 🎉' : 'tasks done'}</div>
        <div style="font-size:.7rem;color:var(--muted2)">${pct === 100 ? "Perfect day so far. Keep it up." : (total - done) + ' to go'}</div>
      </div>
    </div>
    <div class="card flux-streak-card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;min-width:160px;flex:0 0 auto">
      <div style="font-size:1.8rem;line-height:1">🔥</div>
      <div style="min-width:0">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold);font-weight:700;font-family:'JetBrains Mono',monospace">STREAK</div>
        <div style="font-size:1.05rem;font-weight:800;letter-spacing:-.01em;margin:1px 0 2px">${streak} ${streak === 1 ? 'day' : 'days'}</div>
        <div style="font-size:.7rem;color:var(--muted2)">${streak === 0 ? 'Complete a task today to start' : 'Keep going'}</div>
      </div>
    </div>
    <div class="card flux-achievements-card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;min-width:180px;flex:0 0 auto;cursor:pointer" onclick="window.fluxOpenAchievements()" title="View achievements">
      <div style="font-size:1.8rem;line-height:1">★</div>
      <div style="min-width:0">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--purple);font-weight:700;font-family:'JetBrains Mono',monospace">BADGES</div>
        <div style="font-size:1.05rem;font-weight:800;letter-spacing:-.01em;margin:1px 0 2px">${getEarnedAchievements().length} <span style="color:var(--muted);font-weight:500;font-size:.85rem">/ ${ACHIEVEMENTS.length}</span></div>
        <div style="font-size:.7rem;color:var(--muted2)">Tap to view all</div>
      </div>
    </div>`;
  try{ localStorage.setItem('flux_streak_count', String(streak)); }catch(e){}
}

function computeStreak(){
  const tasks = (window.tasks)||[];
  const days = new Set();
  for(const t of tasks){
    if(!t.done || !t.completedAt) continue;
    const d = new Date(t.completedAt); d.setHours(0,0,0,0);
    days.add(d.toISOString().slice(0,10));
  }
  if(days.size === 0) return 0;
  let streak = 0;
  const cur = new Date(); cur.setHours(0,0,0,0);
  // If nothing done today, check from yesterday
  if(!days.has(cur.toISOString().slice(0,10))){
    cur.setDate(cur.getDate() - 1);
  }
  while(days.has(cur.toISOString().slice(0,10))){
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// ────────────────────────────────────────────────────────────────
// Achievements viewer modal
// ────────────────────────────────────────────────────────────────
window.fluxOpenAchievements = function(){
  if(document.getElementById('fluxAchievementsModal')) return;
  const earned = new Set(getEarnedAchievements());
  const wrap = document.createElement('div');
  wrap.id = 'fluxAchievementsModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s ease';
  const items = ACHIEVEMENTS.map(a=>{
    const on = earned.has(a.id);
    return `<div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:${on?'rgba(var(--accent-rgb),.08)':'rgba(255,255,255,.02)'};border:1px solid ${on?'rgba(var(--accent-rgb),.28)':'var(--border)'};border-radius:14px;${on?'':'opacity:.55;filter:grayscale(.6)'}">
      <div style="width:46px;height:46px;border-radius:12px;background:${on?'linear-gradient(145deg,var(--accent),var(--purple))':'rgba(255,255,255,.04)'};display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;${on?'box-shadow:0 6px 18px rgba(var(--accent-rgb),.3)':''}">${a.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1.5px;color:${on?'var(--accent)':'var(--muted)'};font-weight:700;font-family:'JetBrains Mono',monospace;margin-bottom:1px">${a.kicker}</div>
        <div style="font-size:.92rem;font-weight:700;margin-bottom:1px">${a.title}</div>
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.4">${a.desc}</div>
      </div>
      <div style="font-size:1.1rem;color:${on?'var(--accent)':'var(--muted)'};flex-shrink:0">${on?'✓':'○'}</div>
    </div>`;
  }).join('');
  wrap.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:22px;padding:22px;max-width:580px;width:100%;max-height:84vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.55);animation:fluxPanelIn .35s var(--ease-cinematic)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
        <div>
          <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:2px;color:var(--accent);font-weight:700;font-family:'JetBrains Mono',monospace">FLUX PLANNER</div>
          <div style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em">Achievements</div>
        </div>
        <button onclick="document.getElementById('fluxAchievementsModal').remove()" style="background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;padding:6px 10px;border-radius:8px" aria-label="Close">✕</button>
      </div>
      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:16px">${earned.size} of ${ACHIEVEMENTS.length} unlocked</div>
      <div style="display:flex;flex-direction:column;gap:8px">${items}</div>
    </div>`;
  wrap.addEventListener('click', e=>{ if(e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
};

// ────────────────────────────────────────────────────────────────
// Quick-add overlay (Press "+" anywhere; not in inputs)
// ────────────────────────────────────────────────────────────────
window.fluxOpenQuickAdd = function(){
  if(document.getElementById('fluxQuickAdd')) return;
  const el = document.createElement('div');
  el.id = 'fluxQuickAdd';
  el.style.cssText = 'position:fixed;inset:0;z-index:9991;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);display:flex;align-items:flex-start;justify-content:center;padding:18vh 20px 20px;animation:fadeIn .15s ease';
  el.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:18px;padding:18px;max-width:540px;width:100%;box-shadow:0 24px 70px rgba(0,0,0,.6);animation:fluxPanelIn .3s var(--ease-cinematic)">
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);font-weight:700;font-family:'JetBrains Mono',monospace;margin-bottom:6px">QUICK ADD</div>
      <input id="fluxQuickAddInput" type="text" placeholder="Add a task… (e.g. 'Chem essay due Friday' or 'Math hw tomorrow')"
        style="width:100%;font-size:1rem;padding:14px 14px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);color:var(--text);box-sizing:border-box;margin:0">
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:space-between">
        <div style="font-size:.7rem;color:var(--muted);line-height:1.4">Hit <kbd style="background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:1px 6px;font-family:'JetBrains Mono',monospace;font-size:.65rem">Enter</kbd> to add · <kbd style="background:var(--card2);border:1px solid var(--border2);border-radius:5px;padding:1px 6px;font-family:'JetBrains Mono',monospace;font-size:.65rem">Esc</kbd> to close</div>
        <button onclick="window.fluxSubmitQuickAdd()" style="padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--purple));color:#fff;font-weight:700;cursor:pointer;font-size:.82rem">Add</button>
      </div>
    </div>`;
  el.addEventListener('click', e=>{ if(e.target === el) el.remove(); });
  document.body.appendChild(el);
  setTimeout(()=>document.getElementById('fluxQuickAddInput')?.focus(), 50);
  const input = document.getElementById('fluxQuickAddInput');
  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); window.fluxSubmitQuickAdd(); }
    if(e.key === 'Escape'){ e.preventDefault(); el.remove(); }
  });
};
window.fluxSubmitQuickAdd = function(){
  const input = document.getElementById('fluxQuickAddInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  // Try to parse "due [day]" or "tomorrow"/"today"
  let date = '';
  const now = new Date();
  const lc = text.toLowerCase();
  if(lc.includes('today')) date = now.toISOString().slice(0,10);
  else if(lc.includes('tomorrow')){ const d=new Date(now); d.setDate(d.getDate()+1); date = d.toISOString().slice(0,10); }
  else {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    for(let i=0;i<7;i++){
      if(lc.includes(days[i])){
        const target = i;
        const cur = now.getDay();
        let diff = target - cur; if(diff <= 0) diff += 7;
        const d = new Date(now); d.setDate(d.getDate()+diff);
        date = d.toISOString().slice(0,10); break;
      }
    }
  }
  let cleanText = text
    .replace(/\bdue\b\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, '')
    .replace(/\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, '')
    .trim();
  if(!cleanText) cleanText = text;
  const newTask = {
    id: Date.now() + Math.random(),
    name: cleanText, text: cleanText,
    date, subject:'', priority:'med', type:'hw', estTime:0, difficulty:3, notes:'',
    subtasks:[], done:false, rescheduled:0, createdAt:Date.now()
  };
  if(typeof window.calcUrgency === 'function'){
    try{ newTask.urgencyScore = window.calcUrgency(newTask); }catch(e){}
  }
  (window.tasks||[]).unshift(newTask);
  if(typeof window.save === 'function') window.save('tasks', window.tasks);
  if(typeof window.renderTasks === 'function') window.renderTasks();
  if(typeof window.renderStats === 'function') window.renderStats();
  if(typeof window.renderCalendar === 'function') window.renderCalendar();
  if(typeof window.syncKey === 'function') try{ window.syncKey('tasks', window.tasks); }catch(e){}
  document.getElementById('fluxQuickAdd')?.remove();
  _toast('Task added','success');
  setTimeout(checkAchievements, 300);
};

// ────────────────────────────────────────────────────────────────
// Settings UI wiring
// ────────────────────────────────────────────────────────────────
function setToggle(el, on){
  if(!el) return;
  el.classList.toggle('on', on);
  el.classList.toggle('active', on);
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}
function wireSettingsToggles(){
  // Cursor spotlight
  const sel1 = document.getElementById('fluxCursorSpotlightToggle');
  if(sel1 && !sel1.__wired){
    sel1.__wired = true;
    const stored = localStorage.getItem('flux_cursor_spotlight');
    const on = stored === null ? true : stored === '1';
    setToggle(sel1, on);
    sel1.addEventListener('click', ()=>{
      const cur = localStorage.getItem('flux_cursor_spotlight');
      const wasOn = cur === null ? true : cur === '1';
      const next = !wasOn;
      localStorage.setItem('flux_cursor_spotlight', next ? '1' : '0');
      document.body.dataset.fluxCursor = next ? 'on' : 'off';
      setToggle(sel1, next);
      _toast('Cursor spotlight ' + (next ? 'on' : 'off'));
    });
  }
  // Mesh background
  const sel2 = document.getElementById('fluxMeshBgToggle');
  if(sel2 && !sel2.__wired){
    sel2.__wired = true;
    const stored = localStorage.getItem('flux_mesh_bg');
    const on = stored === null ? true : stored === '1';
    setToggle(sel2, on);
    sel2.addEventListener('click', ()=>{
      const cur = localStorage.getItem('flux_mesh_bg');
      const wasOn = cur === null ? true : cur === '1';
      const next = !wasOn;
      localStorage.setItem('flux_mesh_bg', next ? '1' : '0');
      document.body.dataset.fluxMesh = next ? 'on' : 'off';
      setToggle(sel2, next);
      _toast('Mesh background ' + (next ? 'on' : 'off'));
    });
  }
  refreshDensityButtons();
}

// ────────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────────
whenReady(()=>{
  initCursorSpotlight();
  initMeshBackground();
  applyMagneticButtons();
  applyDensity();
  trackLastActiveTask();
  // Wait for app.js to expose globals
  function tryHook(){
    if(typeof window.renderTasks === 'function'){
      hookDashboardRender();
      hookStatsRender();
      hookTaskCompletion();
      wrapNavForTransitions();
      setTimeout(()=>{
        checkAchievements();
        renderPinnedTask();
        renderDailyProgressRing();
        maybeShowReflectionPrompt();
        wireSettingsToggles();
      }, 600);
    } else {
      setTimeout(tryHook, 250);
    }
  }
  tryHook();
  // Re-wire settings whenever the settings tab is shown
  document.addEventListener('click', e=>{
    if(e.target.closest('[onclick*="settings"]')) setTimeout(wireSettingsToggles, 220);
  }, true);
});

// Periodic check (in case tasks change)
setInterval(()=>{
  try{ checkAchievements(); maybeShowReflectionPrompt(); }catch(e){}
}, 60000);

})();
