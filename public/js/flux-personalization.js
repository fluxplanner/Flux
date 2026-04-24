/**
 * Flux personalization: DNA-aware scheduling, density, mood tint, peak hours, affirmations, layout order, profile evolution.
 * Loads after app.js (globals: tasks, moodHistory, studyDNA, load, save, todayStr, loadRestDaysList optional)
 */
(function(){
  const KEY_DENSITY='flux_ui_density';
  const KEY_NAV='flux_nav_counts_v1';
  const KEY_MOOD_TINT='flux_mood_tint_enabled';
  const KEY_LAYOUT_DASH='flux_layout_dashboard_v1';
  const KEY_LAYOUT_CAL='flux_layout_calendar_v1';
  const KEY_LIQUID_GLASS='flux_liquid_glass';
  const KEY_PERF_SNAPPY='flux_perf_snappy';
  const DEFAULT_DASH_ORDER=['pulse','countdown','schedule','tasks'];
  /** Previous factory default (before pulse-first). Used to one-time-migrate users who never customized. */
  const PREVIOUS_DEFAULT_DASH_ORDER=['countdown','pulse','schedule','tasks'];
  const DEFAULT_CAL_ORDER=['hero','schedule'];
  const DASH_LABELS={countdown:'Exam countdown',pulse:'Next 7 days (workload)',schedule:'Today schedule & focus (above tasks)',tasks:'Tasks'};
  const CAL_LABELS={hero:'Month, day detail & Google sync',schedule:'Cycle & weekly schedule'};

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

  function applyLiquidGlass(){
    let on=true;
    try{
      const raw=localStorage.getItem(KEY_LIQUID_GLASS);
      if(raw!==null)on=JSON.parse(raw)===true;
    }catch(e){on=true;}
    document.documentElement.setAttribute('data-flux-glass',on?'on':'off');
  }
  function setLiquidGlassEnabled(on){
    save(KEY_LIQUID_GLASS,!!on);
    applyLiquidGlass();
  }

  function perfSnappySuggest(){
    try{
      const mobile=typeof matchMedia!=='undefined'&&matchMedia('(max-width:768px)').matches;
      const lowMem=typeof navigator.deviceMemory==='number'&&navigator.deviceMemory<=4;
      const fewCores=(navigator.hardwareConcurrency||8)<=2;
      return mobile||lowMem||fewCores;
    }catch(e){return false;}
  }
  function applyPerfSnappy(){
    let on;
    try{
      const raw=localStorage.getItem(KEY_PERF_SNAPPY);
      on=raw===null?perfSnappySuggest():JSON.parse(raw);
    }catch(e){
      on=perfSnappySuggest();
    }
    document.documentElement.setAttribute('data-flux-perf',on?'on':'off');
  }
  function setPerfSnappyEnabled(on){
    save(KEY_PERF_SNAPPY,!!on);
    applyPerfSnappy();
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

  function normalizeOrder(saved,allowed){
    const a=Array.isArray(saved)?saved.filter(x=>allowed.includes(x)):[];
    const miss=allowed.filter(x=>!a.includes(x));
    return a.concat(miss);
  }
  function loadDashOrder(){
    const allowed=DEFAULT_DASH_ORDER.slice();
    try{
      const v=load(KEY_LAYOUT_DASH,null);
      if(Array.isArray(v)&&v.length){
        let norm=normalizeOrder(v,allowed);
        const si=norm.indexOf('schedule');
        const ti=norm.indexOf('tasks');
        if(si>=0&&ti>=0&&si>ti){
          norm=norm.filter(x=>x!=='schedule');
          norm.splice(ti,0,'schedule');
          save(KEY_LAYOUT_DASH,norm);
        }
        if(norm.length===PREVIOUS_DEFAULT_DASH_ORDER.length
          &&norm.every((x,i)=>x===PREVIOUS_DEFAULT_DASH_ORDER[i])){
          norm=DEFAULT_DASH_ORDER.slice();
          try{ save(KEY_LAYOUT_DASH,norm); }catch(e){}
        }
        return norm;
      }
    }catch(e){}
    return allowed;
  }
  function loadCalOrder(){
    try{
      const v=load(KEY_LAYOUT_CAL,null);
      if(Array.isArray(v)&&v.length)return normalizeOrder(v,DEFAULT_CAL_ORDER.slice());
    }catch(e){}
    return DEFAULT_CAL_ORDER.slice();
  }
  function applyDashboardOrder(){
    const wrap=document.getElementById('fluxDashSections');
    if(!wrap)return;
    const order=loadDashOrder();
    order.forEach((name,i)=>{
      const child=wrap.querySelector('[data-flux-section="'+name+'"]');
      if(child)child.style.order=String(i+1);
    });
  }
  function applyCalendarOrder(){
    const wrap=document.getElementById('fluxCalSections');
    if(!wrap)return;
    const order=loadCalOrder();
    order.forEach((name,i)=>{
      const child=wrap.querySelector('[data-flux-cal-section="'+name+'"]');
      if(child)child.style.order=String(i+1);
    });
  }
  function saveDashOrder(arr){
    save(KEY_LAYOUT_DASH,normalizeOrder(arr,DEFAULT_DASH_ORDER.slice()));
    applyDashboardOrder();
  }
  function saveCalOrder(arr){
    save(KEY_LAYOUT_CAL,normalizeOrder(arr,DEFAULT_CAL_ORDER.slice()));
    applyCalendarOrder();
  }
  function shiftLayoutSection(panel,idx,dir){
    const isDash=panel==='dash';
    const def=isDash?DEFAULT_DASH_ORDER:DEFAULT_CAL_ORDER;
    const loadFn=isDash?loadDashOrder:loadCalOrder;
    const saveFn=isDash?saveDashOrder:saveCalOrder;
    const arr=loadFn();
    const j=idx+dir;
    if(j<0||j>=arr.length)return;
    const next=arr.slice();
    const t=next[idx];next[idx]=next[j];next[j]=t;
    saveFn(next);
    renderPanelLayoutSettings();
  }
  function resetPanelLayouts(){
    save(KEY_LAYOUT_DASH,DEFAULT_DASH_ORDER.slice());
    save(KEY_LAYOUT_CAL,DEFAULT_CAL_ORDER.slice());
    applyDashboardOrder();
    applyCalendarOrder();
    renderPanelLayoutSettings();
  }
  function renderPanelLayoutSettings(){
    const host=document.getElementById('fluxPanelLayoutSettings');
    if(!host)return;
    const dOrder=loadDashOrder();
    const cOrder=loadCalOrder();
    const row=(panel,order,labels)=>{
      return order.map((id,i)=>`
        <li class="flux-layout-sort-row">
          <span class="flux-layout-sort-label">${esc(labels[id]||id)}</span>
          <span class="flux-layout-sort-actions">
            <button type="button" class="btn-sec flux-layout-sort-btn" ${i===0?'disabled':''} onclick="FluxPersonal.shiftLayoutSection('${panel}',${i},-1)" aria-label="Move up">↑</button>
            <button type="button" class="btn-sec flux-layout-sort-btn" ${i===order.length-1?'disabled':''} onclick="FluxPersonal.shiftLayoutSection('${panel}',${i},1)" aria-label="Move down">↓</button>
          </span>
        </li>`).join('');
    };
    host.innerHTML=`
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 8px;font-family:'JetBrains Mono',monospace">Dashboard</div>
      <ul class="flux-layout-sort-list" role="list">${row('dash',dOrder,DASH_LABELS)}</ul>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:16px 0 8px;font-family:'JetBrains Mono',monospace">Calendar</div>
      <ul class="flux-layout-sort-list" role="list">${row('cal',cOrder,CAL_LABELS)}</ul>`;
  }

  function applyAll(){
    applyUiDensity();
    applyMoodTint();
    applyLiquidGlass();
    applyPerfSnappy();
    applyDashboardOrder();
    applyCalendarOrder();
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
    const lg=document.getElementById('fluxLiquidGlassToggle');
    if(lg){
      let en=true;
      try{
        const raw=localStorage.getItem(KEY_LIQUID_GLASS);
        if(raw!==null)en=JSON.parse(raw)===true;
      }catch(e){en=true;}
      lg.classList.toggle('on',en);
      lg.setAttribute('aria-pressed',en?'true':'false');
      lg.onclick=()=>{
        const next=!lg.classList.contains('on');
        setLiquidGlassEnabled(next);
        lg.classList.toggle('on',next);
        lg.setAttribute('aria-pressed',next?'true':'false');
      };
    }
    const perf=document.getElementById('fluxPerfSnappyToggle');
    if(perf){
      let cur=false;
      try{
        const raw=localStorage.getItem(KEY_PERF_SNAPPY);
        cur=raw===null?perfSnappySuggest():JSON.parse(raw);
      }catch(e){cur=perfSnappySuggest();}
      perf.classList.toggle('on',!!cur);
      perf.setAttribute('aria-pressed',cur?'true':'false');
      perf.onclick=()=>{
        const next=!perf.classList.contains('on');
        setPerfSnappyEnabled(next);
        perf.classList.toggle('on',next);
        perf.setAttribute('aria-pressed',next?'true':'false');
      };
    }
    renderPanelLayoutSettings();
  }

  window.FluxPersonal={
    dnaFit,
    bumpNav,
    setUiDensity,
    applyUiDensity,
    setMoodTintEnabled,
    applyMoodTint,
    applyLiquidGlass,
    setLiquidGlassEnabled,
    applyPerfSnappy,
    setPerfSnappyEnabled,
    peakHoursFromLog,
    preferredStudyTimesLine,
    sleepSuggestion,
    computeEvolutionLevel,
    styleProfileAvatar,
    renderAffirmation,
    renderPatternsPanel,
    applyDashboardOrder,
    applyCalendarOrder,
    shiftLayoutSection,
    resetPanelLayouts,
    renderPanelLayoutSettings,
    applyAll,
    initSettingsUI,
  };
  function boot(){
    if(window.FluxPersonal)FluxPersonal.applyAll();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
