/* ════════════════════════════════════════════════════════════════════════
   FLUX · Staff workspace tabs — one custom tab per staff TYPE
   ------------------------------------------------------------------------
   Visible only when an educator is in Work mode (gated by applyRoleUI in
   app.js, which toggles [data-role-tab="<role>"] elements).

     · Teacher    → Lesson Hub (#lessonHub)         ─ today's bell schedule
     · Counselor  → Meetings (#counselorMeetings)   ─ Google Calendar feed
     · Admin      → Operations (#adminOps)          ─ school command center
     · Staff      → Workboard (#staffWorkboard)     ─ department tools

   Each render function owns its panel body. nav() in app.js dispatches
   to window.render<TabName>() when the matching panel is opened.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // ── shared helpers ────────────────────────────────────────────────
  const esc=(s)=>String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function todayISO(){return new Date().toISOString().slice(0,10);}
  function timeOfDay(){
    const h=new Date().getHours();
    if(h<12)return 'morning';if(h<17)return 'afternoon';return 'evening';
  }
  function fmtDate(d){
    return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }
  function fmtTime(d){
    return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  }
  // Route reads/writes through the same namespace prefix the rest of the
  // planner uses (see app.js fluxNamespacedKey). When the owner is in a
  // teacher preview, lesson notes / counselor notes / sub coverage / staff
  // tickets all live in that teacher's isolated bubble instead of being
  // overlaid on the owner's account.
  function _key(k){
    try{
      if(typeof window!=='undefined'&&typeof window.fluxNamespacedKey==='function'){
        return window.fluxNamespacedKey(k);
      }
    }catch(_){}
    return k;
  }
  function ls(key,fallback){
    try{const raw=localStorage.getItem(_key(key));return raw?JSON.parse(raw):fallback;}
    catch(_){return fallback;}
  }
  function lsSet(key,val){
    try{localStorage.setItem(_key(key),JSON.stringify(val));}catch(_){}
  }
  function toast(msg,kind){
    if(typeof window.showToast==='function')window.showToast(msg,kind||'info');
  }

  // Pull the current educator name in a forgiving way.
  function meName(){
    try{
      return (window.FluxRole&&FluxRole.profile&&FluxRole.profile.display_name)
        || (window.currentUser&&window.currentUser.user_metadata&&window.currentUser.user_metadata.full_name)
        || (window.currentUser&&window.currentUser.email)
        || 'there';
    }catch(_){return 'there';}
  }
  function firstName(){
    const n=meName();return String(n).split(' ').filter(w=>!['Mr.','Mrs.','Ms.','Dr.'].includes(w))[0]||n;
  }

  // ════════════════════════════════════════════════════════════════
  // 1) TEACHER · LESSON HUB
  // ════════════════════════════════════════════════════════════════
  // Reads the user's locally saved class list (the same one used in the
  // student "School Info" panel) and renders it as a teaching schedule:
  // one card per period with attendance / lesson notes / materials.
  // Notes + materials persist to localStorage keyed by (date · period).
  function renderLessonHub(){
    const host=document.getElementById('lessonHubBody');
    if(!host)return;
    const classes=(window.classes||[]).slice().sort((a,b)=>(a.period||0)-(b.period||0));
    const today=todayISO();
    const dateLabel=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

    // Determine current A/B day, if used
    let abLabel='';
    try{
      if(typeof window.getCurrentDayType==='function'){
        const t=window.getCurrentDayType();
        if(t&&t!=='Standard')abLabel=t;
      }
    }catch(_){}

    // Class state store (notes / attendance / materials)
    const STATE_KEY='flux_lesson_state_v1';
    const state=ls(STATE_KEY,{});
    const stateKey=(period)=>today+'__P'+period;
    const getState=(p)=>state[stateKey(p)]||{notes:'',attendance:'',materials:[]};

    function classCard(c){
      const k=stateKey(c.period);
      const s=state[k]||{notes:'',attendance:'',materials:[]};
      const color=c.color||'#7c5cff';
      const time=(c.timeStart&&c.timeEnd)?(c.timeStart+' – '+c.timeEnd):'No time set';
      return `
        <div class="lh-class-card" data-period="${esc(c.period)}" style="--lh-accent:${esc(color)}">
          <div class="lh-class-head">
            <div class="lh-period-pill">P${esc(c.period)}${c.days&&c.days!=='Every Day'?'·'+esc(c.days[0]):''}</div>
            <div class="lh-class-meta">
              <div class="lh-class-name">${esc(c.name||'Untitled class')}</div>
              <div class="lh-class-sub">${esc(time)}${c.room?' · Room '+esc(c.room):''}</div>
            </div>
            <div class="lh-att-mini" data-att-status="${esc(s.attendance||'')}">
              ${s.attendance?esc(s.attendance):'No attendance'}
            </div>
          </div>
          <div class="lh-class-body">
            <label class="lh-mini-label">Lesson notes for today</label>
            <textarea class="lh-notes" data-period="${esc(c.period)}" placeholder="What are you teaching this period? Drop the lesson plan, page numbers, key questions…">${esc(s.notes||'')}</textarea>
            <div class="lh-action-row">
              <button class="lh-att-btn" data-att="present" data-period="${esc(c.period)}">✓ Mark all present</button>
              <button class="lh-att-btn" data-att="custom" data-period="${esc(c.period)}">Custom roster</button>
              <button class="lh-mat-btn" data-period="${esc(c.period)}">+ Add material reminder</button>
            </div>
            ${(s.materials&&s.materials.length)?`
              <ul class="lh-mat-list">
                ${s.materials.map((m,i)=>`<li><span>${esc(m)}</span><button class="lh-mat-del" data-period="${esc(c.period)}" data-idx="${i}" aria-label="Remove">×</button></li>`).join('')}
              </ul>`:''}
          </div>
        </div>`;
    }

    host.innerHTML=`
      <div class="lh-root">
        <div class="lh-topbar">
          <div>
            <div class="lh-greet">Good ${timeOfDay()}, ${esc(firstName())}</div>
            <div class="lh-greet-sub">${esc(dateLabel)}${abLabel?' · '+esc(abLabel):''} · ${classes.length} class${classes.length===1?'':'es'} on the schedule</div>
          </div>
          <div class="lh-topbar-actions">
            <button class="lh-action-btn" id="lhSubPlanBtn">📄 Sub-plan template</button>
            <button class="lh-action-btn" id="lhExitTicketBtn">🎫 Exit ticket</button>
            <button class="lh-action-btn primary" id="lhBroadcastBtn">📢 Announce</button>
          </div>
        </div>

        <div class="lh-stats">
          <div class="lh-stat"><div class="lh-stat-num">${classes.length}</div><div class="lh-stat-lbl">Classes today</div></div>
          <div class="lh-stat"><div class="lh-stat-num">${classes.reduce((acc,c)=>acc+((state[stateKey(c.period)]&&state[stateKey(c.period)].attendance)?1:0),0)}/${classes.length}</div><div class="lh-stat-lbl">Attendance done</div></div>
          <div class="lh-stat"><div class="lh-stat-num">${classes.reduce((acc,c)=>acc+((state[stateKey(c.period)]&&state[stateKey(c.period)].notes)?1:0),0)}</div><div class="lh-stat-lbl">Lesson notes</div></div>
          <div class="lh-stat"><div class="lh-stat-num">${classes.reduce((acc,c)=>acc+((state[stateKey(c.period)]&&state[stateKey(c.period)].materials&&state[stateKey(c.period)].materials.length)||0),0)}</div><div class="lh-stat-lbl">Materials queued</div></div>
        </div>

        ${classes.length===0?`
          <div class="lh-empty">
            <div class="lh-empty-icon">📚</div>
            <div class="lh-empty-title">No classes yet</div>
            <div class="lh-empty-sub">Add the periods you teach in <a href="javascript:nav('school')">School Info</a> and they'll show up here.</div>
          </div>`:`
          <div class="lh-list">${classes.map(classCard).join('')}</div>
        `}
      </div>`;

    // ── wire interactions ──
    function persist(){lsSet(STATE_KEY,state);}

    host.querySelectorAll('.lh-notes').forEach(ta=>{
      ta.addEventListener('input',()=>{
        const p=ta.dataset.period;const k=stateKey(p);
        state[k]=state[k]||{};state[k].notes=ta.value;persist();
      });
    });
    host.querySelectorAll('.lh-att-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const p=btn.dataset.period;const k=stateKey(p);const t=btn.dataset.att;
        state[k]=state[k]||{};
        if(t==='present'){state[k].attendance='All present';}
        else{
          const v=prompt('Mark attendance — type a quick note (e.g. "3 absent: Aiden, Maya, Jordan")',state[k].attendance||'');
          if(v==null)return;state[k].attendance=v.trim()||'';
        }
        persist();renderLessonHub();
      });
    });
    host.querySelectorAll('.lh-mat-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const p=btn.dataset.period;const k=stateKey(p);
        const v=prompt('Material reminder (e.g. "Bring lab worksheets", "Print Section 4.2")','');
        if(!v)return;
        state[k]=state[k]||{materials:[]};state[k].materials=state[k].materials||[];
        state[k].materials.push(v.trim());persist();renderLessonHub();
      });
    });
    host.querySelectorAll('.lh-mat-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const p=btn.dataset.period;const k=stateKey(p);const i=parseInt(btn.dataset.idx,10);
        if(state[k]&&state[k].materials){state[k].materials.splice(i,1);persist();renderLessonHub();}
      });
    });

    // Sub-plan generator
    document.getElementById('lhSubPlanBtn')?.addEventListener('click',()=>{
      const lines=[`SUB PLAN — ${esc(meName())} — ${esc(dateLabel)}`,''];
      classes.forEach(c=>{
        const k=stateKey(c.period);
        const s=state[k]||{};
        lines.push(`PERIOD ${c.period}${c.room?' — Room '+c.room:''}: ${c.name||'Class'}`);
        lines.push(`Time: ${c.timeStart||'?'} – ${c.timeEnd||'?'}`);
        lines.push(`Plan: ${s.notes||'(see lesson notes on desk)'}`);
        if(s.materials&&s.materials.length)lines.push(`Materials: ${s.materials.join(', ')}`);
        lines.push('');
      });
      lines.push('Emergency contact: Front office');
      const text=lines.join('\n');
      navigator.clipboard?.writeText(text).then(
        ()=>toast('Sub-plan copied to clipboard','success'),
        ()=>toast('Copy failed — see console','warn')
      );
      console.log(text);
    });
    document.getElementById('lhExitTicketBtn')?.addEventListener('click',()=>{
      toast('Exit-ticket builder coming next release — for now jot the prompt in lesson notes','info',2400);
    });
    document.getElementById('lhBroadcastBtn')?.addEventListener('click',()=>{
      if(typeof window.openTeacherAnnouncementModal==='function')window.openTeacherAnnouncementModal();
      else if(typeof window.openCreateAnnouncementModal==='function')window.openCreateAnnouncementModal();
      else toast('Announcement composer not loaded','warn');
    });
  }
  window.renderLessonHub=renderLessonHub;

  // ════════════════════════════════════════════════════════════════
  // 2) COUNSELOR · MEETINGS (Google Calendar)
  // ════════════════════════════════════════════════════════════════
  // Reads the user's Google Calendar via the existing gmailToken (the
  // Google OAuth flow already requests calendar.readonly scope). Events
  // are grouped into Today / Tomorrow / This week / Later and tagged
  // by inferred meeting type (1:1 student / parent / IEP / college /
  // faculty) based on title keywords + attendee count.

  function getGoogleToken(){
    return window.gmailToken
      || (typeof sessionStorage!=='undefined'&&sessionStorage.getItem('flux_gmail_token'))
      || null;
  }

  function classifyMeeting(ev){
    const t=String(ev.summary||'').toLowerCase();
    const att=(ev.attendees||[]).length;
    if(/iep|504|special ?ed|sst|mtss/.test(t))return{tag:'IEP',color:'#a78bfa'};
    if(/parent|guardian|family|conference/.test(t))return{tag:'Parent',color:'#f59e0b'};
    if(/college|fafsa|application|essay|naviance/.test(t))return{tag:'College',color:'#10b981'};
    if(/faculty|staff|admin|department|pd|prof.?dev/.test(t))return{tag:'Faculty',color:'#ef4444'};
    if(/crisis|safety|wellness|mental/.test(t))return{tag:'Wellness',color:'#ec4899'};
    if(att>=2)return{tag:'Group',color:'#7c5cff'};
    return{tag:'1:1',color:'#3b82f6'};
  }

  function meetingBucket(ev){
    const start=ev.start?.dateTime||ev.start?.date;
    if(!start)return 'later';
    const d=new Date(start);
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const tom=new Date(today);tom.setDate(tom.getDate()+1);
    const dayAfter=new Date(today);dayAfter.setDate(dayAfter.getDate()+2);
    const weekEnd=new Date(today);weekEnd.setDate(weekEnd.getDate()+7);
    if(d<tom)return 'today';
    if(d<dayAfter)return 'tomorrow';
    if(d<weekEnd)return 'week';
    return 'later';
  }

  async function fetchCounselorEvents(){
    const token=getGoogleToken();
    if(!token)return{ok:false,needsAuth:true,events:[]};
    const now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString();
    const end=new Date();end.setDate(end.getDate()+30);
    try{
      const res=await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events'
          +'?timeMin='+encodeURIComponent(start)
          +'&timeMax='+encodeURIComponent(end.toISOString())
          +'&maxResults=50&singleEvents=true&orderBy=startTime',
        {headers:{'Authorization':'Bearer '+token}}
      );
      if(res.status===401)return{ok:false,expired:true,events:[]};
      if(!res.ok)return{ok:false,error:'Calendar API '+res.status,events:[]};
      const data=await res.json();
      return{ok:true,events:data.items||[]};
    }catch(e){
      return{ok:false,error:String(e.message||e),events:[]};
    }
  }

  // Notes are a private journal scoped per event (or per ad-hoc memo).
  const NOTES_KEY='flux_counselor_meeting_notes_v1';
  function readNotes(){return ls(NOTES_KEY,{});}
  function writeNotes(n){lsSet(NOTES_KEY,n);}

  async function renderCounselorMeetings(){
    const host=document.getElementById('counselorMeetingsBody');
    if(!host)return;
    host.innerHTML='<div class="cm-loading">Loading your Google Calendar…</div>';

    const token=getGoogleToken();
    if(!token){
      host.innerHTML=`
        <div class="cm-connect">
          <div class="cm-connect-icon">📅</div>
          <h3>Connect Google Calendar</h3>
          <p>Sign in with Google to see your meetings, IEPs, parent calls, and college sessions in one place.</p>
          <button class="cm-connect-btn" id="cmConnectBtn">Connect Google →</button>
          <div class="cm-connect-hint">Already signed in? <a href="javascript:void(0)" id="cmReauth">Reconnect with calendar access</a></div>
        </div>`;
      document.getElementById('cmConnectBtn')?.addEventListener('click',()=>{
        if(typeof window.signInWithGoogle==='function')window.signInWithGoogle();
        else if(typeof window.fluxReconnectGoogleCalendarWrite==='function')window.fluxReconnectGoogleCalendarWrite();
        else toast('Open Settings → Connections → Sign in with Google','info');
      });
      document.getElementById('cmReauth')?.addEventListener('click',()=>{
        if(typeof window.fluxReconnectGoogleCalendarWrite==='function')window.fluxReconnectGoogleCalendarWrite();
      });
      return;
    }

    const result=await fetchCounselorEvents();
    if(!result.ok){
      host.innerHTML=`
        <div class="cm-connect">
          <div class="cm-connect-icon">${result.expired?'🔒':'⚠️'}</div>
          <h3>${result.expired?'Calendar session expired':'Could not load calendar'}</h3>
          <p>${esc(result.error||'Sign in with Google again to refresh access.')}</p>
          <button class="cm-connect-btn" id="cmReauthBtn">Reconnect Google →</button>
        </div>`;
      document.getElementById('cmReauthBtn')?.addEventListener('click',()=>{
        if(typeof window.fluxReconnectGoogleCalendarWrite==='function')window.fluxReconnectGoogleCalendarWrite();
      });
      return;
    }

    const events=result.events;
    const buckets={today:[],tomorrow:[],week:[],later:[]};
    events.forEach(ev=>buckets[meetingBucket(ev)].push(ev));
    const notes=readNotes();

    // Counts by tag (for the filter strip)
    const tagCounts={};
    events.forEach(ev=>{const t=classifyMeeting(ev).tag;tagCounts[t]=(tagCounts[t]||0)+1;});
    const allTags=['1:1','Parent','IEP','College','Faculty','Wellness','Group'];

    function eventCard(ev){
      const c=classifyMeeting(ev);
      const startRaw=ev.start?.dateTime||ev.start?.date;
      const endRaw=ev.end?.dateTime||ev.end?.date;
      const isAllDay=!ev.start?.dateTime;
      const start=startRaw?new Date(startRaw):null;
      const end=endRaw?new Date(endRaw):null;
      const timeStr=isAllDay?'All day':(start?fmtTime(start)+(end?' – '+fmtTime(end):''):'');
      const att=(ev.attendees||[]).filter(a=>!a.self).slice(0,3).map(a=>a.email||a.displayName||'guest');
      const noteVal=notes[ev.id]||'';
      const link=ev.htmlLink||'#';
      const meetUrl=ev.hangoutLink||(ev.conferenceData&&ev.conferenceData.entryPoints&&ev.conferenceData.entryPoints[0]&&ev.conferenceData.entryPoints[0].uri)||'';
      return `
        <div class="cm-card" data-tag="${esc(c.tag)}" data-evid="${esc(ev.id)}">
          <div class="cm-card-stripe" style="background:${esc(c.color)}"></div>
          <div class="cm-card-body">
            <div class="cm-card-head">
              <span class="cm-tag" style="--cm-tag:${esc(c.color)}">${esc(c.tag)}</span>
              <span class="cm-time">${esc(timeStr)}</span>
              ${start?`<span class="cm-date">${esc(fmtDate(start))}</span>`:''}
            </div>
            <div class="cm-title">${esc(ev.summary||'(no title)')}</div>
            ${ev.location?`<div class="cm-loc">📍 ${esc(ev.location)}</div>`:''}
            ${att.length?`<div class="cm-att">👥 ${att.map(esc).join(', ')}${(ev.attendees||[]).length>3?' +'+((ev.attendees||[]).length-3)+' more':''}</div>`:''}
            <textarea class="cm-note" data-evid="${esc(ev.id)}" placeholder="Private session notes (saved locally only)…">${esc(noteVal)}</textarea>
            <div class="cm-card-actions">
              <a class="cm-link" href="${esc(link)}" target="_blank" rel="noopener">Open in Calendar</a>
              ${meetUrl?`<a class="cm-link cm-link-meet" href="${esc(meetUrl)}" target="_blank" rel="noopener">Join meet</a>`:''}
              <button class="cm-link cm-mailto" data-evid="${esc(ev.id)}">Email attendees</button>
            </div>
          </div>
        </div>`;
    }

    function bucketSection(label,key){
      const list=buckets[key];
      if(!list.length)return '';
      return `
        <div class="cm-bucket">
          <div class="cm-bucket-head"><span>${esc(label)}</span><span class="cm-bucket-count">${list.length}</span></div>
          <div class="cm-bucket-list">${list.map(eventCard).join('')}</div>
        </div>`;
    }

    host.innerHTML=`
      <div class="cm-root">
        <div class="cm-topbar">
          <div>
            <div class="cm-greet">${events.length} meeting${events.length===1?'':'s'} on the books</div>
            <div class="cm-greet-sub">${buckets.today.length} today · ${buckets.tomorrow.length} tomorrow · ${buckets.week.length} later this week</div>
          </div>
          <div class="cm-topbar-actions">
            <button class="cm-action-btn" id="cmRefresh">↻ Refresh</button>
            <button class="cm-action-btn" id="cmOpenGCal">Open Google Calendar ↗</button>
            <button class="cm-action-btn primary" id="cmNewMeet">+ New meeting</button>
          </div>
        </div>

        <div class="cm-filter-strip">
          <button class="cm-filter active" data-filter="all">All <span>${events.length}</span></button>
          ${allTags.map(t=>`<button class="cm-filter" data-filter="${esc(t)}">${esc(t)} <span>${tagCounts[t]||0}</span></button>`).join('')}
        </div>

        ${events.length===0?`
          <div class="cm-empty">
            <div class="cm-empty-icon">🌤</div>
            <div class="cm-empty-title">Clear schedule for the next 30 days</div>
            <div class="cm-empty-sub">Anything you put on Google Calendar will appear here automatically.</div>
          </div>`:`
          <div class="cm-feed">
            ${bucketSection('Today','today')}
            ${bucketSection('Tomorrow','tomorrow')}
            ${bucketSection('This week','week')}
            ${bucketSection('Later','later')}
          </div>
        `}
      </div>`;

    // Wire interactions
    host.querySelectorAll('.cm-note').forEach(ta=>{
      ta.addEventListener('input',()=>{
        const id=ta.dataset.evid;
        const obj=readNotes();obj[id]=ta.value;writeNotes(obj);
      });
    });
    host.querySelectorAll('.cm-mailto').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.evid;
        const ev=events.find(e=>e.id===id);
        const emails=(ev?.attendees||[]).filter(a=>!a.self).map(a=>a.email).filter(Boolean);
        if(!emails.length){toast('No email attendees on this event','warn');return;}
        window.location.href='mailto:'+emails.join(',')+'?subject='+encodeURIComponent('Re: '+(ev.summary||''));
      });
    });
    host.querySelectorAll('.cm-filter').forEach(btn=>{
      btn.addEventListener('click',()=>{
        host.querySelectorAll('.cm-filter').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const want=btn.dataset.filter;
        host.querySelectorAll('.cm-card').forEach(card=>{
          card.style.display=(want==='all'||card.dataset.tag===want)?'':'none';
        });
      });
    });
    document.getElementById('cmRefresh')?.addEventListener('click',()=>renderCounselorMeetings());
    document.getElementById('cmOpenGCal')?.addEventListener('click',()=>{
      window.open('https://calendar.google.com/calendar/u/0/r','_blank','noopener');
    });
    document.getElementById('cmNewMeet')?.addEventListener('click',()=>{
      window.open('https://calendar.google.com/calendar/u/0/r/eventedit','_blank','noopener');
    });
  }
  window.renderCounselorMeetings=renderCounselorMeetings;

  // ════════════════════════════════════════════════════════════════
  // 3) ADMIN · OPERATIONS
  // ════════════════════════════════════════════════════════════════
  // Pulls the staff directory (window.FluxStaffDirectory) and presents
  // it as a school command center: roster split by role, today's
  // sub coverage entries (locally tracked), duties roster, and an
  // announcement composer that just opens the existing teacher
  // announcement modal but is labelled "faculty announcement".
  const SUB_KEY='flux_admin_sub_coverage_v1';
  const DUTY_KEY='flux_admin_duties_v1';
  const WALK_KEY='flux_admin_walkthrough_v1';

  function defaultDuties(){
    return {
      'Lunch duty':'(unassigned)',
      'Hall duty (AM)':'(unassigned)',
      'Hall duty (PM)':'(unassigned)',
      'Bus duty':'(unassigned)',
      'Detention':'(unassigned)',
    };
  }

  function renderAdminOps(){
    const host=document.getElementById('adminOpsBody');
    if(!host)return;
    const dir=(window.FluxStaffDirectory&&window.FluxStaffDirectory.all)||[];
    const teachers=dir.filter(d=>d.role==='teacher');
    const counselors=dir.filter(d=>d.role==='counselor');
    const support=dir.filter(d=>d.role==='staff');
    const admins=dir.filter(d=>d.role==='admin');

    const subs=ls(SUB_KEY,[]);
    const duties=ls(DUTY_KEY,defaultDuties());
    const walks=ls(WALK_KEY,[]);
    const today=todayISO();
    const todaySubs=subs.filter(s=>s.date===today);
    const todayWalks=walks.filter(w=>w.date===today);

    function dirRow(d){
      const initial=esc((d.name||'?').charAt(0).toUpperCase());
      return `
        <div class="ao-dir-row" data-email="${esc(d.email)}">
          <div class="ao-dir-av">${initial}</div>
          <div class="ao-dir-info">
            <div class="ao-dir-name">${esc(d.name)}</div>
            <div class="ao-dir-meta">${esc(d.subject||d.displayRole||'')}</div>
          </div>
          <a class="ao-dir-act" href="mailto:${esc(d.email)}" title="Email">✉</a>
        </div>`;
    }

    host.innerHTML=`
      <div class="ao-root">
        <div class="ao-topbar">
          <div>
            <div class="ao-greet">Good ${timeOfDay()}, ${esc(firstName())}</div>
            <div class="ao-greet-sub">${esc(new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}))} · ${dir.length} staff on file</div>
          </div>
          <div class="ao-topbar-actions">
            <button class="ao-action-btn" id="aoAddSub">+ Sub coverage</button>
            <button class="ao-action-btn" id="aoLogWalk">+ Walkthrough</button>
            <button class="ao-action-btn primary" id="aoFacAnnounce">📢 Faculty announcement</button>
          </div>
        </div>

        <div class="ao-stats">
          <div class="ao-stat"><div class="ao-stat-num">${teachers.length}</div><div class="ao-stat-lbl">Teachers</div></div>
          <div class="ao-stat"><div class="ao-stat-num">${counselors.length}</div><div class="ao-stat-lbl">Counselors</div></div>
          <div class="ao-stat"><div class="ao-stat-num">${support.length+admins.length}</div><div class="ao-stat-lbl">Staff &amp; admin</div></div>
          <div class="ao-stat ${todaySubs.length?'ao-stat-warn':''}"><div class="ao-stat-num">${todaySubs.length}</div><div class="ao-stat-lbl">Subs today</div></div>
          <div class="ao-stat"><div class="ao-stat-num">${todayWalks.length}</div><div class="ao-stat-lbl">Walkthroughs today</div></div>
        </div>

        <div class="ao-grid">
          <div class="ao-col">
            <div class="ao-section-head"><h3>Today's sub coverage</h3><button class="ao-link-btn" id="aoAddSub2">+ Add</button></div>
            ${todaySubs.length===0?'<div class="ao-empty-mini">No sub coverage logged for today.</div>':
              todaySubs.map((s,i)=>`
                <div class="ao-sub-row">
                  <div class="ao-sub-period">P${esc(s.period||'?')}</div>
                  <div class="ao-sub-info">
                    <div class="ao-sub-name">${esc(s.absent||'?')} → <span class="ao-sub-cover">${esc(s.cover||'TBD')}</span></div>
                    <div class="ao-sub-meta">${esc(s.note||'')}</div>
                  </div>
                  <button class="ao-sub-del" data-idx="${i}" aria-label="Remove">×</button>
                </div>`).join('')}

            <div class="ao-section-head" style="margin-top:18px"><h3>Duty roster</h3></div>
            ${Object.keys(duties).map(k=>`
              <div class="ao-duty-row" data-key="${esc(k)}">
                <div class="ao-duty-label">${esc(k)}</div>
                <input class="ao-duty-input" data-key="${esc(k)}" value="${esc(duties[k])}" placeholder="Assign staff">
              </div>`).join('')}
          </div>

          <div class="ao-col">
            <div class="ao-section-head"><h3>Walkthroughs today</h3></div>
            ${todayWalks.length===0?'<div class="ao-empty-mini">No walkthroughs logged today.</div>':
              todayWalks.map((w,i)=>`
                <div class="ao-walk-row">
                  <div class="ao-walk-when">${esc(w.time||'')}</div>
                  <div class="ao-walk-info">
                    <div class="ao-walk-name">${esc(w.teacher||'')}</div>
                    <div class="ao-walk-meta">${esc(w.focus||'General observation')}</div>
                  </div>
                  <button class="ao-walk-del" data-idx="${i}" aria-label="Remove">×</button>
                </div>`).join('')}

            <div class="ao-section-head" style="margin-top:18px"><h3>Quick links</h3></div>
            <div class="ao-quick">
              <button class="ao-quick-btn" data-link="https://docs.google.com/document/u/0/?ftv=1&tgif=d">📝 New Doc (incident report)</button>
              <button class="ao-quick-btn" data-link="https://meet.google.com/new">🎥 Start Meet (parent call)</button>
              <button class="ao-quick-btn" data-link="https://calendar.google.com/calendar/u/0/r/eventedit">📅 New calendar event</button>
              <button class="ao-quick-btn" data-link="https://drive.google.com/drive/recent">📂 Recent Drive</button>
            </div>
          </div>

          <div class="ao-col ao-col-wide">
            <div class="ao-section-head">
              <h3>Staff directory</h3>
              <input class="ao-search" id="aoSearch" placeholder="Search by name, subject, email…">
            </div>
            <div class="ao-dir-tabs">
              <button class="ao-dir-tab active" data-grp="teachers">Teachers (${teachers.length})</button>
              <button class="ao-dir-tab" data-grp="counselors">Counselors (${counselors.length})</button>
              <button class="ao-dir-tab" data-grp="support">Support &amp; admin (${support.length+admins.length})</button>
            </div>
            <div class="ao-dir-list" id="aoDirList">
              ${teachers.map(dirRow).join('')||'<div class="ao-empty-mini">No teachers in directory.</div>'}
            </div>
          </div>
        </div>
      </div>`;

    function persistDuties(){lsSet(DUTY_KEY,duties);}
    function persistSubs(arr){lsSet(SUB_KEY,arr);}
    function persistWalks(arr){lsSet(WALK_KEY,arr);}

    host.querySelectorAll('.ao-duty-input').forEach(inp=>{
      inp.addEventListener('change',()=>{duties[inp.dataset.key]=inp.value.trim()||'(unassigned)';persistDuties();});
    });
    const addSub=()=>{
      const period=prompt('Period?','1');if(!period)return;
      const absent=prompt('Absent teacher?');if(!absent)return;
      const cover=prompt('Covered by? (or "TBD")','TBD')||'TBD';
      const note=prompt('Note (optional)?','')||'';
      const next=ls(SUB_KEY,[]).concat([{date:today,period,absent,cover,note}]);
      persistSubs(next);renderAdminOps();
    };
    document.getElementById('aoAddSub')?.addEventListener('click',addSub);
    document.getElementById('aoAddSub2')?.addEventListener('click',addSub);

    host.querySelectorAll('.ao-sub-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const arr=ls(SUB_KEY,[]);
        const dayList=arr.filter(s=>s.date===today);
        const target=dayList[parseInt(btn.dataset.idx,10)];
        if(!target)return;
        const next=arr.filter(s=>!(s.date===target.date&&s.period===target.period&&s.absent===target.absent));
        persistSubs(next);renderAdminOps();
      });
    });

    document.getElementById('aoLogWalk')?.addEventListener('click',()=>{
      const teacher=prompt('Teacher walked through?');if(!teacher)return;
      const focus=prompt('Focus area? (e.g. "checking for understanding")','')||'';
      const time=prompt('Time? (e.g. "9:15am")',new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}))||'';
      const next=ls(WALK_KEY,[]).concat([{date:today,time,teacher,focus}]);
      persistWalks(next);renderAdminOps();
    });
    host.querySelectorAll('.ao-walk-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const arr=ls(WALK_KEY,[]);
        const dayList=arr.filter(w=>w.date===today);
        const target=dayList[parseInt(btn.dataset.idx,10)];
        if(!target)return;
        const next=arr.filter(w=>!(w.date===target.date&&w.time===target.time&&w.teacher===target.teacher));
        persistWalks(next);renderAdminOps();
      });
    });

    document.getElementById('aoFacAnnounce')?.addEventListener('click',()=>{
      if(typeof window.openTeacherAnnouncementModal==='function')window.openTeacherAnnouncementModal();
      else if(typeof window.openCreateAnnouncementModal==='function')window.openCreateAnnouncementModal();
      else toast('Announcement composer not loaded','warn');
    });

    host.querySelectorAll('.ao-quick-btn').forEach(b=>{
      b.addEventListener('click',()=>window.open(b.dataset.link,'_blank','noopener'));
    });

    const dirList=document.getElementById('aoDirList');
    const search=document.getElementById('aoSearch');
    let activeGroup='teachers';
    function renderDir(){
      const groupMap={teachers,counselors,support:support.concat(admins)};
      const list=groupMap[activeGroup]||[];
      const q=(search.value||'').toLowerCase().trim();
      const filtered=q?list.filter(d=>d.searchText.includes(q)):list;
      dirList.innerHTML=filtered.length?filtered.map(dirRow).join(''):'<div class="ao-empty-mini">No matches.</div>';
    }
    host.querySelectorAll('.ao-dir-tab').forEach(t=>{
      t.addEventListener('click',()=>{
        host.querySelectorAll('.ao-dir-tab').forEach(b=>b.classList.remove('active'));
        t.classList.add('active');
        activeGroup=t.dataset.grp;renderDir();
      });
    });
    search?.addEventListener('input',renderDir);
  }
  window.renderAdminOps=renderAdminOps;

  // ════════════════════════════════════════════════════════════════
  // 4) STAFF · WORKBOARD
  // ════════════════════════════════════════════════════════════════
  // Catch-all for non-teaching staff (secretaries, IT, safe-ed,
  // facilities, etc.). Renders a department directory, a request
  // queue (locally tracked tickets), and a daily checklist.
  const TICKET_KEY='flux_staff_tickets_v1';
  const CHECKLIST_KEY='flux_staff_checklist_v1';

  function renderStaffWorkboard(){
    const host=document.getElementById('staffWorkboardBody');
    if(!host)return;
    const dir=(window.FluxStaffDirectory&&window.FluxStaffDirectory.all)||[];
    const today=todayISO();
    const tickets=ls(TICKET_KEY,[]);
    const checklist=ls(CHECKLIST_KEY,{});
    const todayList=checklist[today]||[];

    const myDept=(window.FluxRole&&FluxRole.profile&&FluxRole.profile.department)||'';
    const subjectField=(window.FluxRole&&FluxRole.profile&&FluxRole.profile.subject)||'';

    // Smart department peers — anyone whose subject contains the current
    // user's department keyword (or the same role).
    function peers(){
      const key=String(myDept||subjectField||'').toLowerCase().trim();
      if(!key)return dir.filter(d=>d.role==='staff');
      return dir.filter(d=>(d.subject||'').toLowerCase().includes(key));
    }

    const open=tickets.filter(t=>!t.done);
    const closed=tickets.filter(t=>t.done);

    host.innerHTML=`
      <div class="sw-root">
        <div class="sw-topbar">
          <div>
            <div class="sw-greet">Good ${timeOfDay()}, ${esc(firstName())}</div>
            <div class="sw-greet-sub">${esc(myDept||subjectField||'Staff')} · ${esc(new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}))}</div>
          </div>
          <div class="sw-topbar-actions">
            <button class="sw-action-btn" id="swAddTicket">+ Log request</button>
            <button class="sw-action-btn primary" id="swAddCheck">+ Add to checklist</button>
          </div>
        </div>

        <div class="sw-stats">
          <div class="sw-stat ${open.length?'sw-stat-warn':''}"><div class="sw-stat-num">${open.length}</div><div class="sw-stat-lbl">Open requests</div></div>
          <div class="sw-stat"><div class="sw-stat-num">${closed.length}</div><div class="sw-stat-lbl">Closed</div></div>
          <div class="sw-stat"><div class="sw-stat-num">${todayList.filter(t=>t.done).length}/${todayList.length}</div><div class="sw-stat-lbl">Checklist</div></div>
          <div class="sw-stat"><div class="sw-stat-num">${peers().length}</div><div class="sw-stat-lbl">Department peers</div></div>
        </div>

        <div class="sw-grid">
          <div class="sw-col">
            <div class="sw-section-head"><h3>Today's checklist</h3></div>
            ${todayList.length===0?'<div class="sw-empty-mini">Nothing on the list yet — add your first item.</div>':
              todayList.map((it,i)=>`
                <label class="sw-check-row">
                  <input type="checkbox" class="sw-check-cb" data-idx="${i}" ${it.done?'checked':''}>
                  <span class="${it.done?'sw-done':''}">${esc(it.text)}</span>
                  <button class="sw-check-del" data-idx="${i}" aria-label="Remove">×</button>
                </label>`).join('')}
          </div>

          <div class="sw-col">
            <div class="sw-section-head"><h3>Request queue</h3><span class="sw-mini-tag">${open.length} open</span></div>
            ${open.length===0?'<div class="sw-empty-mini">Inbox zero ✨</div>':
              open.map((t,i)=>`
                <div class="sw-ticket" data-id="${esc(t.id)}">
                  <div class="sw-ticket-head">
                    <span class="sw-prio sw-prio-${esc(t.priority||'normal')}">${esc(t.priority||'normal')}</span>
                    <span class="sw-from">${esc(t.from||'unknown')}</span>
                    <span class="sw-when">${esc(t.created||'')}</span>
                  </div>
                  <div class="sw-ticket-body">${esc(t.text)}</div>
                  <div class="sw-ticket-actions">
                    <button class="sw-resolve" data-id="${esc(t.id)}">✓ Resolve</button>
                    <button class="sw-trash" data-id="${esc(t.id)}">Delete</button>
                  </div>
                </div>`).join('')}

            ${closed.length?`
              <details class="sw-closed">
                <summary>Recently resolved (${closed.length})</summary>
                ${closed.slice(-6).reverse().map(t=>`
                  <div class="sw-ticket sw-ticket-done">
                    <div class="sw-ticket-body">${esc(t.text)}</div>
                    <div class="sw-ticket-meta">from ${esc(t.from||'?')} · ${esc(t.created||'')}</div>
                  </div>`).join('')}
              </details>`:''}
          </div>

          <div class="sw-col">
            <div class="sw-section-head"><h3>Department peers</h3></div>
            ${peers().length===0?'<div class="sw-empty-mini">No matching peers in directory.</div>':
              peers().map(d=>`
                <div class="sw-peer">
                  <div class="sw-peer-av">${esc((d.name||'?').charAt(0).toUpperCase())}</div>
                  <div class="sw-peer-info">
                    <div class="sw-peer-name">${esc(d.name)}</div>
                    <div class="sw-peer-meta">${esc(d.subject||d.displayRole)}</div>
                  </div>
                  <a class="sw-peer-act" href="mailto:${esc(d.email)}">✉</a>
                </div>`).join('')}

            <div class="sw-section-head" style="margin-top:18px"><h3>Quick tools</h3></div>
            <div class="sw-quick">
              <button class="sw-quick-btn" data-link="https://docs.google.com/document/u/0/?ftv=1&tgif=d">📝 New Doc</button>
              <button class="sw-quick-btn" data-link="https://drive.google.com/drive/recent">📂 Drive</button>
              <button class="sw-quick-btn" data-link="https://mail.google.com/mail/u/0/#inbox">✉ Inbox</button>
              <button class="sw-quick-btn" data-link="https://calendar.google.com/calendar/u/0/r">📅 Calendar</button>
            </div>
          </div>
        </div>
      </div>`;

    function persistTickets(arr){lsSet(TICKET_KEY,arr);}
    function persistChecklist(){lsSet(CHECKLIST_KEY,checklist);}

    document.getElementById('swAddTicket')?.addEventListener('click',()=>{
      const text=prompt('Request / ticket detail');if(!text)return;
      const from=prompt('From whom? (name, email, or "drop-in")','drop-in')||'drop-in';
      const priority=(prompt('Priority? (low / normal / high)','normal')||'normal').toLowerCase();
      const id=Date.now().toString(36);
      const created=new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      persistTickets(tickets.concat([{id,text,from,priority,created,done:false}]));
      renderStaffWorkboard();
    });
    host.querySelectorAll('.sw-resolve').forEach(b=>{
      b.addEventListener('click',()=>{
        const id=b.dataset.id;const arr=ls(TICKET_KEY,[]);
        const t=arr.find(x=>x.id===id);if(!t)return;t.done=true;t.closed=todayISO();
        persistTickets(arr);renderStaffWorkboard();
      });
    });
    host.querySelectorAll('.sw-trash').forEach(b=>{
      b.addEventListener('click',()=>{
        const id=b.dataset.id;const arr=ls(TICKET_KEY,[]).filter(x=>x.id!==id);
        persistTickets(arr);renderStaffWorkboard();
      });
    });

    document.getElementById('swAddCheck')?.addEventListener('click',()=>{
      const text=prompt('Add a checklist item for today');if(!text)return;
      checklist[today]=checklist[today]||[];
      checklist[today].push({text,done:false});
      persistChecklist();renderStaffWorkboard();
    });
    host.querySelectorAll('.sw-check-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{
        const i=parseInt(cb.dataset.idx,10);
        if(checklist[today]&&checklist[today][i]){checklist[today][i].done=cb.checked;persistChecklist();renderStaffWorkboard();}
      });
    });
    host.querySelectorAll('.sw-check-del').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        e.preventDefault();
        const i=parseInt(btn.dataset.idx,10);
        if(checklist[today]){checklist[today].splice(i,1);persistChecklist();renderStaffWorkboard();}
      });
    });
    host.querySelectorAll('.sw-quick-btn').forEach(b=>{
      b.addEventListener('click',()=>window.open(b.dataset.link,'_blank','noopener'));
    });
  }
  window.renderStaffWorkboard=renderStaffWorkboard;

})();
