/**
 * Flux AI Command Center — client intelligence + optional AI calls.
 * Depends on: tasks, notes, classes, extras, moodHistory, load/save, todayStr, calcUrgency, syncKey, API, API_HEADERS, showToast, nav, renderTasks, renderCalendar, renderStats, breakItDown, fmtAI (optional)
 */
(function(){
  const KEY_BIAS='flux_night_bias_v1';
  const KEY_EXPLAIN='flux_explain_level_v1';
  const KEY_BREAK='flux_last_break_hint_ts';

  /** Physical key when `app.js` namespacing is available (impersonation-safe fallbacks). */
  function lsNk(k){
    try{return typeof fluxNamespacedKey==='function'?fluxNamespacedKey(k):k;}catch(_){return k;}
  }
  /** Fallback when `load`/`save` are missing; values match JSON written by `save()`. */
  function rawLoad(k, def){
    try{
      const raw=localStorage.getItem(lsNk(k));
      if(raw==null||raw==='')return def;
      try{return JSON.parse(raw);}catch(_){return raw;}
    }catch(_){return def;}
  }
  function rawSave(k, v){
    try{localStorage.setItem(lsNk(k), JSON.stringify(v));}catch(_){}
  }

  function esc(s){
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function strip(html){
    return String(html||'').replace(/<[^>]+>/g,'');
  }

  function readBias(){
    if(typeof load==='function'){
      try{
        const o=load(KEY_BIAS,{});
        return o&&typeof o==='object'&&!Array.isArray(o)?o:{};
      }catch(e){}
    }
    const o=rawLoad(KEY_BIAS,{});
    return o&&typeof o==='object'&&!Array.isArray(o)?o:{};
  }
  function writeBias(o){
    if(typeof save==='function'){
      try{save(KEY_BIAS,o||{});return;}catch(e){}
    }
    rawSave(KEY_BIAS,o||{});
  }

  function onTaskComplete(task){
    if(!task||!task.subject||!task.completedAt)return;
    const h=new Date(task.completedAt).getHours();
    const night=h>=20||h<7;
    const b=readBias();
    const cur=b[task.subject]||{n:0,d:0};
    if(night)cur.n++;else cur.d++;
    b[task.subject]=cur;
    writeBias(b);
  }

  function predictedEst(task){
    const base=task.estTime||30;
    if(typeof FluxEstimateLearn!=='undefined'&&task.subject)
      return FluxEstimateLearn.suggestedEstForSubject(task.subject,base);
    return base;
  }

  function procrastinationSubjects(){
    const b=readBias();
    const out=[];
    Object.entries(b).forEach(([sub,row])=>{
      const n=row.n||0,d=row.d||0;
      const tot=n+d;
      if(tot<4)return;
      const ratio=n/tot;
      if(ratio>=0.55)out.push({sub,ratio,msg:`You often finish ${sub} work late (${Math.round(ratio*100)}% after 8pm) — try scheduling it earlier in the day.`});
    });
    return out;
  }

  function rescheduleProcrastinationEarlier(){
    if(typeof tasks==='undefined'||!Array.isArray(tasks))return 0;
    const hot=new Set(procrastinationSubjects().map(x=>x.sub));
    if(!hot.size)return 0;
    const now=new Date();now.setHours(0,0,0,0);
    let n=0;
    tasks.forEach(t=>{
      if(t.done||!t.date||!hot.has(t.subject))return;
      const d=new Date(t.date+'T12:00:00');
      if(d<=now)return;
      let target=typeof prevNonRestBackward==='function'?prevNonRestBackward(t.date):(()=>{const e=new Date(d);e.setDate(e.getDate()-1);return e.toISOString().slice(0,10);})();
      if(new Date(target+'T12:00:00')<=now)return;
      t.date=target;
      if(typeof calcUrgency==='function')t.urgencyScore=calcUrgency(t);
      n++;
    });
    if(n){
      save('tasks',tasks);
      if(typeof syncKey==='function')syncKey('tasks',tasks);
      if(typeof renderTasks==='function')renderTasks();
      if(typeof renderCalendar==='function')renderCalendar();
      if(typeof showToast==='function')showToast(`Moved ${n} task(s) one day earlier for late-night subjects`,'success');
    }
    return n;
  }

  function workloadByDay(days){
    const map={};
    const now=new Date();now.setHours(0,0,0,0);
    for(let i=0;i<days;i++){
      const d=new Date(now);d.setDate(now.getDate()+i);
      map[d.toISOString().slice(0,10)]=0;
    }
    if(typeof tasks==='undefined')return map;
    tasks.filter(t=>!t.done&&t.date).forEach(t=>{
      if(map[t.date]==null)return;
      map[t.date]+=predictedEst(t);
    });
    return map;
  }

  function lightenOverloadedDays(){
    if(typeof tasks==='undefined'||!Array.isArray(tasks))return 0;
    let flushed=0;
    tasks.forEach(t=>{
      if(t.done||!t.date||typeof isBreak!=='function'||!isBreak(t.date))return;
      if(typeof nextNonRestForward==='function')t.date=nextNonRestForward(t.date);
      else{const d=new Date(t.date+'T12:00:00');d.setDate(d.getDate()+1);t.date=d.toISOString().slice(0,10);}
      if(typeof calcUrgency==='function')t.urgencyScore=calcUrgency(t);
      flushed++;
    });
    const map=workloadByDay(14);
    const TH=240;
    let moves=0;
    const dates=Object.keys(map).sort();
    for(const ds of dates){
      if(map[ds]<=TH)continue;
      const candidates=tasks.filter(t=>!t.done&&t.date===ds).sort((a,b)=>
        (a.priority==='low'?0:1)-(b.priority==='low'?0:1)||(predictedEst(a)-predictedEst(b)));
      const victim=candidates[0];
      if(!victim)continue;
      for(let i=1;i<8;i++){
        const nd=new Date(ds+'T12:00:00');nd.setDate(nd.getDate()+i);
        const ns=nd.toISOString().slice(0,10);
        if(map[ns]==null)continue;
        if(typeof isBreak==='function'&&isBreak(ns))continue;
        if(map[ns]+predictedEst(victim)<=TH+40){
          victim.date=ns;
          if(typeof calcUrgency==='function')victim.urgencyScore=calcUrgency(victim);
          map[ds]-=predictedEst(victim);
          map[ns]+=predictedEst(victim);
          moves++;
          break;
        }
      }
    }
    if(flushed||moves){
      save('tasks',tasks);
      if(typeof syncKey==='function')syncKey('tasks',tasks);
      if(typeof renderTasks==='function')renderTasks();
      if(typeof renderCalendar==='function')renderCalendar();
      if(typeof renderDashWeekStrip==='function')renderDashWeekStrip();
      if(typeof showToast==='function'){
        const p=[];
        if(flushed)p.push(`moved ${flushed} off rest day(s)`);
        if(moves)p.push(`shifted ${moves} for lighter days`);
        showToast(p.join(' · '),'success');
      }
    }
    return moves+flushed;
  }

  function scoreTask(t,now){
    let s=t.urgencyScore||0;
    const due=t.date?new Date(t.date+'T00:00:00'):null;
    if(due){
      const daysUntil=Math.max(0,(due-now)/86400000);
      if(daysUntil===0)s+=40;
      s+=25/(1+daysUntil);
    }
    const diff=t.difficulty||3;
    const energy =
      typeof window.readFluxEnergyLevel === 'function'
        ? window.readFluxEnergyLevel()
        : parseInt(String(typeof load === 'function' ? load('flux_energy', 3) : 3), 10) || 3;
    if(energy<=2){if(diff<=2)s+=15;if(diff>=4)s-=10;}
    if(energy>=4&&['project','essay','lab'].includes(t.type))s+=12;
    const p=t.priority==='high'?8:t.priority==='low'?-3:2;
    s+=p;
    if(window.FluxPersonal&&typeof FluxPersonal.dnaFit==='function')s+=FluxPersonal.dnaFit(t)*0.35;
    return s;
  }

  function studyOrderWithReasons(limit){
    if(typeof tasks==='undefined')return[];
    const now=new Date();now.setHours(0,0,0,0);
    const candidates=tasks.filter(t=>!t.done&&(typeof isTaskSnoozed!=='function'||!isTaskSnoozed(t))&&!(typeof isBlocked==='function'&&isBlocked(t)));
    const ranked=candidates.map(t=>{
      const sc=scoreTask(t,now);
      let why=[];
      if(t.priority==='high')why.push('high priority');
      if(t.date){
        const du=(new Date(t.date+'T00:00:00')-now)/86400000;
        if(du<=1)why.push('due very soon');
        else if(du<=3)why.push('due this week');
      }
      if((t.difficulty||3)>=4)why.push('heavy — fits when energy is higher');
      if((t.rescheduled||0)>=2)why.push('keeps slipping');
      if(!why.length)why.push('balanced urgency vs effort');
      return{task:t,score:sc,why:why.join(' · ')};
    }).sort((a,b)=>b.score-a.score);
    return ranked.slice(0,limit||8);
  }

  function explainScheduling(order){
    return order.map((o,i)=>`${i+1}. ${o.task.name} — ${o.why}`);
  }

  function freeMinutesToday(){
    const ts=typeof todayStr==='function'?todayStr():'';
    if(ts&&typeof isBreak==='function'&&isBreak(ts)){
      const rk=typeof restDayKind==='function'?restDayKind(ts):'lazy';
      return rk==='sick'?5:25;
    }
    const now=new Date();
    const endOfDay=new Date();endOfDay.setHours(23,0,0,0);
    let avail=Math.max(0,(endOfDay-now)/60000);
    const classMin=(typeof classes!=='undefined'&&classes)?classes.reduce((s,c)=>{
      if(!c.timeStart||!c.timeEnd)return s;
      const[sh,sm]=c.timeStart.split(':').map(Number);
      const[eh,em]=c.timeEnd.split(':').map(Number);
      return s+Math.max(0,eh*60+em-(sh*60+sm));
    },0):0;
    return Math.max(30,avail-classMin*0.4);
  }

  function finishEverythingSim(){
    if(typeof tasks==='undefined')return{ok:false,msg:'No data'};
    const now=new Date();now.setHours(0,0,0,0);
    const pending=tasks.filter(t=>!t.done&&(typeof isTaskSnoozed!=='function'||!isTaskSnoozed(t)));
    let remMin=pending.reduce((s,t)=>s+predictedEst(t),0);
    const todayFree=freeMinutesToday();
    const dayMins=[todayFree];
    const start=new Date();start.setHours(0,0,0,0);
    for(let i=1;i<7;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const ds=d.toISOString().slice(0,10);
      let cap=180;
      if(typeof isBreak==='function'&&isBreak(ds)){
        const rk=typeof restDayKind==='function'?restDayKind(ds):'lazy';
        cap=rk==='sick'?0:55;
      }
      dayMins.push(cap);
    }
    let totalFree=dayMins.reduce((a,b)=>a+b,0);
    const verdict=remMin<=totalFree;
    return{
      verdict,
      pendingMin:Math.round(remMin),
      weekFreeMin:Math.round(totalFree),
      todayFreeMin:Math.round(todayFree),
      msg:verdict
        ?`If you use ~${Math.round(remMin)} min of focused time across the next week, you can finish everything currently pending (rough estimate).`
        :`Roughly ${Math.round(remMin)} min of work vs ~${Math.round(totalFree)} min of realistic free time this week — trim scope, extend deadlines, or delegate.`
    };
  }

  function deadlineCompression(){
    const today=typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
    if(typeof isBreak==='function'&&isBreak(today))return{show:false,text:''};
    const free=freeMinutesToday();
    const map=workloadByDay(3);
    const load=map[today]||0;
    if(load<=free*1.1)return{show:false,text:''};
    const tips=[
      'Do the smallest “quick win” first to build momentum.',
      'Halve estimates for first pass — iterate later.',
      'Move one non-urgent task to tomorrow morning.',
    ];
    return{show:true,text:tips.join(' '),overloadMin:Math.round(load),freeMin:Math.round(free)};
  }

  const TYPE_WEIGHT={test:1,quiz:0.85,project:0.9,essay:0.88,lab:0.7,hw:0.55,reading:0.5,other:0.5};

  function gradeImpactHint(t){
    const w=TYPE_WEIGHT[t.type]||0.55;
    const pri=t.priority==='high'?1.15:t.priority==='low'?0.85:1;
    return Math.min(100,Math.round(w*pri*28));
  }

  function fakeProductivity(){
    const ts=typeof todayStr==='function'?todayStr():'';
    const done=(typeof tasks!=='undefined'?tasks:[]).filter(t=>t.done&&t.completedAt&&new Date(t.completedAt).toISOString().slice(0,10)===ts);
    if(done.length<4)return{flag:false,text:''};
    const easy=done.filter(t=>(t.difficulty||3)<=2).length;
    const hard=done.filter(t=>(t.difficulty||3)>=4).length;
    const flag=easy>=done.length*0.75&&hard===0;
    return{
      flag,
      text:flag
        ?`Today you completed ${easy} easier tasks — great momentum, but slot one harder block when energy is higher.`
        :''
    };
  }

  function reviewBeforeTests(){
    if(typeof tasks==='undefined')return[];
    const now=new Date();now.setHours(0,0,0,0);
    const out=[];
    tasks.filter(t=>!t.done&&(t.type==='test'||t.type==='quiz')&&t.date).forEach(t=>{
      const d=new Date(t.date+'T00:00:00');
      const days=Math.floor((d-now)/86400000);
      if(days>=1&&days<=10){
        const sub=typeof getSubjects==='function'?getSubjects()[t.subject]:null;
        out.push({
          label:`Review: ${sub?sub.short+' — ':''}${t.name.slice(0,40)}`,
          days,
          subject:t.subject||'',
          before:t.date,
        });
      }
    });
    return out;
  }

  function addReviewTasks(){
    if(typeof tasks==='undefined')return 0;
    const sug=reviewBeforeTests();
    const existing=new Set(tasks.map(t=>t.name));
    let n=0;
    const now=new Date();now.setHours(0,0,0,0);
    sug.forEach(s=>{
      if(existing.has(s.label))return;
      const exam=new Date(s.before+'T12:00:00');
      const rd=new Date(exam);rd.setDate(rd.getDate()-2);
      if(rd<=now)return;
      const t={
        id:Date.now()+Math.random()+n,name:s.label,date:rd.toISOString().slice(0,10),subject:s.subject||'',priority:'med',type:'reading',
        estTime:45,difficulty:2,notes:'',subtasks:[],done:false,rescheduled:0,createdAt:Date.now(),fluxReviewFor:true,
      };
      t.urgencyScore=typeof calcUrgency==='function'?calcUrgency(t):0;
      tasks.unshift(t);
      existing.add(s.label);
      n++;
    });
    if(n){
      save('tasks',tasks);
      if(typeof syncKey==='function')syncKey('tasks',tasks);
      if(typeof renderTasks==='function')renderTasks();
      if(typeof renderCalendar==='function')renderCalendar();
      if(typeof showToast==='function')showToast(`Added ${n} review task(s)`,'success');
    }
    return n;
  }

  function burnoutSignals(){
    const mh=typeof moodHistory!=='undefined'?moodHistory:[];
    const last=mh.slice(-7);
    const hiStress=last.filter(m=>parseInt(m.stress,10)>=8).length;
    const bias=procrastinationSubjects().length;
    const night=readBias();
    let lateSubs=0;
    Object.values(night).forEach(r=>{if((r.n||0)>((r.d||0)+2))lateSubs++;});
    const risk=hiStress>=4||lateSubs>=3;
    return{
      risk,
      text:risk
        ?'Signals: elevated stress check-ins and/or many late-night completions — shorten tomorrow’s list and protect sleep.'
        :'No strong burnout pattern in recent data — keep monitoring mood.'
    };
  }

  function effortVariance(){
    const log=typeof load==='function'?load('flux_session_log',[]):[];
    const bySub={};
    log.forEach(e=>{
      const k=e.subject||'—';
      if(!bySub[k])bySub[k]=[];
      bySub[k].push(e.mins||0);
    });
    let worst='',maxV=0;
    Object.entries(bySub).forEach(([k,arr])=>{
      if(arr.length<3)return;
      const mean=arr.reduce((a,b)=>a+b,0)/arr.length;
      const v=Math.sqrt(arr.reduce((s,x)=>s+Math.pow(x-mean,2),0)/arr.length);
      if(v>maxV){maxV=v;worst=k;}
    });
    return worst?`Most uneven focus: ${worst} (time per session varies). Try consistent 25–40m blocks.`:'Log a few more focus sessions per subject to see effort balance.';
  }

  function sessionBreakHint(){
    const log=typeof sessionLog!=='undefined'?sessionLog:(typeof load==='function'?load('flux_session_log',[]):[]);
    const ts=typeof todayStr==='function'?todayStr():'';
    const today=log.filter(e=>e.date===ts);
    const sum=today.reduce((a,x)=>a+(x.mins||0),0);
    const lastSess=today.slice(-1)[0];
    if(sum>=90){
      const prev=typeof load==='function'?Number(load(KEY_BREAK,0))||0:Number(rawLoad(KEY_BREAK,0))||0;
      if(Date.now()-prev>12*60*1000){
        if(typeof save==='function')save(KEY_BREAK,Date.now());
        else rawSave(KEY_BREAK,Date.now());
        return`You've logged ${sum}m focus today — take a 10–15m break before the next block.`;
      }
    }
    return lastSess&&(lastSess.mins||0)>=50?`After ~${lastSess.mins}m in one sitting, stretch and look away from the screen.`:'';
  }

  function freeTimeRealistic(){
    const schoolH=(typeof classes!=='undefined'&&classes)?Math.min(9,classes.length*1.2):6.5;
    const ecH=(typeof extras!=='undefined'&&extras)?extras.reduce((s,e)=>s+(parseFloat(e.hours)||0),0)*0.15:0;
    const sleep=8;
    const habit=1.5;
    const avail=Math.max(0,24-schoolH-ecH-sleep-habit);
    return`~${avail.toFixed(1)}h/day discretionary (est.: ${schoolH.toFixed(1)}h school blocks, ${ecH.toFixed(1)}h ECs, ${sleep}h sleep, ${habit}h routines). Tune classes & ECs in School / Extracurriculars.`;
  }

  function suggestTagsForTask(t){
    const tags=[];
    const n=(t.name||'').toLowerCase();
    if(/\bexam|final|midterm\b/i.test(n))tags.push('#exam');
    if(/\bessay|paper|thesis\b/i.test(n))tags.push('#writing');
    if(/\blab|experiment\b/i.test(n))tags.push('#lab');
    if(/\bread|chapter|pages\b/i.test(n))tags.push('#reading');
    if((t.difficulty||3)>=4)tags.push('#hard');
    if((t.estTime||0)>=90)tags.push('#long');
    return[...new Set(tags)];
  }

  function suggestTagsForNote(note){
    const raw=(note.title||'')+' '+strip(note.body||'');
    const tags=[];
    if(/formula|equation|proof/i.test(raw))tags.push('#STEM');
    if(/vocab|grammar|essay/i.test(raw))tags.push('#language');
    if(/history|timeline|war/i.test(raw))tags.push('#history');
    if(/due|homework|assignment/i.test(raw))tags.push('#action');
    return[...new Set(tags)];
  }

  function applyAutoTags(){
    if(typeof tasks==='undefined')return 0;
    let n=0;
    tasks.forEach(t=>{
      if(t.done)return;
      const s=suggestTagsForTask(t);
      if(s.length){t.fluxTags=s;n++;}
    });
    if(n){
      save('tasks',tasks);
      if(typeof syncKey==='function')syncKey('tasks',tasks);
      if(typeof renderTasks==='function')renderTasks();
      if(typeof showToast==='function')showToast('Applied AI tag hints to pending tasks','success');
    }
    return n;
  }

  function applyAutoTagsNotes(){
    if(typeof notes==='undefined'||!Array.isArray(notes))return 0;
    let n=0;
    notes.forEach(note=>{
      const s=suggestTagsForNote(note);
      if(s.length){note.fluxTags=s;n++;}
    });
    if(n){
      save('flux_notes',notes);
      if(typeof syncKey==='function')syncKey('notes',notes);
      if(typeof renderNotesList==='function')renderNotesList();
      if(typeof showToast==='function')showToast('Applied tag hints to notes','success');
    }
    return n;
  }

  function fixSchedule(){
    lightenOverloadedDays();
    rescheduleProcrastinationEarlier();
    if(typeof FluxIntel!=='undefined'&&FluxIntel.rollOverdueForward)FluxIntel.rollOverdueForward();
  }

  function getExplainLevel(){
    if(typeof window.fluxLoadStoredString==='function')return window.fluxLoadStoredString(KEY_EXPLAIN,'ib');
    const v=rawLoad(KEY_EXPLAIN,'ib');
    return v!=null&&String(v).length?String(v):'ib';
  }
  function setExplainLevel(v){
    const s=v==='eli5'?'eli5':'ib';
    if(typeof window.fluxSaveStoredString==='function')window.fluxSaveStoredString(KEY_EXPLAIN,s);
    else rawSave(KEY_EXPLAIN,s);
    render();
  }

  async function runWeeklyReflection(){
    const el=document.getElementById('fluxMegaWeeklyOut');
    if(!el)return;
    const lvl=getExplainLevel();
    el.innerHTML='<span class="flux-muted">Writing reflection…</span>';
    try{
      const log=typeof load==='function'?load('flux_session_log',[]):[];
      const cut=Date.now()-7*86400000;
      const sessMins=log.filter(e=>new Date((e.date||'')+'T12:00:00').getTime()>=cut).reduce((a,e)=>a+(e.mins||0),0);
      const doneWeek=(typeof tasks!=='undefined'?tasks:[]).filter(t=>t.done&&t.completedAt&&t.completedAt>=cut).length;
      const sys=lvl==='eli5'
        ?'Write a very simple weekly reflection a smart 10-year-old could follow. 3 short bullets.'
        :'Write an IB-level concise weekly reflection: habits, academics, EC balance. 3–4 bullets, formal tone.';
      const res=await fetch(typeof API!=='undefined'?API.ai:'',{method:'POST',headers:typeof API_HEADERS!=='undefined'?API_HEADERS:{},body:JSON.stringify({
        system:sys,
        messages:[{role:'user',content:`This week: ${doneWeek} tasks completed, ~${sessMins} minutes in focus sessions. Comment on sustainability and next week.`}],
      })});
      const data=await res.json().catch(()=>({}));
      const txt=(data.content?.[0]?.text||'').replace(/```[\s\S]*?```/g,'').trim();
      el.innerHTML=txt?`<div class="flux-mega-aiout">${typeof fmtAI==='function'?fmtAI(txt):esc(txt)}</div>`:`<span style="color:var(--red)">Could not generate.</span>`;
    }catch(e){
      el.innerHTML=`<span style="color:var(--red)">${esc(e.message||'Error')}</span>`;
    }
  }

  async function runStudyGuide(){
    const el=document.getElementById('fluxMegaGuideOut');
    if(!el)return;
    const note=(typeof notes!=='undefined'&&notes.length)?notes.find(n=>strip(n.body||'').length>20)||notes[0]:null;
    if(!note||!strip(note.body||'').trim()){
      el.innerHTML='<span style="color:var(--muted)">Add a note with content first.</span>';
      if(typeof nav==='function')nav('notes');
      return;
    }
    const lvl=getExplainLevel();
    const sys=lvl==='eli5'
      ?'Turn notes into a simple study guide: big headings, tiny words, analogies where helpful.'
      :'Produce a rigorous IB-style study guide: learning outcomes, command terms, and synthesis.';
    el.innerHTML='<span class="flux-muted">Generating study guide…</span>';
    try{
      const body=strip(note.body||'').slice(0,12000);
      const res=await fetch(typeof API!=='undefined'?API.ai:'',{method:'POST',headers:typeof API_HEADERS!=='undefined'?API_HEADERS:{},body:JSON.stringify({
        system:sys,
        messages:[{role:'user',content:`From these notes titled "${note.title||'Notes'}":\n\n${body}`}],
      })});
      const data=await res.json().catch(()=>({}));
      const txt=(data.content?.[0]?.text||'').replace(/```[\s\S]*?```/g,'').trim();
      el.innerHTML=txt?`<div class="flux-mega-aiout">${typeof fmtAI==='function'?fmtAI(txt):esc(txt)}</div>`:`<span style="color:var(--red)">No response.</span>`;
    }catch(e){
      el.innerHTML=`<span style="color:var(--red)">${esc(e.message||'Error')}</span>`;
    }
  }

  function splitFirstBig(){
    const t=(typeof tasks!=='undefined'?tasks:[]).find(x=>!x.done&&(x.estTime||0)>=75);
    if(!t){if(typeof showToast==='function')showToast('No large pending task (≥75m est) found','info');return;}
    if(typeof breakItDown==='function')breakItDown(t.id);
  }

  function render(){
    const root=document.getElementById('fluxAiMegaPanel');
    if(!root)return;
    const order=studyOrderWithReasons(6);
    const sim=finishEverythingSim();
    const comp=deadlineCompression();
    const fake=fakeProductivity();
    const reviews=reviewBeforeTests();
    const burn=burnoutSignals();
    const breakT=sessionBreakHint();
    const lvl=getExplainLevel();

    root.innerHTML=`
<div class="flux-mega-card card">
  <h3 class="flux-mega-title">🧠 Flux AI Command Center</h3>
  <p class="flux-mega-sub">History-aware estimates, schedule relief, study order, and optional AI for guides & reflections.</p>
  ${(()=>{
    const ts=typeof todayStr==='function'?todayStr():'';
    const list=typeof loadRestDaysList==='function'?loadRestDaysList():[];
    const soon=list.filter(r=>r.date>=ts).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
    if(!soon.length)return'';
    return`<p class="flux-mega-rest-hint" style="font-size:.76rem;color:var(--muted2);margin:-4px 0 12px;line-height:1.5">Upcoming rest days (no crunch math): ${soon.map(r=>`${r.kind==='sick'?'🤒':'🛋'} ${r.date}`).join(' · ')} — set in <strong>Settings</strong>.</p>`;
  })()}

  <div class="flux-mega-toolbar">
    <button type="button" class="btn-sec flux-mega-btn" onclick="FluxMega.fixSchedule()">Fix my schedule</button>
    <button type="button" class="btn-sec flux-mega-btn" onclick="FluxMega.lightenOverloadedDays()">Lighten busy days</button>
    <button type="button" class="btn-sec flux-mega-btn" onclick="FluxMega.rescheduleProcrastinationEarlier()">Earlier dates for late-night subjects</button>
    <button type="button" class="btn-sec flux-mega-btn" onclick="FluxMega.splitFirstBig()">Auto-split big task</button>
    <button type="button" class="btn-sec flux-mega-btn" onclick="FluxMega.addReviewTasks()">Add review sessions before tests</button>
    <button type="button" class="btn-sec flux-mega-btn" onclick="FluxMega.applyAutoTags();FluxMega.applyAutoTagsNotes()">Auto-tag tasks & notes</button>
  </div>

  <div class="flux-mega-grid">
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Predicted time · learn from history</div>
      <p class="flux-mega-p">Estimates use per-subject actual vs planned time when you log effort. Shown on task chips as “avg” where available.</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Night procrastination pattern</div>
      <p class="flux-mega-p">${procrastinationSubjects().map(p=>esc(p.msg)).join('<br>')||'Complete a few more tasks to detect late-night subject patterns.'}</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">If I start now — finish everything?</div>
      <p class="flux-mega-p"><strong>${sim.verdict?'On track':'Tight on time'}</strong> — ${esc(sim.msg)}</p>
      <p class="flux-mega-mini">Today ~${sim.todayFreeMin}m realistic focus · Week ~${sim.weekFreeMin}m rough capacity</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Deadline compression</div>
      <p class="flux-mega-p">${comp.show?esc(comp.text)+` (${comp.overloadMin}m due today vs ~${comp.freeMin}m free)`:'Loads align with remaining time today.'}</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Fake productivity radar</div>
      <p class="flux-mega-p">${fake.flag?esc(fake.text):'Balance of easy vs hard tasks today looks fine.'}</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Burnout signals</div>
      <p class="flux-mega-p">${esc(burn.text)}</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Break timing</div>
      <p class="flux-mega-p">${breakT?esc(breakT):'Take breaks every ~45–60m of deep work.'}</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Effort across subjects</div>
      <p class="flux-mega-p">${esc(effortVariance())}</p>
    </div>
    <div class="flux-mega-block">
      <div class="flux-mega-kicker">Realistic free time</div>
      <p class="flux-mega-p">${esc(freeTimeRealistic())}</p>
    </div>
  </div>

  <div class="flux-mega-block flux-mega-wide">
    <div class="flux-mega-kicker">Best study order (not just one “next” task)</div>
    <ol class="flux-mega-ol">${order.map(o=>`<li><strong>${esc(o.task.name)}</strong> <span class="flux-mega-why">— ${esc(o.why)}</span></li>`).join('')||'<li class="flux-muted">Nothing pending.</li>'}</ol>
    <details class="flux-mega-details"><summary>Why this order (plain text)</summary>
      <pre class="flux-mega-pre">${esc(explainScheduling(order).join('\n'))}</pre>
    </details>
  </div>

  <div class="flux-mega-block flux-mega-wide">
    <div class="flux-mega-kicker">Grade impact (heuristic)</div>
    <ul class="flux-mega-ul">${(typeof tasks!=='undefined'?tasks:[]).filter(t=>!t.done&&t.date).slice(0,8).map(t=>`<li>${esc(t.name.slice(0,56))} · ~${gradeImpactHint(t)}% model weight</li>`).join('')||'<li class="flux-muted">No dated tasks.</li>'}</ul>
  </div>

  <div class="flux-mega-block flux-mega-wide">
    <div class="flux-mega-kicker">Review before assessments</div>
    <ul class="flux-mega-ul">${reviews.length?reviews.map(r=>`<li>${esc(r.label)} (${r.days}d)</li>`).join(''):'<li class="flux-muted">No upcoming tests/quizzes in window.</li>'}</ul>
  </div>

  <div class="flux-mega-airow">
    <div>
      <div class="flux-mega-kicker">Explain level</div>
      <div class="flux-mega-toggle">
        <button type="button" class="${lvl==='eli5'?'active':''}" onclick="FluxMega.setExplainLevel('eli5')">Like I’m 5</button>
        <button type="button" class="${lvl==='ib'?'active':''}" onclick="FluxMega.setExplainLevel('ib')">IB level</button>
      </div>
    </div>
    <button type="button" class="btn-sec" onclick="FluxMega.runWeeklyReflection()">Weekly reflection (AI)</button>
    <button type="button" class="btn-sec" onclick="FluxMega.runStudyGuide()">Study guide from notes (AI)</button>
  </div>
  <div id="fluxMegaWeeklyOut" class="flux-mega-out"></div>
  <div id="fluxMegaGuideOut" class="flux-mega-out"></div>
</div>`;
  }

  let _megaInited=false;
  function init(){
    if(_megaInited)return;
    _megaInited=true;
    if(typeof FluxBus!=='undefined'&&FluxBus.on){
      FluxBus.on('task_completed',onTaskComplete);
    }
  }

  window.FluxMega={
    init,
    render,
    predictedEst,
    procrastinationSubjects,
    rescheduleProcrastinationEarlier,
    lightenOverloadedDays,
    fixSchedule,
    studyOrderWithReasons,
    explainScheduling,
    finishEverythingSim,
    deadlineCompression,
    gradeImpactHint,
    fakeProductivity,
    reviewBeforeTests,
    addReviewTasks,
    burnoutSignals,
    effortVariance,
    sessionBreakHint,
    freeTimeRealistic,
    suggestTagsForTask,
    applyAutoTags,
    applyAutoTagsNotes,
    runWeeklyReflection,
    runStudyGuide,
    splitFirstBig,
    getExplainLevel,
    setExplainLevel,
  };

  function boot(){
    if(!document.getElementById('fluxAiMegaPanel'))return;
    init();
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
