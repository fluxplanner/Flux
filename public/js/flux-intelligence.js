/**
 * Flux Planner — dashboard intelligence: next-best task, summaries, streak, insights.
 * Depends on globals from app.js: tasks, todayStr, isTaskSnoozed, moodHistory, settings, load
 */
(function(){
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function blocked(t){
    return typeof isBlocked==='function'&&isBlocked(t);
  }
  function pickNextBestTask(){
    if(typeof tasks==='undefined'||!Array.isArray(tasks))return null;
    const energy=parseInt(localStorage.getItem('flux_energy')||'3',10);
    const now=new Date();now.setHours(0,0,0,0);
    let stress=5;
    try{
      const mh=typeof moodHistory!=='undefined'&&moodHistory?.length?moodHistory[moodHistory.length-1]:null;
      if(mh&&mh.stress!=null)stress=parseInt(mh.stress,10);
    }catch(e){}
    const candidates=tasks.filter(t=>!t.done&&(typeof isTaskSnoozed!=='function'||!isTaskSnoozed(t))&&!blocked(t));
    if(!candidates.length)return null;
    const score=t=>{
      let s=(t.urgencyScore||0);
      const due=t.date?new Date(t.date+'T00:00:00'):null;
      const daysPast=due?(now-due)/86400000:0;
      if(daysPast>0)s+=50+Math.min(30,daysPast*3);
      else if(due){
        const daysUntil=Math.max(0,(due-now)/86400000);
        if(daysUntil===0)s+=35;
        s+=20/(1+daysUntil);
      }
      const diff=t.difficulty||3;
      if(energy<=2){if(diff<=2)s+=18;if(diff>=4)s-=12;}
      if(energy>=4){if(['project','essay','lab'].includes(t.type))s+=14;}
      if(stress>=8&&diff<=2)s+=8;
      const p=t.priority==='high'?6:t.priority==='low'?-2:2;
      s+=p;
      if(window.FluxPersonal&&typeof FluxPersonal.dnaFit==='function')s+=FluxPersonal.dnaFit(t)*0.38;
      return s;
    };
    return candidates.sort((a,b)=>score(b)-score(a))[0];
  }

  function recordCompletionStreak(){
    const ts=typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
    const last=localStorage.getItem('flux_task_streak_last');
    let n=parseInt(localStorage.getItem('flux_task_streak_n')||'0',10)||0;
    if(last===ts)return n;
    const y=new Date();y.setDate(y.getDate()-1);
    const ystr=y.toISOString().slice(0,10);
    if(last===ystr)n++;
    else n=1;
    localStorage.setItem('flux_task_streak_last',ts);
    localStorage.setItem('flux_task_streak_n',String(n));
    return n;
  }

  function sessionLogMinsToday(){
    const ts=typeof todayStr==='function'?todayStr():'';
    const log=typeof load==='function'?load('flux_session_log',[]):[];
    return log.filter(e=>e.date===ts).reduce((a,x)=>a+(x.mins||0),0);
  }

  function tasksDoneToday(){
    const ts=typeof todayStr==='function'?todayStr():'';
    return tasks.filter(t=>t.done&&t.completedAt&&new Date(t.completedAt).toISOString().slice(0,10)===ts).length;
  }

  function renderDailySummary(){
    const el=document.getElementById('fluxDailySummary');
    if(!el)return;
    const done=tasksDoneToday();
    const mins=sessionLogMinsToday();
    const insight=done>=5?'Crushing it — keep momentum.':done===0?'Start with one small win.':'Nice progress — stack another win.';
    el.innerHTML=`<div class="flux-dash-card-inner flux-daily-summary">
      <div class="flux-dash-card-kicker">Today</div>
      <div class="flux-daily-stats">
        <div><span class="flux-daily-num">${done}</span><span class="flux-daily-lbl">tasks done</span></div>
        <div><span class="flux-daily-num">${mins}</span><span class="flux-daily-lbl">min focus</span></div>
      </div>
      <p class="flux-daily-insight">${esc(insight)}</p>
      <div class="flux-daily-actions">
        <button type="button" class="btn-sec btn-sm" onclick="FluxIntel.doWhatNow()">What now?</button>
        <button type="button" class="btn-sec btn-sm" onclick="FluxIntel.smartDayDraft()">Smart day tips</button>
      </div>
    </div>`;
  }

  function renderWeeklyInsights(){
    const el=document.getElementById('fluxWeeklyInsights');
    if(!el)return;
    const log=typeof load==='function'?load('flux_session_log',[]):[];
    if(!log.length){el.innerHTML=`<div class="flux-dash-card-inner flux-weekly-insights"><div class="flux-dash-card-kicker">This week</div><p class="flux-muted">Complete focus sessions to see trends.</p></div>`;return;}
    const byDow=[0,0,0,0,0,0,0];
    const bySub={};
    const now=new Date();
    for(let i=0;i<7;i++){
      const d=new Date(now);d.setDate(now.getDate()-i);
      const ds=d.toISOString().slice(0,10);
      log.filter(e=>e.date===ds).forEach(e=>{
        const dow=d.getDay();
        byDow[dow]+=e.mins||0;
        const k=e.subject||'—';
        bySub[k]=(bySub[k]||0)+(e.mins||0);
      });
    }
    let bestDow=0,bestM=0;
    byDow.forEach((m,i)=>{if(m>=bestM){bestM=m;bestDow=i;}});
    const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let topSub='—',topSubM=0;
    Object.entries(bySub).forEach(([k,v])=>{if(v>topSubM){topSubM=v;topSub=k;}});
    el.innerHTML=`<div class="flux-dash-card-inner flux-weekly-insights">
      <div class="flux-dash-card-kicker">This week</div>
      <p class="flux-week-line"><strong>${bestM?names[bestDow]:'—'}</strong> ${bestM?`most productive (${bestM}m focus)`:'— no focus data'}</p>
      <p class="flux-week-line"><strong>${esc(topSub)}</strong> ${topSubM?`most time (${topSubM}m)`:'—'}</p>
    </div>`;
  }

  function dismissAiInsightStrip(){}

  function renderAiInsightStrip(){}

  function renderOverdueBanner(){}

  function rollOverdueForward(){
    if(typeof tasks==='undefined')return;
    const now=new Date();now.setHours(0,0,0,0);
    const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
    const nextStr=tomorrow.toISOString().slice(0,10);
    let n=0;
    tasks.forEach(t=>{
      if(!t.done&&t.date&&new Date(t.date+'T00:00:00')<now){
        t.date=nextStr;
        if(typeof calcUrgency==='function')t.urgencyScore=calcUrgency(t);
        n++;
      }
    });
    if(n&&typeof save==='function')save('tasks',tasks);
    if(typeof syncKey==='function')syncKey('tasks',tasks);
    if(typeof showToast==='function')showToast(`Moved ${n} task(s) to next weekdays`,'success');
    if(typeof renderStats==='function')renderStats();
    if(typeof renderTasks==='function')renderTasks();
    if(typeof renderCalendar==='function')renderCalendar();
  }

  function refreshStreakBadge(){
    const el=document.getElementById('fluxStreakBadge');
    if(!el)return;
    const n=parseInt(localStorage.getItem('flux_task_streak_n')||'0',10)||0;
    if(n<1){el.style.display='none';return;}
    el.style.display='inline-flex';
    el.innerHTML=`<span class="flux-streak-icon" aria-hidden="true">🔥</span><span>${n}-day streak</span>`;
  }

  function appendFocusHtml(baseHtml){
    return baseHtml;
  }

  function doWhatNow(){
    const t=pickNextBestTask();
    if(!t){if(typeof showToast==='function')showToast('Nothing pending — you are clear!','info');return;}
    if(typeof showToast==='function')showToast('Focus: '+t.name,'success');
    if(typeof startDeepWork==='function')startDeepWork(t.id);
  }

  function smartDayDraft(){
    const open=tasks.filter(t=>!t.done&&!t.date).slice(0,5);
    if(!open.length){if(typeof showToast==='function')showToast('No undated tasks to place','info');return;}
    if(typeof showToast==='function')showToast(`Try: ${open.map(t=>t.name).slice(0,3).join(', ')} — add dates in edit`,'info');
  }

  window.FluxIntel={
    pickNextBestTask,
    recordCompletionStreak,
    renderDailySummary,
    renderWeeklyInsights,
    renderAiInsightStrip,
    dismissAiInsightStrip,
    renderOverdueBanner,
    rollOverdueForward,
    refreshStreakBadge,
    appendFocusHtml,
    doWhatNow,
    smartDayDraft
  };
})();
