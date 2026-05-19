#!/usr/bin/env python3
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "public/js/app.js"
text = p.read_text()
changed = []

def sub(old, new, label):
    global text
    if old not in text:
        print(f"SKIP {label}")
        return
    text = text.replace(old, new, 1)
    changed.append(label)

sub(
    "  const addEvBtn=document.getElementById('calAddEventBtn');if(addEvBtn)addEvBtn.style.display='inline-flex';\n  const day=tasks.filter",
    "  const addEvBtn=document.getElementById('calAddEventBtn');if(addEvBtn)addEvBtn.style.display='inline-flex';\n  const addEcBtn=document.getElementById('calAddEcBtn');if(addEcBtn)addEcBtn.style.display='inline-flex';\n  const day=tasks.filter",
    "addEcBtn",
)

sub(
    """  const weekly=weeklyVirtualEventsForDate(ds);
  const el=document.getElementById('calDayTasks');
  if(!day.length&&!events.length&&!weekly.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:4px 0">Nothing scheduled.</motion></motion>';return;}
  const blocks=[];weekly.forEach(w=>blocks.push({k:'w',o:w}));events.forEach(e=>blocks.push({k:'e',o:e}));day.forEach(t=>blocks.push({k:'t',o:t}));
  const ord={w:0,e:1,t:2};""",
    """  const weekly=weeklyVirtualEventsForDate(ds);
  const ecGoalsDay=ecGoalEventsForDate(ds);
  const el=document.getElementById('calDayTasks');
  if(!day.length&&!events.length&&!weekly.length&&!ecGoalsDay.length){el.innerHTML='<motion style="display:none"></motion><div style="color:var(--muted);font-size:.82rem;padding:4px 0">Nothing scheduled.</div>';return;}
  const blocks=[];weekly.forEach(w=>blocks.push({k:'w',o:w}));events.forEach(e=>blocks.push({k:'e',o:e}));ecGoalsDay.forEach(g=>blocks.push({k:'g',o:g}));day.forEach(t=>blocks.push({k:'t',o:t}));
  const ord={w:0,e:1,g:1,t:2};""",
    "renderCalDay blocks",
)
# fix accidental motion in nothing scheduled
text = text.replace(
    "Nothing scheduled.</motion></motion>'",
    "Nothing scheduled.</div>'",
)
text = text.replace(
    "if(!day.length&&!events.length&&!weekly.length&&!ecGoalsDay.length){el.innerHTML='<motion style=\"display:none\"></motion><motion style=\"display:none\"></motion><div",
    "if(!day.length&&!events.length&&!weekly.length&&!ecGoalsDay.length){el.innerHTML='<motion style=\"display:none\"></motion><div",
)
text = text.replace("<motion style=\"display:none\"></motion><div style=\"color:var(--muted)", "<div style=\"color:var(--muted)", 1)

marker = "  el.innerHTML=blocks.map(({k,o})=>{\n    if(k==='w'){"
if "if(k==='g')" not in text[text.find(marker):text.find(marker)+800]:
    sub(
        marker,
        """  el.innerHTML=blocks.map(({k,o})=>{
    if(k==='g'){
      return`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.35);border-radius:10px;margin-bottom:6px"><span style="font-size:.85rem">🎯</span><div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:600;color:var(--gold)">EC milestone</div><div style="font-size:.85rem;font-weight:600">${esc(o.title)}</div></div><button type="button" onclick="event.stopPropagation();nav('goals')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:.78rem;padding:2px 6px">Open</button></div>`;
    }
    if(k==='w'){""",
        "g block",
    )

sub(
    """    if(k==='e'){
      const sch=fluxEventScope(o)==='school';
      return`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(192,132,252,.08);border:1px solid rgba(192,132,252,.2);border-radius:10px;margin-bottom:6px"><span style="font-size:.85rem">📅</span>""",
    """    if(k==='e'){
      const sch=fluxEventScope(o)==='school';
      const isEc=fluxIsEcCalendarItem(o);
      const bg=isEc?'rgba(251,191,36,.1)':'rgba(192,132,252,.08)';
      const br=isEc?'rgba(251,191,36,.35)':'rgba(192,132,252,.2)';
      const ic=isEc?'🎯':'📅';
      return`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${bg};border:1px solid ${br};border-radius:10px;margin-bottom:6px"><span style="font-size:.85rem">${ic}</span>""",
    "e block ec",
)

