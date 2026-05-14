/**
 * Flux Owner Command Center — full control UI for the owner account.
 * Covers the full “mega prompt” owner spec: mapped in Mega map tab (In Flux vs Partial vs Server/Supabase).
 */
(function(){
  const SB_PROJECT_REF='lfigdijuqmbensebnevo';
  const PLATFORM_DEFAULTS={
    announcement:'',
    announcementRevision:0,
    dataRetentionDays:365,
    sessionIdleWarnMins:60,
    integrations:{slackWebhook:'',genericWebhook:''},
    complianceContact:'',
  };
  const ROLE_PRESETS={
    admin:['clear_data','feature_flags','dev_mode','manage_devs','view_users','release_push'],
    editor:['clear_data','feature_flags','dev_mode','view_users','release_push'],
    viewer:['view_users'],
  };

  /** Curated backlog ideas for Flux (owner reference only; not shipped as product commitments). */
  const FLUX_PRODUCT_IDEAS=[
    'Natural-language task capture from voice on mobile with auto-parsed date, subject, and duration.',
    'Two-way Google Calendar sync with conflict surfacing and “busy block” overlays on the Flux calendar.',
    'Recurring tasks with exceptions (skip once, shift series, end-after-N) synced reliably to cloud.',
    'Shared class or study-group spaces: read-only task boards with optional comment threads.',
    'Apple Calendar / iCal subscribe link export for due dates and focus blocks.',
    'ICS import for school timetables and blackout dates in one step.',
    'Offline-first queue visual: pending writes, retry, and per-item sync status.',
    'Per-subject color themes and icon packs (user-defined, exportable as a theme JSON).',
    'Command palette (⌘K) actions for every planner surface, with fuzzy search and recent commands.',
    'Deep links that open a specific task, note, or focus session (`?task=…`, share from mobile).',
    'Habit chains with “don’t break the chain” heatmaps separate from one-off tasks.',
    'Mood and energy quick-log tied to completion velocity (optional privacy toggle).',
    'Spaced-repetition deck mode for notes tagged #review with SM-2–style intervals.',
    'Flashcard generator from note headings or bullet lists via on-device templates.',
    'Equation OCR from a photo into LaTeX (with manual correct step) for STEM notes.',
    'Canvas LMS read-only embed: upcoming assignments list with cached refresh.',
    'Schoology / Blackboard assignment ingestion via signed connector (org admin setup).',
    'Email-to-task inbox: forward syllabus deadlines into a staging queue for approval.',
    'Screenshot snip → task: paste image; Flux extracts text locally where possible.',
    'White noise / pomodoro presets saved per subject and synced across devices.',
    'Focus session “intent” note saved with each block for weekly retrospective.',
    'Meeting mode: collapse distractions, banner-only alerts, optional auto-replies copy.',
    'Parent / guardian weekly digest email (opt-in, aggregate stats only).',
    'Teacher dashboard stub: class roster link + assignment push (enterprise track).',
    'Grade GPA calculator with what-if scenarios and target grade paths per class.',
    'Rubric-aware project checklist importer (paste rubric → scaffold subtasks).',
    'Citation graph: notes linked to sources; export bibliography in APA/MLA/Chicago.',
    'Collaborative flashcards with real-time cursors (WebRTC or CRDT-backed).',
    'Peer study matching by subject + timezone with safety and reporting tools.',
    'Public read-only “portfolio week” view for internships or college applications.',
    'Time-zone aware study groups with fair rotation for presentation leads.',
    'Noise-cancelling “focus score” based on session length vs interruptions (heuristic).',
    'Ambient dashboard: live weather + sunset + “best outdoor study window” hint.',
    'Transit-Aware due reminders (“leave by” based on cached commute overlays).',
    'Locker or lab-equipment checklist recurring on lab days only.',
    'Lab safety quiz reminders tied to course tags before certain task types.',
    'Scientific calculator history tape exportable to notes.',
    'Graphing calculator saved plots library with PNG/SVG export.',
    'Unit converter favorites pinned next to the quick-add task field.',
    'Periodic table quizzes with spaced repetition and wrong-answer review.',
    'Organic chemistry name-to-structure drills with optional stereochemistry.',
    'Language conjugation practice from user vocabulary lists.',
    'Historical timeline builder: events on a zoomable axis with citations.',
    'Map-based study for geography: pin decks to regions.',
    'Music practice log with metronome presets and tempo curves.',
    'Art portfolio milestones: critique deadlines and revision rounds.',
    'CS code-snippet library with syntax highlight and tag search (local only).',
    'GitHub issue import for capstone milestones (read-only, PAT in Edge proxy).',
    'LaTeX live preview split for math-heavy notes (KaTeX or MathJax).',
    'Handwriting-to-text for stylus devices with on-device model where available.',
    'Infinite canvas “mind map” layer linked bidirectionally to tasks.',
    'Bi-directional backlinks between notes (`[[wiki]]` style) with graph overview.',
    'Full-text search across tasks, notes, and focus logs with keyboard nav.',
    'Saved searches / smart lists: “overdue STEM”, “no estimate”, “exam prep”.',
    'Bulk edit: shift dates, retag subjects, set priority by filter.',
    'Task templates marketplace (curated packs: AP exams, SAT, college apps).',
    'Syllabus week auto-scaffold: detect week numbers and generate placeholder tasks.',
    'Exam countdown ribbons with suggested daily minutes per subject.',
    'Adaptive daily plan: reschedule open work when a sick/lazy day is marked.',
    'Energy-based scheduling: place hard tasks in user-defined “peak hours”.',
    'Buffer time auto-inserted before/after events imported from calendar.',
    'Travel time tasks auto-created between back-to-back off-campus events.',
    'Location-based reminders (geofence) for “when you reach campus library”.',
    'Wearable glance: next task and focus timer on Apple Watch / Wear OS.',
    'Widget for iOS/Android home screen: next 3 tasks + start focus shortcut.',
    'Lock screen live activity for active focus session with pause controls.',
    'Shortcuts / Automations hooks: “start Flux focus”, “add task”, URL schemes.',
    'Optional end-to-end encrypted notes with passphrase (key never leaves device).',
    'Per-note sharing with expiring links and view-only watermark.',
    'Audit export for schools: aggregate usage without raw note bodies (policy packs).',
    'FERPA-friendly admin mode: tenant isolation, data residency flags.',
    'Role-based access for clubs: officer vs member task visibilities.',
    'Volunteer hour logger with supervisor signature flow (PDF export).',
    'Sport practice planner: drills, hydration, and recovery tasks templates.',
    'Nutrition optional module: meal prep blocks as calendar overlays (non-medical).',
    'Sleep debt estimator from self-reported sleep logs + gentle scheduling nudges.',
    'Break coach: stretch timers with accessibility-friendly animations off.',
    'Dyslexia-friendly reading mode for long notes: spacing, font, contrast presets.',
    'Screen-reader audits on every modal with actionable fix list in devtools.',
    'High-contrast themes tested against WCAG AAA for core planner screens.',
    'Reduced motion parity: no confetti without alternative success cue.',
    'Locale packs with community translation portal and fallback strings.',
    'RTL layout polish for Arabic/Hebrew with mirrored timeline views.',
    'Keyboard-only grade entry flow with visible focus rings everywhere.',
    'Printer-friendly week planner PDF with ink-save mode.',
    'Structured data export to Notion / Obsidian (Markdown + front matter).',
    'Zapier / Make.com triggers: task created, task completed, focus session end.',
    'Slack/Discord bot: post daily digest to a study server channel.',
    'Microsoft Teams assignment cards deep link into Flux tasks.',
    'Linear / Jira bridge for internship task tracking (one-way or two-way).',
    'Billing and org seats (Stripe Customer Portal) for school pilots.',
    'Campus SSO via SAML with JIT provisioning into Supabase.',
    'Device management: revoke other sessions from a trusted devices list.',
    'Security keys / passkeys as primary auth with backup codes UX.',
    'Bug report auto-capture: console tail, route, build ID (user consents).',
    'Feature flag overrides per tester cohort with percentage rollouts.',
    'Performance budgets in CI: bundle size and LCP guardrails on landing.',
    'Synthetic monitoring for auth + sync ping from edge regions.',
    'Owner kill-switch banner for incidents with acknowledgment tracking.',
    'Gradual rollout of AI models with per-tenant allowlists and cost caps.',
  ];
  window.__fluxOwnerProductIdeas=FLUX_PRODUCT_IDEAS;

  window.__fluxProductIdeasFilter=function(q){
    const ql=String(q||'').toLowerCase().trim();
    document.querySelectorAll('#osIdeasList li').forEach(li=>{
      li.style.display=!ql||li.textContent.toLowerCase().includes(ql)?'':'none';
    });
  };
  window.ownerCopyProductIdeasList=function(){
    const arr=window.__fluxOwnerProductIdeas||[];
    const text=arr.map((t,i)=>`${i+1}. ${t}`).join('\n');
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>{
        if(typeof showToast==='function')showToast('Copied '+arr.length+' ideas','success');
      }).catch(()=>{
        if(typeof showToast==='function')showToast('Copy blocked — select list manually','warning');
      });
    }
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('product_ideas_copy',{n:arr.length});
  };

  window.getPlatformConfig=function(){
    return{...PLATFORM_DEFAULTS,...load('flux_platform_config',{})};
  };
  window.savePlatformConfig=function(partial){
    save('flux_platform_config',{...getPlatformConfig(),...partial});
    if(typeof syncKey==='function')syncKey('platform',1);
  };

  window.ownerAuditAppend=function(action,detail){
    if(!isOwner())return;
    const log=load('flux_owner_audit',[]);
    log.push({
      t:Date.now(),
      action:String(action||'event'),
      detail:typeof detail==='object'?JSON.stringify(detail):String(detail||''),
      by:currentUser?.email||'local',
    });
    while(log.length>300)log.shift();
    save('flux_owner_audit',log);
    syncKey('owner_audit',1);
  };

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  /** Minimal CSV field parser (handles quoted fields). */
  function parseCsvLine(line){
    const out=[];
    let cur='';
    let inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(inQ){
        if(c==='"')inQ=false;
        else cur+=c;
      }else{
        if(c==='"')inQ=true;
        else if(c===','){out.push(cur.trim());cur='';}
        else cur+=c;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function mapBadge(st){
    if(st==='in')return'<span style="font-size:.58rem;padding:2px 7px;border-radius:6px;background:rgba(34,197,94,.14);color:var(--green);font-weight:700;white-space:nowrap">In Flux</span>';
    if(st==='partial')return'<span style="font-size:.58rem;padding:2px 7px;border-radius:6px;background:rgba(251,191,36,.12);color:var(--gold);font-weight:700;white-space:nowrap">Partial</span>';
    return'<span style="font-size:.58rem;padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.06);color:var(--muted2);font-weight:700;white-space:nowrap">Server</span>';
  }
  function mapRow(st,text,extra){
    return`<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)">${mapBadge(st)}<div style="flex:1;min-width:0"><div style="font-size:.76rem;line-height:1.45;color:var(--text)">${text}</div>${extra||''}</div></div>`;
  }

  window.ownerOpenSupabase=function(page){
    const ref=SB_PROJECT_REF;
    const map={
      auth:`https://supabase.com/dashboard/project/${ref}/auth/users`,
      sql:`https://supabase.com/dashboard/project/${ref}/sql/new`,
      logs:`https://supabase.com/dashboard/project/${ref}/logs/explorer`,
      api:`https://supabase.com/dashboard/project/${ref}/settings/api`,
      edge:`https://supabase.com/dashboard/project/${ref}/functions`,
    };
    const u=map[page]||map.auth;
    window.open(u,'_blank','noopener,noreferrer');
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('supabase_open',{page:page||'auth'});
  };

  function buildMegaMapHtml(){
    const jump=(tab,label)=>`<button type="button" onclick="window.__osSetTab('${tab}')" style="margin-top:4px;padding:4px 10px;font-size:.65rem;border-radius:8px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.25);color:var(--accent);cursor:pointer">${esc(label)}</button>`;
    const ext=(page,label)=>`<button type="button" onclick="ownerOpenSupabase('${page}')" style="margin-top:4px;margin-right:6px;padding:4px 10px;font-size:.65rem;border-radius:8px;background:var(--card2);border:1px solid var(--border2);color:var(--muted2);cursor:pointer">${esc(label)}</button>`;
    return`
      <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:14px">
        This is the full <b>owner mega-prompt</b> checklist. <b>In Flux</b> = available in this client. <b>Partial</b> = supported in a limited way. <b>Server</b> = needs Supabase Dashboard, service role, or Edge Functions (cannot be done with the anon key alone).
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        ${ext('auth','Auth users')}${ext('sql','SQL')}${ext('logs','Logs')}${ext('edge','Edge Functions')}${ext('api','API keys')}
        <button type="button" onclick="ownerExportComplianceBundle()" style="padding:6px 12px;font-size:.72rem;border-radius:10px;background:rgba(124,92,255,.12);border:1px solid rgba(124,92,255,.3);color:var(--purple);cursor:pointer">⬇ Compliance bundle (JSON)</button>
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:12px 0 6px">1 · User &amp; role management</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('partial','Create, remove, suspend <b>Auth</b> users (all accounts).',jump('auth','Auth users')+ext('auth','Open dashboard'))}
        ${mapRow('in','Assign roles / permissions for the <b>dev team list</b> (admin · editor · viewer) and import/export that list.',jump('team','Team & roles'))}
        ${mapRow('partial','Reset passwords, force password changes.',jump('auth','Auth users')+ext('auth','Dashboard'))}
        ${mapRow('partial','Activity trail: owner <b>audit log</b> in Flux; authoritative Auth logs in Supabase.',jump('audit','Audit log')+ext('logs','Logs explorer'))}
        ${mapRow('in','Import / export dev roster in bulk (JSON / CSV).',jump('team','Team'))}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">2 · Content &amp; resource control</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('partial','Access synced payloads: <b>Platform usage</b> (anonymized aggregates) + full <b>backup JSON</b> for your session.',jump('usage','Platform usage')+jump('data','Data & backup'))}
        ${mapRow('partial','Archive / trim: remove all <b>done</b> tasks locally (reversible via backup).',jump('data','Archive'))}
        ${mapRow('in','Delete outdated data: nuclear clear local cache (Advanced) or selective deletes in-app.',jump('advanced','Advanced'))}
        ${mapRow('in','Versioning / history: use dated <b>full backup</b> exports as snapshots.',jump('data','Backups'))}
        ${mapRow('partial','Tags / categories: tasks &amp; notes use subjects/types inside the app (not a separate CMS).',`<span style="font-size:.68rem;color:var(--muted)">Use main planner UI</span>`)}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">3 · Settings &amp; configuration</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('in','Global announcement toast, session idle hint, compliance contact, data retention target (advisory).',jump('config','Platform config'))}
        ${mapRow('partial','Alerts: panic / quiet hours / daily goal live in user Settings; owner announcement overlays everyone on load.',jump('config','Config')+`<span style="font-size:.68rem;color:var(--muted);display:block;margin-top:4px">Users: Settings → Alerts</span>`)}
        ${mapRow('server','Billing / subscriptions: not part of this student planner — use your host or Stripe separately.',``)}
        ${mapRow('in','Feature flags &amp; dev mode: <b>Admin → Owner control / Dev panel</b> tab.',jump('advanced','Advanced'))}
        ${mapRow('server','Org-wide 2FA / IP restrictions / session policies: configure in Supabase Auth &amp; Dashboard.',ext('auth','Auth')+ext('api','API'))}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">4 · Analytics &amp; reporting</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('in','Session dashboard: task / note / focus counts + CSV exports.',jump('analytics','Analytics'))}
        ${mapRow('in','Cross-account anonymized usage: completions by day, types, per-user counts (Platform usage).',jump('usage','Platform usage'))}
        ${mapRow('partial','Compliance / growth exports: aggregate JSON + tasks/sessions CSV (your data plane).',jump('usage','Exports'))}
        ${mapRow('partial','Retention / engagement: infer from completion timestamps where <code style="font-size:.65rem">completedAt</code> exists.',``)}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">5 · Security &amp; compliance</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('in','Owner audit log (actions in this Command Center).',jump('audit','Audit'))}
        ${mapRow('in','Data retention <b>target</b> (advisory) + compliance contact field.',jump('config','Config'))}
        ${mapRow('partial','Suspicious activity: route alerts via webhooks (Slack/generic) — wire events in Edge Functions later.',jump('integrations','Integrations'))}
        ${mapRow('partial','Revoke sessions / ban users: via Auth tab (server) or Supabase Auth Admin.',jump('auth','Auth users')+ext('auth','Dashboard'))}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">6 · Integrations &amp; automation</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('partial','Webhooks (Slack / generic) for future automation + test ping.',jump('integrations','Integrations'))}
        ${mapRow('partial','Google / Canvas: end-users connect in-app; secrets stay server-side (Edge proxies).',`<span style="font-size:.68rem;color:var(--muted)">Canvas &amp; Gmail tab + Edge proxy</span>`)}
        ${mapRow('server','Signing API keys / service role: only in Supabase &amp; Edge secrets — never in this bundle.',ext('edge','Functions')+ext('api','API'))}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">7 · System maintenance</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('in','Backup &amp; restore full planner JSON; force sync.',jump('data','Data')+jump('advanced','Force sync'))}
        ${mapRow('partial','App “version”: data schema via <code style="font-size:.65rem">DATA_VERSION</code> in app.js; rollback = restore older backup.',``)}
        ${mapRow('server','Hosting uptime / DB metrics: Supabase &amp; Netlify/Vercel dashboards (not embedded here).',ext('logs','Logs'))}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">8 · Special owner powers</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('server','Impersonate users: requires secure Admin API — never with anon key.',ext('auth','Auth'))}
        ${mapRow('partial','Override limits / quotas: not enforced in Flux yet; use Auth + DB policies.',ext('sql','SQL'))}
        ${mapRow('partial','Starter experience: onboarding + tour + synced platform config / dev list.',`<span style="font-size:.68rem;color:var(--muted)">Onboarding in app · tour replay in Settings → Data</span>`)}
      </div>

      <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:16px 0 6px">9 · Futuristic / next-level</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px 14px 2px">
        ${mapRow('partial','AI-assisted workflows: Flux AI + full planner context; owner sees aggregate usage.',jump('analytics','Analytics')+jump('usage','Usage'))}
        ${mapRow('partial','Engagement: streaks &amp; dashboard hero in-app.',`<span style="font-size:.68rem;color:var(--muted)">Dashboard</span>`)}
        ${mapRow('in','Global announcement toast on Command Center open (platform config).',jump('config','Announcement'))}
        ${mapRow('server','Predictive churn / growth: needs anonymized telemetry pipeline — future Edge job.',ext('edge','Edge Functions'))}
        ${mapRow('in','Curated <b>100 feature ideas</b> backlog for planning (owner-only tab).',jump('ideas','Product ideas'))}
      </div>`;
  }

  function extractTasksFromPayload(payload){
    if(!payload||typeof payload!=='object')return[];
    const t=payload.tasks;
    return Array.isArray(t)?t:[];
  }
  function statsFromTaskList(taskList){
    const arr=Array.isArray(taskList)?taskList:[];
    let done=0,open=0;
    const byDay={};
    const byType={};
    arr.forEach(t=>{
      if(t.done){
        done++;
        if(t.completedAt){
          const day=new Date(t.completedAt).toISOString().slice(0,10);
          byDay[day]=(byDay[day]||0)+1;
        }
        const ty=String(t.type||'other').toLowerCase();
        byType[ty]=(byType[ty]||0)+1;
      }else open++;
    });
    return{done,open,byDay,byType};
  }
  function anonLabel(id){
    const s=String(id||'');
    return'U·'+s.replace(/-/g,'').slice(0,10);
  }
  function lastNDaysKeys(n){
    const keys=[];
    for(let i=n-1;i>=0;i--){
      const d=new Date();
      d.setHours(0,0,0,0);
      d.setDate(d.getDate()-i);
      keys.push(d.toISOString().slice(0,10));
    }
    return keys;
  }
  function buildAggHtml(rows){
    if(!rows||!rows.length){
      return'<div style="color:var(--muted);font-size:.82rem">No user_data rows in this result.</div>';
    }
    const globalByDay={};
    const globalByType={};
    const perUser=[];
    rows.forEach(row=>{
      const tasks=extractTasksFromPayload(row.data);
      const s=statsFromTaskList(tasks);
      perUser.push({
        label:anonLabel(row.id),
        done:s.done,
        open:s.open,
        updated:row.updated_at||row.updatedAt||'',
        byDay:s.byDay,
      });
      Object.keys(s.byDay).forEach(k=>{globalByDay[k]=(globalByDay[k]||0)+s.byDay[k];});
      Object.keys(s.byType).forEach(k=>{globalByType[k]=(globalByType[k]||0)+s.byType[k];});
    });
    perUser.sort((a,b)=>b.done-a.done);
    const dayKeys=lastNDaysKeys(14);
    const maxBar=Math.max(1,...dayKeys.map(k=>globalByDay[k]||0));
    const bars=dayKeys.map(k=>{
      const v=globalByDay[k]||0;
      const pct=v===0?0:Math.max(6,Math.round((v/maxBar)*100));
      const label=k.slice(5);
      return`<div style="flex:1;min-width:22px;display:flex;flex-direction:column;align-items:center;gap:6px" title="${esc(k)}: ${v} completions (UTC day)">
        <div style="width:100%;max-width:40px;height:100px;display:flex;align-items:flex-end;border-radius:8px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.12);overflow:hidden">
          <div style="width:100%;height:${pct}%;min-height:${v?3:0}px;background:linear-gradient(180deg,rgba(var(--accent-rgb),.9),rgba(124,92,255,.42));border-radius:4px 4px 0 0"></div>
        </div>
        <span style="font-size:.55rem;color:var(--muted);font-family:JetBrains Mono,monospace">${esc(label)}</span>
      </div>`;
    }).join('');
    const totalDone=perUser.reduce((a,p)=>a+p.done,0);
    const totalOpen=perUser.reduce((a,p)=>a+p.open,0);
    const withTs=dayKeys.reduce((s,k)=>s+(globalByDay[k]||0),0);
    const typeRows=Object.entries(globalByType).sort((a,b)=>b[1]-a[1]).map(([ty,c])=>
      `<div style="display:flex;justify-content:space-between;font-size:.75rem;padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted2)">${esc(ty)}</span><span style="font-family:JetBrains Mono,monospace;color:var(--accent)">${c}</span></div>`
    ).join('');
    const userRows=perUser.map(p=>
      `<tr><td style="padding:8px;font-family:JetBrains Mono,monospace;font-size:.68rem;color:var(--muted2)">${esc(p.label)}</td>
      <td style="padding:8px;text-align:right;font-weight:700;color:var(--green)">${p.done}</td>
      <td style="padding:8px;text-align:right;color:var(--muted)">${p.open}</td>
      <td style="padding:8px;font-size:.65rem;color:var(--muted);font-family:JetBrains Mono,monospace">${p.updated?esc(new Date(p.updated).toLocaleString()):'—'}</td></tr>`
    ).join('');
    const rlsNote=rows.length===1?'<div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.28);border-radius:10px;padding:10px;margin-bottom:12px;font-size:.72rem;color:var(--muted2);line-height:1.5">Only <b>one</b> <code style="font-size:.65rem">user_data</code> row returned — RLS likely limits reads to the signed-in user. To aggregate <b>all</b> accounts, add a Supabase policy for your owner role or an Edge Function using the service role.</div>':'';
    return`
      ${rlsNote}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px">
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px"><div style="font-size:1.15rem;font-weight:800;color:var(--accent)">${rows.length}</div><div style="font-size:.62rem;color:var(--muted)">Accounts (rows)</div></div>
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px"><div style="font-size:1.15rem;font-weight:800;color:var(--green)">${totalDone}</div><div style="font-size:.62rem;color:var(--muted)">Σ completed tasks</div></div>
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px"><div style="font-size:1.15rem;font-weight:800;color:var(--gold)">${totalOpen}</div><div style="font-size:.62rem;color:var(--muted)">Σ open tasks</div></div>
        <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px"><div style="font-size:1.15rem;font-weight:800;color:var(--purple)">${withTs}</div><div style="font-size:.62rem;color:var(--muted)">Completions dated (14d window)</div></div>
      </div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Completed tasks by calendar day (UTC) · last 14 days</div>
      <div style="display:flex;gap:4px;align-items:flex-end;overflow-x:auto;padding-bottom:10px;margin-bottom:16px">${bars}</div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Completed by type (aggregated, no titles)</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:8px 12px;margin-bottom:16px">${typeRows||'<div style="color:var(--muted);font-size:.78rem">No completion type data</div>'}</div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Per account · anonymized id</div>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">
        <table style="width:100%;border-collapse:collapse;font-size:.78rem">
          <thead><tr style="background:var(--card2);text-align:left"><th style="padding:8px">User</th><th style="padding:8px;text-align:right">Done</th><th style="padding:8px;text-align:right">Open</th><th style="padding:8px">Row updated</th></tr></thead>
          <tbody>${userRows}</tbody>
        </table>
      </div>`;
  }

  function tabStyle(active){
    return`display:flex;align-items:center;gap:9px;width:100%;padding:9px 12px;font-size:.78rem;font-weight:650;text-align:left;border-radius:10px;border:1px solid ${active?'rgba(var(--accent-rgb),.32)':'transparent'};background:${active?'linear-gradient(135deg,rgba(var(--accent-rgb),.16),rgba(var(--purple-rgb,124,92,255),.08))':'transparent'};color:${active?'var(--accent)':'var(--muted2)'};cursor:pointer;font-family:inherit;transition:background .12s,color .12s,border-color .12s;letter-spacing:.005em`;
  }

  /** Tab id → { label, icon, group }.  Order here drives the sidebar nav order. */
  const OS_TAB_DEFS={
    overview:    {label:'Overview',         icon:'📊', group:'home'},
    release:     {label:'Release & push',   icon:'🚀', group:'home'},
    team:        {label:'Team & roles',     icon:'👥', group:'people'},
    testers:     {label:'Testers',          icon:'🧪', group:'people'},
    auth:        {label:'Auth users',       icon:'🔐', group:'people'},
    analytics:   {label:'My analytics',     icon:'📈', group:'insights'},
    usage:       {label:'Platform usage',   icon:'🌐', group:'insights'},
    feedback:    {label:'Feedback inbox',   icon:'💬', group:'insights'},
    config:      {label:'Platform config',  icon:'⚙️', group:'build'},
    integrations:{label:'Integrations',     icon:'🔌', group:'build'},
    megamap:     {label:'Mega map',         icon:'🗺',  group:'build'},
    ideas:       {label:'Product ideas',    icon:'💡', group:'build'},
    audit:       {label:'Audit log',        icon:'📜', group:'safety'},
    data:        {label:'Data & backup',    icon:'💾', group:'safety'},
    advanced:    {label:'Advanced',         icon:'🛠', group:'safety'},
  };
  const OS_TABS=new Set(Object.keys(OS_TAB_DEFS));
  const OS_GROUPS=[
    {id:'home',     label:'Command'},
    {id:'people',   label:'People'},
    {id:'insights', label:'Insights'},
    {id:'build',    label:'Build'},
    {id:'safety',   label:'Safety'},
  ];

  /** Build the sidebar nav HTML.  Uses tabStyle() for active/inactive look. */
  function buildOsSidebarHtml(activeTab){
    return OS_GROUPS.map(g=>{
      const items=Object.entries(OS_TAB_DEFS).filter(([_,def])=>def.group===g.id);
      if(!items.length)return'';
      const rows=items.map(([id,def])=>`
        <button type="button" data-os-tab="${id}" onclick="window.__osSetTab('${id}')" style="${tabStyle(id===activeTab)}">
          <span style="font-size:.95rem;line-height:1">${def.icon}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(def.label)}</span>
        </button>`).join('');
      return`<div style="margin-bottom:14px">
        <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);font-family:JetBrains Mono,monospace;padding:6px 12px 4px;font-weight:700">${esc(g.label)}</div>
        ${rows}
      </div>`;
    }).join('');
  }

  window.openOwnerSuite=function(prefTab, opts){
    if(!isOwner())return;
    opts=opts||{};
    let mountEl=null;
    if(opts.overlay===true)mountEl=null;
    else mountEl=opts.mount||document.getElementById('fluxControlMount');
    let tab=OS_TABS.has(prefTab)?prefTab:(window.__osActiveTab&&OS_TABS.has(window.__osActiveTab)?window.__osActiveTab:'overview');
    if(mountEl&&!opts.skipNav){
      const fc=document.getElementById('flux_control');
      if(!fc||!fc.classList.contains('active')){
        window.__fluxOwnerPrefTab=tab;
        if(typeof nav==='function')nav('flux_control');
        return;
      }
    }
    document.getElementById('modPanel')?.remove();
    document.getElementById('ownerSuite')?.remove();
    const embedUi=!!mountEl;
    const root=document.createElement('div');
    root.id='ownerSuite';
    if(embedUi){
      root.style.cssText='position:relative;width:100%;min-height:0;margin:0;padding:0;background:transparent;z-index:auto;overflow:visible;display:block';
    }else{
      root.style.cssText='position:fixed;inset:0;background:rgba(5,8,16,.92);z-index:9900;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;backdrop-filter:blur(12px);overflow-y:auto';
    }
    function body(){
      const devAccounts=load('flux_dev_accounts',[]);
      const auditRaw=load('flux_owner_audit',[]);
      const audit=auditRaw.slice().reverse();
      const pc=getPlatformConfig();
      const lastSync=load('flux_last_sync',0);
      const lsBytes=JSON.stringify(localStorage).length;
      const insights=[];
      try{
        const overdue=(tasks||[]).filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<new Date(new Date().toDateString())).length;
        if(overdue>=3)insights.push({icon:'⚠️',t:'Workload',d:overdue+' overdue tasks — consider nudges or Recovery-style filters.'});
        if((tasks||[]).filter(t=>!t.done).length===0)insights.push({icon:'✨',t:'Momentum',d:'Inbox clear — strong time to plan ahead.'});
        if((sessionLog||[]).length>=5)insights.push({icon:'⏱',t:'Focus',d:Math.round((sessionLog||[]).reduce((a,s)=>a+(s.mins||0),0)/60)+'h logged in focus sessions.'});
      }catch(_){}
      insights.push({icon:'🛡',t:'Security',d:'Use Google 2FA on the account that signs into Flux; session hints are advisory only in this client.'});

      if(tab==='testers'){
        const testers=load('flux_tester_emails',[]);
        const rows=Array.isArray(testers)?testers:[];
        return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:14px">
          Accounts on this list get <b>tester mode</b> after sign-in: treated as <b>Pro</b> while payment flags stay off. Stored in <code style="font-size:.65rem">flux_tester_emails</code> (localStorage). Re-open the Command Center after edits; testers may need to refresh if already signed in.
        </div>
        ${rows.length?rows.map((em,i)=>`
          <div style="display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <span style="font-size:.8rem;font-weight:600;flex:1;word-break:break-all">${esc(em)}</span>
            <button type="button" onclick="ownerRemoveTesterEmail(${i})" style="padding:6px 10px;font-size:.72rem;border-radius:8px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);color:var(--red)">Remove</button>
          </div>`).join(''):'<div style="color:var(--muted);font-size:.82rem;margin-bottom:10px">No tester emails yet.</div>'}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <input type="email" id="osTesterEmail" placeholder="student@school.edu" style="flex:1;min-width:200px;margin:0;padding:8px 12px;font-size:.8rem;border-radius:10px">
          <button type="button" onclick="ownerAddTesterEmail()" style="padding:8px 14px;font-size:.78rem">+ Add tester</button>
        </div>`;
      }

      if(tab==='megamap')return buildMegaMapHtml();

      if(tab==='overview')return`
        <div style="background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.22);border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:.74rem;line-height:1.5;color:var(--muted2)">
          <b style="color:var(--accent)">Mega prompt coverage</b> — Every bullet from the owner god-mode spec is listed with status on the <button type="button" onclick="window.__osSetTab('megamap')" style="background:rgba(var(--accent-rgb),.15);border:1px solid rgba(var(--accent-rgb),.35);color:var(--accent);padding:3px 10px;border-radius:8px;font-size:.72rem;cursor:pointer;font-weight:700">Mega map</button> tab.
        </div>
        <div style="background:rgba(124,92,255,.06);border:1px solid rgba(124,92,255,.22);border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:.74rem;line-height:1.5;color:var(--muted2)">
          <b style="color:var(--purple)">Product backlog</b> — <button type="button" onclick="window.__osSetTab('ideas')" style="background:rgba(124,92,255,.14);border:1px solid rgba(124,92,255,.35);color:var(--purple);padding:3px 10px;border-radius:8px;font-size:.72rem;cursor:pointer;font-weight:700">100 feature ideas</button> curated for Flux (filter, copy list).
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px">
            <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Team (dev seats)</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${devAccounts.length}</div>
          </div>
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px">
            <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Audit events</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--gold)">${auditRaw.length}</div>
          </div>
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px">
            <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Local footprint</div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text)">${(lsBytes/1024).toFixed(0)} KB</div>
          </div>
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px">
            <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Last cloud sync</div>
            <div style="font-size:.72rem;font-weight:700;color:var(--muted2);margin-top:4px">${lastSync?new Date(lastSync).toLocaleString():'—'}</div>
          </div>
        </div>
        <div style="background:rgba(124,92,255,.08);border:1px solid rgba(124,92,255,.25);border-radius:14px;padding:14px;margin-bottom:14px">
          <div style="font-size:.75rem;font-weight:700;margin-bottom:6px">🔐 Platform reality (read this)</div>
          <div style="font-size:.72rem;color:var(--muted2);line-height:1.55">
            Flux stores each user’s data in their own <b>user_data</b> row. <b>Auth administration</b> (list/ban/delete/reset) runs through the owner-only <b>release-admin</b> Edge Function with the service role — open the <button type="button" onclick="window.__osSetTab&&window.__osSetTab('auth')" style="background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.32);color:var(--accent);padding:2px 10px;border-radius:8px;font-size:.72rem;cursor:pointer;font-weight:700">Auth users</button> tab. This browser still ships only the <b>anon</b> key; impersonation and org SSO policies stay in Supabase.
          </div>
        </div>
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:8px">AI-style insights (heuristic)</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${insights.map(i=>`<div style="display:flex;gap:10px;background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px 12px"><span>${i.icon}</span><div><div style="font-size:.78rem;font-weight:700">${esc(i.t)}</div><div style="font-size:.72rem;color:var(--muted2)">${esc(i.d)}</div></div></div>`).join('')}
        </div>`;

      if(tab==='team')return`
        <div style="font-size:.72rem;color:var(--muted2);margin-bottom:12px;line-height:1.5">
          <b>Roles</b> map to permission bundles. <b>Admin</b> = all tools. <b>Editor</b> = flags + dev mode + clear + release push (no manage devs). <b>Viewer</b> = read-only panel hooks.
        </div>
        ${typeof renderDevPanelLayoutEditorHtml==='function'?renderDevPanelLayoutEditorHtml():''}
        ${devAccounts.length?devAccounts.map((d,i)=>`
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
              <span style="font-weight:700;flex:1;min-width:140px">${esc(d.email)}</span>
              <select onchange="ownerSetDevRole(${i},this.value)" style="padding:6px 10px;border-radius:8px;background:var(--card);border:1px solid var(--border2);color:var(--text);font-size:.75rem">
                <option value="admin" ${(d.role||'admin')==='admin'?'selected':''}>Admin</option>
                <option value="editor" ${d.role==='editor'?'selected':''}>Editor</option>
                <option value="viewer" ${d.role==='viewer'?'selected':''}>Viewer</option>
              </select>
              <button type="button" onclick="removeDevAccount(${i})" style="padding:6px 10px;font-size:.72rem;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);color:var(--red);border-radius:8px">Remove</button>
            </div>
            <div style="font-size:.65rem;color:var(--muted);font-family:JetBrains Mono,monospace">Perms: ${(d.perms||[]).join(', ')||'—'}</div>
          </div>`).join(''):'<div style="color:var(--muted);font-size:.82rem">No dev accounts. Add emails below.</div>'}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <input type="email" id="osNewDevEmail" placeholder="invite@email.com" style="flex:1;min-width:180px;margin:0;padding:8px 12px;font-size:.8rem;border-radius:10px">
          <button type="button" onclick="ownerQuickAddDev()" style="padding:8px 14px;font-size:.78rem">+ Invite</button>
        </div>
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Bulk import / export (dev list)</div>
          <button type="button" onclick="ownerExportDevsJson()" style="margin-right:8px;margin-bottom:8px;padding:8px 12px;font-size:.72rem;border-radius:10px">Export JSON</button>
          <button type="button" onclick="ownerExportDevsCsv()" style="margin-right:8px;margin-bottom:8px;padding:8px 12px;font-size:.72rem;border-radius:10px">Export CSV</button>
          <label style="font-size:.72rem;color:var(--accent);cursor:pointer">Import JSON<input type="file" accept="application/json" style="display:none" onchange="ownerImportDevsFile(event)"></label>
          <label style="font-size:.72rem;color:var(--accent);cursor:pointer;margin-left:10px">Import CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="ownerImportDevsCsvFile(event)"></label>
        </div>`;

      if(tab==='release'){
        const buildId=(typeof FLUX_BUILD_ID!=='undefined'&&FLUX_BUILD_ID)||(window.FLUX_BUILD_ID||'unknown');
        const gate=(typeof FluxRelease!=='undefined'&&FluxRelease.getGate())||pc.releaseGate||null;
        const released=gate&&gate.released?String(gate.released).replace(/^build-/,''):'— (no release pushed yet)';
        const buildLabel=String(buildId).replace(/^build-/,'');
        const isLive=gate&&gate.released===buildId;
        const diff=!isLive;
        const previewMode=(gate&&gate.previewMode)||'all_devs';
        const previewEmails=(gate&&Array.isArray(gate.previewEmails)?gate.previewEmails:[]).map(x=>String(x||'').toLowerCase());
        const previewRows=devAccounts.length?devAccounts.map((d,i)=>{
          const em=String(d.email||'').toLowerCase();
          const checked=previewEmails.includes(em);
          return`<label style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:.74rem;color:var(--muted2)">
            <input type="checkbox" data-release-preview-email="${esc(em)}" ${checked?'checked':''} style="width:14px;height:14px;margin:0">
            <span style="flex:1;word-break:break-all">${esc(d.email||'')}</span>
            <span style="font-size:.6rem;color:var(--muted);font-family:JetBrains Mono,monospace">${esc(d.role||'viewer')}</span>
          </label>`;
        }).join(''):'<div style="font-size:.72rem;color:var(--muted);padding:8px 0">No dev accounts yet. Add devs in Team & roles.</div>';
        return`
          <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:14px">
            Staged rollout: bump <code style="font-size:.65rem">FLUX_BUILD_ID</code> each deploy. With <b>strict release</b> on (<code style="font-size:.65rem">REQUIRE_EXPLICIT_RELEASE</code> in <code style="font-size:.65rem">flux-release-gate.js</code>), signed-in users who are <b>not</b> owner/dev preview stay on <i>"Update under review"</i> until someone with permission clicks <b>Push to all users</b> for that build. Owner always sees preview; devs follow the mode below.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px">
              <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Preview (you)</div>
              <div style="font-size:1rem;font-weight:800;color:var(--gold);margin-top:3px;font-family:JetBrains Mono,monospace">${esc(buildLabel)}</div>
            </div>
            <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px">
              <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Live (users)</div>
              <div style="font-size:1rem;font-weight:800;color:${isLive?'var(--green)':'var(--muted2)'};margin-top:3px;font-family:JetBrains Mono,monospace">${esc(released)}</div>
            </div>
          </div>
          ${gate&&gate.pushedBy?`<div style="font-size:.7rem;color:var(--muted2);margin-bottom:12px">Last push by <b>${esc(gate.pushedBy)}</b> · ${esc(new Date(gate.pushedAt||0).toLocaleString())}${gate.notes?`<br><span style="color:var(--muted)">Notes:</span> ${esc(gate.notes)}`:''}</div>`:''}
          <button type="button" id="osReleasePushBtn" ${isLive?'disabled':''} style="width:100%;padding:12px;font-size:.9rem;font-weight:800;border-radius:12px;background:${isLive?'var(--card2)':'linear-gradient(135deg,#fbbf24,#f59e0b)'};border:1px solid ${isLive?'var(--border)':'rgba(251,191,36,.4)'};color:${isLive?'var(--muted)':'#080a0f'};cursor:${isLive?'default':'pointer'};opacity:${isLive?0.6:1}">${isLive?'✓ This build is already released':'🚀 Push '+esc(buildLabel)+' to all users'}</button>
          <div style="margin-top:10px;font-size:.66rem;color:var(--muted);line-height:1.5">
            ${diff?'Users currently see the "Update under review" screen. Push when you\'re ready to roll out.':'All users on the current build. New deploys will re-enter preview until pushed.'}
          </div>
          <div style="margin-top:18px;padding:14px;background:var(--card2);border:1px solid var(--border);border-radius:14px">
            <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:8px">Preview access before release</div>
            <div style="font-size:.7rem;color:var(--muted2);line-height:1.5;margin-bottom:10px">The owner always sees preview builds. Choose which dev accounts can see a new build before it is released to everyone.</div>
            <select id="osReleasePreviewMode" style="width:100%;padding:8px 10px;border-radius:10px;background:var(--card);border:1px solid var(--border2);color:var(--text);font-size:.78rem;margin-bottom:10px">
              <option value="all_devs" ${previewMode==='all_devs'?'selected':''}>Owner + all dev accounts</option>
              <option value="selected" ${previewMode==='selected'?'selected':''}>Owner + selected dev accounts</option>
              <option value="owner" ${previewMode==='owner'?'selected':''}>Owner only</option>
            </select>
            <div style="max-height:160px;overflow-y:auto;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:10px">${previewRows}</div>
            <button type="button" onclick="ownerSaveReleasePreviewAccess()" style="width:100%;padding:9px;font-size:.78rem;font-weight:700;border-radius:10px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.32);color:var(--accent)">Save preview access</button>
          </div>
          <div style="margin-top:18px;padding:14px;background:var(--card2);border:1px solid var(--border);border-radius:14px">
            <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:8px">Sync platform config to devs (server)</div>
            <div style="font-size:.7rem;color:var(--muted2);line-height:1.55;margin-bottom:10px">Merges your <b>cloud</b> owner row’s <code style="font-size:.65rem">platformConfig</code> (release gate, flags, announcements…) into each dev’s <code style="font-size:.65rem">user_data</code> row via the <b>release-admin</b> Edge Function. Does <b>not</b> copy tasks, notes, or other local planner content. Devs must have signed in once so Auth + <code style="font-size:.65rem">user_data</code> exist. Optional: add a <code style="font-size:.65rem">userId</code> field on a dev row in Team to skip Auth email lookup.</div>
            <select id="osPlatformSyncScope" style="width:100%;padding:8px 10px;border-radius:10px;background:var(--card);border:1px solid var(--border2);color:var(--text);font-size:.78rem;margin-bottom:10px">
              <option value="all">All dev accounts in Team</option>
              <option value="selected">Only devs checked above (preview list)</option>
            </select>
            <button type="button" onclick="ownerSyncPlatformConfigToDevs()" style="width:100%;padding:10px;font-size:.8rem;font-weight:700;border-radius:10px;background:rgba(124,92,255,.14);border:1px solid rgba(124,92,255,.35);color:var(--text)">⬆ Sync platform config to dev cloud rows</button>
          </div>
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);font-size:.66rem;color:var(--muted);line-height:1.5">
            <b>How deploys work:</b> Bump <code style="font-size:.7rem">FLUX_BUILD_ID</code> in <code style="font-size:.7rem">public/js/flux-release-gate.js</code> before committing. After you deploy, the new build is automatically gated for non-preview users until an owner or release-authorized dev pushes it here.
          </div>`;
      }

      if(tab==='auth')return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:12px">
          Owner-only <b>Supabase Auth Admin</b> via <code style="font-size:.65rem">release-admin</code> (JWT + <code style="font-size:.65rem">FLUX_OWNER_EMAIL</code>). Deploy the function and keep the <b>service role</b> in Edge secrets only. Recovery links are generated here — copy into email or your support flow; invite emails are sent by Supabase when you use <b>Invite</b>.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
          <button type="button" onclick="ownerAuthUsersLoad(1)" style="padding:8px 14px;font-size:.78rem;border-radius:10px;background:rgba(var(--accent-rgb),.14);border:1px solid rgba(var(--accent-rgb),.32);color:var(--accent);font-weight:700">↻ Refresh list</button>
          <button type="button" onclick="ownerAuthUsersPrevPage()" class="btn-sec" style="padding:7px 12px;font-size:.74rem;border-radius:10px">← Prev page</button>
          <button type="button" onclick="ownerAuthUsersNextPage()" class="btn-sec" style="padding:7px 12px;font-size:.74rem;border-radius:10px">Next page →</button>
          <button type="button" onclick="ownerOpenSupabase('auth')" style="padding:7px 12px;font-size:.72rem;border-radius:10px;background:var(--card2);border:1px solid var(--border2);color:var(--muted2)">Open Supabase Auth</button>
        </div>
        <div id="osAuthMount" style="min-height:120px;margin-bottom:16px;font-size:.78rem;color:var(--muted)">Click <b>Refresh list</b> to load accounts (page size 40).</div>
        <div style="border-top:1px solid var(--border);padding-top:14px;margin-bottom:14px">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Create user</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <input type="email" id="osAuthNewEmail" placeholder="student@school.edu" style="flex:1;min-width:200px;padding:8px 12px;border-radius:10px;font-size:.8rem">
            <input type="password" id="osAuthNewPw" placeholder="password (optional)" style="width:160px;padding:8px 10px;border-radius:10px;font-size:.78rem">
            <button type="button" onclick="ownerAuthCreateUser()" style="padding:8px 14px;font-size:.78rem;border-radius:10px;font-weight:700">Create</button>
          </div>
          <div style="font-size:.65rem;color:var(--muted);margin-top:6px">Leave password blank for a generated temporary password (shown once in a dialog).</div>
        </div>
        <div style="margin-bottom:14px">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Recovery link (manual send)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <input type="email" id="osAuthRecoveryEmail" placeholder="account email" style="flex:1;min-width:200px;padding:8px 12px;border-radius:10px;font-size:.8rem">
            <button type="button" onclick="ownerAuthSendRecovery()" style="padding:8px 14px;font-size:.78rem;border-radius:10px">Generate recovery link</button>
          </div>
        </div>
        <div>
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px">Invite (email)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <input type="email" id="osAuthInviteEmail" placeholder="invite@school.edu" style="flex:1;min-width:200px;padding:8px 12px;border-radius:10px;font-size:.8rem">
            <button type="button" onclick="ownerAuthInvite()" style="padding:8px 14px;font-size:.78rem;border-radius:10px">Send invite</button>
          </div>
        </div>`;

      if(tab==='data')return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:14px">
          Full <b>backup</b> includes planner payload shape (tasks, notes, grades, dev list, audit tail, platform config). Restoring merges into this browser then syncs if signed in.
        </div>
        <button type="button" onclick="ownerExportFullBackup()" style="width:100%;padding:12px;margin-bottom:10px;font-size:.85rem;font-weight:700;border-radius:12px;background:linear-gradient(135deg,rgba(var(--accent-rgb),.2),rgba(var(--purple-rgb),.15));border:1px solid rgba(var(--accent-rgb),.35)">⬇ Download full backup (JSON)</button>
        <label style="display:block;width:100%;padding:12px;text-align:center;border-radius:12px;border:1px dashed var(--border2);cursor:pointer;font-size:.82rem;color:var(--accent);margin-bottom:12px">
          ⬆ Restore from backup JSON<input type="file" accept="application/json" style="display:none" onchange="ownerRestoreBackupFile(event)">
        </label>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border)">
          <span style="font-size:.8rem">Archive all <b>done</b> tasks (reversible via backup)</span>
          <button type="button" onclick="ownerArchiveDoneTasks()" style="padding:6px 12px;font-size:.72rem;border-radius:8px">Archive</button>
        </div>
        <div style="margin-top:14px">
          <label style="font-size:.72rem;color:var(--muted)">Data retention target (days, advisory)</label>
          <input type="number" id="osRetention" value="${pc.dataRetentionDays||365}" min="30" max="3650" style="width:100%;margin-top:4px;padding:8px;border-radius:10px" onchange="savePlatformConfig({dataRetentionDays:parseInt(this.value)||365})">
        </div>`;

      if(tab==='config')return`
        <label style="font-size:.72rem;color:var(--muted)">Global announcement (toast after sync — optional)</label>
        <input type="text" id="osAnnounce" value="${esc(pc.announcement)}" placeholder="e.g. Maintenance Sunday 2am UTC" style="width:100%;margin:6px 0 10px;padding:10px;border-radius:10px" onblur="savePlatformConfig({announcement:this.value.trim()})">
        <label style="font-size:.72rem;color:var(--muted)">Announcement revision (integer — bump when you want <b>everyone</b> to dismiss/see toast again)</label>
        <input type="number" id="osAnnRev" value="${typeof pc.announcementRevision==='number'?pc.announcementRevision:0}" min="0" max="999999" step="1" style="width:100%;margin:6px 0 14px;padding:8px;border-radius:10px" onchange="savePlatformConfig({announcementRevision:Math.max(0,parseInt(this.value)||0)})">
        <label style="font-size:.72rem;color:var(--muted)">Session idle reminder (minutes, advisory)</label>
        <input type="number" id="osSess" value="${pc.sessionIdleWarnMins||60}" min="5" max="480" style="width:100%;margin:6px 0 14px;padding:8px;border-radius:10px" onchange="savePlatformConfig({sessionIdleWarnMins:parseInt(this.value)||60})">
        <label style="font-size:.72rem;color:var(--muted)">Compliance / DPO contact (reference only)</label>
        <input type="text" id="osComp" value="${esc(pc.complianceContact)}" placeholder="privacy@school.edu" style="width:100%;margin:6px 0;padding:10px;border-radius:10px" onblur="savePlatformConfig({complianceContact:this.value.trim()})">
        <p style="font-size:.68rem;color:var(--muted);margin-top:12px">Billing, 2FA enforcement, and IP allowlists require IdP or Supabase Pro policies — not configurable from this client alone.</p>`;

      if(tab==='integrations')return`
        <label style="font-size:.72rem;color:var(--muted)">Slack / generic webhook URL (POST JSON on future events)</label>
        <input type="url" id="osSlack" value="${esc(pc.integrations?.slackWebhook||'')}" placeholder="https://hooks.slack.com/..." style="width:100%;margin:6px 0;padding:10px;border-radius:10px" onblur="ownerSaveIntegrationWebhooks()">
        <input type="url" id="osHook" value="${esc(pc.integrations?.genericWebhook||'')}" placeholder="https://your-automation/webhook" style="width:100%;margin:6px 0 14px;padding:10px;border-radius:10px" onblur="ownerSaveIntegrationWebhooks()">
        <button type="button" onclick="ownerTestWebhookPing()" style="padding:8px 14px;font-size:.75rem;border-radius:10px">Send test ping</button>
        <p style="font-size:.68rem;color:var(--muted);margin-top:12px">API keys with service role must never ship in the browser. Use Edge Functions.</p>`;

      if(tab==='analytics'){
        const allTasks=Array.isArray(tasks)?tasks:[];
        const done=allTasks.filter(t=>t.done);
        const open=allTasks.filter(t=>!t.done);
        const todayKey=new Date().toDateString();
        const overdue=open.filter(t=>t.date&&new Date(t.date+'T00:00:00')<new Date(todayKey)).length;
        const dueToday=open.filter(t=>t.date===new Date().toISOString().slice(0,10)).length;
        const compRate=allTasks.length?Math.round(done.length*100/allTasks.length):0;
        const sLog=Array.isArray(sessionLog)?sessionLog:[];
        const focusMins=sLog.reduce((a,s)=>a+(parseInt(s.mins,10)||0),0);
        const focusHrs=Math.round(focusMins/60*10)/10;
        const focusWeek=(()=>{
          const cutoff=Date.now()-7*864e5;
          return sLog.filter(s=>(s.t||s.timestamp||0)>=cutoff).reduce((a,s)=>a+(parseInt(s.mins,10)||0),0);
        })();
        const subjectsAgg={};
        allTasks.forEach(t=>{const k=(t.subject||t.class||'(none)')+'';subjectsAgg[k]=(subjectsAgg[k]||0)+1;});
        const subjectRows=Object.entries(subjectsAgg).sort((a,b)=>b[1]-a[1]).slice(0,8);
        const subjectMax=subjectRows.length?Math.max(...subjectRows.map(r=>r[1])):1;
        const last30=(()=>{
          const out=[];
          for(let i=29;i>=0;i--){
            const d=new Date();d.setDate(d.getDate()-i);
            const key=d.toISOString().slice(0,10);
            const n=done.filter(t=>(t.doneAt||'').slice(0,10)===key||(t.completedAt||'').slice(0,10)===key||(t.date||'')===key).length;
            out.push({key,n,label:d.getDate()+'/'+(d.getMonth()+1)});
          }
          return out;
        })();
        const last30Max=Math.max(1,...last30.map(d=>d.n));
        const noteCount=Array.isArray(notes)?notes.length:0;
        const goalCount=Array.isArray(window.extraGoals)?window.extraGoals.length:0;
        const streakBest=parseInt(localStorage.getItem('flux_streak_best')||'0',10)||0;
        const streakCur=parseInt(localStorage.getItem('flux_streak_current')||'0',10)||0;
        const feedbackCount=(load('flux_feedback_inbox',[])||[]).length;
        const sparkBars=last30.map(d=>`<div title="${esc(d.key)}: ${d.n}" style="flex:1;height:${Math.max(4,(d.n/last30Max)*48)}px;background:linear-gradient(180deg,var(--accent) 0%, color-mix(in srgb, var(--accent) 40%, transparent) 100%);border-radius:3px 3px 0 0;opacity:${d.n?0.95:0.25}"></div>`).join('');
        return`
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:18px">
          <h3 class="flux-color-title" style="margin:0;font-size:1.05rem;font-weight:800">My analytics</h3>
          <span style="font-size:.66rem;color:var(--muted);font-family:JetBrains Mono,monospace">Local snapshot · ${esc(new Date().toLocaleString())}</span>
          <span style="flex:1"></span>
          <button type="button" onclick="ownerExportTasksCsv()" class="btn-sec" style="padding:7px 12px;font-size:.7rem;border-radius:10px">⬇ Tasks CSV</button>
          <button type="button" onclick="ownerExportSessionsCsv()" class="btn-sec" style="padding:7px 12px;font-size:.7rem;border-radius:10px">⬇ Sessions CSV</button>
          <button type="button" onclick="window.__osSetTab&&window.__osSetTab('usage')" style="padding:7px 12px;font-size:.7rem;border-radius:10px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);font-weight:700">Cross-user usage →</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px">
          <div style="background:var(--card2);border-radius:14px;padding:14px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-family:JetBrains Mono,monospace">Tasks total</div><div style="font-size:1.6rem;font-weight:900;color:var(--accent);margin-top:4px">${allTasks.length}</div><div style="font-size:.68rem;color:var(--muted2);margin-top:2px">${done.length} done · ${open.length} open</div></div>
          <div style="background:var(--card2);border-radius:14px;padding:14px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-family:JetBrains Mono,monospace">Completion rate</div><div style="font-size:1.6rem;font-weight:900;color:var(--green);margin-top:4px">${compRate}%</div><div style="margin-top:8px;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${compRate}%;height:100%;background:linear-gradient(90deg,var(--green),var(--accent));border-radius:3px"></div></div></div>
          <div style="background:var(--card2);border-radius:14px;padding:14px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-family:JetBrains Mono,monospace">Overdue</div><div style="font-size:1.6rem;font-weight:900;color:${overdue?'var(--red)':'var(--muted)'};margin-top:4px">${overdue}</div><div style="font-size:.68rem;color:var(--muted2);margin-top:2px">${dueToday} due today</div></div>
          <div style="background:var(--card2);border-radius:14px;padding:14px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-family:JetBrains Mono,monospace">Focus logged</div><div style="font-size:1.6rem;font-weight:900;color:var(--purple);margin-top:4px">${focusHrs}h</div><div style="font-size:.68rem;color:var(--muted2);margin-top:2px">${Math.round(focusWeek)}m this week · ${sLog.length} sessions</div></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:16px">
          <div style="background:var(--card2);border-radius:14px;padding:14px;border:1px solid var(--border)">
            <div style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-family:JetBrains Mono,monospace;margin-bottom:10px">Completions · last 30 days</div>
            <div style="display:flex;align-items:flex-end;gap:3px;height:60px;padding:0 2px">${sparkBars}</div>
            <div style="display:flex;justify-content:space-between;font-size:.6rem;color:var(--muted);font-family:JetBrains Mono,monospace;margin-top:6px;padding:0 4px"><span>30d ago</span><span>today</span></div>
          </div>
          <div style="background:var(--card2);border-radius:14px;padding:14px;border:1px solid var(--border)">
            <div style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-family:JetBrains Mono,monospace;margin-bottom:10px">Top subjects</div>
            ${subjectRows.length?subjectRows.map(([s,n])=>`
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <div style="flex:0 0 120px;font-size:.72rem;color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s)}</div>
                <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;width:${(n/subjectMax)*100}%;background:linear-gradient(90deg,var(--accent),var(--purple))"></div></div>
                <div style="flex:0 0 28px;font-size:.7rem;color:var(--muted2);font-family:JetBrains Mono,monospace;text-align:right">${n}</div>
              </div>`).join(''):'<div style="font-size:.78rem;color:var(--muted)">No subjects yet.</div>'}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px">
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Notes</div><div style="font-size:1.2rem;font-weight:800;color:var(--gold);margin-top:2px">${noteCount}</div></div>
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Goals</div><div style="font-size:1.2rem;font-weight:800;color:var(--accent);margin-top:2px">${goalCount}</div></div>
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Streak (cur · best)</div><div style="font-size:1.2rem;font-weight:800;color:var(--accent2,var(--accent));margin-top:2px">${streakCur} · ${streakBest}</div></div>
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Feedback (cached)</div><div style="font-size:1.2rem;font-weight:800;color:var(--purple);margin-top:2px">${feedbackCount}</div><button type="button" onclick="window.__osSetTab&&window.__osSetTab('feedback')" style="margin-top:4px;font-size:.62rem;background:none;border:none;color:var(--accent);padding:0;cursor:pointer;text-decoration:underline">Open inbox →</button></div>
        </div>

        <div style="font-size:.66rem;color:var(--muted);line-height:1.55;padding:12px 14px;background:rgba(var(--accent-rgb),.04);border:1px dashed rgba(var(--accent-rgb),.24);border-radius:10px">
          Numbers above reflect <b>your local browser</b>. For aggregate user analytics across the platform (anonymous task/focus counts), open <b>Platform usage</b> in the sidebar.
        </div>`;
      }

      if(tab==='usage')return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:12px">
          Pulls anonymized <b>counts</b> from synced <code style="font-size:.65rem">user_data</code> payloads: completed vs open tasks, completion dates (for the chart), and task <b>types</b> only. <b>No</b> task titles, note bodies, or grades are shown here.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center">
          <button type="button" onclick="ownerRefreshPlatformUsage()" style="padding:10px 16px;font-size:.78rem;border-radius:10px;background:linear-gradient(135deg,rgba(var(--accent-rgb),.18),rgba(124,92,255,.12));border:1px solid rgba(var(--accent-rgb),.35);font-weight:700">↻ Refresh from cloud</button>
          <button type="button" onclick="ownerExportPlatformAggJson()" class="btn-sec" style="padding:8px 14px;font-size:.75rem;border-radius:10px">Export aggregate JSON</button>
        </div>
        <div id="osUsageMount">${typeof window.__ownerUsageHtml==='string'&&window.__ownerUsageHtml?window.__ownerUsageHtml:'<div style="color:var(--muted);font-size:.82rem">Click <b>Refresh from cloud</b> to load cross-account aggregates (requires Supabase to return multiple <code style="font-size:.65rem">user_data</code> rows — see RLS note after load).</div>'}</div>`;

      if(tab==='audit')return`
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <button type="button" onclick="ownerClearAudit()" style="padding:6px 12px;font-size:.72rem;border-radius:8px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);color:var(--red)">Clear audit log</button>
        <button type="button" onclick="ownerExportAuditCsv()" style="padding:6px 12px;font-size:.72rem;border-radius:8px;background:var(--card2);border:1px solid var(--border2);color:var(--muted2)">⬇ Export CSV</button>
        </div>
        <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--card2)">
          ${audit.length?audit.map(e=>`<div style="padding:10px 12px;border-bottom:1px solid var(--border);font-size:.72rem">
            <div style="font-family:JetBrains Mono,monospace;color:var(--muted)">${new Date(e.t).toLocaleString()}</div>
            <div style="font-weight:700;color:var(--accent)">${esc(e.action)}</div>
            <div style="color:var(--muted2);word-break:break-word">${esc(e.detail)}</div>
            <div style="font-size:.65rem;opacity:.6">${esc(e.by)}</div>
          </div>`).join(''):'<div style="padding:20px;text-align:center;color:var(--muted)">No events yet.</div>'}
        </div>`;

      if(tab==='feedback'){
        const inboxRaw=load('flux_feedback_inbox',[]);
        const inbox=Array.isArray(inboxRaw)?inboxRaw.slice().reverse():[];
        const catAgg={};
        inbox.forEach(e=>{const c=(e&&e.category)||'general';catAgg[c]=(catAgg[c]||0)+1;});
        const catRows=Object.entries(catAgg).sort((a,b)=>b[1]-a[1]);
        const last7=inbox.filter(e=>e&&e.t&&(Date.now()-Number(e.t||0))<7*864e5).length;
        const last24=inbox.filter(e=>e&&e.t&&(Date.now()-Number(e.t||0))<864e5).length;
        return`
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px">
          <h3 class="flux-color-title" style="margin:0;font-size:1.05rem;font-weight:800">Feedback inbox</h3>
          <span style="font-size:.66rem;color:var(--muted);font-family:JetBrains Mono,monospace">${inbox.length} cached locally</span>
          <span style="flex:1"></span>
          <button type="button" onclick="ownerRefreshFeedbackInbox()" style="padding:8px 14px;font-size:.74rem;font-weight:700;border-radius:10px;background:linear-gradient(135deg,rgba(var(--accent-rgb),.18),rgba(124,92,255,.12));border:1px solid rgba(var(--accent-rgb),.35);color:var(--accent)">↻ Refresh from cloud</button>
          <button type="button" onclick="ownerExportFeedbackJson()" class="btn-sec" style="padding:7px 12px;font-size:.7rem;border-radius:10px">⬇ Export JSON</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px">
          <div style="background:var(--card2);border-radius:10px;padding:10px 12px;border:1px solid var(--border)"><div style="font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Last 24h</div><div style="font-size:1.2rem;font-weight:800;color:var(--accent);margin-top:2px">${last24}</div></div>
          <div style="background:var(--card2);border-radius:10px;padding:10px 12px;border:1px solid var(--border)"><div style="font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Last 7 days</div><div style="font-size:1.2rem;font-weight:800;color:var(--gold);margin-top:2px">${last7}</div></div>
          <div style="background:var(--card2);border-radius:10px;padding:10px 12px;border:1px solid var(--border)"><div style="font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">All-time</div><div style="font-size:1.2rem;font-weight:800;color:var(--purple);margin-top:2px">${inbox.length}</div></div>
          <div style="background:var(--card2);border-radius:10px;padding:10px 12px;border:1px solid var(--border)"><div style="font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-family:JetBrains Mono,monospace">Top topic</div><div style="font-size:1.05rem;font-weight:800;color:var(--text);margin-top:2px">${catRows[0]?esc(catRows[0][0]):'—'}</div></div>
        </div>
        ${catRows.length>1?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${catRows.map(([c,n])=>`<span style="font-size:.66rem;padding:4px 10px;border-radius:8px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.22);color:var(--accent);font-weight:700">${esc(c)} · ${n}</span>`).join('')}</div>`:''}
        <div style="font-size:.68rem;color:var(--muted);line-height:1.55;margin-bottom:10px">
          Stored in <b>Supabase</b> (your <code style="font-size:.6rem">user_data.feedbackInbox</code>) via <code style="font-size:.6rem">user-feedback</code> Edge Function.
        </div>
        <div style="max-height:min(480px,55vh);overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--card2)">
          ${inbox.length?inbox.map(entry=>{
            const e=entry&&typeof entry==='object'?entry:{};
            const when=e.t?new Date(e.t).toLocaleString():'—';
            return`<div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:.74rem">
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">
                <span style="font-family:JetBrains Mono,monospace;color:var(--muted);font-size:.68rem">${esc(when)}</span>
                <span style="font-size:.58rem;padding:2px 8px;border-radius:6px;background:rgba(var(--accent-rgb),.12);color:var(--accent);font-weight:700">${esc(e.category||'general')}</span>
                <span style="flex:1"></span>
                <button type="button" onclick="ownerDismissFeedback(${JSON.stringify(String(e.id||''))})" style="padding:4px 10px;font-size:.65rem;border-radius:8px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);color:var(--red)">Dismiss</button>
              </div>
              <div style="font-size:.68rem;color:var(--muted2);margin-bottom:6px;word-break:break-all"><b>From</b> ${esc(e.fromEmail||'unknown')} <span style="opacity:.7">· ${esc((e.fromUserId||'').slice(0,8))}…</span></div>
              <div style="color:var(--text);white-space:pre-wrap;word-break:break-word;line-height:1.5">${esc(e.message||'')}</div>
              ${e.path?`<div style="font-size:.62rem;color:var(--muted);margin-top:8px;font-family:JetBrains Mono,monospace">Path: ${esc(e.path)}</div>`:''}
            </div>`;
          }).join(''):'<div style="padding:24px;text-align:center;color:var(--muted);font-size:.82rem">No feedback yet. Ask users to use Settings → Data &amp; info → Send feedback (or ⌘K → Send feedback).</div>'}
        </div>`;
      }

      if(tab==='ideas'){
        const n=FLUX_PRODUCT_IDEAS.length;
        return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:14px">
          <b>${n} product ideas</b> you could ship into Flux — brainstorming backlog only (not commitments). Filter or copy the full list for roadmapping.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
          <input type="search" id="osIdeasFilter" placeholder="Filter ideas…" autocomplete="off" style="flex:1;min-width:200px;padding:8px 12px;font-size:.82rem;border-radius:10px;background:var(--card);border:1px solid var(--border2);color:var(--text)" oninput="window.__fluxProductIdeasFilter&&window.__fluxProductIdeasFilter(this.value)">
          <button type="button" onclick="ownerCopyProductIdeasList()" style="padding:8px 14px;font-size:.75rem;border-radius:10px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.32);color:var(--accent);font-weight:700">Copy all (${n})</button>
        </div>
        <ol id="osIdeasList" style="margin:0;padding-left:1.15rem;max-height:min(520px,58vh);overflow-y:auto;font-size:.76rem;line-height:1.55;color:var(--text)">
          ${FLUX_PRODUCT_IDEAS.map(t=>`<li style="margin-bottom:10px">${esc(t)}</li>`).join('')}
        </ol>`;
      }

      if(tab==='advanced')return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.6;margin-bottom:14px">
          <b>Impersonation</b> requires a dedicated Admin API workflow — never the anon key. Session revoke / ban flows for arbitrary users live under <button type="button" onclick="window.__osSetTab('auth')" style="background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);padding:3px 10px;border-radius:8px;font-size:.72rem;cursor:pointer;font-weight:700">Auth users</button>.
        </div>
        <button type="button" onclick="document.getElementById('ownerSuite')?.remove();openModPanel();" style="padding:10px 16px;font-size:.78rem;border-radius:12px;margin-bottom:10px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.3)">⚡ Open classic Dev Panel</button>
        <button type="button" onclick="forceSyncNow()" style="display:block;width:100%;padding:10px;margin-bottom:8px;font-size:.78rem;border-radius:10px">⟳ Force sync now</button>
        <button type="button" onclick="clearCache()" style="display:block;width:100%;padding:10px;font-size:.78rem;border-radius:10px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);color:var(--red)">⚠ Nuclear: clear local cache (typed confirm)</button>`;

      return'';
    }

    function paint(){
      const bodyEl=root.querySelector('#osBody');
      if(bodyEl)bodyEl.innerHTML=body();
      const sb=root.querySelector('#osSidebar');
      if(sb)sb.innerHTML=buildOsSidebarHtml(tab);
      root.querySelectorAll('[data-os-tab]').forEach(b=>{
        b.style.cssText=tabStyle(b.getAttribute('data-os-tab')===tab);
      });
      const pushBtn=root.querySelector('#osReleasePushBtn');
      if(pushBtn&&!pushBtn.disabled){
        pushBtn.addEventListener('click',()=>{
          if(typeof FluxRelease!=='undefined'&&FluxRelease&&typeof FluxRelease.openPushDialog==='function'){
            FluxRelease.openPushDialog();
          }
        });
      }
    }

    const cardMax=embedUi?'min(1180px,100%)':'min(1100px,100%)';
    const osBodyStyle=embedUi?'padding:22px 24px;max-height:none;overflow-y:visible':'padding:22px 24px;max-height:min(74vh,720px);overflow-y:auto';
    const closeBtn=embedUi
      ?`<button type="button" onclick="nav('dashboard')" class="os-head-btn" title="Back to planner">← Planner</button>`
      :`<button type="button" onclick="document.getElementById('ownerSuite')?.remove()" class="os-head-btn" title="Close" aria-label="Close">✕</button>`;

    /* Current release state — show "live build" badge in header and "Push update" button */
    let __buildLabel='unknown';
    let __isLive=false;
    try{
      const __bid=(typeof FLUX_BUILD_ID!=='undefined'&&FLUX_BUILD_ID)||(window.FLUX_BUILD_ID||'unknown');
      const __gate=(typeof FluxRelease!=='undefined'&&FluxRelease.getGate&&FluxRelease.getGate())||getPlatformConfig().releaseGate||null;
      __buildLabel=String(__bid).replace(/^build-/,'');
      __isLive=__gate&&__gate.released===__bid;
    }catch(_){}
    const pushBtnHeader=`
      <button type="button" id="osHeaderPushBtn" onclick="window.__osSetTab&&window.__osSetTab('release')" class="os-head-push" title="${__isLive?'This build is live — open Release panel':'Open Release panel to push this build'}">
        <span class="os-head-push__icon" aria-hidden="true">🚀</span>
        <span class="os-head-push__text">
          <span class="os-head-push__lbl">${__isLive?'Build live':'Push update'}</span>
          <span class="os-head-push__sub">${esc(__buildLabel)}</span>
        </span>
        ${__isLive?'<span class="os-head-push__dot os-head-push__dot--live" title="Live"></span>':'<span class="os-head-push__dot" title="Not pushed"></span>'}
      </button>`;

    root.innerHTML=`
      <div class="owner-suite-card owner-suite-card--v2" style="max-width:${cardMax};${embedUi?'margin:0 auto;':''}">
        <header class="os-head">
          <div class="os-head__title">
            <span class="os-head__crown" aria-hidden="true">👑</span>
            <div>
              <div class="os-head__name flux-color-title">Owner Command Center</div>
              <div class="os-head__meta">${esc(currentUser?.email||'')} · god-mode for your data plane</div>
            </div>
          </div>
          <div class="os-head__actions">
            ${pushBtnHeader}
            <button type="button" id="osHeaderQuickSyncBtn" onclick="(function(){try{forceSyncNow&&forceSyncNow();if(typeof showToast==='function')showToast('Sync requested','info');}catch(e){}})()" class="os-head-btn" title="Force sync">⟳</button>
            ${closeBtn}
          </div>
        </header>
        <div class="os-layout">
          <aside class="os-sidebar" id="osSidebar" aria-label="Owner sections">
            ${buildOsSidebarHtml(tab)}
          </aside>
          <main class="os-main" id="osBody" style="${osBodyStyle}"></main>
        </div>
      </div>`;

    window.__osSetTab=function(t){
      tab=t;
      window.__osActiveTab=t;
      paint();
    };
    if(mountEl){
      mountEl.innerHTML='';
      mountEl.appendChild(root);
    }else{
      document.body.appendChild(root);
    }
    paint();
    ownerAuditAppend('owner_suite_open',{embed:!!mountEl});
    const ann=getPlatformConfig().announcement;
    if(ann&&!embedUi)showToast(ann,'info');
  };

  window.reopenOwnerSuite=function(prefTab){
    if(!isOwner())return;
    const m=document.getElementById('fluxControlMount');
    const next=OS_TABS.has(prefTab)?prefTab:(window.__osActiveTab&&OS_TABS.has(window.__osActiveTab)?window.__osActiveTab:'overview');
    if(m)openOwnerSuite(next,{mount:m,skipNav:true});
    else openOwnerSuite(next,{overlay:true});
  };

  window.ownerSetDevRole=function(idx,role){
    if(!isOwner())return;
    const devAccounts=load('flux_dev_accounts',[]);
    const acc=devAccounts[idx];if(!acc)return;
    acc.role=role;
    acc.perms=[...(ROLE_PRESETS[role]||ROLE_PRESETS.viewer)];
    saveDevAccounts(devAccounts);
    ownerAuditAppend('dev_role_change',{email:acc.email,role});
    reopenOwnerSuite();
  };

  window.ownerQuickAddDev=function(){
    const inp=document.getElementById('osNewDevEmail');
    const email=(inp?.value||'').trim();
    if(!email||!email.includes('@')){alert('Valid email required.');return;}
    const devAccounts=load('flux_dev_accounts',[]);
    if(devAccounts.find(d=>d.email===email)){alert('Already a dev account.');return;}
    devAccounts.push({email,role:'viewer',perms:[...ROLE_PRESETS.viewer],addedAt:Date.now()});
    saveDevAccounts(devAccounts);
    ownerAuditAppend('dev_invite',{email});
    reopenOwnerSuite();
  };

  window.ownerExportDevsJson=function(){
    const blob=new Blob([JSON.stringify(load('flux_dev_accounts',[]),null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-dev-accounts.json';a.click();URL.revokeObjectURL(a.href);
    ownerAuditAppend('export_dev_json',{});
  };
  window.ownerExportDevsCsv=function(){
    const rows=['email,role,perms,addedAt'].concat(load('flux_dev_accounts',[]).map(d=>`${d.email},${d.role||''},"${(d.perms||[]).join(';')}",${d.addedAt||''}`));
    const blob=new Blob([rows.join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-dev-accounts.csv';a.click();URL.revokeObjectURL(a.href);
    ownerAuditAppend('export_dev_csv',{});
  };
  window.ownerImportDevsFile=function(ev){
    const f=ev.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const arr=JSON.parse(r.result);
        if(!Array.isArray(arr))throw new Error('JSON must be an array');
        const norm=arr.map(x=>(typeof x==='string'?{email:x}:x)).filter(x=>x&&x.email&&x.email.includes('@'));
        norm.forEach(u=>{
          if(!u.perms||!u.perms.length)u.perms=[...(ROLE_PRESETS[u.role]||ROLE_PRESETS.viewer)];
          if(!u.role)u.role='viewer';
          u.addedAt=u.addedAt||Date.now();
        });
        save('flux_dev_accounts',norm);
        saveDevAccounts(norm);
        ownerAuditAppend('import_dev_json',{count:norm.length});
        reopenOwnerSuite();
        showToast('Imported '+norm.length+' dev rows','success');
      }catch(e){alert('Import failed: '+e.message);}
    };
    r.readAsText(f);
    ev.target.value='';
  };

  window.ownerExportFullBackup=function(){
    const payload=getCloudPayload();
    payload._fluxBackupMeta={v:1,exportedAt:new Date().toISOString(),owner:currentUser?.email};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-owner-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href);
    ownerAuditAppend('full_backup_export',{});
  };

  window.ownerRestoreBackupFile=function(ev){
    const f=ev.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const d=JSON.parse(r.result);
        if(d.tasks){tasks=d.tasks;save('tasks',tasks);}
        if(d.notes){notes=d.notes;save('flux_notes',notes);}
        if(d.habits){habits=d.habits;save('flux_habits',habits);}
        if(d.goals){goals=d.goals;save('flux_goals',goals);}
        if(d.devAccounts&&isOwner())save('flux_dev_accounts',d.devAccounts);
        if(d.ownerAuditLog&&isOwner())save('flux_owner_audit',d.ownerAuditLog.slice(-300));
        if(d.platformConfig&&isOwner())save('flux_platform_config',d.platformConfig);
        if(d.profile)localStorage.setItem('profile',JSON.stringify(d.profile));
        if(currentUser)syncToCloud();
        ownerAuditAppend('backup_restore',{keys:Object.keys(d).slice(0,20).join(',')});
        showToast('Restore applied — verify data & sync','success');
        location.reload();
      }catch(e){alert('Restore failed: '+e.message);}
    };
    r.readAsText(f);
    ev.target.value='';
  };

  window.ownerArchiveDoneTasks=function(){
    if(!confirm('Remove all completed tasks from the active list? (Backup first.)'))return;
    const n=tasks.filter(t=>t.done).length;
    tasks=tasks.filter(t=>!t.done);
    save('tasks',tasks);
    if(currentUser)syncToCloud();
    ownerAuditAppend('archive_done_tasks',{removed:n});
    showToast('Archived '+n+' done tasks','info');
    reopenOwnerSuite();
  };

  window.ownerSaveIntegrationWebhooks=function(){
    const s=document.getElementById('osSlack')?.value?.trim()||'';
    const g=document.getElementById('osHook')?.value?.trim()||'';
    savePlatformConfig({integrations:{...getPlatformConfig().integrations,slackWebhook:s,genericWebhook:g}});
    ownerAuditAppend('integrations_update','webhooks');
  };

  window.ownerTestWebhookPing=function(){
    const url=getPlatformConfig().integrations?.slackWebhook||getPlatformConfig().integrations?.genericWebhook;
    if(!url){showToast('Add a webhook URL first','warning');return;}
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Flux Owner ping',ts:new Date().toISOString()})}).then(()=>showToast('Ping sent','success')).catch(()=>showToast('Ping failed (CORS or URL)','error'));
    ownerAuditAppend('webhook_test',{});
  };

  window.ownerExportTasksCsv=function(){
    const h='id,name,done,priority,date,type,subject';
    const rows=tasks.map(t=>[t.id,t.name,t.done,t.priority,t.date||'',t.type||'',t.subject||''].map(x=>`"${String(x).replace(/"/g,'""')}"`).join(','));
    const blob=new Blob([[h,...rows].join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-tasks.csv';a.click();URL.revokeObjectURL(a.href);
    ownerAuditAppend('export_tasks_csv',{n:tasks.length});
  };
  window.ownerExportSessionsCsv=function(){
    const h='date,mins,subject';
    const rows=sessionLog.map(s=>[s.date,s.mins,s.subject||''].join(','));
    const blob=new Blob([[h,...rows].join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-sessions.csv';a.click();URL.revokeObjectURL(a.href);
    ownerAuditAppend('export_sessions_csv',{n:sessionLog.length});
  };

  window.ownerClearAudit=function(){
    if(!confirm('Clear owner audit log?'))return;
    save('flux_owner_audit',[]);
    syncKey('owner_audit',1);
    reopenOwnerSuite();
  };

  window.ownerRefreshPlatformUsage=async function(){
    if(!isOwner())return;
    const sb=typeof getSB==='function'?getSB():null;
    const mount=document.getElementById('osUsageMount');
    if(mount)mount.innerHTML='<div style="color:var(--muted);font-size:.85rem">Loading <code style="font-size:.65rem">user_data</code>…</div>';
    if(!sb){
      window.__ownerUsageHtml='<div style="color:var(--red)">Supabase client not available.</div>';
      if(mount)mount.innerHTML=window.__ownerUsageHtml;
      return;
    }
    const {data,error}=await sb.from('user_data').select('id,updated_at,data').limit(2000);
    if(error){
      window.__ownerUsageHtml='<div style="color:var(--red);font-size:.82rem;margin-bottom:8px">'+esc(error.message)+'</div><div style="font-size:.72rem;color:var(--muted2);line-height:1.55">Typical cause: Row Level Security only allows <code style="font-size:.65rem">select</code> on your own row. In Supabase SQL Editor you can add a policy for the owner service account, or expose a secure Edge Function that returns aggregates with the service role.</div>';
      if(mount)mount.innerHTML=window.__ownerUsageHtml;
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('platform_usage_error',{msg:error.message});
      if(typeof showToast==='function')showToast('Platform usage query failed','error');
      return;
    }
    const rows=data||[];
    window.__ownerAggRows=rows;
    window.__ownerUsageHtml=buildAggHtml(rows);
    if(mount)mount.innerHTML=window.__ownerUsageHtml;
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('platform_usage_refresh',{rows:rows.length});
    if(typeof showToast==='function')showToast('Loaded '+rows.length+' account row(s)','success');
  };

  window.ownerExportPlatformAggJson=function(){
    if(!isOwner())return;
    const rows=window.__ownerAggRows;
    if(!rows||!rows.length){if(typeof showToast==='function')showToast('Refresh platform usage first','warning');return;}
    const accounts=rows.map(row=>{
      const tasks=extractTasksFromPayload(row.data);
      const s=statsFromTaskList(tasks);
      return{anon:anonLabel(row.id),done:s.done,open:s.open,completionsByDay:s.byDay,byType:s.byType,updated_at:row.updated_at||row.updatedAt};
    });
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),note:'No task titles or personal text — counts and dates only',accounts},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-platform-usage-aggregate.json';a.click();URL.revokeObjectURL(a.href);
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('export_platform_agg_json',{n:accounts.length});
  };

  window.ownerExportComplianceBundle=function(){
    if(!isOwner())return;
    const bundle={
      kind:'flux_owner_compliance_bundle',
      exportedAt:new Date().toISOString(),
      supabaseProjectRef:SB_PROJECT_REF,
      note:'Owner export: platform config + audit tail + dev roster size. End-user GDPR packages require per-user export from their account.',
      platformConfig:getPlatformConfig(),
      ownerAuditTail:load('flux_owner_audit',[]).slice(-120),
      devAccountCount:load('flux_dev_accounts',[]).length,
    };
    const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-owner-compliance-bundle.json';a.click();URL.revokeObjectURL(a.href);
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('compliance_bundle_export',{});
    if(typeof showToast==='function')showToast('Compliance bundle downloaded','success');
  };

  window.ownerSaveReleasePreviewAccess=async function(){
    if(!isOwner())return;
    if(typeof FluxRelease==='undefined'||!FluxRelease.savePreviewAccess){
      alert('Flux Release module not loaded.');
      return;
    }
    const mode=document.getElementById('osReleasePreviewMode')?.value||'all_devs';
    const emails=[];
    document.querySelectorAll('#ownerSuite [data-release-preview-email]').forEach((cb)=>{
      if(cb.checked)emails.push(String(cb.getAttribute('data-release-preview-email')||'').toLowerCase());
    });
    const res=await FluxRelease.savePreviewAccess(mode,emails);
    if(!res.ok&&typeof showToast==='function')showToast(res.err||'Save failed','error');
    reopenOwnerSuite('release');
  };

  window.ownerSyncPlatformConfigToDevs=async function(){
    if(!isOwner())return;
    if(typeof FluxRelease==='undefined'||!FluxRelease.syncPlatformToDevs){
      alert('Flux Release module not loaded.');
      return;
    }
    const scope=document.getElementById('osPlatformSyncScope')?.value||'all';
    let targetEmails=[];
    if(scope==='selected'){
      document.querySelectorAll('#ownerSuite [data-release-preview-email]').forEach((cb)=>{
        if(cb.checked)targetEmails.push(String(cb.getAttribute('data-release-preview-email')||'').toLowerCase());
      });
      if(!targetEmails.length){
        if(typeof showToast==='function')showToast('Check at least one dev in the list above','warning');
        return;
      }
    }
    if(!confirm('Merge your owner cloud row’s platformConfig into the selected dev user_data rows? Tasks and notes are not copied.'))return;
    const res=await FluxRelease.syncPlatformToDevs({targetMode:scope,targetEmails});
    if(!res.ok){
      if(typeof showToast==='function')showToast(res.err||'Sync failed','error');
    }else{
      const ok=(res.synced||[]).filter(x=>x.ok).length;
      const bad=(res.synced||[]).filter(x=>!x.ok).length;
      if(typeof showToast==='function')showToast('Synced '+ok+' dev row(s)'+(bad?'; '+bad+' failed':''),'success');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('platform_sync_devs',{scope,ok,bad});
    }
    reopenOwnerSuite('release');
  };

  window.ownerAddTesterEmail=function(){
    if(typeof isOwner!=='function'||!isOwner())return;
    const inp=document.getElementById('osTesterEmail');
    const em=(inp?.value||'').trim().toLowerCase();
    if(!em||!em.includes('@')){alert('Enter a valid email.');return;}
    const arr=Array.isArray(load('flux_tester_emails',[]))?load('flux_tester_emails',[]).slice():[];
    if(arr.some(x=>String(x||'').toLowerCase().trim()===em)){alert('Already on the list.');return;}
    arr.push(em);
    save('flux_tester_emails',arr);
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('tester_add',{email:em});
    if(inp)inp.value='';
    reopenOwnerSuite('testers');
    if(typeof checkTesterMode==='function')checkTesterMode();
    if(typeof renderTesterBadge==='function')renderTesterBadge();
  };

  window.ownerRemoveTesterEmail=function(idx){
    if(typeof isOwner!=='function'||!isOwner())return;
    const arr=Array.isArray(load('flux_tester_emails',[]))?load('flux_tester_emails',[]).slice():[];
    if(idx<0||idx>=arr.length)return;
    const removed=arr.splice(idx,1)[0];
    save('flux_tester_emails',arr);
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('tester_remove',{email:removed});
    reopenOwnerSuite('testers');
    if(typeof currentUser!=='undefined'&&currentUser&&String(currentUser.email||'').toLowerCase().trim()===String(removed||'').toLowerCase().trim()){
      if(typeof checkTesterMode==='function')checkTesterMode();
      if(typeof renderTesterBadge==='function')renderTesterBadge();
    }
  };

  window.__fluxAuthPage=1;
  window.__fluxAuthNextPage=null;

  window.ownerExportAuditCsv=function(){
    if(!isOwner())return;
    const log=load('flux_owner_audit',[]);
    const q=function(s){return'"'+String(s==null?'':s).replace(/"/g,'""')+'"'};
    const rows=['t,iso_utc,action,detail,by'].concat((log||[]).map(e=>{
      const iso=new Date(e.t||0).toISOString();
      return[q(e.t),q(iso),q(e.action),q(e.detail),q(e.by)].join(',');
    }));
    const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='flux-owner-audit.csv';a.click();URL.revokeObjectURL(a.href);
    if(typeof ownerAuditAppend==='function')ownerAuditAppend('export_audit_csv',{n:(log||[]).length});
  };

  window.ownerImportDevsCsvFile=function(ev){
    const f=ev.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const text=String(r.result||'');
        const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
        if(lines.length<2)throw new Error('Need a header plus at least one row');
        const header=parseCsvLine(lines[0]).map(x=>String(x||'').toLowerCase().replace(/^\ufeff/,''));
        const emailIdx=header.findIndex(h=>h==='email'||h.endsWith('email'));
        if(emailIdx<0)throw new Error('CSV must include an email column');
        const roleIdx=header.indexOf('role');
        const permsIdx=header.indexOf('perms');
        const uidIdx=header.indexOf('userid');
        const byEmail={};
        load('flux_dev_accounts',[]).forEach(d=>{
          if(d&&d.email)byEmail[String(d.email).toLowerCase().trim()]={...d};
        });
        for(let li=1;li<lines.length;li++){
          const cols=parseCsvLine(lines[li]);
          const emRaw=(cols[emailIdx]||'').trim().toLowerCase();
          if(!emRaw.includes('@'))continue;
          let rname='viewer';
          if(roleIdx>=0&&cols[roleIdx]){
            const x=String(cols[roleIdx]).trim().toLowerCase();
            if(['admin','editor','viewer'].includes(x))rname=x;
          }
          let perms=[];
          if(permsIdx>=0&&cols[permsIdx]){
            perms=String(cols[permsIdx]).split(/[;|]/).map(x=>x.trim()).filter(Boolean);
          }
          if(!perms.length)perms=[...(ROLE_PRESETS[rname]||ROLE_PRESETS.viewer)];
          const prev=byEmail[emRaw]||{};
          let userId=prev.userId;
          if(uidIdx>=0&&cols[uidIdx])userId=String(cols[uidIdx]).trim()||userId;
          byEmail[emRaw]={
            email:emRaw,
            role:rname,
            perms,
            addedAt:prev.addedAt||Date.now(),
            ...(userId?{userId}:{}),
          };
        }
        const norm=Object.values(byEmail);
        save('flux_dev_accounts',norm);
        if(typeof saveDevAccounts==='function')saveDevAccounts(norm);
        if(typeof ownerAuditAppend==='function')ownerAuditAppend('import_dev_csv',{count:norm.length});
        if(typeof reopenOwnerSuite==='function')reopenOwnerSuite('team');
        if(typeof showToast==='function')showToast('Merged '+norm.length+' dev row(s) from CSV','success');
      }catch(e){alert('CSV import failed: '+e.message);}
    };
    r.readAsText(f);
    ev.target.value='';
  };

  window.ownerAuthUsersLoad=async function(page){
    if(!isOwner())return;
    const p=Math.max(1,parseInt(page,10)||1);
    window.__fluxAuthPage=p;
    const mount=document.getElementById('osAuthMount');
    if(mount)mount.innerHTML='<div style="color:var(--muted);font-size:.82rem">Loading Auth users…</div>';
    try{
      if(typeof FluxRelease==='undefined'||!FluxRelease.invokeOwnerReleaseAdmin){
        throw new Error('FluxRelease.invokeOwnerReleaseAdmin unavailable');
      }
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_list_users',page:p,perPage:40});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'List failed');
      window.__fluxAuthNextPage=data.nextPage;
      const users=data.users||[];
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_list_users',{page:p,n:users.length});
      if(!mount)return;
      if(!users.length){
        mount.innerHTML='<div style="color:var(--muted);font-size:.82rem">No accounts on this page.</div>';
        return;
      }
      const rows=users.map(u=>{
        const bannedTag=u.banned?'<span style="font-size:.58rem;color:var(--red);font-weight:700">Banned</span>':'<span style="font-size:.58rem;color:var(--muted)">Active</span>';
        return'<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);font-size:.72rem;background:var(--card2)">'+
          '<span style="font-family:JetBrains Mono,monospace;font-size:.62rem;color:var(--muted2);flex:0 0 260px;word-break:break-all">'+esc(u.id)+'</span>'+
          '<span style="flex:1;min-width:140px;font-weight:600">'+(esc(u.email)||'—')+'</span>'+
          bannedTag+
          '<span style="font-size:.62rem;color:var(--muted)">'+(esc(u.created_at||''))+'</span>'+
          '<span style="flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">'+
            '<button type="button" style="padding:4px 8px;font-size:.65rem;border-radius:8px;cursor:pointer" onclick="ownerAuthBan(\''+esc(u.id)+'\','+(u.banned?'false':'true')+')">'+(u.banned?'Unban':'Ban')+'</button>'+
            '<button type="button" style="padding:4px 8px;font-size:.65rem;border-radius:8px;cursor:pointer" onclick="ownerAuthRevokeSessions(\''+esc(u.id)+'\')">Revoke sessions</button>'+
            '<button type="button" style="padding:4px 8px;font-size:.65rem;border-radius:8px;cursor:pointer" onclick="ownerAuthForceRotate(\''+esc(u.id)+'\')">Force pwd flag</button>'+
            '<button type="button" style="padding:4px 8px;font-size:.65rem;border-radius:8px;cursor:pointer" onclick="ownerAuthSetPasswordPrompt(\''+esc(u.id)+'\')">Set password…</button>'+
            '<button type="button" style="padding:4px 8px;font-size:.65rem;border-radius:8px;cursor:pointer;color:var(--red)" onclick="ownerAuthDeleteUser(\''+esc(u.id)+'\')">Delete…</button>'+
          '</span>'+
        '</div>';
      }).join('');
      mount.innerHTML='<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">'+rows+'</div>';
      if(typeof showToast==='function')showToast('Loaded '+users.length+' user(s) · p.'+p,'success');
    }catch(e){
      const msg=e&&e.message?e.message:String(e);
      if(mount)mount.innerHTML='<div style="color:var(--red);font-size:.82rem">'+esc(msg)+'</div><div style="font-size:.7rem;color:var(--muted2);margin-top:8px;line-height:1.5">Deploy <code style="font-size:.65rem">release-admin</code> with the newest Auth handlers and confirm <code style="font-size:.65rem">FLUX_OWNER_EMAIL</code> matches your Google account.</div>';
      if(typeof showToast==='function')showToast(msg,'error');
    }
  };

  window.ownerAuthUsersPrevPage=function(){
    const cur=window.__fluxAuthPage||1;
    if(cur<=1){if(typeof showToast==='function')showToast('First page','info');return;}
    ownerAuthUsersLoad(cur-1);
  };
  window.ownerAuthUsersNextPage=function(){
    const np=window.__fluxAuthNextPage;
    if(!np){if(typeof showToast==='function')showToast('No further pages','info');return;}
    ownerAuthUsersLoad(np);
  };

  window.ownerAuthCreateUser=async function(){
    if(!isOwner())return;
    const em=(document.getElementById('osAuthNewEmail')?.value||'').trim().toLowerCase();
    const pw=(document.getElementById('osAuthNewPw')?.value||'').trim();
    if(!em||!em.includes('@')){alert('Valid email required.');return;}
    try{
      const payload={action:'auth_create_user',email:em,returnTemporaryPassword:true};
      if(pw.length)payload.password=pw;
      const data=await FluxRelease.invokeOwnerReleaseAdmin(payload);
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Create failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_create_user',{email:em,temp:!!data.temporaryPasswordReturned});
      let dlg='Created '+em+'.';
      if(data.password)dlg+='\n\nTemporary password (copy now):\n'+data.password;
      alert(dlg);
      if(typeof showToast==='function')showToast('Auth user created','success');
      ownerAuthUsersLoad(window.__fluxAuthPage||1);
    }catch(e){alert(e.message||String(e));}
  };

  window.ownerAuthSendRecovery=async function(){
    if(!isOwner())return;
    const em=(document.getElementById('osAuthRecoveryEmail')?.value||'').trim().toLowerCase();
    if(!em.includes('@')){alert('Email required.');return;}
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_send_recovery_link',email:em});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Recovery failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_recovery_link',{email:em});
      const link=data.action_link||'(missing link — check Supabase Auth mail settings)';
      window.prompt('Copy recovery link:',link);
    }catch(e){alert(e.message||String(e));}
  };

  window.ownerAuthInvite=async function(){
    if(!isOwner())return;
    const em=(document.getElementById('osAuthInviteEmail')?.value||'').trim().toLowerCase();
    if(!em.includes('@')){alert('Email required.');return;}
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_invite_user',email:em});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Invite failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_invite',{email:em});
      if(typeof showToast==='function')showToast('Invite queued — requires SMTP/Send in Supabase','success');
    }catch(e){alert(e.message||String(e));}
  };

  window.ownerAuthBan=async function(userId,wantBan){
    if(!isOwner())return;
    const b=wantBan===true||wantBan==='true';
    if(!confirm(b?'Suspend / ban this account?':'Unban this account?'))return;
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_ban_user',userId,banned:b});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Ban update failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_ban',{userId,banned:b});
      ownerAuthUsersLoad(window.__fluxAuthPage||1);
    }catch(e){if(typeof showToast==='function')showToast(e.message||String(e),'error');}
  };

  window.ownerAuthRevokeSessions=async function(userId){
    if(!isOwner())return;
    if(!confirm('Revoke every refresh token for this user (global sign-out)?'))return;
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_revoke_sessions',userId});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Revoke failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_revoke_sessions',{userId});
      if(typeof showToast==='function')showToast('Sessions revoked','success');
    }catch(e){if(typeof showToast==='function')showToast(e.message||String(e),'error');}
  };

  window.ownerAuthForceRotate=async function(userId){
    if(!isOwner())return;
    if(!confirm('Stamp user_metadata flux_password_rotate_required_at for this login?'))return;
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_force_password_rotate',userId});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Update failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_force_pw_flag',{userId});
      if(typeof showToast==='function')showToast('Flag applied','success');
    }catch(e){if(typeof showToast==='function')showToast(e.message||String(e),'error');}
  };

  window.ownerAuthSetPasswordPrompt=async function(userId){
    if(!isOwner())return;
    const pw=window.prompt('New password (min 8 chars). Share out-of-band:','');
    if(!pw||pw.length<8)return;
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_set_password',userId,password:pw});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Password update failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_set_password',{userId});
      if(typeof showToast==='function')showToast('Password set','success');
    }catch(e){if(typeof showToast==='function')showToast(e.message||String(e),'error');}
  };

  window.ownerAuthDeleteUser=async function(userId){
    if(!isOwner())return;
    if(!confirm('Delete this Supabase Auth user? Planner rows are not deleted automatically.'))return;
    if(!confirm('Irreversible for the Auth identity. Continue?'))return;
    try{
      const data=await FluxRelease.invokeOwnerReleaseAdmin({action:'auth_delete_user',userId});
      if(!data||data.error||data.ok===false)throw new Error(data&&data.error||'Delete failed');
      if(typeof ownerAuditAppend==='function')ownerAuditAppend('auth_delete_user',{userId});
      ownerAuthUsersLoad(window.__fluxAuthPage||1);
    }catch(e){if(typeof showToast==='function')showToast(e.message||String(e),'error');}
  };

  /* ═══ Owner Command Center v2 — chrome / sidebar / header styling ═══ */
  (function injectOwnerSuiteCSS(){
    if(document.getElementById('owner-suite-v2-css'))return;
    const s=document.createElement('style');
    s.id='owner-suite-v2-css';
    s.textContent=`
      .owner-suite-card.owner-suite-card--v2{
        background:var(--card);
        border:1px solid color-mix(in srgb, var(--gold,#fbbf24) 28%, var(--border));
        border-radius:22px;
        width:100%;
        box-shadow:0 24px 80px rgba(0,0,0,.55), 0 2px 0 rgba(255,255,255,.04) inset;
        overflow:hidden;
        display:flex;
        flex-direction:column;
      }
      .os-head{
        display:flex;align-items:center;gap:12px;
        padding:14px 18px;
        border-bottom:1px solid var(--border);
        background:linear-gradient(135deg, rgba(var(--accent-rgb),.07), rgba(124,92,255,.05) 60%, transparent);
        flex-shrink:0;
      }
      .os-head__title{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
      .os-head__crown{font-size:1.6rem;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))}
      .os-head__name{font-size:1.05rem;font-weight:800;letter-spacing:-.01em;line-height:1.2}
      .os-head__meta{font-size:.66rem;color:var(--muted);font-family:JetBrains Mono,monospace;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46ch}
      .os-head__actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
      .os-head-btn{
        background:var(--card2);
        border:1px solid var(--border2);
        color:var(--muted2);
        font-size:.72rem;font-weight:650;font-family:inherit;
        cursor:pointer;
        padding:7px 12px;
        height:36px;
        border-radius:10px;
        transition:background .12s, border-color .12s, color .12s, transform .12s;
      }
      .os-head-btn:hover{background:var(--card);border-color:rgba(var(--accent-rgb),.3);color:var(--text)}
      .os-head-push{
        display:inline-flex;align-items:center;gap:10px;
        padding:7px 14px 7px 12px;
        height:38px;
        border-radius:12px;
        cursor:pointer;
        background:linear-gradient(135deg, #fbbf24 0%, #f59e0b 65%);
        color:#080a0f;
        border:1px solid rgba(251,191,36,.5);
        font-family:inherit;font-weight:800;
        box-shadow:0 6px 20px rgba(251,191,36,.28), inset 0 1px 0 rgba(255,255,255,.5);
        transition:transform .12s, box-shadow .12s, filter .12s;
      }
      .os-head-push:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(251,191,36,.36), inset 0 1px 0 rgba(255,255,255,.6);filter:brightness(1.05)}
      .os-head-push:active{transform:translateY(0)}
      .os-head-push__icon{font-size:1.08rem;line-height:1}
      .os-head-push__text{display:flex;flex-direction:column;align-items:flex-start;gap:1px;line-height:1.05;text-align:left}
      .os-head-push__lbl{font-size:.78rem;font-weight:800;letter-spacing:.01em}
      .os-head-push__sub{font-size:.6rem;font-weight:700;opacity:.66;font-family:JetBrains Mono,monospace;letter-spacing:.04em}
      .os-head-push__dot{width:8px;height:8px;border-radius:50%;background:rgba(0,0,0,.55);box-shadow:0 0 0 2px rgba(255,255,255,.3) inset}
      .os-head-push__dot--live{background:#10b981;box-shadow:0 0 0 2px rgba(255,255,255,.4) inset, 0 0 0 0 rgba(16,185,129,.6); animation:os-live-pulse 2s ease-out infinite}
      @keyframes os-live-pulse{0%{box-shadow:0 0 0 2px rgba(255,255,255,.4) inset, 0 0 0 0 rgba(16,185,129,.6)}80%{box-shadow:0 0 0 2px rgba(255,255,255,.4) inset, 0 0 0 8px rgba(16,185,129,0)}100%{box-shadow:0 0 0 2px rgba(255,255,255,.4) inset, 0 0 0 0 rgba(16,185,129,0)}}

      .os-layout{display:flex;min-height:0;flex:1 1 auto}
      .os-sidebar{
        flex:0 0 220px;
        max-width:220px;
        padding:14px 10px;
        border-right:1px solid var(--border);
        background:linear-gradient(180deg, var(--card2) 0%, color-mix(in srgb, var(--card2) 60%, var(--card)) 100%);
        overflow-y:auto;
        overscroll-behavior:contain;
      }
      .os-sidebar::-webkit-scrollbar{width:6px}
      .os-sidebar::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
      .os-main{flex:1 1 0%;min-width:0;background:var(--card)}
      .os-main::-webkit-scrollbar{width:8px}
      .os-main::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}

      /* Sidebar nav buttons hover state */
      .os-sidebar [data-os-tab]:hover{
        background:color-mix(in srgb, var(--accent) 6%, var(--card2)) !important;
        color:var(--text) !important;
      }

      /* Compact owner suite on tighter screens (overlay also lands here) */
      @media (max-width: 880px){
        .os-layout{flex-direction:column}
        .os-sidebar{
          flex:0 0 auto;max-width:none;width:100%;
          border-right:none;border-bottom:1px solid var(--border);
          padding:10px 10px 4px;
          display:flex;flex-wrap:wrap;gap:6px;
          background:var(--card2);
        }
        .os-sidebar > div{margin:0 !important;display:contents}
        .os-sidebar > div > div{display:none !important} /* hide section labels */
        .os-sidebar [data-os-tab]{width:auto !important;padding:7px 11px !important;font-size:.72rem !important}
        .os-head{flex-wrap:wrap;gap:10px}
        .os-head__meta{font-size:.6rem}
        .os-head-push__sub{display:none}
      }
      @media (max-width: 520px){
        .os-head{padding:11px 14px}
        .os-head__crown{font-size:1.35rem}
        .os-head__name{font-size:.95rem}
        .os-head-push{padding:6px 11px;height:34px}
        .os-head-push__icon{font-size:.95rem}
        .os-head-push__lbl{font-size:.7rem}
        .os-head-btn{padding:6px 10px;height:34px;font-size:.66rem}
        .os-main{padding:16px !important}
      }
    `;
    document.head.appendChild(s);
  })();
})();
