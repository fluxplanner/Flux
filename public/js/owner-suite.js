/**
 * Flux Owner Command Center — full control UI for the owner account.
 * Covers the full “mega prompt” owner spec: mapped in Mega map tab (In Flux vs Partial vs Server/Supabase).
 */
(function(){
  const SB_PROJECT_REF='lfigdijuqmbensebnevo';
  const PLATFORM_DEFAULTS={
    announcement:'',
    dataRetentionDays:365,
    sessionIdleWarnMins:60,
    integrations:{slackWebhook:'',genericWebhook:''},
    complianceContact:'',
  };
  const ROLE_PRESETS={
    admin:['clear_data','feature_flags','dev_mode','manage_devs','view_users'],
    editor:['clear_data','feature_flags','dev_mode','view_users'],
    viewer:['view_users'],
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
        ${mapRow('server','Create, remove, suspend <b>Auth</b> users (all accounts).',ext('auth','Open Auth'))}
        ${mapRow('in','Assign roles / permissions for the <b>dev team list</b> (admin · editor · viewer) and import/export that list.',jump('team','Team & roles'))}
        ${mapRow('server','Reset passwords, force password changes.',ext('auth','Auth users'))}
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
        ${mapRow('in','Feature flags &amp; dev mode: Dev Panel (owner badge → classic panel).',jump('advanced','Dev Panel'))}
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
        ${mapRow('server','Revoke sessions / ban users: Supabase Auth or Admin API.',ext('auth','Auth users'))}
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
    return`padding:8px 12px;font-size:.72rem;font-weight:600;border-radius:10px;border:1px solid ${active?'rgba(var(--accent-rgb),.4)':'var(--border2)'};background:${active?'rgba(var(--accent-rgb),.12)':'transparent'};color:${active?'var(--accent)':'var(--muted2)'};cursor:pointer;font-family:inherit`;
  }

  const OS_TABS=new Set(['overview','megamap','team','testers','release','data','config','integrations','analytics','usage','audit','advanced']);

  window.openOwnerSuite=function(prefTab){
    if(!isOwner())return;
    document.getElementById('modPanel')?.remove();
    document.getElementById('ownerSuite')?.remove();
    const root=document.createElement('div');
    root.id='ownerSuite';
    root.style.cssText='position:fixed;inset:0;background:rgba(5,8,16,.92);z-index:9900;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;backdrop-filter:blur(12px);overflow-y:auto';

    let tab=OS_TABS.has(prefTab)?prefTab:'overview';
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
            Flux stores each user’s data in their own <b>user_data</b> row. This browser only has your <b>anon</b> Supabase key — it cannot list every Auth user, reset passwords, suspend accounts, or impersonate without a <b>server-side Admin API</b> (Edge Function + service role). Do those in <b>Supabase Dashboard → Authentication</b> or add a secured admin function.
          </div>
        </div>
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:8px">AI-style insights (heuristic)</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${insights.map(i=>`<div style="display:flex;gap:10px;background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px 12px"><span>${i.icon}</span><div><div style="font-size:.78rem;font-weight:700">${esc(i.t)}</div><div style="font-size:.72rem;color:var(--muted2)">${esc(i.d)}</div></div></div>`).join('')}
        </div>`;

      if(tab==='team')return`
        <div style="font-size:.72rem;color:var(--muted2);margin-bottom:12px;line-height:1.5">
          <b>Roles</b> map to permission bundles. <b>Admin</b> = all tools. <b>Editor</b> = flags + dev mode + clear (no manage devs). <b>Viewer</b> = read-only panel hooks.
        </div>
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
        </div>`;

      if(tab==='release'){
        const buildId=(typeof FLUX_BUILD_ID!=='undefined'&&FLUX_BUILD_ID)||(window.FLUX_BUILD_ID||'unknown');
        const gate=(typeof FluxRelease!=='undefined'&&FluxRelease.getGate())||pc.releaseGate||null;
        const released=gate&&gate.released?String(gate.released).replace(/^build-/,''):'— (no release pushed yet)';
        const buildLabel=String(buildId).replace(/^build-/,'');
        const isLive=gate&&gate.released===buildId;
        const diff=!isLive;
        return`
          <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:14px">
            Staged rollout: every deploy lands on <b>owner + dev</b> accounts first. Click <b>Push to all users</b> to release the current build to everyone. Normal users see an <i>"Update under review"</i> screen until you push.
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
          <button type="button" id="osReleasePushBtn" ${isLive?'disabled':''} style="width:100%;padding:12px;font-size:.9rem;font-weight:800;border-radius:12px;background:${isLive?'var(--card2)':'linear-gradient(135deg,#fbbf24,#f59e0b)'};border:1px solid ${isLive?'var(--border)':'rgba(251,191,36,.4)'};color:${isLive?'var(--muted)':'#080a0f'};cursor:${isLive?'default':'pointer'};opacity:${isLive?.6:1}">${isLive?'✓ This build is already released':'🚀 Push '+esc(buildLabel)+' to all users'}</button>
          <div style="margin-top:10px;font-size:.66rem;color:var(--muted);line-height:1.5">
            ${diff?'Users currently see the "Update under review" screen. Push when you\'re ready to roll out.':'All users on the current build. New deploys will re-enter preview until pushed.'}
          </div>
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);font-size:.66rem;color:var(--muted);line-height:1.5">
            <b>How deploys work:</b> Bump <code style="font-size:.7rem">FLUX_BUILD_ID</code> in <code style="font-size:.7rem">public/js/flux-release-gate.js</code> before committing. After you deploy, the new build is automatically gated for non-devs until you push it here.
          </div>`;
      }

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
        <label style="font-size:.72rem;color:var(--muted)">Global announcement (show in toast on load — optional)</label>
        <input type="text" id="osAnnounce" value="${esc(pc.announcement)}" placeholder="e.g. Maintenance Sunday 2am UTC" style="width:100%;margin:6px 0 14px;padding:10px;border-radius:10px" onblur="savePlatformConfig({announcement:this.value.trim()})">
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

      if(tab==='analytics')return`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:1.3rem;font-weight:800;color:var(--accent)">${(tasks||[]).length}</div><div style="font-size:.65rem;color:var(--muted)">Tasks total</div></div>
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:1.3rem;font-weight:800;color:var(--green)">${(tasks||[]).filter(t=>t.done).length}</div><div style="font-size:.65rem;color:var(--muted)">Completed</div></div>
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:1.3rem;font-weight:800;color:var(--gold)">${(notes||[]).length}</div><div style="font-size:.65rem;color:var(--muted)">Notes</div></div>
          <div style="background:var(--card2);border-radius:12px;padding:12px;border:1px solid var(--border)"><div style="font-size:1.3rem;font-weight:800;color:var(--purple)">${(sessionLog||[]).length}</div><div style="font-size:.65rem;color:var(--muted)">Focus logs</div></div>
        </div>
        <button type="button" onclick="ownerExportTasksCsv()" style="padding:10px 16px;font-size:.78rem;border-radius:10px;margin-right:8px">Export tasks CSV</button>
        <button type="button" onclick="ownerExportSessionsCsv()" style="padding:10px 16px;font-size:.78rem;border-radius:10px">Export sessions CSV</button>`;

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
        <button type="button" onclick="ownerClearAudit()" style="margin-bottom:12px;padding:6px 12px;font-size:.72rem;border-radius:8px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);color:var(--red)">Clear audit log</button>
        <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--card2)">
          ${audit.length?audit.map(e=>`<div style="padding:10px 12px;border-bottom:1px solid var(--border);font-size:.72rem">
            <div style="font-family:JetBrains Mono,monospace;color:var(--muted)">${new Date(e.t).toLocaleString()}</div>
            <div style="font-weight:700;color:var(--accent)">${esc(e.action)}</div>
            <div style="color:var(--muted2);word-break:break-word">${esc(e.detail)}</div>
            <div style="font-size:.65rem;opacity:.6">${esc(e.by)}</div>
          </div>`).join(''):'<div style="padding:20px;text-align:center;color:var(--muted)">No events yet.</div>'}
        </div>`;

      if(tab==='advanced')return`
        <div style="font-size:.72rem;color:var(--muted2);line-height:1.6;margin-bottom:14px">
          <b>Impersonation</b>, <b>revoke other users’ sessions</b>, and <b>live user activity across tenants</b> need secure server endpoints. Use Supabase Auth admin or build <code style="font-size:.65rem">admin-revoke-session</code> Edge Functions.
        </div>
        <button type="button" onclick="document.getElementById('ownerSuite')?.remove();openModPanel();" style="padding:10px 16px;font-size:.78rem;border-radius:12px;margin-bottom:10px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.3)">⚡ Open classic Dev Panel</button>
        <button type="button" onclick="forceSyncNow()" style="display:block;width:100%;padding:10px;margin-bottom:8px;font-size:.78rem;border-radius:10px">⟳ Force sync now</button>
        <button type="button" onclick="clearCache()" style="display:block;width:100%;padding:10px;font-size:.78rem;border-radius:10px;background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.25);color:var(--red)">⚠ Nuclear: clear local cache (typed confirm)</button>`;

      return'';
    }

    function paint(){
      const bodyEl=root.querySelector('#osBody');
      if(bodyEl)bodyEl.innerHTML=body();
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

    root.innerHTML=`
      <div style="background:var(--card);border:1px solid rgba(251,191,36,.35);border-radius:22px;width:100%;max-width:760px;box-shadow:0 24px 80px rgba(0,0,0,.55);overflow:hidden">
        <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(251,191,36,.08),transparent)">
          <span style="font-size:1.6rem">👑</span>
          <div style="flex:1">
            <div style="font-size:1.05rem;font-weight:800">Owner Command Center</div>
            <div style="font-size:.68rem;color:var(--muted);font-family:JetBrains Mono,monospace">${esc(currentUser?.email)} · god-mode for your data plane</div>
          </div>
          <button type="button" onclick="document.getElementById('ownerSuite')?.remove()" style="background:none;border:none;color:var(--muted);font-size:1.3rem;cursor:pointer">✕</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--card2)">
          <button type="button" data-os-tab="overview" onclick="window.__osSetTab('overview')">Overview</button>
          <button type="button" data-os-tab="megamap" onclick="window.__osSetTab('megamap')">Mega map</button>
          <button type="button" data-os-tab="team" onclick="window.__osSetTab('team')">Team & roles</button>
          <button type="button" data-os-tab="testers" onclick="window.__osSetTab('testers')">Testers</button>
          <button type="button" data-os-tab="release" onclick="window.__osSetTab('release')">Release</button>
          <button type="button" data-os-tab="data" onclick="window.__osSetTab('data')">Data & backup</button>
          <button type="button" data-os-tab="config" onclick="window.__osSetTab('config')">Platform config</button>
          <button type="button" data-os-tab="integrations" onclick="window.__osSetTab('integrations')">Integrations</button>
          <button type="button" data-os-tab="analytics" onclick="window.__osSetTab('analytics')">Analytics</button>
          <button type="button" data-os-tab="usage" onclick="window.__osSetTab('usage')">Platform usage</button>
          <button type="button" data-os-tab="audit" onclick="window.__osSetTab('audit')">Audit log</button>
          <button type="button" data-os-tab="advanced" onclick="window.__osSetTab('advanced')">Advanced</button>
        </div>
        <div id="osBody" style="padding:20px;max-height:min(70vh,620px);overflow-y:auto"></div>
      </div>`;

    window.__osSetTab=function(t){tab=t;paint();};
    document.body.appendChild(root);
    paint();
    ownerAuditAppend('owner_suite_open',{});
    const ann=getPlatformConfig().announcement;
    if(ann)showToast(ann,'info');
  };

  window.ownerSetDevRole=function(idx,role){
    if(!isOwner())return;
    const devAccounts=load('flux_dev_accounts',[]);
    const acc=devAccounts[idx];if(!acc)return;
    acc.role=role;
    acc.perms=[...(ROLE_PRESETS[role]||ROLE_PRESETS.viewer)];
    saveDevAccounts(devAccounts);
    ownerAuditAppend('dev_role_change',{email:acc.email,role});
    openOwnerSuite();
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
    openOwnerSuite();
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
        openOwnerSuite();
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
        if(d.grades){grades=d.grades;save('flux_grades',grades);}
        if(d.gpaPrior&&typeof d.gpaPrior==='object'){gpaPrior={prevGpa:d.gpaPrior.prevGpa??'',prevCredits:d.gpaPrior.prevCredits??''};save('flux_gpa_prior',gpaPrior);}
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
    openOwnerSuite();
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
    openOwnerSuite();
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
    openOwnerSuite('testers');
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
    openOwnerSuite('testers');
    if(typeof currentUser!=='undefined'&&currentUser&&String(currentUser.email||'').toLowerCase().trim()===String(removed||'').toLowerCase().trim()){
      if(typeof checkTesterMode==='function')checkTesterMode();
      if(typeof renderTesterBadge==='function')renderTesterBadge();
    }
  };
})();