sub("function openAddEventModal(){", "function openAddEventModal(preferredType){", "openAddEventModal sig")

sub(
    """  setAddEventScope('school');
  setAddEventType('task');
  modal.style.display='flex';
}
function openEditCalendarEventModal(id){""",
    """  setAddEventScope(preferredType==='ec'?'outside':'school');
  setAddEventType(preferredType==='ec'?'ec':'task');
  modal.style.display='flex';
}
function openEditCalendarEventModal(id){""",
    "openAddEventModal body",
)

old_set = """function setAddEventType(type){
  addEventType=type;
  document.getElementById('addEventTypeTask').style.background=type==='task'?'var(--accent)':'';
  document.getElementById('addEventTypeTask').className=type==='task'?'':'btn-sec';
  document.getElementById('addEventTypeEvent').style.background=type==='event'?'var(--accent)':'';
  document.getElementById('addEventTypeEvent').className=type==='event'?'':'btn-sec';
  document.getElementById('addEventSubjectRow').style.display=type==='task'?'block':'none';
  document.getElementById('addEventPriorityRow').style.display=type==='task'?'block':'none';
  const tr=document.getElementById('addEventTimeRow');
  if(tr){
    const lab=tr.querySelector('label');
    if(lab)lab.textContent=type==='task'?'Due time (optional)':'Time (optional)';
  }
}"""

new_set = """function setAddEventType(type){
  addEventType=type;
  const isTask=type==='task';
  const isEc=type==='ec';
  const isEv=type==='event';
  const tBtn=document.getElementById('addEventTypeTask');
  const eBtn=document.getElementById('addEventTypeEvent');
  const ecBtn=document.getElementById('addEventTypeEc');
  if(tBtn){tBtn.style.background=isTask?'var(--accent)':'';tBtn.className=isTask?'':'btn-sec';}
  if(eBtn){eBtn.style.background=isEv?'var(--accent)':'';eBtn.className=isEv?'':'btn-sec';}
  if(ecBtn){ecBtn.style.background=isEc?'var(--accent)':'';ecBtn.className=isEc?'':'btn-sec';}
  const extraRow=document.getElementById('addEventExtraRow');
  if(extraRow)extraRow.style.display=isEc?'block':'none';
  const scopeRow=document.getElementById('addEventScopeRow');
  if(scopeRow)scopeRow.style.display=isEc?'none':'block';
  const subRow=document.getElementById('addEventSubjectRow');
  const priRow=document.getElementById('addEventPriorityRow');
  if(subRow)subRow.style.display=isTask?'block':'none';
  if(priRow)priRow.style.display=isTask?'block':'none';
  if(isEc){
    populateEcSelectOptions(document.getElementById('addEventExtraSelect'));
    setAddEventScope('outside');
  }
  const tr=document.getElementById('addEventTimeRow');
  if(tr){
    const lab=tr.querySelector('label');
    if(lab)lab.textContent=isTask?'Due time (optional)':'Time (optional)';
  }
}"""
sub(old_set, new_set, "setAddEventType")

sub(
    """  }else{
    const events=load('flux_events',[]);
    events.push({id:String(Date.now()),title,date,time:time||'',notes,scope});
    save('flux_events',events);
    syncKey('events',1);
  }
  syncKey('tasks',tasks);
  closeAddEventModal();renderCalendar();
}
function deleteEvent(id){""",
    """  }else if(addEventType==='ec'){
    const extraId=parseInt(document.getElementById('addEventExtraSelect')?.value,10);
    const ex=getExtraById(extraId);
    const finalTitle=title||(ex?.name||'');
    if(!finalTitle){showToast('Pick an activity or enter a title','warning');return;}
    const events=load('flux_events',[]);
    events.push({id:String(Date.now()),title:finalTitle,date,time:time||'',notes,scope:'outside',kind:'ec',extraId:ex?ex.id:undefined});
    save('flux_events',events);
    syncKey('events',1);
  }else{
    const events=load('flux_events',[]);
    events.push({id:String(Date.now()),title,date,time:time||'',notes,scope});
    save('flux_events',events);
    syncKey('events',1);
  }
  syncKey('tasks',tasks);
  closeAddEventModal();renderCalendar();
}
function deleteEvent(id){""",
    "saveAddEvent ec",
)

