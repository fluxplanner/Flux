/**
 * Flux AI Orchestrator — Claude-style agent layer on top of Flux (additive).
 *
 * Depends on globals from app.js + flux-ai-mega.js: load, save, tasks, moodHistory,
 * todayStr, calcUrgency, syncKey, renderCalendar, renderTasks, renderStats, showToast, nav,
 * API, API_HEADERS, buildFullPlannerContextForAI (optional), FluxMega, FluxBus, FluxIntel,
 * appendMsg, fmtAI, esc (optional; we inline esc), openFluxAgent, sendAI (for scratch insert).
 *
 * Example tool invocation (from model reply):
 *   ```flux_tool
 *   {"name":"optimizeDayPlan","args":{"dryRun":true}}
 *   ```
 *
 * Example scenario (energy + weak subjects + deadlines):
 *   User: "/plan I have low energy but two tests this week"
 *   → Decision engine flags urgency + low energy; system prompt includes ranked tasks via
 *   adjustForEnergyLevel + analyzeWeakSubjects; model may call predictStudyTime / createScheduleBlock.
 */
(function(){
  const MEM_KEY='flux_ai_agent_memory_v1';
  const MAX_RECS=36;
  const MAX_TOOL_FOLLOWUPS=1;

  function esc(s){
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function loadMem(){
    const o = load(MEM_KEY, {});
    return o && typeof o === 'object' ? o : {};
  }
  function saveMem(m){
    try{ save(MEM_KEY, m); }catch(e){}
  }

  function bumpSubjectCompletion(subject,done){
    const m=loadMem();
    m.subjectCompletions=m.subjectCompletions||{};
    const k=subject||'—';
    m.subjectCompletions[k]=m.subjectCompletions[k]||{done:0,pending:0};
    if(done)m.subjectCompletions[k].done++;
    saveMem(m);
  }

  function recordRecommendation(summary,tools){
    const m=loadMem();
    m.recommendations=m.recommendations||[];
    m.recommendations.push({t:Date.now(),summary:String(summary||'').slice(0,420),tools:tools||[]});
    if(m.recommendations.length>MAX_RECS)m.recommendations=m.recommendations.slice(-MAX_RECS);
    saveMem(m);
  }

  function recordToolOutcome(name,ok,detail){
    const m=loadMem();
    m.toolLog=m.toolLog||[];
    m.toolLog.push({t:Date.now(),name,ok:!!ok,detail:String(detail||'').slice(0,200)});
    if(m.toolLog.length>60)m.toolLog=m.toolLog.slice(-60);
    saveMem(m);
  }

  function updateFocusPatternFromSession(payload){
    if(!payload||payload.mins==null)return;
    const m=loadMem();
    m.hourBuckets=m.hourBuckets||{};
    const h=new Date().getHours();
    m.hourBuckets[h]=(m.hourBuckets[h]||0)+(payload.mins||0);
    saveMem(m);
  }

  /** Rank subjects by workload signals (overdue, reschedules) — no gradebook data. */
  function analyzeWeakSubjects(){
    const now=new Date();now.setHours(0,0,0,0);
    const byKey={};
    const bump=(key,field,n=1)=>{
      if(!key)return;
      if(!byKey[key])byKey[key]={subject:key,overdue:0,reschedules:0,pending:0};
      byKey[key][field]+=n;
    };
    if(typeof tasks!=='undefined'&&Array.isArray(tasks)){
      tasks.filter(t=>!t.done).forEach(t=>{
        const k=t.subject||'(untagged)';
        bump(k,'pending',1);
        if(t.date){
          try{
            if(new Date(t.date+'T00:00:00')<now)bump(k,'overdue',1);
          }catch(_){}
        }
        const rs=t.rescheduled||0;
        if(rs>=2)bump(k,'reschedules',rs);
      });
    }
    const rows=Object.values(byKey).map(r=>({
      subject:r.subject,
      strain:r.overdue*5+r.reschedules+r.pending,
      overdue:r.overdue,
      reschedules:r.reschedules,
      pending:r.pending,
    })).filter(r=>r.strain>0).sort((a,b)=>b.strain-a.strain);
    const weakest=rows.slice(0,5);
    let proc=[];
    if(window.FluxMega&&typeof FluxMega.procrastinationSubjects==='function')
      proc=FluxMega.procrastinationSubjects().slice(0,4);
    return{
      weakest,
      strongest:rows.slice().sort((a,b)=>a.strain-b.strain).slice(0,3),
      procrastinationHints:proc,
      narrative:weakest.length
        ?`Highest strain (overdue / reschedules / open): ${weakest.map(w=>`${w.subject} (score ${w.strain})`).join('; ')}.`
        :'No strained subjects detected from tasks — add due dates and subjects for clearer signals.',
    };
  }

  function predictStudyTime(args){
    const taskId=args&&args.taskId;
    const subject=(args&&args.subject)||'';
    let task=null;
    if(typeof tasks!=='undefined'&&taskId!=null)
      task=tasks.find(t=>String(t.id)===String(taskId));
    if(!task&&subject&&typeof tasks!=='undefined')
      task=tasks.find(t=>!t.done&&(t.subject===subject||String(t.name).toLowerCase().includes(subject.toLowerCase())));
    if(!task)return{ok:false,error:'Task not found — pass taskId or subject.'};
    let est=task.estTime||30;
    if(window.FluxMega&&FluxMega.predictedEst)est=FluxMega.predictedEst(task);
    return{
      ok:true,
      task:{id:task.id,name:task.name,subject:task.subject||'',type:task.type||'hw'},
      predictedMinutes:Math.round(est),
      note:'Uses learned per-subject adjustments when Flux Estimate Learn has data.',
    };
  }

  function createScheduleBlock(args){
    if(!args||!args.title||!args.date)return{ok:false,error:'Need title and date (YYYY-MM-DD).'};
    const title=String(args.title).trim();
    const date=String(args.date).trim();
    const time=String(args.time||args.startTime||'').trim();
    const notes=String(args.notes||'').trim();
    const scope=args.scope==='outside'?'outside':'school';
    const kind=(args.kind||'event').toLowerCase();
    if(kind==='task'){
      if(typeof tasks==='undefined'||typeof save!=='function'||typeof calcUrgency!=='function')
        return{ok:false,error:'Planner not ready.'};
      const t={
        id:Date.now()+Math.random(),
        name:title,
        date,
        time,
        subject:args.subject||'',
        priority:args.priority||'med',
        type:args.taskType||'hw',
        notes,
        done:false,
        rescheduled:0,
        createdAt:Date.now(),
        scope,
        estTime:parseInt(args.estTime,10)||0,
        difficulty:parseInt(args.difficulty,10)||3,
        subtasks:[],
      };
      t.urgencyScore=calcUrgency(t);
      tasks.unshift(t);
      save('tasks',tasks);
      if(typeof syncKey==='function')syncKey('tasks',tasks);
      if(typeof renderTasks==='function')renderTasks();
      if(typeof renderStats==='function')renderStats();
      if(typeof renderCalendar==='function')renderCalendar();
      if(typeof showToast==='function')showToast('✓ Added task from AI tool','success');
      return{ok:true,created:{kind:'task',id:t.id}};
    }
    const events=typeof load==='function'?load('flux_events',[]):[];
    const ev={id:String(Date.now()),title,date,time,notes,scope};
    events.push(ev);
    if(typeof save==='function')save('flux_events',events);
    if(typeof syncKey==='function')syncKey('events',1);
    if(typeof renderCalendar==='function')renderCalendar();
    if(typeof showToast==='function')showToast('✓ Added calendar block','success');
    return{ok:true,created:{kind:'event',id:ev.id}};
  }

  function optimizeDayPlan(args){
    const dryRun=!(args&&args.apply);
    const out={dryRun,actions:[],summary:''};
    if(window.FluxMega&&FluxMega.studyOrderWithReasons){
      const ord=FluxMega.studyOrderWithReasons(args&&args.limit?parseInt(args.limit,10):8);
      out.studyOrder=ord.map(o=>({name:o.task.name,why:o.why,score:Math.round(o.score*10)/10}));
    }
    if(window.FluxMega&&FluxMega.finishEverythingSim){
      const sim=FluxMega.finishEverythingSim();
      out.capacity=sim;
    }
    if(!dryRun){
      if(FluxMega.fixSchedule)FluxMega.fixSchedule();
      out.actions.push('fixSchedule');
      recordToolOutcome('optimizeDayPlan',true,'apply');
    }else{
      out.summary='Dry run — no schedule mutations. Pass {"apply":true} to run Fix my schedule + related relief.';
      recordToolOutcome('optimizeDayPlan',true,'dryRun');
    }
    return{ok:true,...out};
  }

  function readFluxEnergy(){
    if (typeof window.readFluxEnergyLevel === 'function') return window.readFluxEnergyLevel();
    const v = typeof load === 'function' ? load('flux_energy', 3) : 3;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 3 : Math.max(1, Math.min(5, n));
  }

  function adjustForEnergyLevel(args){
    const level=args&&args.level!=null?parseInt(args.level,10):readFluxEnergy();
    const energy=isNaN(level)?3:Math.max(1,Math.min(5,level));
    if(args&&args.persist&&typeof save==='function')save('flux_energy', energy);
    if(!window.FluxMega||!FluxMega.studyOrderWithReasons)return{ok:false,error:'FluxMega not available'};
    const ranked=FluxMega.studyOrderWithReasons(12).map(o=>{
      const d=o.task.difficulty||3;
      let adj=o.score;
      let tag='';
      if(energy<=2){if(d<=2){adj+=12;tag='lighter fit';}if(d>=4){adj-=14;tag='heavy — defer if tired';}}
      if(energy>=4){if(['project','essay','lab'].includes(o.task.type)){adj+=10;tag='deep work window';}}
      return{name:o.task.name,adjustedScore:Math.round(adj*10)/10,hint:tag||o.why,subject:o.task.subject};
    }).sort((a,b)=>b.adjustedScore-a.adjustedScore);
    return{ok:true,energy,ranked:ranked.slice(0,10),breakSuggestion:energy<=2?'Prefer 20–30m blocks with breaks.':'You can sustain longer blocks — still break every ~50m.'};
  }

  const TOOL_DEFS=[
    {name:'createScheduleBlock',description:'Create a calendar event or school task with date (and optional time).',params:'{title,date,time?,kind?:"event"|"task",subject?,priority?,notes?,scope?}'},
    {name:'predictStudyTime',description:'Predict minutes for a task using Flux learn + estimates.',params:'{taskId?|subject?}'},
    {name:'analyzeWeakSubjects',description:'Rank strained subjects from task overload + procrastination hints.',params:'{}'},
    {name:'optimizeDayPlan',description:'Return study order + capacity; set apply:true to run schedule relief (same as Fix my schedule).',params:'{apply?:boolean,limit?}'},
    {name:'adjustForEnergyLevel',description:'Re-rank tasks for energy 1–5; set persist:true to save energy slider.',params:'{level?:1-5,persist?:boolean}'},
  ];

  function runDecisionEngine(userText){
    const now=new Date();now.setHours(0,0,0,0);
    const ut=(userText||'').toLowerCase();
    const urgent=[];
    if(typeof tasks!=='undefined'){
      tasks.filter(t=>!t.done&&t.date).forEach(t=>{
        const d=new Date(t.date+'T00:00:00');
        const days=(d-now)/86400000;
        if(days>=0&&days<=2)urgent.push({name:t.name,date:t.date,type:t.type,priority:t.priority});
      });
    }
    const tests=window.FluxMega&&FluxMega.reviewBeforeTests?FluxMega.reviewBeforeTests().slice(0,6):[];
    const energy=readFluxEnergy();
    let stress=null;
    try{
      const mh=typeof moodHistory!=='undefined'&&moodHistory?.length?moodHistory[moodHistory.length-1]:null;
      if(mh&&mh.stress!=null)stress=parseInt(mh.stress,10);
    }catch(e){}
    const burn=window.FluxMega&&FluxMega.burnoutSignals?FluxMega.burnoutSignals():null;
    const compress=window.FluxMega&&FluxMega.deadlineCompression?FluxMega.deadlineCompression():null;
    const suggestedTools=[];
    if(/fix|reschedule|overload|schedule/i.test(ut))suggestedTools.push('optimizeDayPlan');
    if(/energy|tired|exhaust|burn/i.test(ut))suggestedTools.push('adjustForEnergyLevel');
    if(/weak|overload|behind|gpa|subject/i.test(ut))suggestedTools.push('analyzeWeakSubjects');
    if(/block|calendar|event|plan afternoon/i.test(ut))suggestedTools.push('createScheduleBlock');
    if(/how long|estimate|minutes/i.test(ut))suggestedTools.push('predictStudyTime');
    if(!suggestedTools.length){
      if(urgent.length)suggestedTools.push('optimizeDayPlan','adjustForEnergyLevel');
      if(tests.length)suggestedTools.push('analyzeWeakSubjects');
    }
    return{
      urgentDeadlines:urgent.slice(0,8),
      upcomingAssessments:tests,
      energyLevel:energy,
      latestStress:stress,
      burnout:burn,
      deadlineCompression:compress,
      suggestedTools:[...new Set(suggestedTools)],
      timestamp:new Date().toISOString(),
    };
  }

  function memorySummaryForPrompt(){
    const m=loadMem();
    const subs=Object.entries(m.subjectCompletions||{})
      .map(([k,v])=>({k,r:(v.done||0)/Math.max(1,(v.done||0)+(v.pending||0))}))
      .sort((a,b)=>b.r-a.r)
      .slice(0,4)
      .map(x=>x.k);
    const topHours=Object.entries(m.hourBuckets||{})
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3)
      .map(([h,mins])=>`${h}:00 (~${Math.round(mins)}m logged)`);
    const lastRec=(m.recommendations||[]).slice(-2).map(r=>r.summary);
    return{
      frequentCompletionSubjects:subs,
      focusHours:topHours,
      recentAiRecaps:lastRec,
    };
  }

  function augmentSystemPrompt(base,userText){
    const dec=runDecisionEngine(userText);
    const mem=memorySummaryForPrompt();
    const weak=analyzeWeakSubjects();
    const toolBlock=TOOL_DEFS.map(t=>`- ${t.name} ${t.params}`).join('\n');
    const extra=`

---
## Flux Agent Layer (live)
You can call **tools** to read or safely change the planner. When you need tool data or to act, output ONE OR MORE blocks exactly like:
\`\`\`flux_tool
{"name":"toolName","args":{...}}
\`\`\`
Available tools:
${toolBlock}
Rules: Never invent task IDs — copy from TASKS in the snapshot. Prefer dryRun optimizeDayPlan unless the student asked to change the schedule. createScheduleBlock requires real dates (YYYY-MM-DD).

### Decision snapshot (computed client-side)
${JSON.stringify(dec)}

### Subject strain (tasks + habits)
${JSON.stringify({weakest:weak.weakest.slice(0,4),leastStrained:weak.strongest.slice(0,3),hints:weak.procrastinationHints})}

### Personalization memory (learned in Flux; advisory only)
${JSON.stringify(mem)}
---
`;
    return base+extra;
  }

  let _thinkEl=null;
  function beginThinking(thinkEl){
    _thinkEl=thinkEl;
    const bub=thinkEl&&thinkEl.querySelector('.ai-bub');
    if(!bub)return;
    let log=document.getElementById('fluxAiThinkLog');
    if(!log){
      log=document.createElement('div');
      log.id='fluxAiThinkLog';
      log.className='flux-ai-think-log';
      log.setAttribute('aria-live','polite');
      const thinkRow=bub.querySelector('.ai-think');
      if(thinkRow)bub.insertBefore(log,thinkRow);
      else bub.appendChild(log);
    }else log.innerHTML='';
    thinkingStep('Reading planner context…');
  }

  function thinkingStep(msg){
    const log=document.getElementById('fluxAiThinkLog');
    if(!log)return;
    const row=document.createElement('div');
    row.className='flux-ai-think-row';
    row.textContent=msg;
    log.appendChild(row);
    const wrap=document.getElementById('aiMsgsWrap');
    if(wrap)setTimeout(()=>{wrap.scrollTop=wrap.scrollHeight;},20);
  }

  function executeTool(name,args){
    let out;
    try{
      switch(name){
        case 'createScheduleBlock':out=createScheduleBlock(args||{});break;
        case 'predictStudyTime':out=predictStudyTime(args||{});break;
        case 'analyzeWeakSubjects':out={ok:true,...analyzeWeakSubjects()};break;
        case 'optimizeDayPlan':out=optimizeDayPlan(args||{});break;
        case 'adjustForEnergyLevel':out=adjustForEnergyLevel(args||{});break;
        default:out={ok:false,error:'Unknown tool: '+name};
      }
    }catch(err){
      out={ok:false,error:err.message||String(err)};
    }
    recordToolOutcome(name,out&&out.ok,(out&&out.error)||'ok');
    return out;
  }

  function parseFluxTools(text){
    const re=/```flux_tool\s*([\s\S]*?)```/gi;
    const calls=[];
    let m;
    while((m=re.exec(text))){
      try{
        const j=JSON.parse(m[1].trim());
        if(j&&j.name)calls.push({name:j.name,args:j.args||{}});
      }catch(e){}
    }
    return calls;
  }

  function stripFluxTools(text){
    return String(text||'').replace(/```flux_tool\s*[\s\S]*?```/gi,'').replace(/\n{3,}/g,'\n\n').trim();
  }

  function renderToolCard(results){
    const wrap=document.getElementById('aiMsgs');
    if(!wrap||!results.length)return;
    const div=document.createElement('div');
    div.className='ai-msg bot flux-tool-card-wrap';
    const body=results.map(r=>`<div class="flux-tool-card"><div class="flux-tool-card-title">${esc(r.name)}</div><pre class="flux-tool-pre">${esc(JSON.stringify(r.result,null,2))}</pre></div>`).join('');
    div.innerHTML=`<div class="ai-av bot">⚙</div><div class="ai-bub bot flux-tool-bub"><div class="flux-tool-card-h">Tool results</div>${body}</div>`;
    wrap.appendChild(div);
    const sc=document.getElementById('aiMsgsWrap');
    if(sc)setTimeout(()=>{sc.scrollTop=sc.scrollHeight;},30);
  }

  function updateScratchFromAssistant(cleanText){
    const ta=document.getElementById('fluxAiScratchTa');
    const panel=document.getElementById('fluxAiScratch');
    if(!ta||!panel)return;
    if(!cleanText||cleanText.length<80)return;
    ta.value=cleanText;
    panel.style.display='block';
  }

  function applyScratchToInput(){
    const ta=document.getElementById('fluxAiScratchTa');
    const inp=document.getElementById('aiInput');
    if(!ta||!inp)return;
    inp.value=(inp.value?inp.value+'\n\n':'')+ta.value.trim();
    inp.focus();
    try{inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,120)+'px';}catch(e){}
    if(typeof showToast==='function')showToast('Inserted into chat','success');
  }

  function getPaletteCommands(q){
    const qq=(q||'').toLowerCase();
    const cmds=[];
    const add=(o)=>cmds.push(o);
    if(!qq||qq.includes('plan')||qq.includes('/plan'))
      add({icon:'🧭',label:'AI: /plan — study plan with tools',cat:'Flux AI',action:()=>{closeCommandPalette();openFluxAgent({prefill:'/plan Help me build a realistic study plan for the next few days using my tasks, energy, and deadlines.'});}});
    if(!qq||qq.includes('conn')||qq.includes('workspace')||qq.includes('link'))
      add({icon:'🔗',label:'Flux AI: Connections',cat:'Flux AI',action:()=>{closeCommandPalette();if(window.openFluxConnections)window.openFluxConnections();}});
    if(!qq||qq.includes('optim'))
      add({icon:'⚡',label:'AI: /optimize — workload + suggestions',cat:'Flux AI',action:()=>{closeCommandPalette();openFluxAgent({prefill:'/optimize Analyze my workload and suggest what to move or trim (use tools if needed).'});}});
    if(!qq||qq.includes('fix')||qq.includes('schedule'))
      add({icon:'🛠',label:'AI: /fix schedule — run schedule relief',cat:'Flux AI',action:()=>{closeCommandPalette();openFluxAgent({prefill:'/fix Run schedule relief and tell me what changed.'});}});
    if(!qq||qq.includes('weak')||qq.includes('subject'))
      add({icon:'📉',label:'AI: Weak subjects analysis',cat:'Flux AI',action:()=>{closeCommandPalette();openFluxAgent({prefill:'Call analyzeWeakSubjects and tell me what to prioritize.'});}});
    if(!qq||qq.includes('energy'))
      add({icon:'🔋',label:'AI: Adjust plan for energy',cat:'Flux AI',action:()=>{closeCommandPalette();openFluxAgent({prefill:'Use adjustForEnergyLevel for my current slider and suggest task order.'});}});
    if(qq==='/plan'||qq==='/optimize'||qq==='/fix')return cmds;
    return cmds;
  }

  function handleSlashCommand(text){
    const t=text.trim();
    if(t.startsWith('/fix')){
      if(window.FluxMega&&FluxMega.fixSchedule)FluxMega.fixSchedule();
      if(typeof showToast==='function')showToast('Schedule relief applied — see Calendar / tasks','success');
      return 'I ran **Fix my schedule** (same as AI Command Center). Here is what I recommend you review next…';
    }
    if(t.startsWith('/plan')||t.startsWith('/optimize'))
      return null;
    return null;
  }

  function initBus(){
    if(typeof FluxBus==='undefined'||!FluxBus.on)return;
    FluxBus.on('task_completed',function(task){
      bumpSubjectCompletion(task&&task.subject,true);
    });
    FluxBus.on('session_ended',function(payload){
      const mins=payload&&payload.mins!=null?payload.mins:(function(){
        try{
          const log=typeof sessionLog!=='undefined'?sessionLog:(typeof load==='function'?load('flux_session_log',[]):[]);
          const last=(log||[]).slice(-1)[0];
          return last?last.mins:0;
        }catch(e){return 0;}
      })();
      if(mins)updateFocusPatternFromSession({mins:+(mins||0)});
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initBus);
  else initBus();

  window.FluxOrchestrator={
    TOOL_DEFS,
    augmentSystemPrompt,
    runDecisionEngine,
    executeTool,
    parseFluxTools,
    stripFluxTools,
    beginThinking,
    thinkingStep,
    analyzeWeakSubjects,
    predictStudyTime,
    createScheduleBlock,
    optimizeDayPlan,
    adjustForEnergyLevel,
    getPaletteCommands,
    applyScratchToInput,
    updateScratchFromAssistant,
    handleSlashCommand,
    recordRecommendation,
    /** Called from sendAI after assistant reply */
    processAssistantReply(rawReply,toolsRun){
      const calls=parseFluxTools(rawReply);
      if(calls.length){
        thinkingStep('Running Flux tools…');
        const results=calls.map(c=>({name:c.name,result:executeTool(c.name,c.args)}));
        renderToolCard(results);
        toolsRun.push(...calls.map(c=>c.name));
      }
      const forDisplay=stripFluxTools(rawReply);
      updateScratchFromAssistant(forDisplay);
      if(forDisplay)recordRecommendation(forDisplay,toolsRun);
    },
  };
})();
