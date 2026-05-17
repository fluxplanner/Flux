/**
 * Flux — staged release gate.
 *
 * Every deploy bumps FLUX_BUILD_ID below. The new build reaches owner +
 * dev accounts immediately; normal users see a non-blocking "Update
 * under review" screen until the owner (or a dev) clicks
 * "Push update to all users" from the preview banner or panels.
 *
 * Release state lives at flux_platform_config.releaseGate on the owner's
 * user_data row. Reads prefer the release-admin Edge Function and fall back
 * to the older direct Supabase read. Pushes go through release-admin so
 * authorized dev accounts can publish without waiting for the owner browser.
 *
 * Client-side cache: **`relLoad`/`relSave`** delegate to **`load`/`save`** from `app.js`
 * when present. **`flux_last_user_email`** uses **`fluxLoadStoredString`** when present
 * (handles JSON from **`save`**) and falls back to raw **`getItem`** + parse.
 */
(function(){
  const FLUX_BUILD_ID='build-2026-04-24-01'; // ⬅ BUMP THIS EACH DEPLOY
  window.FLUX_BUILD_ID=FLUX_BUILD_ID;

  /** Delegate to app.js `load`/`save` / `fluxNamespacedKey`; safe if script order changes. */
  function relLoad(k, def){
    if(typeof load === 'function'){
      try{ return load(k, def); }catch(_){ return def; }
    }
    try{
      const nk = typeof fluxNamespacedKey === 'function' ? fluxNamespacedKey(k) : k;
      const v = localStorage.getItem(nk);
      if(v == null || v === '') return def;
      try{ return JSON.parse(v); }catch(_){ return v; }
    }catch(_){ return def; }
  }
  function relSave(k, v){
    if(typeof save === 'function'){
      try{ save(k, v); }catch(_){}
    }else{
      try{
        const nk = typeof fluxNamespacedKey === 'function' ? fluxNamespacedKey(k) : k;
        localStorage.setItem(nk, JSON.stringify(v));
      }catch(_){}
    }
  }
  function relRemoveKey(k){
    try{
      const nk = typeof fluxNamespacedKey === 'function' ? fluxNamespacedKey(k) : k;
      localStorage.removeItem(nk);
    }catch(_){}
  }

  /**
   * When true: the "Update under review" overlay is used only while
   * releaseGate.stagingEnabled is true (owner turns it on in Owner → Release).
   * When staging is off, everyone gets the current deploy — no automatic gate.
   * While staging is on, the public is live only after releaseGate.released
   * matches FLUX_BUILD_ID ("Push to all users").
   * Owner always bypasses the overlay; dev access follows previewMode / previewEmails.
   * Set false to ignore staging entirely (every deploy is live for everyone).
   */
  const REQUIRE_EXPLICIT_RELEASE=true;

  const KEY_GATE='flux_release_gate';
  const KEY_FIRST='flux_release_build_first_seen';
  const POLL_MS=60*1000;
  const OWNER_EMAIL_FALLBACK='azfermohammed21@gmail.com';
  const ADMIN_FUNCTION='release-admin';

  function ownerEmail(){
    try{return typeof OWNER_EMAIL!=='undefined'?OWNER_EMAIL:OWNER_EMAIL_FALLBACK;}
    catch(_){return OWNER_EMAIL_FALLBACK;}
  }
  function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function buildLabel(id){return String(id||'').replace(/^build-/,'');}

  function normEmail(v){return String(v||'').trim().toLowerCase();}
  function cachedEmail(){
    try{
      if(typeof fluxLoadStoredString === 'function'){
        return normEmail(fluxLoadStoredString('flux_last_user_email',''));
      }
      const nk = typeof fluxNamespacedKey === 'function' ? fluxNamespacedKey('flux_last_user_email') : 'flux_last_user_email';
      const raw = localStorage.getItem(nk);
      if(raw == null || raw === '') return '';
      try{ return normEmail(String(JSON.parse(raw))); }catch(_){ return normEmail(raw); }
    }catch(_){return'';}
  }
  function currentEmail(){
    try{
      if(typeof currentUser!=='undefined'&&currentUser&&currentUser.email)return normEmail(currentUser.email);
    }catch(_){}
    return cachedEmail();
  }
  function isOwnerLocal(){
    try{if(typeof isOwner==='function'&&isOwner())return true;}catch(_){}
    return currentEmail()===ownerEmail();
  }
  function devRecordLocal(email){
    email=normEmail(email||currentEmail());
    if(!email)return null;
    if(email===ownerEmail())return true;
    try{
      const devs=relLoad('flux_dev_accounts',[]);
      if(!Array.isArray(devs))return null;
      return devs.find(d=>d&&normEmail(d.email)===email)||null;
    }catch(_){return null;}
  }
  function isDevLocal(){
    try{
      if(typeof getMyRole==='function'){
        const r=getMyRole();
        if(r==='dev'||r==='owner')return true;
      }
    }catch(_){}
    // Fallback to cached identity so owner/dev don't flash the blocking overlay
    // on reload before Supabase restores the session.
    return !!devRecordLocal();
  }
  function canPushReleaseLocal(){
    if(isOwnerLocal())return true;
    const dev=devRecordLocal();
    if(!dev||dev===true)return false;
    const role=String(dev.role||'viewer').toLowerCase();
    const perms=Array.isArray(dev.perms)?dev.perms:[];
    return perms.includes('release_push')||role==='admin'||role==='editor'||role==='owner'||role==='dev';
  }
  function hasPreviewAccess(gate){
    if(isOwnerLocal())return true;
    try{
      if(typeof currentUser==='undefined'||!currentUser||!currentUser.email)return false;
    }catch(_){return false;}
    const email=currentEmail();
    if(!email||!email.includes('@'))return false;

    let teamDev=false;
    try{
      if(typeof getMyRole==='function'){
        const r=getMyRole();
        teamDev=r==='dev'||r==='owner';
      }
    }catch(_){}
    const fromList=devRecordLocal(email);
    const inDevRoster=teamDev||!!(fromList&&fromList!==true);
    if(!inDevRoster)return false;

    const mode=(gate&&gate.previewMode)||'all_devs';
    if(mode==='owner')return false;
    if(mode==='selected'){
      const allowed=Array.isArray(gate&&gate.previewEmails)?gate.previewEmails.map(normEmail):[];
      return allowed.includes(normEmail(email));
    }
    return true;
  }

  function getGate(){
    try{
      const g=relLoad(KEY_GATE,null);
      if(g&&typeof g==='object')return g;
    }catch(_){}
    try{
      const pc=relLoad('flux_platform_config',null);
      if(pc&&typeof pc==='object'&&pc.releaseGate)return pc.releaseGate;
    }catch(_){}
    return null;
  }
  function saveGate(g){
    try{
      relSave(KEY_GATE,g);
      const pc=relLoad('flux_platform_config',{})||{};
      pc.releaseGate=g;
      relSave('flux_platform_config',pc);
    }catch(_){}
  }
  function clearGate(){
    try{
      relRemoveKey(KEY_GATE);
      const pc=relLoad('flux_platform_config',{})||{};
      if(pc&&pc.releaseGate){
        delete pc.releaseGate;
        relSave('flux_platform_config',pc);
      }
    }catch(_){}
  }
  /** Owner opt-in: only when true do non-preview users see "Update under review". */
  function isStagingActive(gate){
    return !!(gate&&gate.stagingEnabled===true);
  }

  function isReleased(gate){
    if(!REQUIRE_EXPLICIT_RELEASE){
      if(!gate||!gate.released)return true;
      return gate.released===FLUX_BUILD_ID;
    }
    if(!isStagingActive(gate))return true;
    if(!gate||!gate.released)return false;
    return gate.released===FLUX_BUILD_ID;
  }

  function releaseAdminUrl(){
    try{
      if(typeof SB_URL!=='undefined'&&SB_URL)return `${SB_URL}/functions/v1/${ADMIN_FUNCTION}`;
    }catch(_){}
    return `https://lfigdijuqmbensebnevo.supabase.co/functions/v1/${ADMIN_FUNCTION}`;
  }
  async function callReleaseAdmin(action,payload){
    const method=action?'POST':'GET';
    const opts={method,headers:typeof fluxAuthHeaders==='function'?await fluxAuthHeaders():{'Content-Type':'application/json'}};
    if(action)opts.body=JSON.stringify({action,...(payload||{})});
    const res=await fetch(releaseAdminUrl(),opts);
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||('Release admin HTTP '+res.status));
    return data;
  }

  /** Fetch the owner's published gate from Supabase (used by all clients). */
  async function fetchOwnerGate(){
    try{
      const data=await callReleaseAdmin();
      if(data&&Object.prototype.hasOwnProperty.call(data,'gate')){
        if(data.gate)saveGate(data.gate);
        else clearGate();
        return data.gate||null;
      }
    }catch(e){
      console.warn('[FluxRelease] release-admin fetch failed; falling back',e);
    }
    let sb=null;
    try{sb=typeof getSB==='function'?getSB():null;}catch(_){}
    if(!sb)return null;
    try{
      if(!window.__fluxOwnerRowId){
        const rows=await sb.from('user_data').select('id,data').limit(100);
        const hit=(rows&&rows.data||[]).find(r=>r&&r.data&&r.data.ownerEmail===ownerEmail());
        if(hit){
          window.__fluxOwnerRowId=hit.id;
          const g=hit.data.platformConfig&&hit.data.platformConfig.releaseGate;
          if(g){saveGate(g);return g;}
        }
      }
      if(window.__fluxOwnerRowId){
        const res=await sb.from('user_data').select('data').eq('id',window.__fluxOwnerRowId).single();
        const g=res&&res.data&&res.data.data&&res.data.data.platformConfig&&res.data.data.platformConfig.releaseGate;
        if(g){saveGate(g);return g;}
      }
    }catch(_){}
    return null;
  }

  /** Owner/dev action: flip the gate so the current build becomes live for every user. */
  async function pushUpdate(notes){
    if(!canPushReleaseLocal())return{ok:false,err:'Not authorized to publish releases'};
    const now=Date.now();
    const by=currentEmail()||'unknown';
    let gate={
      ...(getGate()||{}),
      released:FLUX_BUILD_ID,
      stagingEnabled:false,
      pushedAt:now,
      pushedAtIso:new Date(now).toISOString(),
      pushedBy:by,
      notes:String(notes||'').slice(0,800),
    };
    let propagated=false;
    try{
      const data=await callReleaseAdmin('push_release',{buildId:FLUX_BUILD_ID,notes:gate.notes});
      if(data&&data.gate)gate=data.gate;
      propagated=true;
    }catch(e){
      if(!isOwnerLocal()){
        return{ok:false,err:e.message||'Release publish failed'};
      }
      console.warn('[FluxRelease] release-admin push failed; owner local sync fallback',e);
    }
    saveGate(gate);
    try{
      if(typeof savePlatformConfig==='function'){
        savePlatformConfig({releaseGate:gate});
      }else{
        const pc=relLoad('flux_platform_config',{})||{};
        pc.releaseGate=gate;
        relSave('flux_platform_config',pc);
      }
    }catch(_){}
    try{
      if(!propagated&&isOwnerLocal()&&typeof syncToCloud==='function')await syncToCloud();
      else if(typeof syncKey==='function')syncKey('platform',1);
    }catch(_){}
    try{
      if(typeof ownerAuditAppend==='function'){
        ownerAuditAppend('release_push',{build:FLUX_BUILD_ID,notes:gate.notes,by});
      }
    }catch(_){}
    applyGate();
    if(typeof showToast==='function'){
      showToast('✓ Released build '+buildLabel(FLUX_BUILD_ID)+' to all users','success');
    }
    return{ok:true,gate,propagated};
  }

  async function saveStagingEnabled(enabled){
    if(!isOwnerLocal())return{ok:false,err:'Only the owner can turn update mode on or off'};
    const on=!!enabled;
    let gate={
      ...(getGate()||{}),
      stagingEnabled:on,
      stagingUpdatedAt:Date.now(),
      stagingUpdatedBy:currentEmail()||'owner',
    };
    try{
      const data=await callReleaseAdmin('set_staging_enabled',{stagingEnabled:on});
      if(data&&data.gate)gate=data.gate;
    }catch(e){
      console.warn('[FluxRelease] set_staging_enabled failed; owner local fallback',e);
    }
    saveGate(gate);
    try{
      if(typeof savePlatformConfig==='function')savePlatformConfig({releaseGate:gate});
      if(typeof syncToCloud==='function')await syncToCloud();
    }catch(_){}
    applyGate();
    if(typeof showToast==='function'){
      showToast(on?'Update mode ON — normal users see "Update under review" until you push this build.':'Update mode OFF — everyone uses the current deploy.','success');
    }
    return{ok:true,gate};
  }

  async function savePreviewAccess(mode,emails){
    if(!isOwnerLocal())return{ok:false,err:'Only the owner can change preview access'};
    const previewMode=['owner','selected','all_devs'].includes(mode)?mode:'all_devs';
    const previewEmails=Array.isArray(emails)?emails.map(normEmail).filter(x=>x.includes('@')):[];
    let gate={...(getGate()||{}),previewMode,previewEmails,previewUpdatedAt:Date.now(),previewUpdatedBy:currentEmail()||'owner'};
    try{
      const data=await callReleaseAdmin('save_preview_access',{previewMode,previewEmails});
      if(data&&data.gate)gate=data.gate;
    }catch(e){
      if(!isOwnerLocal())return{ok:false,err:e.message||'Preview update failed'};
      console.warn('[FluxRelease] release-admin preview update failed; owner local sync fallback',e);
    }
    saveGate(gate);
    try{
      if(typeof savePlatformConfig==='function')savePlatformConfig({releaseGate:gate});
      if(typeof syncToCloud==='function')await syncToCloud();
    }catch(_){}
    applyGate();
    if(typeof showToast==='function')showToast('Preview access saved','success');
    return{ok:true,gate};
  }

  /** Owner only: merge owner row platformConfig into devs' user_data (via release-admin). */
  async function syncPlatformToDevs(opts){
    if(!isOwnerLocal())return{ok:false,err:'Only the owner account can push platform config to dev rows'};
    try{
      const data=await callReleaseAdmin('sync_platform_to_devs',{
        targetMode:(opts&&opts.targetMode)==='selected'?'selected':'all',
        targetEmails:Array.isArray(opts&&opts.targetEmails)?opts.targetEmails:[],
      });
      if(data&&data.ok)return{ok:true,synced:data.synced||[],okCount:data.okCount};
      return{ok:false,err:(data&&data.error)||'sync_platform_to_devs failed'};
    }catch(e){
      return{ok:false,err:e.message||String(e)};
    }
  }

  function ensureHost(){
    let host=document.getElementById('fluxReleaseGateRoot');
    if(!host){
      host=document.createElement('div');
      host.id='fluxReleaseGateRoot';
      document.body.appendChild(host);
    }
    return host;
  }

  function removeOverlay(){
    const o=document.getElementById('fluxReleaseOverlay');
    if(o)o.remove();
    const app=document.getElementById('app');
    if(app)app.removeAttribute('aria-hidden');
  }
  function removeBanner(){
    const b=document.getElementById('fluxReleasePreviewBanner');
    if(b)b.remove();
    document.body.classList.remove('flux-has-release-banner');
    document.documentElement.style.removeProperty('--flux-release-banner-h');
  }

  function renderOverlay(gate){
    ensureHost();
    if(document.getElementById('fluxReleaseOverlay'))return;
    const notes=gate&&gate.notes?`<div style="font-size:.74rem;color:var(--muted2,#8a93a7);margin-top:14px;line-height:1.55;max-width:420px;margin-left:auto;margin-right:auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;text-align:left"><div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.14em;color:var(--muted,#5b6473);margin-bottom:6px">Release notes</div>${esc(gate.notes)}</div>`:'';
    const div=document.createElement('div');
    div.id='fluxReleaseOverlay';
    div.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 30% 20%,rgba(var(--accent-rgb),.18),transparent 60%),rgba(4,7,14,.96);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);color:var(--text,#e6edf6);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    div.innerHTML=`
      <div style="max-width:460px;width:100%;text-align:center">
        <div style="font-size:2.6rem;margin-bottom:14px">🛠</div>
        <div style="font-size:1.3rem;font-weight:800;letter-spacing:-.01em;margin-bottom:8px">Update under review</div>
        <div style="font-size:.85rem;color:var(--muted2,#8a93a7);line-height:1.55">This build is not rolled out to everyone yet. The owner can turn on <b>Update mode</b> in Owner → Release to gate the public; once they push this build, this screen clears. If you think this is a mistake, try <b>Check again</b> or contact support.</div>
        ${notes}
        <div style="margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button type="button" id="fluxReleaseRetryBtn" style="padding:10px 18px;font-size:.82rem;font-weight:700;border-radius:10px;background:rgba(var(--accent-rgb),.16);border:1px solid rgba(var(--accent-rgb),.35);color:var(--accent,#00bfff);cursor:pointer">↻ Check again</button>
          <button type="button" id="fluxReleaseSignOutBtn" style="padding:10px 18px;font-size:.82rem;font-weight:700;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:var(--muted2,#8a93a7);cursor:pointer">Sign out</button>
        </div>
        <div style="font-size:.62rem;color:var(--muted,#5b6473);font-family:JetBrains Mono,monospace;margin-top:18px;opacity:.7">BUILD · ${esc(buildLabel(FLUX_BUILD_ID))} · awaiting release</div>
      </div>`;
    ensureHost().appendChild(div);
    div.querySelector('#fluxReleaseRetryBtn').addEventListener('click',async(e)=>{
      const btn=e.currentTarget;
      const old=btn.textContent;
      btn.textContent='Checking…';btn.disabled=true;
      const g=await fetchOwnerGate();
      applyGate();
      const stillGated=!isReleased(g||getGate())&&!hasPreviewAccess(g||getGate());
      if(stillGated){
        btn.textContent=old;btn.disabled=false;
        if(typeof showToast==='function')showToast('Still under review — hang tight.','info');
      }
    });
    div.querySelector('#fluxReleaseSignOutBtn').addEventListener('click',()=>{
      try{
        const sb=typeof getSB==='function'?getSB():null;
        if(sb)sb.auth.signOut();
      }catch(_){}
      setTimeout(()=>location.reload(),200);
    });
    const app=document.getElementById('app');
    if(app)app.setAttribute('aria-hidden','true');
  }

  function renderPreviewBanner(gate){
    ensureHost();
    if(document.getElementById('fluxReleasePreviewBanner'))return;
    try{
      if(typeof window.matchMedia==='function'&&window.matchMedia('(max-width:768px)').matches)return;
    }catch(_){}
    const releasedLabel=gate&&gate.released?buildLabel(gate.released):'none yet';
    const canPush=canPushReleaseLocal();
    const bar=document.createElement('div');
    bar.id='fluxReleasePreviewBanner';
    bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9500;display:flex;align-items:center;gap:10px;padding:7px 14px;background:linear-gradient(90deg,rgba(251,191,36,.18),rgba(124,92,255,.14));border-bottom:1px solid rgba(251,191,36,.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:.74rem;color:var(--text,#e6edf6);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    bar.innerHTML=`
      <span style="font-weight:800;color:#fbbf24;letter-spacing:.04em;font-family:JetBrains Mono,monospace;font-size:.68rem">PREVIEW</span>
      <span style="flex:1;min-width:0;color:var(--muted2,#8a93a7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Build <b style="color:var(--text,#e6edf6)">${esc(buildLabel(FLUX_BUILD_ID))}</b> — preview audience only. Users are on <b>${esc(releasedLabel)}</b></span>
      <button type="button" id="fluxReleaseOpenBtn" ${canPush?'':'disabled'} style="padding:5px 12px;font-size:.72rem;font-weight:700;border-radius:8px;background:rgba(251,191,36,.2);border:1px solid rgba(251,191,36,.5);color:#fbbf24;cursor:${canPush?'pointer':'default'};white-space:nowrap;opacity:${canPush?1:.5}">${canPush?'Push update →':'Preview only'}</button>
      <button type="button" id="fluxReleaseCloseBtn" style="padding:4px 8px;font-size:.8rem;background:none;border:none;color:var(--muted2,#8a93a7);cursor:pointer" title="Hide until next reload">✕</button>`;
    ensureHost().appendChild(bar);
    document.documentElement.style.setProperty('--flux-release-banner-h','34px');
    document.body.classList.add('flux-has-release-banner');
    bar.querySelector('#fluxReleaseOpenBtn').addEventListener('click',()=>{if(canPush)openPushDialog();});
    bar.querySelector('#fluxReleaseCloseBtn').addEventListener('click',removeBanner);
  }

  function openPushDialog(){
    if(!hasPreviewAccess(getGate()))return;
    const existing=document.getElementById('fluxReleaseDialog');
    if(existing)existing.remove();
    const root=document.createElement('div');
    root.id='fluxReleaseDialog';
    root.style.cssText='position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,8,16,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const gate=getGate()||{};
    const canPush=canPushReleaseLocal();
    const lastPush=gate.pushedAt?new Date(gate.pushedAt).toLocaleString():'—';
    root.innerHTML=`
      <div style="background:var(--card,#121826);border:1px solid rgba(251,191,36,.4);border-radius:20px;padding:22px;width:100%;max-width:460px;box-shadow:0 32px 80px rgba(0,0,0,.55);color:var(--text,#e6edf6)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span style="font-size:1.5rem">🚀</span>
          <div style="flex:1">
            <div style="font-size:1.05rem;font-weight:800">Push update to all users</div>
            <div style="font-size:.7rem;color:var(--muted,#5b6473);font-family:JetBrains Mono,monospace">preview · ${esc(buildLabel(FLUX_BUILD_ID))}</div>
          </div>
          <button type="button" id="fluxPushClose" style="background:none;border:none;color:var(--muted,#5b6473);font-size:1.2rem;cursor:pointer;padding:0">✕</button>
        </div>
        <div style="font-size:.76rem;color:var(--muted2,#8a93a7);line-height:1.55;margin-bottom:14px">Releases this build to every user and turns <b>Update mode</b> off. While update mode is on, normal users outside the preview list see an <b>"Update under review"</b> screen — after you push, their next load (or auto-poll) picks up this build and the overlay clears.</div>
        ${canPush?'':'<div style="font-size:.72rem;color:#fbbf24;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.28);border-radius:10px;padding:9px 11px;margin-bottom:12px;line-height:1.5">This dev account can preview, but does not have release-push permission.</div>'}
        <div style="background:var(--card2,#0c1220);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:.72rem;line-height:1.5;color:var(--muted2,#8a93a7)">
          <div>Currently released: <b style="color:var(--text,#e6edf6)">${esc(buildLabel(gate.released)||'— (first release)')}</b></div>
          ${gate.pushedBy?`<div style="margin-top:2px">Last push by ${esc(gate.pushedBy)} · ${esc(lastPush)}</div>`:''}
        </div>
        <label style="display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted,#5b6473);margin-bottom:6px;font-family:JetBrains Mono,monospace">Release notes (optional)</label>
        <textarea id="fluxPushNotes" placeholder="Liquid glass default, sidebar fixes, tour polish…" style="width:100%;min-height:72px;padding:10px;border-radius:10px;background:var(--card2,#0c1220);border:1px solid var(--border2,rgba(255,255,255,.12));color:var(--text,#e6edf6);font-family:inherit;font-size:.78rem;resize:vertical;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button type="button" id="fluxPushGoBtn" ${canPush?'':'disabled'} style="flex:1;padding:11px;font-size:.85rem;font-weight:800;border-radius:12px;background:${canPush?'linear-gradient(135deg,#fbbf24,#f59e0b)':'var(--card2,#0c1220)'};border:none;color:${canPush?'#080a0f':'var(--muted,#5b6473)'};cursor:${canPush?'pointer':'default'}">Push to all users</button>
          <button type="button" id="fluxPushCancelBtn" style="padding:11px 16px;font-size:.78rem;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:var(--muted2,#8a93a7);cursor:pointer">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const close=()=>root.remove();
    root.querySelector('#fluxPushClose').addEventListener('click',close);
    root.querySelector('#fluxPushCancelBtn').addEventListener('click',close);
    root.querySelector('#fluxPushGoBtn').addEventListener('click',async(e)=>{
      if(!canPush){if(typeof showToast==='function')showToast('No release permission','warning');return;}
      const btn=e.currentTarget;
      btn.textContent='Pushing…';btn.disabled=true;
      const notes=(root.querySelector('#fluxPushNotes').value||'').trim();
      const res=await pushUpdate(notes);
      close();
      if(!res.ok&&typeof showToast==='function')showToast(res.err||'Push failed','error');
    });
  }

  /** True only when the current session is definitely a signed-in normal user
   *  (so we don't block the login screen or anonymous landings). */
  function isConfirmedNormal(){
    try{
      if(typeof currentUser==='undefined'||!currentUser)return false;
      return !isOwnerLocal()&&!hasPreviewAccess(getGate());
    }catch(_){return false;}
  }

  function applyGate(){
    try{
      const g=getGate();
      if(isReleased(g)){
        removeOverlay();
        removeBanner();
        return;
      }
      if(hasPreviewAccess(g)){
        removeOverlay();
        renderPreviewBanner(g);
        return;
      }
      if(isConfirmedNormal()){
        removeBanner();
        renderOverlay(g);
        return;
      }
      removeOverlay();
      removeBanner();
    }catch(_){}
  }

  let _pollId=null;
  function startPolling(){
    if(_pollId)return;
    _pollId=setInterval(async()=>{
      try{await fetchOwnerGate();}catch(_){}
      applyGate();
    },POLL_MS);
    window.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){
        fetchOwnerGate().finally(applyGate);
      }
    });
  }

  function boot(){
    try{
      if(relLoad(KEY_FIRST,null)==null)relSave(KEY_FIRST,Date.now());
    }catch(_){}
    applyGate();
    startPolling();
  }

  function isPreviewAudience(){
    return hasPreviewAccess(getGate());
  }
  function isPublicReleaseLive(){
    return isReleased(getGate());
  }

  async function invokeOwnerReleaseAdmin(payload) {
    if (!isOwnerLocal()) {
      throw new Error("Only the platform owner can run this action");
    }
    const p = payload && typeof payload === "object" ? payload : {};
    const action = String(p.action || "");
    if (!action) throw new Error("action required");
    const { action: _omit, ...rest } = p;
    return callReleaseAdmin(action, rest);
  }

  window.FluxRelease={
    FLUX_BUILD_ID,
    REQUIRE_EXPLICIT_RELEASE,
    getGate,
    isStagingActive,
    hasPreviewAccess,
    isPreviewAudience,
    isPublicReleaseLive,
    canPushRelease:canPushReleaseLocal,
    pushUpdate,
    saveStagingEnabled,
    savePreviewAccess,
    syncPlatformToDevs,
    fetchOwnerGate,
    applyGate,
    openPushDialog,
    invokeOwnerReleaseAdmin,
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
