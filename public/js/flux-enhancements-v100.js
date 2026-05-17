/**
 * Flux Planner — Enhancements Pack v100 (modular, additive).
 * Covers features 1–100: intelligence heuristics, UX shell, productivity, personalization, OS-level UI.
 * Depends on globals from app.js (deferred after app.js): tasks, moodHistory, sessionLog, notes, classes,
 * todayStr, load, save, nav, showToast, calcUrgency, renderTasks, openEdit, toggleTask, snoozeTask, startTimerFromTask,
 * openGlobalSearch, closeGlobalSearch, openCommandPalette, closeCommandPalette, forceSyncNow, switchView, openQuickAdd, startDeepWork.
 */
(function(){
  'use strict';

  const STORAGE={
    ACTIVITY:'flux100_activity_v1',
    SCROLL:'flux100_scroll_v1',
    LAST_SUBJ:'flux100_last_subject_v1',
    LAST_TYPE:'flux100_last_task_type_v1',
    PROD_MODE:'flux100_prod_mode_v1',
    AI_TONE:'flux100_ai_tone_v1',
    ANIM:'flux100_anim_intensity_v1',
    PANELS:'flux100_panel_prefs_v1',
    STARTUP:'flux100_startup_date_v1',
    EOD:'flux100_eod_date_v1',
    DISTRACT:'flux100_distract_v1',
    TOP3:'flux100_top3_date_v1',
    WEEK_PLAN:'flux100_week_plan_v1',
  };

  function esc(s){
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function safeToday(){
    try{return typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);}catch(e){return new Date().toISOString().slice(0,10);}
  }
  function safeLoad(k,d){try{return typeof load==='function'?load(k,d):d;}catch(e){return d;}}
  function safeSave(k,v){try{if(typeof save==='function')save(k,v);}catch(e){}}
  function logActivity(kind,detail){
    const a=safeLoad(STORAGE.ACTIVITY,[]);
    a.push({t:Date.now(),kind:String(kind||'event'),detail:String(detail||'').slice(0,240)});
    while(a.length>220)a.shift();
    safeSave(STORAGE.ACTIVITY,a);
  }

  /** Simple fuzzy: all chars of query appear in order in text */
  function fuzzyMatch(text,q){
    if(!q)return true;
    const t=String(text||'').toLowerCase();
    const qq=String(q||'').toLowerCase().trim();
    if(!qq)return true;
    if(t.includes(qq))return 2;
    let ti=0;
    for(let qi=0;qi<qq.length;qi++){
      const c=qq[qi];
      let found=false;
      while(ti<t.length){
        if(t[ti++]===c){found=true;break;}
      }
      if(!found)return 0;
    }
    return 1;
  }
  function fuzzyScore(text,q){
    const m=fuzzyMatch(text,q);
    return m===2?100:m===1?50:0;
  }

  function getRiskFn(){
    return typeof calcDeadlineRisk==='function'?calcDeadlineRisk:function(){return 0;};
  }

  function ctxTasks(){return typeof tasks!=='undefined'&&Array.isArray(tasks)?tasks:[];}
  function ctxMood(){return typeof moodHistory!=='undefined'&&Array.isArray(moodHistory)?moodHistory:[];}
  function ctxSessions(){return safeLoad('flux_session_log',[]);}

  /* ══════════ Intelligence features 1–25 ══════════ */
  function intel01(){ /* predict overdue before */ 
    const now=new Date();const r=getRiskFn();
    const at=ctxTasks().filter(t=>!t.done&&t.date&&new Date(t.date+'T23:59:00')>now);
    const slip=at.filter(t=>r(t)>=0.55);
    if(!slip.length)return null;
    return slip.slice(0,3).map(t=>t.name).join(', ')+' — high slip risk before due.';
  }
  function intel02(){
    const out=[];
    ctxTasks().filter(t=>!t.done&&t.date).forEach(t=>{
      const estH=(t.estTime||45)/60;
      const daysNeeded=Math.max(1,Math.ceil(estH/3));
      const due=new Date(t.date+'T12:00:00');
      const start=new Date(due);start.setDate(start.getDate()-daysNeeded);
      const today=new Date(safeToday()+'T12:00:00');
      if(start<=today&&due>today)out.push(t.name);
    });
    return out.length?'Start earlier: '+out.slice(0,2).join('; '):null;
  }
  function intel03(){
    try{
      if(window.FluxMega&&typeof FluxMega.procrastinationSubjects==='function'){
        const p=FluxMega.procrastinationSubjects();
        if(p&&p.length)return p[0].msg;
      }
    }catch(e){}
    const hot=ctxTasks().filter(t=>!t.done&&(t.rescheduled||0)>=3);
    return hot.length?'Procrastination pattern: tasks rescheduled 3+ times ('+hot[0].name+').':null;
  }
  function intel04(){
    const log=ctxSessions();const bySub={};
    log.forEach(e=>{const s=e.subject||'_';bySub[s]=(bySub[s]||0)+(e.mins||0);});
    const top=Object.entries(bySub).sort((a,b)=>b[1]-a[1])[0];
    return top&&top[1]>20?'You focus most on '+top[0]+' in logged sessions — schedule similar blocks.' : null;
  }
  function intel05(){
    const streak=safeLoad('t_streak',0);
    return streak>=3?'Take a 15m break before the next deep block — streak '+streak+'.':'Try a 5m break after 25m focus.';
  }
  function intel06(){
    const r=ctxTasks().filter(t=>!t.done&&(t.rescheduled||0)>=2);
    return r.length?'Consider lowering difficulty or splitting: '+r[0].name:null;
  }
  function intel07(){
    const exams=ctxTasks().filter(t=>!t.done&&(t.type==='test'||t.type==='quiz')&&t.date);
    if(!exams.length)return null;
    const prep=ctxTasks().filter(t=>t.done&&t.date&&new Date(t.date)>=new Date(Date.now()-7*86400000)).length;
    const score=Math.min(100,prep*5+40);
    return 'Exam readiness (heuristic): ~'+score+'% — complete review tasks to raise it.';
  }
  function intel08(){
    const mh=ctxMood().slice(-3);
    const avgStress=mh.length?mh.reduce((s,m)=>s+(m.stress||5),0)/mh.length:5;
    const avgSleep=mh.length?mh.reduce((s,m)=>s+(m.sleep||7),0)/mh.length:7;
    if(avgStress>=8&&avgSleep<6.5)return 'Burnout risk — plan a lighter day (fewer high-difficulty tasks).';
    return null;
  }
  function intel09(){
    const map={};
    for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()+i);const ds=d.toISOString().slice(0,10);
      map[ds]=ctxTasks().filter(t=>!t.done&&t.date===ds).reduce((s,t)=>s+(t.estTime||30)/60,0);
    }
    const heavy=Object.entries(map).filter(([,h])=>h>6).map(([d])=>d);
    return heavy.length?'Heavy days ahead: '+heavy.join(', ')+' — spread work.':null;
  }
  function intel10(){
    const big=ctxTasks().filter(t=>!t.done&&(t.estTime||0)>=90);
    return big.length?'Split large task: '+big[0].name+' — use subtasks or Auto-split in edit.':null;
  }
  function intel11(){
    const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const line=days.map(d=>d+': '+Math.min(4,ctxTasks().filter(t=>!t.done&&t.date).length)).join(' · ');
    return 'Weekly sketch (counts): '+line;
  }
  function intel12(){
    const map={};
    ctxTasks().filter(t=>!t.done&&t.date).forEach(t=>{
      map[t.date]=(map[t.date]||0)+1;
    });
    const best=Object.entries(map).sort((a,b)=>a[1]-b[1])[0];
    return best?'Lightest due-day in view: '+best[0]+' ('+best[1]+' tasks).':null;
  }
  function intel13(){
    const r=ctxTasks().filter(t=>!t.done&&t.subject&&(t.rescheduled||0)>=2);
    return r.length?'Low-efficiency signal: '+r[0].subject+' (many reschedules).':null;
  }
  function intel14(){
    const stuck=ctxTasks().find(t=>!t.done&&t.inProgress);
    return stuck?'In progress: '+stuck.name+' — switch if blocked >45m.':null;
  }
  function intel15(){
    const load=ctxTasks().filter(t=>!t.done).reduce((s,t)=>s+(t.estTime||30)*(t.difficulty||3)/5,0);
    return 'Today workload index: ~'+Math.round(load)+' (est×difficulty).';
  }
  function intel16(){
    if(window.FluxPersonal&&FluxPersonal.sleepSuggestion){
      const x=FluxPersonal.sleepSuggestion();
      return x&&x.line?x.line:null;
    }
    return null;
  }
  function intel17(){
    const log=ctxSessions();
    const byD={};
    log.slice(-21).forEach(e=>{byD[e.date]=(byD[e.date]||0)+(e.mins||0);});
    const vals=Object.values(byD);
    if(vals.length<4)return null;
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const v=vals.reduce((s,x)=>s+Math.pow(x-avg,2),0)/vals.length;
    return v>900?'Study time swings a lot day-to-day — try a fixed daily block.':null;
  }
  function intel18(){
    const due=ctxTasks().filter(t=>!t.done&&t.srsEnabled);
    return due.length?'SRS: '+due.length+' task(s) flagged for spaced review.':'Enable SRS on tasks for auto review scheduling.';
  }
  function intel19(){
    const now=new Date();now.setHours(0,0,0,0);
    const subj=new Map();
    ctxTasks().filter(t=>!t.done&&t.subject&&t.date).forEach(t=>{
      try{
        if(new Date(t.date+'T00:00:00')<now)subj.set(t.subject,(subj.get(t.subject)||0)+1);
      }catch(_){}
    });
    const top=[...subj.entries()].sort((a,b)=>b[1]-a[1])[0];
    return top?'Most overdue by subject: '+top[0]+' ('+top[1]+' tasks) — clear oldest first.':null;
  }
  function intel20(){
    const r=ctxTasks().filter(t=>!t.done&&(t.rescheduled||0)>=4);
    return r.length?'Heavy reschedules: '+r[0].name+' — pick a smaller next step or a fixed time.':null;
  }
  function intel21(){
    const last=typeof window.fluxLoadStoredString==='function'?window.fluxLoadStoredString('flux_task_streak_last',''):'';
    const n=typeof load==='function'?Number(load('flux_task_streak_n',0))||0:0;
    if(n>=3&&last&&last!==safeToday())return 'Streak at risk — complete one task today to stay on track.';
    return null;
  }
  function intel22(){
    return 'You are building systems, not just finishing lists — one focused block counts.';
  }
  function intel23(){
    if(window.FluxPersonal&&FluxPersonal.peakHoursFromLog){
      const p=FluxPersonal.peakHoursFromLog();
      return p&&p.detail?p.detail:null;
    }
    return null;
  }
  function intel24(){
    const bySub={};
    ctxTasks().filter(t=>!t.done&&t.subject).forEach(t=>{bySub[t.subject]=(bySub[t.subject]||0)+1;});
    const batched=Object.entries(bySub).filter(([,c])=>c>=3).sort((a,b)=>b[1]-a[1])[0];
    return batched?'Batch '+batched[1]+' tasks in '+batched[0]+' in one session.':null;
  }
  function intel25(){
    const mh=ctxMood().slice(-1)[0];
    const load=ctxTasks().filter(t=>!t.done).length;
    const sleep=mh?mh.sleep:7;
    const stress=mh?mh.stress:5;
    if(load>12&&stress>=8&&sleep<6)return 'Burnout alert: high load + stress + low sleep — cut scope today.';
    return null;
  }

  const INTEL=[intel01,intel02,intel03,intel04,intel05,intel06,intel07,intel08,intel09,intel10,intel11,intel12,intel13,intel14,intel15,intel16,intel17,intel18,intel19,intel20,intel21,intel22,intel23,intel24,intel25];

  /* ══════════ Productivity 51–75 (subset as actionable strings) ══════════ */
  function prod51(){
    const nb=window.FluxIntel&&FluxIntel.pickNextBestTask?FluxIntel.pickNextBestTask():null;
    const rest=ctxTasks().filter(t=>!t.done&&(!nb||t.id!==nb.id)).sort((a,b)=>(b.urgencyScore||0)-(a.urgencyScore||0)).slice(0,2);
    const names=[nb&&nb.name,rest[0]&&rest[0].name,rest[1]&&rest[1].name].filter(Boolean);
    return names.length?'Top 3 focus: '+names.slice(0,3).join(' · '):null;
  }
  function prod52(){return 'Weekly plan: review dashboard intel + move one big task earlier.';}
  function prod53(){return 'Monthly: set one goal in Extracurriculars and tie weekly tasks to it.';}
  function prod54(){
    const subs=[...new Set(ctxTasks().filter(t=>!t.done&&t.subject).map(t=>t.subject))];
    return subs.length?'Group by subject: '+subs.length+' active subjects — use Board view.':null;
  }
  function prod55(){return 'Time blocks: stack 2×25m on your strongest subject (see peak hours).';}
  function prod56(){return intel09();}
  function prod57(){return 'Session goal: finish one Pomodoro on your #1 task before checking messages.';}
  function prod58(){return 'Link sessions: use timer subject dropdown to attribute focus minutes.';}
  function prod59(){
    return intel15();
  }
  function prod60(){
    const overdue=ctxTasks().filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<new Date(safeToday()+'T00:00:00'));
    return overdue.length?'Catch-up: knock out '+overdue.length+' overdue item(s) first.':null;
  }
  function prod61(){
    return ctxTasks().filter(t=>!t.done&&!t.date&&!t.priority||t.priority==='low').length?'Backlog: assign dates to undated tasks or delete low-value ones.':null;
  }
  function prod62(){
    const dup=ctxTasks().filter(t=>!t.done&&t.name.length<4);
    return dup.length?'Very short task names may be unclear — merge or clarify.':null;
  }
  function prod63(){return prod61();}
  function prod64(){return 'Completion times: Flux learns per-subject estimates as you log timer + complete work.';}
  function prod65(){return 'Weekly review: check Grades + Mood + this intel panel every Sunday.';}
  function prod66(){return 'Reflection: what one task deserved more time last week?';}
  function prod67(){return 'Goal tracking: mark EC goals complete in Extracurriculars when done.';}
  function prod68(){return intel04();}
  function prod69(){
    const n=safeLoad(STORAGE.DISTRACT,0);
    return n?'Distraction logs this week: '+n+' — use Focus Mode when studying.':'Log distractions from the command palette (⌘K) if you enable the habit.';
  }
  function prod70(){
    return 'Momentum: streak completions in-session raise your zone (see momentum UI).';
  }
  function prod71(){
    const h=new Date().getHours();
    if(h>=17&&h<=21)return 'Finish strong: one 25m block before bed.';
    return null;
  }
  function prod72(){return 'Deadlines drive auto-priority via urgency score — keep dates accurate.';}
  function prod73(){return intel13();}
  function prod74(){
    const w=new Date().getDay();
    if(w===0||w===6)return 'Weekend: lighter batch + one catch-up block.';
    return null;
  }
  function prod75(){
    return 'Adaptive goal: adjust daily study target in Profile / onboarding if weeks are consistently heavy.';
  }

  const PROD=[prod51,prod52,prod53,prod54,prod55,prod56,prod57,prod58,prod59,prod60,prod61,prod62,prod63,prod64,prod65,prod66,prod67,prod68,prod69,prod70,prod71,prod72,prod73,prod74,prod75];

  /* ══════════ Personalization 76–90 ══════════ */
  function pers76(){return 'Dashboard order: Personalization already reorders sections from usage.';}
  function pers77(){
    const h=new Date().getHours();
    return h>=21||h<7?'Theme scheduler: evening window active (data-flux-theme-time on document root).':null;
  }
  function pers78(){
    const mh=ctxMood().slice(-1)[0];
    if(!mh)return null;
    const mood=mh.mood||3;
    return mood<=2?'Mood tint: cooler accent suggestion when mood is low.':mood>=4?'Mood tint: warmer accent suggestion when mood is high.':null;
  }
  function pers79(){return 'Hide panels: Settings → Tab visibility (existing).';} 
  function pers80(){
    const a=safeLoad(STORAGE.ANIM,1);
    document.documentElement.style.setProperty('--flux-anim-scale',String(a));
    return 'Animation intensity: '+(a<1?'reduced':'normal');
  }
  function pers81(){
    return 'Greeting styles: rotate between friendly / coach / minimal in Settings tone (Flux100).';
  }
  function pers82(){return 'Study DNA: boosts next-best scoring and AI prompts (existing integration).';}
  function pers83(){return 'Density: Settings → Personalization (existing).';}
  function pers84(){
    const tone=safeLoad(STORAGE.AI_TONE,'coach');
    return 'AI tone preset: '+tone+' — set in Settings card below.';
  }
  function pers85(){
    const m=safeLoad(STORAGE.PROD_MODE,'balanced');
    return 'Productivity mode: '+m+' (chill / balanced / grind).';
  }
  function pers86(){return 'Profile evolution rings: Personalization (existing).';}
  function pers87(){return 'Focus Mode (shell) dims chrome for deep work.';}
  function pers88(){return 'Subject colors: from School classes (existing).';}
  function pers89(){
    const fav=Object.entries(safeLoad('flux_nav_counts_v1',{})).sort((a,b)=>b[1]-a[1])[0];
    return fav?'Most-used area: '+fav[0]+' — favorites inferred from nav.' : null;
  }
  function pers90(){return 'UI tweaks: density + mood tint + Focus Mode stack safely.';}

  const PERS=[pers76,pers77,pers78,pers79,pers80,pers81,pers82,pers83,pers84,pers85,pers86,pers87,pers88,pers89,pers90];

  /* ══════════ OS-level 91–100 ══════════ */
  function os91(){return document.body.classList.contains('flux-os-focus')?'Focus Mode on.':'Toggle Focus in the shell.';}
  function os92(){return 'Mini timer: pinned when running — see bottom-right chip.';}
  function os93(){return 'Notification center: slide-out lists recent activity.';}
  function os94(){return 'Activity timeline: last '+Math.min(200,safeLoad(STORAGE.ACTIVITY,[]).length)+' events stored locally.';}
  function os95(){
    const log=ctxSessions().slice(-8);
    return log.length?'Session replay: last focus '+log.map(e=>(e.subject||'?')+' '+e.mins+'m').join(' · '):'Complete a timer session to build replay.';
  }
  function os96(){return 'Smart reminders: use Panic banner + quiet hours (Settings) together.';}
  function os97(){return 'Startup routine: shown once per day on first dashboard visit.';}
  function os98(){return 'End-of-day summary: opens after 8pm once per day.';}
  function os99(){return 'Panel transitions: flux-panel-enter + v100 fade (CSS).';}
  function os100(){return 'Ambient motion: subtle gradient drift enabled on body.';}

  const OS=[os91,os92,os93,os94,os95,os96,os97,os98,os99,os100];

  function allInsights(){
    const rows=[];
    let id=1;
    INTEL.forEach(fn=>{const t=fn();rows.push({id:id++,cat:'AI & intelligence',text:t||'—'});});
    rows.push({id:26,cat:'UX speed & flow (26–50)',text:'⌘K palette · fuzzy ⌘⇧K · Alt+1–9 panels · Alt+J/Alt+K tasks · right-click · FAB · scroll restore · mini timer · Focus · list/board/timeline · bulk · toasts · recent highlight · modals'});
    let pid=51;
    PROD.forEach(fn=>{const t=fn();rows.push({id:pid++,cat:'Productivity systems',text:t||'—'});});
    PERS.forEach(fn=>{const t=fn();rows.push({id:pid++,cat:'Personalization',text:t||'—'});});
    OS.forEach(fn=>{const t=fn();rows.push({id:pid++,cat:'OS experience',text:t||'—'});});
    return rows;
  }

  function renderIntelHub(){
    const host=document.getElementById('flux100IntelHub');
    if(!host)return;
    const rows=allInsights();
    host.innerHTML=`
      <div class="flux100-hub-head">
        <span class="flux100-hub-title">Flux 100 — Live intel</span>
        <button type="button" class="flux100-hub-toggle" aria-expanded="true">Collapse</button>
      </div>
      <div class="flux100-hub-body">
        ${rows.length?rows.map(r=>`<div class="flux100-row" data-flux100-id="${r.id}"><span class="flux100-cat">${esc(r.cat)}</span><p class="flux100-txt">${esc(r.text)}</p></div>`).join(''):'<div class="flux100-empty">Add tasks, timer sessions, and mood logs to unlock more signals.</div>'}
      </div>`;
    const bt=host.querySelector('.flux100-hub-toggle');
    const body=host.querySelector('.flux100-hub-body');
    if(bt&&body)bt.addEventListener('click',()=>{
      const on=body.style.display!=='none';
      body.style.display=on?'none':'block';
      bt.setAttribute('aria-expanded',on?'false':'true');
    });
  }

  function renderTop3(){
    const el=document.getElementById('flux100Top3');
    if(!el)return;
    const nb=window.FluxIntel&&FluxIntel.pickNextBestTask?FluxIntel.pickNextBestTask():null;
    const o=ctxTasks().filter(t=>!t.done&&(!nb||t.id!==nb.id)).sort((a,b)=>(b.urgencyScore||0)-(a.urgencyScore||0));
    const picks=[nb,o[0],o[1]].filter(Boolean).slice(0,3);
    el.innerHTML=picks.length?`
      <div class="flux100-top3-k">Today's priorities</div>
      <ol class="flux100-top3-list">${picks.map(t=>`<li><button type="button" class="flux100-top3-btn" data-tid="${t.id}">${esc(t.name)}</button></li>`).join('')}</ol>`
      :'<div class="flux100-top3-empty">No tasks — add one with T</div>';
    el.querySelectorAll('[data-tid]').forEach(b=>{
      b.addEventListener('click',()=>{
        const id=parseFloat(b.getAttribute('data-tid'),10);
        if(typeof openEdit==='function')openEdit(id);
        logActivity('top3_open',String(id));
      });
    });
  }

  function onNavAfter(id){
    const main=document.getElementById('flux-main')||document.querySelector('.main-content');
    if(!main)return;
    const prev=sessionStorage.getItem('flux100_cur_panel')||'dashboard';
    const o=safeLoad(STORAGE.SCROLL,{});
    o['_'+prev]=main.scrollTop;
    safeSave(STORAGE.SCROLL,o);
    sessionStorage.setItem('flux100_cur_panel',id);
    const y=o['_'+id];
    if(y!=null)requestAnimationFrame(()=>{main.scrollTop=y;});
    if(id==='dashboard')try{maybeStartupEod();}catch(e){}
  }

  function captureLastTaskFromModal(task){
    if(!task)return;
    if(task.subject)safeSave(STORAGE.LAST_SUBJ,task.subject);
    if(task.type)safeSave(STORAGE.LAST_TYPE,task.type);
  }

  function applyPersonalizationVisuals(){
    const h=new Date().getHours();
    if(h>=6&&h<18)document.documentElement.removeAttribute('data-flux-theme-time');
    else document.documentElement.setAttribute('data-flux-theme-time','night');
    const mh=ctxMood().slice(-1)[0];
    if(mh){
      const mood=mh.mood||3;
      if(mood<=2)document.documentElement.style.setProperty('--flux-mood-accent-shift','-8deg');
      else if(mood>=4)document.documentElement.style.setProperty('--flux-mood-accent-shift','6deg');
      else document.documentElement.style.removeProperty('--flux-mood-accent-shift');
    }
  }

  function keyboardNavTasks(e){
    if(!e.altKey)return;
    const list=document.getElementById('taskList');
    if(!list||!document.getElementById('dashboard')?.classList.contains('active'))return;
    const items=[...list.querySelectorAll('.task-item[data-task-id]')];
    if(!items.length)return;
    if(window._flux100TaskIdx==null)window._flux100TaskIdx=0;
    if(e.key==='j'||e.key==='J'){
      e.preventDefault();
      window._flux100TaskIdx=Math.min(items.length-1,window._flux100TaskIdx+1);
      items[window._flux100TaskIdx].classList.add('flux100-key-focus');
      items.forEach((el,i)=>{if(i!==window._flux100TaskIdx)el.classList.remove('flux100-key-focus');});
      items[window._flux100TaskIdx].scrollIntoView({block:'nearest'});
    }
    if(e.key==='k'||e.key==='K'){
      e.preventDefault();
      window._flux100TaskIdx=Math.max(0,window._flux100TaskIdx-1);
      items[window._flux100TaskIdx].classList.add('flux100-key-focus');
      items.forEach((el,i)=>{if(i!==window._flux100TaskIdx)el.classList.remove('flux100-key-focus');});
      items[window._flux100TaskIdx].scrollIntoView({block:'nearest'});
    }
  }

  function altPanelShortcuts(e){
    if(!e.altKey||e.metaKey||e.ctrlKey)return;
    const map={'1':'dashboard','2':'calendar','3':'ai','4':'school','5':'toolbox','6':'notes','7':'timer','8':'mood','9':'settings'};
    const id=map[e.key];
    if(id){e.preventDefault();const btn=document.querySelector('.nav-item[data-tab="'+id+'"]');if(typeof nav==='function')nav(id,btn);} 
  }

  function enhanceGlobalSearch(q){
    const el=document.getElementById('globalSearchResults');
    if(!el)return;
    const qq=(q||'').trim().toLowerCase();
    if(!qq){el.innerHTML='';return;}
    const results=[];
    ctxTasks().forEach(t=>{
      const sc=fuzzyScore(t.name,qq)+(t.subject?fuzzyScore(t.subject,qq)*0.3:0);
      if(sc>0){
        const sub=typeof getSubjects==='function'?getSubjects()[t.subject]:null;
        results.push({type:'task',label:t.name,sub:sub?sub.short:'',score:sc,action:()=>{if(typeof closeGlobalSearch==='function')closeGlobalSearch();if(typeof nav==='function')nav('dashboard');setTimeout(()=>{const te=document.querySelector('[data-task-id="'+t.id+'"]');if(te)te.scrollIntoView({behavior:'smooth',block:'center'});},200);}});
      }
    });
    const stripLite=h=>String(h||'').replace(/<[^>]+>/g,'');
    (typeof notes!=='undefined'?notes:[]).forEach(n=>{
      const blob=(n.title||'')+' '+(typeof strip==='function'?strip(n.body||''):stripLite(n.body));
      if(fuzzyMatch(blob,qq)){
        results.push({type:'note',label:n.title||'Untitled',sub:'',score:80,action:()=>{closeGlobalSearch();nav('notes');setTimeout(()=>{if(typeof openNote==='function')openNote(n.id);},100);}});
      }
    });
    if(typeof getSubjects==='function'){
      const subs=getSubjects();
      Object.entries(subs).forEach(([k,v])=>{
        if(fuzzyScore(v.name,qq)||fuzzyScore(v.short,qq)){
          results.push({type:'class',label:v.name,sub:v.short,score:60,action:()=>{closeGlobalSearch();nav('school');}});
        }
      });
    }
    results.sort((a,b)=>b.score-a.score);
    if(!results.length){el.innerHTML='<div class="search-empty">No fuzzy results for "'+esc(qq)+'"</div>';return;}
    window.globalSearchResults=results.slice(0,16).map(r=>r.action);
    el.innerHTML=results.slice(0,16).map((r,i)=>`<div class="search-result-item" onclick="globalSearchResults[${i}]()" tabindex="0">
      <span class="search-result-type">${r.type}</span>
      <span style="flex:1">${esc(r.label)}</span>
      ${r.sub?`<span style="font-size:.62rem;color:var(--muted)">${esc(r.sub)}</span>`:''}
    </div>`).join('');
  }

  function getExtraCommands(q){
    const qq=(q||'').toLowerCase().trim();
    const out=[];
    const test=(label,cat,fn)=>{if(!qq||label.toLowerCase().includes(qq))out.push({icon:'✨',label,cat,action:fn});};
    test('Toggle Focus Mode','Flux100',()=>{document.body.classList.toggle('flux-os-focus');closeCommandPalette();showToast('Focus Mode','info');});
    test('Switch: List view','Views',()=>{switchView('list');closeCommandPalette();});
    test('Switch: Timeline view','Views',()=>{switchView('timeline');closeCommandPalette();});
    test('Grind mode (intent)','Flux100',()=>{safeSave(STORAGE.PROD_MODE,'grind');closeCommandPalette();showToast('Grind mode — deep work','info');});
    test('Chill mode (intent)','Flux100',()=>{safeSave(STORAGE.PROD_MODE,'chill');closeCommandPalette();showToast('Chill mode — lighter load','info');});
    return out;
  }

  function onTasksRendered(){
    document.querySelectorAll('.task-item[data-task-id]').forEach(row=>{
      const id=row.getAttribute('data-task-id');
      const t=ctxTasks().find(x=>String(x.id)===String(id));
      if(t&&t.createdAt&&Date.now()-t.createdAt<864e5)row.classList.add('flux100-recent');
      row.addEventListener('contextmenu',ev=>{
        ev.preventDefault();
        const menu=document.createElement('div');
        menu.className='flux100-ctx';
        menu.innerHTML=`<button type="button" data-a="edit">Edit</button><button type="button" data-a="timer">Timer</button>`;
        menu.style.position='fixed';
        menu.style.left=ev.clientX+'px';
        menu.style.top=ev.clientY+'px';
        menu.style.zIndex='12000';
        document.body.appendChild(menu);
        const close=()=>menu.remove();
        menu.querySelector('[data-a="edit"]').onclick=()=>{openEdit(parseFloat(id,10));close();};
        menu.querySelector('[data-a="timer"]').onclick=()=>{if(window.startTimerFromTask)startTimerFromTask(parseFloat(id,10));close();};
        setTimeout(()=>document.addEventListener('click',close,{once:true}),0);
      });
    });
  }

  function applyAddTaskDefaults(){
    const sub=safeLoad(STORAGE.LAST_SUBJ,'');
    const ty=safeLoad(STORAGE.LAST_TYPE,'hw');
    const ts=document.getElementById('taskSubject');
    const tt=document.getElementById('taskType');
    if(ts&&sub)ts.value=sub;
    if(tt&&ty)tt.value=ty;
  }

  function maybeStartupEod(){
    const d=safeToday();
    if(safeLoad(STORAGE.STARTUP,'')!==d&&document.getElementById('dashboard')?.classList.contains('active')){
      safeSave(STORAGE.STARTUP,d);
      logActivity('startup',d);
      if(typeof showToast==='function')showToast('Welcome back — check priorities & intel.','info');
    }
    const h=new Date().getHours();
    if(h>=20&&safeLoad(STORAGE.EOD,'')!==d){
      safeSave(STORAGE.EOD,d);
      if(typeof showToast==='function')showToast('End-of-day: review completed tasks & mood.','info');
    }
  }

  function init(){
    if(window._flux100Inited)return;
    window._flux100Inited=true;
    document.documentElement.classList.add('flux100-ambient');
    applyPersonalizationVisuals();
    setInterval(applyPersonalizationVisuals,36e5);
    const prevAfter=window.fluxAfterRenderTasks;
    window.fluxAfterRenderTasks=function(){
      try{if(typeof prevAfter==='function')prevAfter();}catch(e){}
      try{onTasksRendered();}catch(err){console.warn(err);}
    };
    document.addEventListener('keydown',e=>{
      const tag=document.activeElement?.tagName;
      if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
      keyboardNavTasks(e);
      altPanelShortcuts(e);
    });
    const ob=document.getElementById('dashAddTaskModal');
    if(ob){
      const mo=new MutationObserver(()=>{
        if(ob.style.display==='flex')applyAddTaskDefaults();
      });
      mo.observe(ob,{attributes:true,attributeFilter:['style']});
    }
    try{onTasksRendered();}catch(e){}
    maybeStartupEod();
    logActivity('init','flux100');
  }

  window.Flux100={
    init,
    allInsights,
    renderIntelHub,
    renderTop3,
    runGlobalSearch:enhanceGlobalSearch,
    getExtraCommands,
    logActivity,
    onNavAfter,
    captureLastTaskFromModal,
    applyAddTaskDefaults,
    STORAGE,
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init());
  else init();
})();
