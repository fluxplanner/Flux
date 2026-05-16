/**
 * Flux Task UX — global quick add, sticky focus bar, timer jump, drag-to-date, inline rename.
 */
(function(){
  let _dragTaskId=null;

  window.startTimerFromTask=function(id){
    const t=typeof tasks!=='undefined'&&tasks.find(x=>x.id===id);
    if(!t){if(typeof showToast==='function')showToast('Task not found','error');return;}
    if(typeof nav==='function')nav('timer');
    setTimeout(()=>{
      const sel=document.getElementById('timerSubject');
      if(sel&&t.subject)sel.value=t.subject;
      const cw=document.getElementById('customWork');
      const m=t.estTime?Math.min(90,Math.max(5,Math.round(t.estTime/5)*5)):25;
      if(cw)cw.value=m;
      if(typeof updateTLengths==='function')updateTLengths();
      if(typeof pauseTimer==='function')pauseTimer();
      if(typeof startTimer==='function')startTimer();
      if(typeof showToast==='function')showToast('Timer started for '+t.name,'success');
    },220);
  };

  function updateStickyFocus(){
    const bar=document.getElementById('fluxStickyFocus');
    if(!bar||typeof tasks==='undefined')return;
    const nb=window.FluxIntel&&FluxIntel.pickNextBestTask?FluxIntel.pickNextBestTask():null;
    if(!nb){bar.hidden=true;bar.innerHTML='';return;}
    bar.hidden=false;
    const esc=typeof window.esc==='function'?window.esc:(s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'));
    bar.innerHTML=`<div class="flux-sticky-inner">
      <span class="flux-sticky-kicker">Focus</span>
      <span class="flux-sticky-title">${esc(nb.name)}</span>
      <span class="flux-sticky-actions">
        <button type="button" onclick="startDeepWork(${nb.id})">Deep work</button>
        <button type="button" onclick="startTimerFromTask(${nb.id})">Timer</button>
        <button type="button" onclick="openEdit(${nb.id})">Edit</button>
      </span>
    </div>`;
  }

  function attachTaskRowUX(){
    const list=document.getElementById('taskList');
    if(!list)return;
    list.querySelectorAll('.task-item[data-task-id]').forEach(row=>{
      const id=parseFloat(row.getAttribute('data-task-id'),10);
      row.addEventListener('dragstart',e=>{
        _dragTaskId=id;
        e.dataTransfer.setData('text/plain',String(id));
        e.dataTransfer.effectAllowed='move';
        row.classList.add('task-dragging');
      });
      row.addEventListener('dragend',()=>{
        row.classList.remove('task-dragging');
        _dragTaskId=null;
      });
      const title=row.querySelector('.task-primary-line');
      if(title&&!title.dataset.inlineBound){
        title.dataset.inlineBound='1';
        title.addEventListener('dblclick',ev=>{
          ev.stopPropagation();
          if(row.classList.contains('task-done'))return;
          const t=tasks.find(x=>x.id===id);if(!t)return;
          const inp=document.createElement('input');
          inp.type='text';
          inp.className='flux-inline-task-input';
          inp.value=t.name;
          title.replaceWith(inp);
          inp.focus();inp.select();
          const commit=()=>{
            const v=inp.value.trim();
            if(v&&v!==t.name){t.name=v;if(typeof save==='function')save('tasks',tasks);if(typeof syncKey==='function')syncKey('tasks',tasks);}
            if(typeof renderTasks==='function')renderTasks();
            updateStickyFocus();
          };
          inp.addEventListener('keydown',k=>{if(k.key==='Enter')commit();if(k.key==='Escape'){if(typeof renderTasks==='function')renderTasks();}});
          inp.addEventListener('blur',commit);
        });
      }
    });
  }

  window.fluxCalDragOver=function(e){
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    e.currentTarget.classList.add('cal-day-drag-hover');
  };
  window.fluxCalDragLeave=function(e){
    e.currentTarget.classList.remove('cal-day-drag-hover');
  };
  window.fluxCalDrop=function(e){
    e.preventDefault();
    e.currentTarget.classList.remove('cal-day-drag-hover');
    const id=parseFloat(e.dataTransfer.getData('text/plain')||_dragTaskId,10);
    const ds=e.currentTarget.getAttribute('data-cal-date');
    if(!id||!ds||typeof tasks==='undefined')return;
    const t=tasks.find(x=>x.id===id);
    if(!t)return;
    if(typeof snapshotTasks==='function')snapshotTasks();
    t.date=ds;
    if(typeof calcUrgency==='function')t.urgencyScore=calcUrgency(t);
    if(typeof save==='function')save('tasks',tasks);
    if(typeof syncKey==='function')syncKey('tasks',tasks);
    if(typeof showToast==='function')showToast('Task moved to '+ds,'success');
    if(typeof renderTasks==='function')renderTasks();
    if(typeof renderCalendar==='function')renderCalendar();
  };

  window.fluxAfterRenderTasks=function(){
    attachTaskRowUX();
    updateStickyFocus();
  };

  window.fluxAfterRenderCalendar=function(){
    document.querySelectorAll('.cal-day[data-cal-date]').forEach(cell=>{
      cell.addEventListener('dragover',window.fluxCalDragOver);
      cell.addEventListener('dragleave',window.fluxCalDragLeave);
      cell.addEventListener('drop',window.fluxCalDrop);
    });
  };

  document.addEventListener('DOMContentLoaded',()=>{
    document.body.classList.add('flux-enhanced');
  });
})();
