/**
 * Flux personalization: DNA-aware scheduling, density, mood tint, peak hours, affirmations, layout order, profile evolution.
 * Loads after app.js (globals: tasks, moodHistory, studyDNA, load, save, todayStr, loadRestDaysList optional)
 */
(function(){
  const KEY_DENSITY='flux_ui_density';
  const KEY_NAV='flux_nav_counts_v1';
  const KEY_MOOD_TINT='flux_mood_tint_enabled';

  function esc(s){
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function loadNavCounts(){
    return load(KEY_NAV,{});
  }
  function bumpNav(tabId){
    if(!tabId)return;
    const o=loadNavCounts();
    o[tabId]=(o[tabId]||0)+1;
    save(KEY_NAV,o);
  }

  /** Higher = better match to selected study DNA (affects sort + next-best). */
  function dnaFit(t){
    try{
      const dna=typeof studyDNA!=='undefined'&&Array.isArray(studyDNA)?studyDNA:load('flux_dna',[]);
      if(!dna||!dna.length)return 0;
      const ty=t.type||'hw';
      let n=0;
      if(dna.includes('visual')&&['reading','project','essay'].includes(ty))n+=10;
      if(dna.includes('audio')&&['reading','hw','essay'].includes(ty))n+=8;
      if(dna.includes('reading')&&['reading','essay','hw'].includes(ty))n+=10;
      if(dna.includes('practice')&&['hw','lab','quiz','test'].includes(ty))n+=10;
      return n;
    }catch(e){return 0;}
  }

  function setUiDensity(v){
    const x=['minimal','comfortable','dense'].includes(v)?v:'comfortable';
    save(KEY_DENSITY,x);
    applyUiDensity();
  }
  function applyUiDensity(){
    const v=load(KEY_DENSITY,'comfortable');
    document.documentElement.setAttribute('data-flux-density',v);
  }

  function setMoodTintEnabled(on){
    save(KEY_MOOD_TINT,!!on);
    applyMoodTint();
  }
  function applyMoodTint(){
    const on=load(KEY_MOOD_TINT,true);
    document.documentElement.removeAttribute('data-mood-tint');
    if(!on)return;
    const mh=typeof moodHistory!=='undefined'&&moodHistory?.length?moodHistory[moodHistory.length-1]:null;
    const mood=mh&&mh.mood!=null?parseInt(mh.mood,10):parseInt(localStorage.getItem('flux_mood_today')||'3',10);
    const stress=mh&&mh.stress!=null?parseInt(mh.stress,10):5;
    let tone='neutral';
    if(mood<=2||stress>=9)tone='calm';
    else if(mood>=4&&stress<=4)tone='warm';
    document.documentElement.setAttribute('data-mood-tint',tone);
  }

  function peakHoursFromLog(){
    const log=typeof load==='function'?load('flux_session_log',[]):[];
    const byH=new Array(24).fill(0);
    let totalM=0;
    log.forEach(e=>{
      const h=e.hour!=null?parseInt(e.hour,10):null;
      if(h==null||h<0||h>23)return;
      const m=e.mins||0;
      byH[h]+=m;
      totalM+=m;
    });
    if(totalM<15)return{peak:[],detail:'Complete focus sessions to learn your peak hours.'};
    const ranked=byH.map((m,h)=>({h,m})).filter(x=>x.m>0).sort((a,b)=>b.m-a.m);
    const top=ranked.slice(0,3).map(x=>x.h);
    const labels=top.map(h=>{
      const am=h>=12;
      const hr=h%12||12;
      return`${hr}${am?'pm':'am'}`;
    });
    return{peak:top,labels,detail:`Most focused: ~${labels.join(', ')} (from your timer sessions).`};
  }

  function preferredStudyTimesLine(){
    const p=peakHoursFromLog();
    if(!p.labels||!p.labels.length)return'';
    return`You usually focus best around ${p.labels.join(' · ')} — Flux boosts matching tasks when ties are close.`;
  }

  function sleepSuggestion(){
    const mh=typeof moodHistory!=='undefined'?moodHistory:[];
    const recent=mh.slice(-21).filter(m=>m.sleep!=null&&m.sleep>0);
    if(!recent.length)return{line:'Log sleep hours in Mood to get bedtime targets.',avg:null};
    const avg=recent.reduce((s,m)=>s+parseFloat(m.sleep),0)/recent.length;
    const target=8;
    const wakeH=7;
    const bedHour=Math.max(21,wakeH+24-target-Math.max(0,avg-target));
    return{
      avg,
      line:`Avg sleep ${avg.toFixed(1)}h · target ~${target}h. For a ${wakeH}:00 wake, aim for bed around ${bedHour}:00 (${Math.max(0,target-avg).toFixed(1)}h gap to close).`,
    };
  }

  function computeEvolutionLevel(){
    const streak=parseInt(localStorage.getItem('flux_task_streak_n')||'0',10)||0;
    const done=(typeof tasks!=='undefined'?tasks:[]).filter(t=>t.done).length;
    return Math.min(5,Math.max(1,1+Math.floor(streak/10)+Math.floor(done/35)));
  }

  function styleProfileAvatar(){
    const av=document.getElementById('pAvatar');
    if(!av)return;
    const lv=computeEvolutionLevel();
    av.classList.remove('flux-avatar--evo-1','flux-avatar--evo-2','flux-avatar--evo-3','flux-avatar--evo-4','flux-avatar--evo-5');
    av.classList.add('flux-avatar--evo-'+lv);
    av.title=`Profile level ${lv} — grows with streaks & completed tasks`;
  }

  function renderAffirmation(){
    const el=document.getElementById('affirmation');
    if(!el)return;
    const prof=load('profile',{});
    const first=(prof.name||localStorage.getItem('flux_user_name')||'').trim().split(/\s+/)[0]||'';
    const nm=first||'You';
    const dna=typeof studyDNA!=='undefined'&&studyDNA.length?studyDNA:load('flux_dna',[]);
    const last=typeof moodHistory!=='undefined'&&moodHistory.length?moodHistory[moodHistory.length-1]:null;
    const pool=[];
    if(dna.includes('visual'))pool.push(`${nm}, one diagram today beats a blank page — you have got this.`);
    if(dna.includes('audio'))pool.push(`Read one paragraph aloud, ${nm} — your style sticks better by ear.`);
    if(dna.includes('reading'))pool.push(`${nm}, rewrite one dense paragraph in your own words — that's mastery.`);
    if(dna.includes('practice'))pool.push(`${nm}, three focused problems beat an hour of drift — pick the smallest next step.`);
    if(last){
      const m=parseInt(last.mood,10),st=parseInt(last.stress,10);
      if(m>=4&&st<=5)pool.push(`Energy looks steadier, ${nm}. Channel it into one block before noon.`);
      if(m<=2||st>=8)pool.push(`Rough patch, ${nm} — protect sleep; school can wait one notch today.`);
    }
    const log=typeof load==='function'?load('flux_session_log',[]):[];
    if(log.length>=5)pool.push(`${nm}, your consistency is building — keep stacking short wins.`);
    pool.push(`${nm}, progress beats perfection.`);
    pool.push(`Show up for ${nm.split(' ')[0]||'you'} — the next hour is enough.`);
    const idx=(new Date().getDate()+new Date().getMonth()*31+pool.length*7)%pool.length;
    el.textContent='"'+pool[idx]+'"';
  }

  function renderPatternsPanel(){
    const el=document.getElementById('fluxPatternsPanel');
    if(!el)return;
    const pk=peakHoursFromLog();
    const sleep=sleepSuggestion();
    const dnaLine=preferredStudyTimesLine();
    const counts=loadNavCounts();
    const topNav=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} (${v})`).join(' · ')||'—';
    el.innerHTML=`<div class="card flux-patterns-card">
      <h3>🧬 My patterns</h3>
      <div class="flux-patterns-grid">
        <div><div class="flux-pat-k">Peak focus</div><p class="flux-pat-p">${esc(pk.detail||'—')}</p></div>
        <div><div class="flux-pat-k">Sleep target</div><p class="flux-pat-p">${esc(sleep.line)}</p></div>
        <div><div class="flux-pat-k">Study DNA → scheduling</div><p class="flux-pat-p">${dnaLine?esc(dnaLine):'Pick Study DNA on Profile — task order gains a small boost for matching types.'}</p></div>
        <div><div class="flux-pat-k">Tab usage (layout)</div><p class="flux-pat-p" style="font-size:.72rem">${esc(topNav)}</p></div>
      </div>
    </div>`;
  }

  function applyDashboardOrder(){
    const wrap=document.getElementById('fluxDashSections');
    if(!wrap)return;
    const c=loadNavCounts();
    const weight=name=>{
      const base={countdown:6,tasks:11};
      const b=base[name]||8;
      let w=b;
      if(name==='countdown')w+=Math.min(5,(c.timer||0)*0.2);
      if(name==='tasks')w+=Math.min(6,(c.dashboard||0)*0.12);
      return w;
    };
    ['countdown','tasks'].forEach(name=>{
      const child=wrap.querySelector('[data-flux-section="'+name+'"]');
      if(child)child.style.order=String(Math.round(24-weight(name)));
    });
  }

  function applyAll(){
    applyUiDensity();
    applyMoodTint();
    applyDashboardOrder();
    styleProfileAvatar();
  }

  function initSettingsUI(){
    const den=document.getElementById('fluxDensitySelect');
    if(den){
      den.value=load(KEY_DENSITY,'comfortable');
      den.onchange=()=>setUiDensity(den.value);
    }
    const mt=document.getElementById('fluxMoodTintToggle');
    if(mt){
      const en=load(KEY_MOOD_TINT,true)!==false;
      mt.classList.toggle('on',en);
      mt.onclick=()=>{
        const next=!mt.classList.contains('on');
        setMoodTintEnabled(next);
        mt.classList.toggle('on',next);
      };
    }
  }

  window.FluxPersonal={
    dnaFit,
    bumpNav,
    setUiDensity,
    applyUiDensity,
    setMoodTintEnabled,
    applyMoodTint,
    peakHoursFromLog,
    preferredStudyTimesLine,
    sleepSuggestion,
    computeEvolutionLevel,
    styleProfileAvatar,
    renderAffirmation,
    renderPatternsPanel,
    applyDashboardOrder,
    applyAll,
    initSettingsUI,
  };
  function boot(){
    if(window.FluxPersonal)FluxPersonal.applyAll();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