sub(
    """  const outside=document.getElementById('weeklyScopeOutside')?.checked;
  const rules=getWeeklyRules();
  rules.push({id:String(Date.now()),title,time,weekdays,enabled:true,scope:outside?'outside':'school'});""",
    """  const outside=document.getElementById('weeklyScopeOutside')?.checked;
  const extraLink=document.getElementById('weeklyExtraLink')?.value;
  const extraId=extraLink?parseInt(extraLink,10):null;
  const ex=extraId?getExtraById(extraId):null;
  const finalTitle=ex?ex.name:title;
  const rules=getWeeklyRules();
  rules.push({id:String(Date.now()),title:finalTitle,time,weekdays,enabled:true,scope:outside?'outside':'school',kind:ex?'ec':undefined,extraId:ex?ex.id:undefined});""",
    "addWeeklyRule",
)

sub(
    "  renderWeeklyRulesList();\n}\nfunction renderWeeklyRulesList(){",
    "  renderWeeklyRulesList();\n  fillWeeklyExtraLinkSelect();\n}\nfunction renderWeeklyRulesList(){",
    "loadCalScheduleUI",
)

sub(
    "function removeExtra(id){\n  extras = extras.filter(e => e.id !== id);\n  save('flux_extras', extras);\n  renderExtrasList();\n}",
    "function removeExtra(id){\n  purgeCalendarForExtra(id);\n  extras = extras.filter(e => e.id !== id);\n  save('flux_extras', extras);\n  renderExtrasList();\n}",
    "removeExtra",
)

sub(
    """      <button onclick="editExtra(${e.id})" title="Edit" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.82rem;padding:4px;flex-shrink:0;opacity:.6;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">✎</button>""",
    """      <button type="button" onclick="openEcCalendarScheduleModal(${e.id})" title="Add to calendar" style="background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);color:var(--gold);cursor:pointer;font-size:.72rem;padding:4px 8px;border-radius:8px;flex-shrink:0;font-weight:600">📅</button>
      <button onclick="editExtra(${e.id})" title="Edit" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.82rem;padding:4px;flex-shrink:0;opacity:.6;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">✎</button>""",
    "extras calendar btn",
)

if "ecGoalsDay=ecGoalEventsForDate" not in text.split("const weekly=weeklyVirtualEventsForDate(ds);")[1][:200] if "const weekly=weeklyVirtualEventsForDate(ds);" in text else "":
    sub(
        """  const weekly=weeklyVirtualEventsForDate(ds);
  const el=document.getElementById('calDayTasks');
  if(!day.length&&!events.length&&!weekly.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:4px 0">Nothing scheduled.</div>';return;}
  const blocks=[];weekly.forEach(w=>blocks.push({k:'w',o:w}));events.forEach(e=>blocks.push({k:'e',o:e}));day.forEach(t=>blocks.push({k:'t',o:t}));
  const ord={w:0,e:1,t:2};""",
        """  const weekly=weeklyVirtualEventsForDate(ds);
  const ecGoalsDay=ecGoalEventsForDate(ds);
  const el=document.getElementById('calDayTasks');
  if(!day.length&&!events.length&&!weekly.length&&!ecGoalsDay.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:4px 0">Nothing scheduled.</div>';return;}
  const blocks=[];weekly.forEach(w=>blocks.push({k:'w',o:w}));events.forEach(e=>blocks.push({k:'e',o:e}));ecGoalsDay.forEach(g=>blocks.push({k:'g',o:g}));day.forEach(t=>blocks.push({k:'t',o:t}));
  const ord={w:0,e:1,g:1,t:2};""",
        "renderCalDay blocks alt",
    )

# EC goals calendar refresh
if "addECGoal" in text and "renderCalendar();" not in text.split("function addECGoal")[1].split("function removeECGoal")[0]:
    text = text.replace(
        "  save('flux_ec_goals', ecGoals);\n  document.getElementById('ecGoalTitle').value = '';",
        "  save('flux_ec_goals', ecGoals);\n  if(typeof renderCalendar==='function')renderCalendar();\n  document.getElementById('ecGoalTitle').value = '';",
        1,
    )
    changed.append("addECGoal cal")

p.write_text(text)
print("Applied:", ", ".join(changed) if changed else "none")
