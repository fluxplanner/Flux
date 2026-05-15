/* ── FLUX PLANNER · app.js v2 ── */

// ══ STORAGE — must be first, everything below depends on it ══
const load=(k,def)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch(e){return def;}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.warn('Storage full',e);}};

// ══ DATA VERSION — bump when schema needs pruning; never drop user task/note data ══
const DATA_VERSION=6;
(function checkDataVersion(){
  const stored=parseInt(localStorage.getItem('flux_data_version')||'0',10);
  if(stored>=DATA_VERSION)return;
  const keepExact=new Set([
    'flux_data_version','flux_splash_shown',
    'flux_liquid_glass','flux_perf_snappy','flux_ui_density','flux_mood_tint_enabled',
    'flux_nav_counts_v1','flux_layout_dashboard_v1','flux_layout_calendar_v1',
    'flux_canvas_token','flux_canvas_url','flux_canvas_host',
    'flux_canvas_last_view','flux_canvas_last_params',
    'flux_canvas_autosync','flux_canvas_last_sync',
    'flux_canvas_due_filter','flux_canvas_hub_tab',
    'flux_canvas_split','flux_canvas_sidebar_collapsed',
    'flux_canvas_embed_url','flux_canvas_hub_cache','flux_canvas_ai_focus',
    'flux_ai_connections_items_v1','flux_ai_connections_custom_v1','flux_ai_model_route_v1',
    'tasks',
  ]);
  function shouldKeepKey(k){
    if(!k)return false;
    if(keepExact.has(k))return true;
    if(k.startsWith('flux_'))return true;
    return false;
  }
  Object.keys(localStorage).forEach(k=>{
    if(shouldKeepKey(k))return;
    try{
      console.warn('[Flux] migration: dropping non-preserved localStorage key:',k);
    }catch(e){}
    try{localStorage.removeItem(k);}catch(e){}
  });
  localStorage.setItem('flux_data_version',String(DATA_VERSION));
  console.log('[Flux] Data migration applied → version',DATA_VERSION);
})();

(function(){
  function estBytes(){
    let n=0;
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k)n+=(k.length+(localStorage.getItem(k)||'').length)*2;
      }
    }catch(e){}
    return n;
  }
  window.fluxEstimateLocalStorageBytes=estBytes;
  window.fluxCompactStorageIfNeeded=function(){
    if(estBytes()<=5*1024*1024)return;
    try{
      const raw=localStorage.getItem('flux_notes');
      if(raw){
        const notes=JSON.parse(raw);
        if(Array.isArray(notes)&&notes.length>240)localStorage.setItem('flux_notes',JSON.stringify(notes.slice(-240)));
      }
    }catch(e){}
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const k=localStorage.key(i);
        if(!k||!k.startsWith('flux_ai_chats'))continue;
        const arr=JSON.parse(localStorage.getItem(k)||'null');
        if(!Array.isArray(arr))continue;
        let dirty=false;
        for(let j=0;j<arr.length;j++){
          const ch=arr[j];
          if(ch&&Array.isArray(ch.messages)&&ch.messages.length>100){ch.messages=ch.messages.slice(-100);dirty=true;}
        }
        if(dirty)localStorage.setItem(k,JSON.stringify(arr));
      }
    }catch(e){}
  };
  window.fluxCompactStorageIfNeeded();
})();

// ══ APP VERSION — bump for release notes / error payloads (Part 4) ══
const APP_VERSION='1.0.0';

// ══ FEATURE FLAGS — payments & gates (off until launch) ══
const FLUX_FLAGS={
  PAYMENTS_ENABLED:false,
  SHOW_PRICING_PAGE:false,
  SHOW_UPGRADE_PROMPTS:false,
  ENFORCE_AI_LIMITS:false,
  ENFORCE_TASK_LIMITS:false,
  ENFORCE_CANVAS_GATE:false,
  ENFORCE_SCHEDULE_IMPORT_GATE:false,
  ENFORCE_EXPORT_GATE:false,
  ENFORCE_GCAL_PUSH_GATE:false,
  SHOW_PRO_BADGE:false,
  TRIAL_ENABLED:false,
  TESTER_MODE:false,
};

const FLUX_PLANS={
  free:{
    name:'Free',
    price:0,
    aiPremiumModel:false,
    aiDailyMessages:10,
    aiMonthlyMessages:50,
    imageAnalysis:false,
    maxActiveTasks:50,
    canvasSync:false,
    schedulePhotoImport:false,
    gmailSync:true,
    googleCalendarPush:false,
    exportJson:true,
    exportCsv:false,
    exportIcal:false,
    exportPdf:false,
    cloudSync:true,
    maxClasses:6,
    supportLevel:'community',
    trialDays:30,
  },
  pro:{
    name:'Student Pro',
    price:2.99,
    billingPeriod:'monthly',
    stripePriceId:null,
    aiPremiumModel:true,
    aiDailyMessages:200,
    aiMonthlyMessages:6000,
    imageAnalysis:true,
    maxActiveTasks:Infinity,
    canvasSync:true,
    schedulePhotoImport:true,
    gmailSync:true,
    googleCalendarPush:true,
    exportJson:true,
    exportCsv:true,
    exportIcal:true,
    exportPdf:true,
    cloudSync:true,
    maxClasses:Infinity,
    supportLevel:'email',
    trialDays:0,
  },
  school:{
    name:'School License',
    price:0,
    billingPeriod:'yearly',
    stripePriceId:null,
    aiPremiumModel:true,
    aiDailyMessages:200,
    aiMonthlyMessages:6000,
    imageAnalysis:true,
    maxActiveTasks:Infinity,
    canvasSync:true,
    schedulePhotoImport:true,
    gmailSync:true,
    googleCalendarPush:true,
    exportJson:true,
    exportCsv:true,
    exportIcal:true,
    exportPdf:true,
    cloudSync:true,
    maxClasses:Infinity,
    supportLevel:'email',
    trialDays:0,
  },
};

const FLUX_FREE_LIMITS={
  AI_DAILY_MESSAGES:10,
  AI_MONTHLY_MESSAGES:50,
  MAX_ACTIVE_TASKS:50,
  MAX_CLASSES:6,
};

let _entitlement={
  plan:'free',
  status:'trialing',
  isTrialing:true,
  trialEndsAt:null,
  currentPeriodEnd:null,
  cancelAtPeriodEnd:false,
  aiDailyMessages:FLUX_FREE_LIMITS.AI_DAILY_MESSAGES,
  aiMonthlyMessages:FLUX_FREE_LIMITS.AI_MONTHLY_MESSAGES,
  imageAnalysis:false,
  canvasSync:false,
  schedulePhotoImport:false,
  usage:{
    daily_used:0,
    daily_limit:FLUX_FREE_LIMITS.AI_DAILY_MESSAGES,
    monthly_used:0,
    monthly_limit:FLUX_FREE_LIMITS.AI_MONTHLY_MESSAGES,
  },
};
let _entitlementFetchedAt=0;
const ENTITLEMENT_CACHE_MS=5*60*1000;

function getUserPlan(){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED)return'pro';
  if(FLUX_FLAGS.TESTER_MODE)return'pro';
  return _entitlement.plan||'free';
}

function requiresPro(feature){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED)return false;
  if(FLUX_FLAGS.TESTER_MODE)return false;
  const plan=_entitlement.plan;
  const planConfig=FLUX_PLANS[plan];
  if(!planConfig)return false;
  if(planConfig[feature]===false)return true;
  if(feature==='maxActiveTasks'){
    const max=planConfig.maxActiveTasks??Infinity;
    return max!==Infinity&&tasks.filter(t=>!t.done).length>=max;
  }
  if(feature==='maxClasses'){
    const max=planConfig.maxClasses??Infinity;
    return max!==Infinity&&classes.length>=max;
  }
  return false;
}

function showAILimitReached(){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED)return;
  const daily=_entitlement.usage?.daily_used??0;
  const dailyLimit=_entitlement.usage?.daily_limit??FLUX_FREE_LIMITS.AI_DAILY_MESSAGES;
  const plan=_entitlement.plan;
  const isTrialing=_entitlement.isTrialing;
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML=`
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:20px;padding:28px;width:100%;max-width:420px;text-align:center;box-shadow:var(--shadow-float)">
      <div style="font-size:2rem;margin-bottom:12px">🤖</div>
      <div style="font-size:1.1rem;font-weight:800;margin-bottom:8px">Daily AI limit reached</div>
      <div style="font-size:.85rem;color:var(--muted2);line-height:1.6;margin-bottom:20px">
        You've used ${daily} of ${dailyLimit} AI messages today on the ${plan==='free'?'Free':'Pro'} plan.
        ${isTrialing?'<br><br>Your trial gives you full Pro access. Subscribe to keep it after your trial ends.':'<br><br>Upgrade to Pro for 200 messages per day.'}
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:20px;font-size:.8rem;color:var(--muted)">
        Resets at midnight • Current usage: ${daily}/${dailyLimit}
      </div>
      ${FLUX_FLAGS.SHOW_PRICING_PAGE?`
        <button onclick="this.closest('[style*=fixed]').remove();showPricingPage()" style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-weight:700;font-size:.95rem;cursor:pointer;margin-bottom:10px">
          ${isTrialing?'Subscribe — $2.99/month':'Upgrade to Flux Pro'}
        </button>`:''}
      <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:12px;color:var(--muted2);font-size:.85rem;cursor:pointer">
        OK, I'll wait until tomorrow
      </button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

function showUpgradePrompt(feature,reason){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED||!FLUX_FLAGS.SHOW_UPGRADE_PROMPTS)return;
  const featureLabels={
    imageAnalysis:'AI Image Analysis',
    canvasSync:'Canvas LMS Sync',
    schedulePhotoImport:'Schedule Photo Import',
    maxActiveTasks:'Unlimited Tasks',
    maxClasses:'Unlimited Classes',
    exportCsv:'CSV Export',
    exportPdf:'PDF Export',
    googleCalendarPush:'Google Calendar Sync',
    exportIcal:'iCal Export',
  };
  const label=featureLabels[feature]||feature;
  const isTrialing=_entitlement.isTrialing;
  const trialEnd=_entitlement.trialEndsAt
    ?new Date(_entitlement.trialEndsAt).toLocaleDateString('en-US',{month:'long',day:'numeric'})
    :null;
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML=`
    <div style="background:var(--card);border:1px solid rgba(var(--accent-rgb),.3);border-radius:20px;padding:28px;width:100%;max-width:400px;box-shadow:0 24px 80px rgba(0,0,0,.5)">
      <div style="font-size:1.8rem;text-align:center;margin-bottom:10px">✦</div>
      <div style="font-size:1rem;font-weight:800;text-align:center;margin-bottom:6px">${label}</div>
      <div style="font-size:.82rem;color:var(--muted2);text-align:center;line-height:1.6;margin-bottom:18px">${reason}</div>
      ${isTrialing&&trialEnd?`
        <div style="background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.2);border-radius:10px;padding:10px 14px;font-size:.78rem;color:var(--accent);text-align:center;margin-bottom:14px">
          Your free trial ends ${trialEnd}. Subscribe to keep access.
        </div>`:''}
      <div style="margin-bottom:16px">
        ${['Unlimited AI messages','Image & photo analysis','Canvas LMS sync','Schedule photo import','CSV & iCal export','Google Calendar push'].map(f=>
          `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.82rem">
            <span style="color:var(--green)">✓</span>${f}
          </div>`
        ).join('')}
      </div>
      ${FLUX_FLAGS.SHOW_PRICING_PAGE?`
        <button onclick="this.closest('[style*=fixed]').remove();showPricingPage()" style="width:100%;padding:13px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-weight:700;margin-bottom:8px;cursor:pointer;font-size:.9rem">
          Upgrade — $2.99/month
        </button>`:`
        <div style="text-align:center;font-size:.8rem;color:var(--muted2);padding:10px;margin-bottom:8px">
          Subscriptions opening soon — you'll be the first to know!
        </div>`}
      <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:11px;background:none;border:1px solid var(--border);border-radius:12px;color:var(--muted2);font-size:.82rem;cursor:pointer">
        Maybe later
      </button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

function showPricingPage(){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED||!FLUX_FLAGS.SHOW_PRICING_PAGE)return;
  const isTrialing=_entitlement.isTrialing;
  const currentPlan=_entitlement.plan;
  const trialEnd=_entitlement.trialEndsAt
    ?new Date(_entitlement.trialEndsAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    :null;
  const overlay=document.createElement('div');
  overlay.id='pricingOverlay';
  overlay.style.cssText='position:fixed;inset:0;background:var(--bg);z-index:9500;overflow-y:auto;animation:fadeIn .2s var(--ease)';
  overlay.innerHTML=`
    <div style="max-width:860px;margin:0 auto;padding:40px 20px 80px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:40px">
        <div style="font-size:1.4rem;font-weight:800">Flux Planner</div>
        <button onclick="document.getElementById('pricingOverlay').remove()" style="background:var(--card2);border:1px solid var(--border);border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;color:var(--muted2);transform:none;box-shadow:none">✕</button>
      </div>
      <div style="text-align:center;margin-bottom:40px">
        <div style="font-size:2rem;font-weight:800;margin-bottom:8px">Simple, honest pricing</div>
        <div style="font-size:1rem;color:var(--muted2)">30-day free trial • No credit card required • Cancel anytime</div>
        ${isTrialing&&trialEnd?`
          <div style="margin-top:12px;display:inline-block;background:rgba(var(--accent-rgb),.1);border:1px solid rgba(var(--accent-rgb),.3);border-radius:20px;padding:6px 16px;font-size:.82rem;color:var(--accent)">
            Your free trial ends ${trialEnd}
          </div>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:40px">
        <div style="background:var(--card);border:1px solid var(--border2);border-radius:18px;padding:24px">
          <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:8px">Free</div>
          <div style="font-size:2rem;font-weight:800;margin-bottom:4px">$0</div>
          <div style="font-size:.8rem;color:var(--muted2);margin-bottom:20px">Forever free</div>
          <div style="margin-bottom:20px">
            ${[
              `${FLUX_FREE_LIMITS.AI_DAILY_MESSAGES} AI messages/day`,
              `Up to ${FLUX_FREE_LIMITS.MAX_ACTIVE_TASKS} active tasks`,
              `Up to ${FLUX_FREE_LIMITS.MAX_CLASSES} classes`,
              'Cloud sync',
              'Calendar & notes',
              'Mood tracking',
              'Focus timer',
            ].map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.82rem;color:var(--muted2)"><span style="color:var(--green)">✓</span>${f}</div>`).join('')}
            ${[
              'AI image analysis',
              'Canvas sync',
              'Schedule import',
              'CSV/iCal export',
            ].map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.82rem;color:var(--muted);opacity:.5"><span>✕</span>${f}</div>`).join('')}
          </div>
          <button disabled style="width:100%;padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:12px;color:var(--muted2);font-size:.85rem;cursor:default">
            ${currentPlan==='free'&&!isTrialing?'Current Plan':'Free Forever'}
          </button>
        </div>
        <div style="background:var(--card);border:2px solid var(--accent);border-radius:18px;padding:24px;position:relative;overflow:hidden">
          <div style="position:absolute;top:14px;right:14px;background:var(--accent);color:#fff;font-size:.65rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px">MOST POPULAR</div>
          <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);margin-bottom:8px">Student Pro</div>
          <div style="font-size:2rem;font-weight:800;margin-bottom:4px">$2.99<span style="font-size:1rem;font-weight:400;color:var(--muted2)">/month</span></div>
          <div style="font-size:.8rem;color:var(--muted2);margin-bottom:20px">30-day free trial</div>
          <div style="margin-bottom:20px">
            ${[
              '200 AI messages/day',
              'Unlimited tasks & classes',
              'AI image analysis',
              'Canvas LMS sync',
              'Schedule photo import',
              'Google Calendar push',
              'CSV & iCal export',
              'Email support',
            ].map(f=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.82rem"><span style="color:var(--green)">✓</span>${f}</div>`).join('')}
          </div>
          <button id="checkoutBtn" onclick="startCheckout('pro','monthly')"
            style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-weight:700;font-size:.95rem;cursor:pointer;box-shadow:0 4px 16px rgba(var(--accent-rgb),.4)">
            ${isTrialing?'Subscribe — $2.99/month':'Start Free Trial'}
          </button>
          <div style="text-align:center;font-size:.72rem;color:var(--muted);margin-top:8px">
            ${isTrialing?'Cancel anytime from Settings':'No credit card required for trial'}
          </div>
        </div>
      </div>
      <div style="max-width:600px;margin:0 auto">
        <div style="font-size:1rem;font-weight:700;margin-bottom:16px;text-align:center">Common questions</div>
        ${[
          ['Can I cancel anytime?','Yes. Cancel from Settings → Account → Manage Subscription at any time. You keep Pro access until the end of your billing period.'],
          ['What happens when my trial ends?','You automatically move to the Free plan. No charges, no surprises. Your data is never deleted.'],
          ['Is $2.99 the student price?','Yes — this is already the student price. No discount code needed.'],
          ['What happens to my data if I downgrade?','All your tasks and notes stay intact forever. You just hit Free plan limits for new additions.'],
          ['Which AI model does Flux use?','Flux AI uses **Groq** (Llama): Pro gets 70B, free gets 8B. Image analysis uses **Google Gemini** on the server.'],
        ].map(([q,a])=>`
          <div style="padding:14px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:.87rem;font-weight:600;margin-bottom:5px">${q}</div>
            <div style="font-size:.8rem;color:var(--muted2);line-height:1.6">${a}</div>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function startCheckout(plan,period){
  void period;
  if(!FLUX_FLAGS.PAYMENTS_ENABLED){
    showToast('Payments are not yet active — check back soon!','info');
    return;
  }
  if(!currentUser){
    showToast('Please sign in to subscribe','error');
    return;
  }
  const btn=document.getElementById('checkoutBtn');
  if(btn){btn.disabled=true;btn.textContent='Loading...';}
  try{
    const session=await getSB().auth.getSession();
    const token=session?.data?.session?.access_token;
    const res=await fetch(`${SB_URL}/functions/v1/stripe-checkout`,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+(token||SB_ANON),
        'apikey':SB_ANON,
        'Content-Type':'application/json',
      },
      body:JSON.stringify({plan:plan||'pro',period:period||'monthly'}),
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Failed to start checkout');
    window.location.href=data.url;
  }catch(e){
    showToast('Failed to open checkout: '+e.message,'error');
    if(btn){btn.disabled=false;btn.textContent='Start Student Pro';}
  }
}

async function openBillingPortal(){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED){
    showToast('Billing portal is not enabled in this build.','info');
    return;
  }
  if(!currentUser)return;
  try{
    const session=await getSB().auth.getSession();
    const token=session?.data?.session?.access_token;
    const res=await fetch(`${SB_URL}/functions/v1/stripe-portal`,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+(token||SB_ANON),
        'apikey':SB_ANON,
        'Content-Type':'application/json',
      },
    });
    const data=await res.json();
    if(data.url)window.open(data.url,'_blank');
  }catch(e){
    showToast('Failed to open billing portal','error');
  }
}

function updatePlanUI(){
  const plan=_entitlement.plan;
  const isTrialing=_entitlement.isTrialing;
  const isFree=plan==='free'&&!isTrialing;
  const upgradeCTA=document.getElementById('sidebarUpgradeCTA');
  if(upgradeCTA){
    upgradeCTA.style.display=(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.SHOW_PRO_BADGE&&isFree)?'block':'none';
  }
  const proBadge=document.getElementById('proPlanBadge');
  if(proBadge){
    proBadge.style.display=(FLUX_FLAGS.PAYMENTS_ENABLED&&plan==='pro')?'inline-flex':'none';
    proBadge.textContent=isTrialing?'Trial':'Pro';
  }
  const aiUsageBar=document.getElementById('aiDailyUsageBar');
  if(aiUsageBar&&FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_AI_LIMITS){
    const used=_entitlement.usage?.daily_used??0;
    const limit=_entitlement.usage?.daily_limit??FLUX_FREE_LIMITS.AI_DAILY_MESSAGES;
    const pct=Math.min(100,(used/limit)*100);
    aiUsageBar.style.display='flex';
    const bar=aiUsageBar.querySelector('.ai-usage-fill');
    const label=aiUsageBar.querySelector('.ai-usage-label');
    if(bar)bar.style.width=pct+'%';
    if(bar)bar.style.background=pct>=90?'var(--red)':pct>=70?'var(--gold)':'var(--green)';
    if(label)label.textContent=`${used}/${limit} messages today`;
  }else if(aiUsageBar){
    aiUsageBar.style.display='none';
  }
}

function checkTrialExpiry(){
  if(!FLUX_FLAGS.PAYMENTS_ENABLED)return;
  if(!_entitlement.isTrialing||!_entitlement.trialEndsAt)return;
  const daysLeft=Math.ceil(
    (new Date(_entitlement.trialEndsAt)-new Date())/(1000*60*60*24)
  );
  if(daysLeft>7)return;
  const bannerId='trialExpiryBanner';
  if(document.getElementById(bannerId))return;
  const dismissed=load('flux_trial_banner_dismissed',null);
  if(dismissed===_entitlement.trialEndsAt)return;
  const banner=document.createElement('div');
  banner.id=bannerId;
  banner.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid rgba(var(--accent-rgb),.4);border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow-float);z-index:500;max-width:420px;width:calc(100% - 40px);animation:slideUp .3s var(--ease-spring)';
  banner.innerHTML=`
    <span style="font-size:1.2rem">⏳</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:.82rem;font-weight:700">${daysLeft===1?'Trial ends tomorrow':`Trial ends in ${daysLeft} days`}</div>
      <div style="font-size:.72rem;color:var(--muted2)">Subscribe to keep Pro access</div>
    </div>
    ${FLUX_FLAGS.SHOW_PRICING_PAGE?`<button onclick="document.getElementById('${bannerId}').remove();showPricingPage()" style="padding:6px 14px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:.78rem;font-weight:700;cursor:pointer;flex-shrink:0;transform:none;box-shadow:none">Subscribe</button>`:''}
    <button onclick="save('flux_trial_banner_dismissed','${_entitlement.trialEndsAt}');document.getElementById('${bannerId}').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;font-size:.9rem;flex-shrink:0;transform:none;box-shadow:none">✕</button>`;
  document.body.appendChild(banner);
}

function renderSubscriptionCard(){
  const el=document.getElementById('subscriptionStatusCard');
  if(!el)return;
  const section=document.getElementById('subscriptionSection');
  if(section)section.style.display=FLUX_FLAGS.PAYMENTS_ENABLED?'block':'none';
  if(!FLUX_FLAGS.PAYMENTS_ENABLED)return;
  const plan=_entitlement.plan;
  const status=_entitlement.status;
  const isTrialing=_entitlement.isTrialing;
  const trialEnd=_entitlement.trialEndsAt
    ?new Date(_entitlement.trialEndsAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    :null;
  const periodEnd=_entitlement.currentPeriodEnd
    ?new Date(_entitlement.currentPeriodEnd).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    :null;
  const cancelAtEnd=_entitlement.cancelAtPeriodEnd;
  let statusLine='';
  if(isTrialing&&trialEnd)statusLine=`Free trial ends ${trialEnd}`;
  else if(plan==='pro'&&cancelAtEnd&&periodEnd)statusLine=`Cancels ${periodEnd}`;
  else if(plan==='pro'&&periodEnd)statusLine=`Renews ${periodEnd}`;
  else if(status==='past_due')statusLine='Payment past due';
  else statusLine='Free plan';
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div>
        <div style="font-size:.9rem;font-weight:700">${isTrialing?'Free Trial':plan==='pro'?'Student Pro':'Free'}</div>
        <div style="font-size:.75rem;color:var(--muted2);margin-top:2px">${statusLine}</div>
      </div>
      <span style="font-size:.65rem;padding:3px 10px;border-radius:10px;background:${plan==='pro'?'rgba(var(--accent-rgb),.15)':'var(--card2)'};color:${plan==='pro'?'var(--accent)':'var(--muted2)'};font-weight:700">
        ${plan==='pro'?(isTrialing?'TRIAL':'PRO'):'FREE'}
      </span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${plan==='free'&&!isTrialing&&FLUX_FLAGS.SHOW_PRICING_PAGE?`
        <button onclick="showPricingPage()" style="padding:8px 16px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:.8rem;font-weight:700;cursor:pointer">
          Upgrade to Pro
        </button>`:''}
      ${(plan==='pro'||isTrialing)?`
        <button onclick="openBillingPortal()" style="padding:8px 16px;background:var(--card2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:.8rem;cursor:pointer;transform:none;box-shadow:none">
          Manage Subscription
        </button>`:''}
    </div>`;
}

function checkTesterMode(){
  FLUX_FLAGS.TESTER_MODE=false;
  if(!currentUser||!currentUser.email)return;
  const list=load('flux_tester_emails',[]);
  if(!Array.isArray(list)||!list.length)return;
  const email=String(currentUser.email).toLowerCase().trim();
  if(list.some(e=>String(e||'').toLowerCase().trim()===email)){
    FLUX_FLAGS.TESTER_MODE=true;
    _entitlement.plan='pro';
    try{console.log('[Flux] Tester mode active for',currentUser.email);}catch(_){}
  }
}

function renderTesterBadge(){
  document.querySelectorAll('.flux-tester-badge').forEach(el => el.remove());
  if (!FLUX_FLAGS.TESTER_MODE || !currentUser) return;
  const style = 'font-size:.62rem;font-weight:700;color:var(--muted2);letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:8px;text-align:center;border:1px solid var(--border2);border-radius:8px;background:rgba(255,255,255,.04);font-family:JetBrains Mono,monospace';
  const side = document.querySelector('.sidebar-footer');
  if (side){
    const d = document.createElement('div');
    d.className = 'flux-tester-badge';
    d.setAttribute('aria-label', 'Tester account — full access for QA');
    d.textContent = 'Tester';
    d.style.cssText = style;
    side.appendChild(d);
  }
  const ac = document.getElementById('accountSignedIn');
  if (ac){
    const d = document.createElement('div');
    d.className = 'flux-tester-badge';
    d.setAttribute('aria-label', 'Tester account');
    d.textContent = 'Tester';
    d.style.cssText = style + ';max-width:220px';
    const firstBtn = ac.querySelector('button');
    if (firstBtn) ac.insertBefore(d, firstBtn);
    else ac.appendChild(d);
  }
}

try{
  window.FLUX_FLAGS = FLUX_FLAGS;
  window.APP_VERSION = APP_VERSION;
  window.getUserPlan = getUserPlan;
  window.requiresPro = requiresPro;
  window.showUpgradePrompt = showUpgradePrompt;
  window.startCheckout = startCheckout;
  window.openBillingPortal = openBillingPortal;
  window.showPricingPage = showPricingPage;
  window.checkTesterMode = checkTesterMode;
  window.renderTesterBadge = renderTesterBadge;
}catch(_){}

// ══ PWA — register service worker (path follows current app URL, not hardcoded /Fluxplanner/) ══
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    const isSecure=location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
    if(!isSecure)return;
    const swUrl=new URL('service-worker.js',window.location.href);
    navigator.serviceWorker.register(swUrl,{updateViaCache:'none'})
      .then(r=>{
        console.log('✓ SW registered',r.scope);
        r.update();
        document.addEventListener('visibilitychange',()=>{
          if(document.visibilityState==='visible')r.update();
        });
      })
      .catch(e=>console.warn('SW failed',e));
  });
}

// ══ DYNAMIC FOCUS CARD (class strip above tasks + next-best task) ══
function getClassScheduleDisplayMode(){
  const m=settings&&settings.classScheduleDisplay;
  if(m==='collapsed'||m==='hidden')return m;
  return 'full';
}
function getTodayClassesForSchedule(){
  if(typeof classes==='undefined'||!classes||!classes.length)return[];
  const ab=AB_MAP[todayStr()];
  if(!ab)return[];
  return classes.filter(c=>{
    if(!c.name)return false;
    if(!c.days||c.days==='')return true;
    if(c.days.includes('Mon-Fri'))return true;
    if(c.days.includes(ab+' Day'))return true;
    return false;
  }).sort((a,b)=>(a.timeStart||'').localeCompare(b.timeStart||'')||(a.period||0)-(b.period||0));
}
function isDashScheduleDetailExpanded(){
  return localStorage.getItem('flux_dash_schedule_expanded')==='1';
}
function toggleDashScheduleExpanded(){
  localStorage.setItem('flux_dash_schedule_expanded',isDashScheduleDetailExpanded()?'0':'1');
  renderDynamicFocus();
}
function renderDynamicFocus(){
  const wrap=document.getElementById('dashClassScheduleWrap');
  const el=document.getElementById('dynamicFocusCard');
  if(!el){if(wrap)wrap.style.display='none';return;}
  const mode=getClassScheduleDisplayMode();
  const now=new Date();
  const todayIso=todayStr();
  const useIntel=typeof FluxIntel!=='undefined'&&FluxIntel.appendFocusHtml;

  if(typeof isBreak==='function'&&isBreak(todayIso)){
    const rk=typeof restDayKind==='function'?restDayKind(todayIso):'lazy';
    const restHtml=`<div class="focus-card flux-focus-rest">
      <div class="focus-label">${rk==='sick'?'🤒 Sick day':'🛋 Lazy day'}</div>
      <div style="font-size:.86rem;color:var(--muted2);margin-top:6px;line-height:1.45">No mandatory school-work block today — Flux treats this as recovery. Tasks are optional; use <strong>AI Command Center → Fix my schedule</strong> to push work forward.</div>
    </div>`;
    el.innerHTML=useIntel?FluxIntel.appendFocusHtml(restHtml):restHtml;
    if(wrap)wrap.style.display=el.innerHTML.trim()?'block':'none';
    return;
  }

  const nowMin=now.getHours()*60+now.getMinutes();
  const clockStr=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const todayClasses=getTodayClassesForSchedule();
  let nextClass=null,minDiff=0;
  if(todayClasses.length){
    nextClass=todayClasses.find(c=>c.timeStart&&c.timeStart>clockStr)||todayClasses[0];
    if(nextClass&&nextClass.timeStart){
      const[h,m]=nextClass.timeStart.split(':').map(Number);
      minDiff=h*60+m-nowMin;
    }
  }

  const urgent=(typeof tasks!=='undefined'&&tasks)?tasks.filter(t=>!t.done&&t.date===todayIso).sort((a,b)=>(b.priority==='high'?1:0)-(a.priority==='high'?1:0))[0]:null;
  let gapSug=null;
  if(nextClass&&minDiff>0&&typeof tasks!=='undefined'&&tasks){
    gapSug=tasks.filter(t=>!t.done&&t.estTime&&t.estTime<=minDiff).sort((a,b)=>b.urgencyScore-a.urgencyScore)[0];
  }

  let classBlock='';
  if(mode!=='hidden'&&nextClass){
    const hrs=Math.floor(Math.max(0,minDiff)/60),mins=Math.max(0,minDiff)%60;
    const awayStr=minDiff>0?(hrs>0?`${hrs}h ${mins}m`:`${mins}m`):'—';
    const startLbl=nextClass.timeStart?fmtTime(nextClass.timeStart):'P'+nextClass.period;
    const detailInner=`<div class="focus-card flux-focus-class-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="font-size:1.4rem">📍</div>
        <div>
          <div class="focus-label">Next class</div>
          <div style="font-size:.95rem;font-weight:700;margin-top:2px">${esc(nextClass.name)}${nextClass.room?' · Rm '+esc(nextClass.room):''}</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div class="focus-time">${minDiff>0?awayStr:esc(startLbl)}</div>
          <div class="focus-label">${minDiff>0?'away':'starts'}</div>
        </div>
      </div>
      ${gapSug?`<div style="background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.15);border-radius:10px;padding:10px 14px;font-size:.8rem">
        <span style="color:var(--muted2)">💡 Gap task:</span> <strong>${esc(gapSug.name)}</strong>
        <span style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:.72rem;margin-left:6px">~${gapSug.estTime}min</span>
      </div>`:''}
    </div>`;
    if(mode==='collapsed'){
      const exp=isDashScheduleDetailExpanded();
      const sum=`${todayClasses.length} class${todayClasses.length===1?'':'es'} · Next: ${nextClass.name} · ${startLbl}`;
      classBlock=`<div class="flux-schedule-focus-shell card" style="padding:0;overflow:hidden;margin-bottom:14px;border:1px solid rgba(var(--accent-rgb),.15)">
        <button type="button" class="flux-schedule-collapsed-toggle" onclick="toggleDashScheduleExpanded()" aria-expanded="${exp?'true':'false'}" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:transparent;border:none;color:var(--text);font:inherit;cursor:pointer;text-align:left">
          <span style="font-size:.82rem;font-weight:600">📅 <span style="color:var(--muted2);font-weight:500">${esc(sum)}</span></span>
          <span class="flux-schedule-chev" aria-hidden="true" style="flex-shrink:0;color:var(--muted);font-size:.75rem">${exp?'▴':'▾'}</span>
        </button>
        <div class="flux-schedule-focus-detail" style="display:${exp?'block':'none'};padding:0 12px 12px">${detailInner}</div>
      </div>`;
    }else{
      classBlock=detailInner;
    }
  }

  let html=classBlock;
  if(!html&&urgent){
    html=`<div class="focus-card">
      <div class="focus-label">Focus on now</div>
      <div style="font-size:1rem;font-weight:700;margin-top:6px">${esc(urgent.name)}</div>
      <div style="font-size:.75rem;color:var(--muted2);margin-top:4px">Due today${urgent.estTime?' · ~'+urgent.estTime+'min':''}</div>
    </div>`;
  }
  el.innerHTML=useIntel?FluxIntel.appendFocusHtml(html):html;
  if(wrap)wrap.style.display=el.innerHTML.trim()?'block':'none';
}

// ══ TIME POVERTY DETECTOR ══
function checkTimePoverty(){
  const banner=document.getElementById('timePovertyBanner');if(!banner)return;
  const now=new Date();
  const todayStr=now.toISOString().slice(0,10);

  if(typeof isBreak==='function'&&isBreak(todayStr)){
    const rk=typeof restDayKind==='function'?restDayKind(todayStr):'lazy';
    banner.classList.add('on');
    banner.classList.add('time-poverty-banner--rest');
    banner.innerHTML=`<span class="time-poverty-banner__icon" aria-hidden="true">${rk==='sick'?'🤒':'🛋'}</span>
      <div class="time-poverty-banner__body">
        <div class="time-poverty-banner__title">${rk==='sick'?'Sick day':'Lazy day'} — no school-work plan</div>
        <div class="time-poverty-banner__detail">Flux won’t treat today as a crunch day. Tasks still listed are optional — use <strong>Fix my schedule</strong> in AI Command Center to push them forward.</div>
      </div>
      <button type="button" class="time-poverty-banner__dismiss" onclick="this.parentElement.classList.remove('on');this.parentElement.classList.remove('time-poverty-banner--rest')" aria-label="Dismiss">✕</button>`;
    return;
  }
  banner.classList.remove('time-poverty-banner--rest');

  // Total est minutes of tasks due today
  const todayTasks=tasks.filter(t=>!t.done&&t.date===todayStr);
  const totalEstMin=todayTasks.reduce((s,t)=>s+(t.estTime||30),0);

  // Available minutes: now → 11PM minus class time
  const endOfDay=new Date();endOfDay.setHours(23,0,0,0);
  const availableMin=Math.max(0,(endOfDay-now)/60000);
  const classMin=classes.reduce((s,c)=>{
    if(!c.timeStart||!c.timeEnd)return s;
    const[sh,sm]=c.timeStart.split(':').map(Number);
    const[eh,em]=c.timeEnd.split(':').map(Number);
    return s+(eh*60+em-(sh*60+sm));
  },0);
  const freeMin=Math.max(0,availableMin-classMin);

  if(totalEstMin>freeMin&&freeMin>0&&todayTasks.length>0){
    banner.classList.add('on');
    const over=Math.round(totalEstMin-freeMin);
    banner.innerHTML=`<span class="time-poverty-banner__icon" aria-hidden="true">⚠</span>
      <div class="time-poverty-banner__body">
        <div class="time-poverty-banner__title">Today may not fit your free time</div>
        <div class="time-poverty-banner__detail">~${Math.round(totalEstMin)} min of work estimated vs ~${Math.round(freeMin)} min free (about <strong>${over} min short</strong>). Consider moving something or trimming estimates.</div>
      </div>
      <button type="button" class="time-poverty-banner__dismiss" onclick="this.parentElement.classList.remove('on')" aria-label="Dismiss">✕</button>`;
  } else {
    banner.classList.remove('on');
  }
}

// ══ BREAK IT DOWN (AI-powered task splitter) ══
async function breakItDown(taskId){
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  const btn=document.getElementById('breakdown-btn-'+taskId);
  if(btn){btn.textContent='Breaking down...';btn.disabled=true;btn.classList.add('btn-loading');}

  try{
    const res=await fetch(API.ai,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+((await getSB()?.auth?.getSession())?.data?.session?.access_token||'')},
      body:JSON.stringify({
        model:'llama-3.3-70b-versatile',
        messages:[
          {role:'system',content:'You are a productivity assistant. Return ONLY a JSON array of exactly 5 short, actionable sub-tasks. No explanation, no markdown, just the array: ["sub-task 1","sub-task 2","sub-task 3","sub-task 4","sub-task 5"]'},
          {role:'user',content:`Break down this task into 5 immediate actionable sub-tasks: "${task.name}"`}
        ],
        max_tokens:300,temperature:0.4
      })
    });
    const data=await res.json();
    const txt=(data.choices?.[0]?.message?.content||'').trim().replace(/```json|```/g,'');
    const start=txt.indexOf('['),end=txt.lastIndexOf(']');
    const subtasks=JSON.parse(txt.slice(start,end+1));
    if(!Array.isArray(subtasks)||!subtasks.length)throw new Error('Invalid response');
    task.subtasks=(subtasks||[]).map(s=>({text:s,done:false}));
    save('tasks',tasks);
    renderTasks();
    syncKey('tasks',tasks);
  }catch(e){
    if(btn){btn.textContent='Break it Down';btn.disabled=false;btn.classList.remove('btn-loading');}
    showToast('Could not break down task: '+e.message,'error');
  }
}

// ══ ENERGY-BASED SMART SORT ══
function smartSortTasks(taskList){
  const energy=parseInt(localStorage.getItem('flux_energy')||'3');
  return [...taskList].sort((a,b)=>{
    if(energy<=2){
      // Low energy: easy tasks first (difficulty 1-2), then by urgency
      const da=a.difficulty||3,db=b.difficulty||3;
      if(da<=2&&db>2)return -1;
      if(db<=2&&da>2)return 1;
    } else if(energy>=4){
      // High energy: projects and essays first, then by urgency
      const isProjA=['project','essay'].includes(a.type);
      const isProjB=['project','essay'].includes(b.type);
      if(isProjA&&!isProjB)return -1;
      if(isProjB&&!isProjA)return 1;
    }
    return (b.urgencyScore||0)-(a.urgencyScore||0);
  });
}

// ══ PRIVACY REVEAL (tap-to-reveal) ══
function toggleReveal(fieldId,btnId){
  const field=document.getElementById(fieldId);
  const btn=document.getElementById(btnId);
  if(!field||!btn)return;
  if(field.tagName==='INPUT'){
    const show=field.type==='password';
    field.type=show?'text':'password';
    btn.textContent=show?'🙈':'👁';
    btn.setAttribute('title',show?'Hide':'Show');
    if(show)field.focus();
    return;
  }
  const isHidden=field.dataset.hidden==='true';
  field.dataset.hidden=isHidden?'false':'true';
  if(isHidden){
    field.textContent=field.dataset.value||'—';
    btn.textContent='🙈';
  } else {
    const len=(field.dataset.value||'').length||4;
    field.textContent='•'.repeat(len);
    btn.textContent='👁';
  }
}

function maskPrivateField(el,value){
  if(!el||!value)return;
  el.dataset.value=value;
  el.dataset.hidden='true';
  el.textContent='•'.repeat(Math.min(value.length,8));
}

// ══ TOAST NOTIFICATIONS ══
function showToast(msg,type='success',durationMs=3000){
  const live=document.getElementById('toastLive');if(live)live.textContent=msg;
  // Ensure toast stack container exists — newest toast is prepended so it sits on top
  let stack=document.getElementById('fluxToastStack');
  if(!stack){
    stack=document.createElement('div');
    stack.id='fluxToastStack';
    stack.setAttribute('aria-live','polite');
    stack.setAttribute('aria-atomic','false');
    const isMob=window.innerWidth<768;
    stack.style.cssText=`position:fixed;left:50%;transform:translateX(-50%);bottom:${isMob?'calc(16px + var(--bnav-height,62px) + var(--sa-bottom,0px))':'20px'};z-index:9999;display:flex;flex-direction:column-reverse;gap:8px;align-items:center;pointer-events:none;max-width:90vw;`;
    document.body.appendChild(stack);
  }
  const t=document.createElement('div');
  t.className='toast-item';
  const colors={success:'var(--green)',error:'var(--red)',info:'var(--accent)',warning:'var(--gold)'};
  const textColors={success:'#080a0f',error:'#fff',info:'#fff',warning:'#080a0f'};
  const reduce=document.documentElement.classList.contains('flux-reduce-motion');
  t.style.cssText=`position:relative;display:flex;flex-direction:column;align-items:stretch;pointer-events:auto;background:${colors[type]||colors.success};color:${textColors[type]||'#080a0f'};
    border-radius:12px;font-size:.82rem;font-weight:700;max-width:100%;
    ${reduce?'':'animation:fluxToastIn .3s cubic-bezier(.34,1.56,.64,1) both;'}overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,.4);`;
  const msgRow=document.createElement('div');
  msgRow.style.cssText='padding:10px 20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  msgRow.textContent=msg;
  const prog=document.createElement('div');
  prog.className='toast-progress';
  t.appendChild(msgRow);
  t.appendChild(prog);
  // Prepend so newest sits visually on top of column-reverse stack
  stack.prepend(t);
  try{
    if(!reduce&&window.FluxAnim?.toastIn)FluxAnim.toastIn(t);
  }catch(e){}
  setTimeout(()=>{
    const out=()=>{try{t.remove();}catch(e){}};
    if(!reduce&&window.FluxAnim?.toastOut){
      try{FluxAnim.toastOut(t,out);}catch(e){out();}
    }else{
      t.style.opacity='0';t.style.transition='opacity .2s,transform .2s';t.style.transform='translateY(8px)';setTimeout(out,220);
    }
  },durationMs||3000);
}

// ══ ACCESSIBILITY · SNOOZE · BULK · EXAM CONFLICTS ══
let _taskBulkMode=false;
const _bulkIds=new Set();
function isTaskSnoozed(_t){return false;}
function applyFontScale(){
  const v=parseInt(load('flux_font_scale','100'),10)||100;
  document.documentElement.style.fontSize=(v/100*16)+'px';
  const lab=document.getElementById('fontScaleLabel');if(lab)lab.textContent=v+'%';
  const sl=document.getElementById('fontScaleSlider');if(sl)sl.value=String(v);
}
function setFontScale(v){
  save('flux_font_scale',String(v));
  applyFontScale();
}
function applyReduceMotion(){
  const user=load('flux_reduce_motion',false);
  const sys=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('flux-reduce-motion',!!user||sys);
  const el=document.getElementById('reduceMotionToggle');if(el)el.classList.toggle('on',!!user);
}
function toggleReduceMotion(){
  save('flux_reduce_motion',!load('flux_reduce_motion',false));
  applyReduceMotion();
}
function snoozeTask(){showToast('Snooze is no longer available','info');}
function toggleTaskBulkMode(_force){
  _taskBulkMode=typeof _force==='boolean'?_force:!_taskBulkMode;
  if(!_taskBulkMode)_bulkIds.clear();
  // Toggle the UI bar and the select button state
  const bar=document.getElementById('taskBulkBar');
  if(bar)bar.style.display=_taskBulkMode?'flex':'none';
  const selBtn=document.getElementById('dashSelectBtn');
  if(selBtn)selBtn.classList.toggle('on',_taskBulkMode);
  document.body.classList.toggle('flux-bulk-mode',_taskBulkMode);
  const countEl=document.getElementById('bulkCount');
  if(countEl)countEl.textContent=_bulkIds.size+' selected';
  renderTasks();
}
function fluxEnterBulkMode(){ toggleTaskBulkMode(true); }
function fluxExitBulkMode(){ toggleTaskBulkMode(false); }
function fluxBulkSelectAll(){
  const active=tasks.filter(t=>!t.done);
  if(_bulkIds.size>=active.length){
    _bulkIds.clear();
  } else {
    active.forEach(t=>_bulkIds.add(t.id));
  }
  const el=document.getElementById('bulkCount');
  if(el)el.textContent=_bulkIds.size+' selected';
  renderTasks();
}
function fluxBulkReschedule(){
  if(!_bulkIds.size){ showToast('Nothing selected','info'); return; }
  // Simple prompt-based date entry; leverages existing date inputs elsewhere if needed
  const today=new Date(); today.setHours(0,0,0,0);
  const iso=today.toISOString().slice(0,10);
  const input=prompt('Reschedule selected tasks to (YYYY-MM-DD):', iso);
  if(!input)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input)){ showToast('Invalid date format','error'); return; }
  _bulkIds.forEach(id=>{
    const t=tasks.find(x=>x.id===id);
    if(!t||t.done)return;
    t.date=input;
    if(typeof calcUrgency==='function')t.urgencyScore=calcUrgency(t);
  });
  save('tasks',tasks);
  if(typeof syncKey==='function')syncKey('tasks',tasks);
  showToast('Rescheduled','success');
  toggleTaskBulkMode(false);
  renderStats();renderTasks();renderCalendar();if(typeof renderCountdown==='function')renderCountdown();
}
try{ window.fluxEnterBulkMode=fluxEnterBulkMode; window.fluxExitBulkMode=fluxExitBulkMode; window.fluxBulkSelectAll=fluxBulkSelectAll; window.fluxBulkReschedule=fluxBulkReschedule; }catch(e){}

function fluxToggleGCalAutoPush(btn){
  if(!window.fluxGCalAutoPush)return;
  const on=window.fluxGCalAutoPush.toggle();
  if(btn){
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-pressed',on?'true':'false');
  }
  if(typeof showToast==='function') showToast(on?'Auto-push enabled':'Auto-push disabled','info');
}
function fluxInitGCalAutoPushToggle(){
  const btn=document.getElementById('gcalAutoToggle');
  if(!btn||!window.fluxGCalAutoPush)return;
  const on=window.fluxGCalAutoPush.enabled();
  btn.classList.toggle('on',on);
  btn.setAttribute('aria-pressed',on?'true':'false');
}
try{ window.fluxToggleGCalAutoPush=fluxToggleGCalAutoPush; window.fluxInitGCalAutoPushToggle=fluxInitGCalAutoPushToggle; }catch(e){}
document.addEventListener('DOMContentLoaded',()=>{ setTimeout(fluxInitGCalAutoPushToggle,400); });
function toggleBulkOne(id,on){if(on)_bulkIds.add(id);else _bulkIds.delete(id);const el=document.getElementById('bulkCount');if(el)el.textContent=_bulkIds.size+' selected';}
function bulkCompleteSelected(){
  _bulkIds.forEach(id=>{const t=tasks.find(x=>x.id===id);if(t&&!t.done){t.done=true;t.completedAt=Date.now();}});
  _bulkIds.clear();save('tasks',tasks);syncKey('tasks',tasks);
  showToast('Updated tasks','success');toggleTaskBulkMode(false);
  renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();
}
function bulkSnoozeSelected(){showToast('Snooze is no longer available','info');}
function bulkDeleteSelected(){
  if(!confirm('Delete selected tasks?'))return;
  const rm=new Set(_bulkIds);tasks=tasks.filter(t=>!rm.has(t.id));_bulkIds.clear();
  save('tasks',tasks);syncKey('tasks',tasks);showToast('Deleted','info');toggleTaskBulkMode(false);
  renderStats();renderTasks();renderCalendar();renderCountdown();
}
function renderExamConflictBanner(){
  const el=document.getElementById('examConflictBanner');if(!el)return;
  const now=new Date();now.setHours(0,0,0,0);
  const tests=tasks.filter(t=>!t.done&&t.date&&(t.type==='test'||t.type==='quiz'));
  const by={};tests.forEach(t=>{if(!by[t.date])by[t.date]=[];by[t.date].push(t);});
  const bad=Object.entries(by).filter(([,a])=>a.length>=2);
  if(!bad.length){el.style.display='none';el.innerHTML='';return;}
  el.style.display='block';
  el.innerHTML='<strong>⚠️ Heavy day:</strong> '+bad.map(([d,a])=>`${new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} (${a.length} tests/quizzes)`).join(' · ');
}
async function exportEncryptedBackup(){
  if(!window.crypto?.subtle){showToast('Encrypted export needs a secure (HTTPS) context','error');return;}
  const pw=prompt('Choose a passphrase (min 8 characters). You will need it to decrypt.');
  if(!pw||pw.length<8){showToast('Passphrase too short','warning');return;}
  const data={tasks,notes:notes.map(n=>({...n,body:strip(n.body)})),habits,goals,colleges,moodHistory,schoolInfo,classes,settings,extras,ecSchools,ecGoals,flux_cycle_config:load('flux_cycle_config',null),flux_weekly_events:load('flux_weekly_events',[]),flux_events:load('flux_events',[]),flux_rest_days_v1:loadRestDaysList(),exportDate:new Date().toISOString(),encrypted:true};
  const raw=JSON.stringify(data);
  try{
    const enc=await fluxEncryptPayload(raw,pw);
    const blob=new Blob([JSON.stringify(enc,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='flux-backup-encrypted.json';a.click();URL.revokeObjectURL(url);
    showToast('Encrypted export saved','success');
  }catch(e){showToast('Encryption failed: '+e.message,'error');}
}
async function fluxEncryptPayload(plainText,password){
  const enc=new TextEncoder();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits','deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:120000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt']);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,enc.encode(plainText));
  return{v:1,salt:Array.from(salt),iv:Array.from(iv),data:Array.from(new Uint8Array(ct))};
}
async function fluxDecryptPayload(encObj,password){
  if(!encObj||encObj.v!==1||!encObj.salt||!encObj.iv||!encObj.data)throw new Error('Invalid file');
  const enc=new TextEncoder(),dec=new TextDecoder();
  const salt=new Uint8Array(encObj.salt);
  const iv=new Uint8Array(encObj.iv);
  const data=new Uint8Array(encObj.data);
  const keyMaterial=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits','deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:120000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,data);
  return dec.decode(pt);
}
async function importEncryptedBackup(file){
  if(!window.crypto?.subtle){showToast('Import needs HTTPS','error');return;}
  const pw=prompt('Passphrase for this file:');
  if(!pw)return;
  const text=await file.text();
  let enc;try{enc=JSON.parse(text);}catch(e){showToast('Invalid JSON file','error');return;}
  let raw;try{raw=await fluxDecryptPayload(enc,pw);}catch(e){showToast('Wrong passphrase or corrupt file','error');return;}
  let d;try{d=JSON.parse(raw);}catch(e){showToast('Decrypted data invalid','error');return;}
  if(!confirm('Merge tasks and notes from this backup into your planner? (Existing IDs are skipped.)'))return;
  applyImportedPayloadMerge(d);
}
function applyImportedPayloadMerge(d){
  const seen=new Set(tasks.map(t=>t.id));
  (d.tasks||[]).forEach(t=>{if(t&&typeof t.id!=='undefined'&&!seen.has(t.id)){tasks.push(t);seen.add(t.id);}});
  save('tasks',tasks);
  if(Array.isArray(d.notes))d.notes.forEach(n=>{if(n&&n.id&&!notes.find(x=>x.id===n.id))notes.push(n);});
  save('flux_notes',notes);
  if(d.schoolInfo&&typeof d.schoolInfo==='object')schoolInfo={...schoolInfo,...d.schoolInfo};
  save('flux_school',schoolInfo);
  if(Array.isArray(d.classes)&&d.classes.length)classes=[...classes,...d.classes.filter(c=>!classes.find(x=>x.id===c.id))];
  save('flux_classes',classes);
  if(Array.isArray(d.flux_rest_days_v1)&&d.flux_rest_days_v1.length)saveRestDaysList(d.flux_rest_days_v1.filter(x=>x&&x.date));
  showToast('Merged backup data','success');
  renderStats();renderTasks();renderCalendar();renderCountdown();populateSubjectSelects();
  if(currentUser)syncToCloud();
}
function setTimerPresetMins(mins){
  const el=document.getElementById('customWork');if(!el)return;
  el.value=String(mins);updateTLengths();showToast(mins+' min focus','info');
}
function estimateStorageBytes(){
  let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)n+=(k.length+(localStorage.getItem(k)||'').length)*2;}}catch(e){}
  return n;
}
function renderStorageMeter(){
  const el=document.getElementById('storageMeter');if(!el)return;
  const b=estimateStorageBytes();const mb=(b/1048576).toFixed(2);
  el.innerHTML=`<span style="font-family:'JetBrains Mono',monospace;font-size:.85rem;color:var(--accent)">~${mb} MB</span> <span style="font-size:.72rem;color:var(--muted)">(browser storage for this site)</span>`;
}
function saveJournalLine(){
  const inp=document.getElementById('journalLine');if(!inp)return;
  const line=inp.value.trim();if(!line)return;
  const j=load('flux_journal_lines',{});
  j[todayStr()]=line;save('flux_journal_lines',j);
  showToast('Saved','success');
}
function loadJournalLineUI(){
  const inp=document.getElementById('journalLine');if(!inp)return;
  const j=load('flux_journal_lines',{});
  inp.value=j[todayStr()]||'';
}
function pushQuickAddHistory(line){
  if(!line||!line.trim())return;
  let h=load('flux_quick_add_history',[]);
  h=h.filter(x=>x!==line);h.unshift(line.trim());h=h.slice(0,5);
  save('flux_quick_add_history',h);
}

// ══ STUDY DNA AI INTEGRATION ══
function getStudyDNAPrompt(){
  const dna=load('flux_dna',[]);if(!dna.length)return'';
  const parts=[];
  if(dna.includes('Visual'))parts.push('Use tables, diagrams, and visual formatting in your explanations. Structure information visually.');
  if(dna.includes('Practice'))parts.push('After every explanation, generate exactly 3 practice questions for the student to test themselves.');
  if(dna.includes('Audio'))parts.push('Write in a conversational, easy-to-read-aloud style.');
  if(dna.includes('Reading'))parts.push('Provide detailed written explanations with clear structure.');
  return parts.length?'\n\nLearning style preferences: '+parts.join(' '):'';
}
// ══ SUBJECTS — built dynamically from user's classes ══
// No hardcoded subjects. Colors auto-assigned.
const SUBJECT_COLORS=['#6366f1','#f43f5e','#10d9a0','#fbbf24','#3b82f6','#c084fc','#fb923c','#e879f9','#22d3ee','#4ade80','#f472b6','#a78bfa'];
function getSubjects(){
  // Build purely from user classes — no reference to SUBJECTS proxy
  const subjs={};
  classes.forEach((c,i)=>{
    if(!c.name)return;
    const cleanName=cleanClassName(c.name);
    const key='CLS'+(c.id||i);
    subjs[key]={name:cleanName,short:cleanName.length>8?cleanName.slice(0,3).toUpperCase():cleanName,color:c.color||SUBJECT_COLORS[i%SUBJECT_COLORS.length]};
  });
  return subjs;
}
// ── CLEAN CLASS NAME — strips prefixes and grade numbers ──
function cleanClassName(name){
  if(!name)return name;
  // Remove common academic prefixes (case insensitive)
  let clean = name.trim();
  // Remove prefixes like "IB MYP", "AP", "Honors", "Grade 10", etc.
  clean = clean.replace(/^(IB\s+MYP|IB\s+DP|IB\s+SL|IB\s+HL|MYP|IB|DP|SL|HL|AP|Honors|Honours|Advanced|Regular|CP|College\s+Prep)\s+/gi, '');
  // Remove trailing grade numbers like "10", "9", "11", "12" or "10th", "Grade 10"
  clean = clean.replace(/\s+(?:Grade\s+)?\d{1,2}(?:st|nd|rd|th)?\s*$/i, '');
  // Remove leading grade number patterns like "10 " at start
  clean = clean.replace(/^\d{1,2}\s+/, '');
  return clean.trim() || name.trim();
}

// SUBJECTS is a live getter — always reflects current classes
function SUBJECTS_GET(){return getSubjects();}
// Compat shim — returns current subjects object
// SUBJECTS: always call getSubjects() directly — Proxy removed to prevent recursion
const SUBJECTS={};  // kept for compat, real data via getSubjects()
const REST_DAYS_KEY='flux_rest_days_v1';
function loadRestDaysList(){
  let arr=load(REST_DAYS_KEY,null);
  if(!Array.isArray(arr))arr=[];
  if(arr.length===0){
    const old=load('flux_no_hw_days',[]);
    if(Array.isArray(old)&&old.length){
      arr=old.map(d=>(typeof d==='string'?{date:d,kind:'lazy'}:{date:d.date||d,kind:d.kind==='sick'?'sick':'lazy'}));
      save(REST_DAYS_KEY,arr);
    }
  }
  return arr.filter(r=>r&&r.date&&/^\d{4}-\d{2}-\d{2}$/.test(r.date));
}
function saveRestDaysList(arr){save(REST_DAYS_KEY,arr);}
function isBreak(d){return loadRestDaysList().some(r=>r.date===d);}
function restDayKind(d){const r=loadRestDaysList().find(x=>x.date===d);return r?r.kind:null;}
function nextNonRestForward(ds){
  let d=new Date(ds+'T12:00:00');
  for(let i=0;i<56;i++){
    d.setDate(d.getDate()+1);
    const s=d.toISOString().slice(0,10);
    if(!isBreak(s))return s;
  }
  return ds;
}
function prevNonRestBackward(ds){
  let d=new Date(ds+'T12:00:00');
  for(let i=0;i<56;i++){
    d.setDate(d.getDate()-1);
    const s=d.toISOString().slice(0,10);
    if(!isBreak(s))return s;
  }
  return ds;
}
/** Move tasks dated on sick/lazy days to the next working day. */
function flushTasksOffRestDays(){
  if(typeof tasks==='undefined'||!Array.isArray(tasks))return 0;
  let n=0;
  tasks.forEach(t=>{
    if(t.done||!t.date||!isBreak(t.date))return;
    t.date=nextNonRestForward(t.date);
    if(typeof calcUrgency==='function')t.urgencyScore=calcUrgency(t);
    n++;
  });
  if(n){
    save('tasks',tasks);
    if(typeof syncKey==='function')syncKey('tasks',tasks);
    if(typeof renderTasks==='function')renderTasks();
    if(typeof renderCalendar==='function')renderCalendar();
    if(typeof renderDashWeekStrip==='function')renderDashWeekStrip();
    if(typeof showToast==='function')showToast(`Moved ${n} task(s) off rest day(s)`,'success');
  }
  return n;
}
const PANEL_TITLES={dashboard:'Dashboard',calendar:'Calendar',school:'School Info',notes:'Notes',timer:'Focus Timer',canvas:'Canvas',profile:'Profile',goals:'Extracurriculars',mood:'Mood',ai:'Flux AI',toolbox:'Study Tools',references:'Study Tools',settings:'Settings',flux_control:'Control'};

function buildABMap(){return load('flux_ab_map',{});}
const AB_MAP=buildABMap();
const TODAY=new Date();

/** Local YYYY-MM-DD (no UTC shift). */
function fluxLocalYMD(d){
  return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fluxParseLocalYMD(s){
  if(!s||typeof s!=='string')return null;
  const p=s.split('-').map(Number);
  if(p.length!==3||!p[0])return null;
  const x=new Date(p[0],p[1]-1,p[2]);
  if(x.getFullYear()!==p[0]||x.getMonth()!==p[1]-1||x.getDate()!==p[2])return null;
  return x;
}
function fluxIsWeekend(d){const w=d.getDay();return w===0||w===6;}
/** Cycle label for a calendar day, or '' — uses flux_cycle_config or legacy AB_MAP. */
function getCycleDayLabel(dateStr){
  const cfg=load('flux_cycle_config',null);
  if(cfg&&cfg.enabled&&cfg.pattern&&cfg.anchorDate){
    const pat=cfg.pattern.map(x=>String(x).trim()).filter(Boolean);
    if(!pat.length)return'';
    const skip=cfg.skipWeekends!==false;
    const target=fluxParseLocalYMD(dateStr);
    if(!target)return'';
    if(skip&&fluxIsWeekend(target))return'';
    const anchor=fluxParseLocalYMD(cfg.anchorDate);
    if(!anchor)return'';
    let cur=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
    const end=new Date(target.getFullYear(),target.getMonth(),target.getDate());
    if(cur.getTime()===end.getTime())return pat[0];
    if(end>cur){
      let n=0;
      while(cur<end){
        cur.setDate(cur.getDate()+1);
        if(!skip||!fluxIsWeekend(cur))n++;
      }
      return pat[n%pat.length];
    }
    let n=0;
    cur=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
    while(cur>end){
      cur.setDate(cur.getDate()-1);
      if(!skip||!fluxIsWeekend(cur))n--;
    }
    return pat[((n%pat.length)+pat.length)%pat.length];
  }
  return AB_MAP[dateStr]||'';
}
function getWeeklyRules(){return load('flux_weekly_events',[]);}
/** 'school' | 'outside' — default school when unset. */
function fluxEventScope(o){if(!o)return'school';return o.scope==='outside'?'outside':'school';}
function fluxScopeSortKey(o){return fluxEventScope(o)==='outside'?1:0;}
/** Milliseconds for task due date (local midnight). No date or invalid date sorts last. */
function fluxTaskDueDateMs(t){
  if(!t||!t.date)return Number.POSITIVE_INFINITY;
  const ms=+new Date(t.date+'T00:00:00');
  return Number.isNaN(ms)?Number.POSITIVE_INFINITY:ms;
}
/** True if task has a due date strictly before today (local calendar). */
function isTaskOverdueDay(t){
  if(!t||t.done||!t.date)return false;
  const dms=fluxTaskDueDateMs(t);
  if(!Number.isFinite(dms)||dms===Number.POSITIVE_INFINITY)return false;
  const now=new Date();
  now.setHours(0,0,0,0);
  return now.getTime()>dms;
}
/** Minutes since midnight for calendar ordering; missing time sorts last within the same scope. */
function fluxTimeSortMinutes(t){
  if(t==null||t==='')return 24*60;
  const m=String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if(!m)return 24*60;
  const h=parseInt(m[1],10),min=parseInt(m[2],10);
  if(h>23||min>59)return 24*60;
  return h*60+min;
}
/** Compact display for HTML time values (HH:MM) e.g. 3:30p */
function formatCalTimeShort(t){
  if(!t)return'';
  const m=String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if(!m)return String(t);
  let h=parseInt(m[1],10),mins=m[2];
  const ap=h>=12?'p':'a';
  const hr=h%12||12;
  return mins==='00'?`${hr}${ap}`:`${hr}:${mins}${ap}`;
}
function weeklyVirtualEventsForDate(dateStr){
  const d=fluxParseLocalYMD(dateStr);
  if(!d)return[];
  const wd=d.getDay();
  return getWeeklyRules().filter(r=>r.enabled!==false&&Array.isArray(r.weekdays)&&r.weekdays.includes(wd)).map(r=>({
    id:'w_'+r.id,
    ruleId:r.id,
    title:r.title,
    time:r.time||'',
    notes:r.notes||'',
    date:dateStr,
    scope:fluxEventScope(r),
    _weekly:true
  }));
}


// ══ STATE ══
let tasks=load('tasks',[]);
let notes=load('flux_notes',[]);
let habits=load('flux_habits',[]);
let goals=load('flux_goals',[]);
let colleges=load('flux_colleges',[]);
let moodHistory=load('flux_mood',[]);
let confidences=load('flux_conf',{});
let studyDNA=load('flux_dna',[]);
let subjectBudgets=load('flux_budgets',{});
let sessionLog=load('flux_session_log',[]);
let settings=load('flux_settings',{panic:true,quiet:true,dndStart:'07:50',dndEnd:'14:30',dailyGoalHrs:2,notifyBrowser:false,notifyDueSoon:true,classScheduleDisplay:'full'});
let schoolInfo=load('flux_school',{locker:'',combo:'',counselor:'',studentID:''});
let classes=load('flux_classes',[]);
let teacherNotes=load('flux_teacher_notes',[]);

/** Done tasks missing completedAt get a best-effort timestamp (streaks, week strip, AI actions). Safe to run often. */
function migrateCompletedAtBackfill(){
  let changed=false;
  const infer=t=>{
    if(t.updatedAt)return t.updatedAt;
    if(t.createdAt)return t.createdAt;
    if(t.date){
      const d=fluxParseLocalYMD(t.date);
      if(d){d.setHours(17,0,0,0);return d.getTime();}
    }
    if(typeof t.id==='number'&&t.id>1e12)return t.id;
    return Date.now();
  };
  tasks.forEach(t=>{
    if(!t.done||t.completedAt)return;
    t.completedAt=infer(t);
    changed=true;
  });
  if(changed){save('tasks',tasks);syncKey('tasks',tasks);}
}

// Tab config — each tab has id, icon, label, visible flag
const DEFAULT_TABS=[
  {id:'dashboard',icon:'⚡',label:'Dashboard',visible:true},
  {id:'calendar',icon:'📅',label:'Calendar',visible:true},
  {id:'ai',icon:'✦',label:'Flux AI',visible:true},
  {id:'school',icon:'🏫',label:'School Info',visible:true},
  {id:'canvas',icon:'🎓',label:'Canvas',visible:true},
  {id:'notes',icon:'📝',label:'Notes',visible:true},
  {id:'timer',icon:'⏱',label:'Focus Timer',visible:true},
  {id:'profile',icon:'👤',label:'Profile',visible:true},
  {id:'goals',icon:'🎯',label:'Extracurriculars',visible:true},
  {id:'mood',icon:'😊',label:'Mood',visible:true},
  {id:'toolbox',icon:'🧰',label:'Study tools',visible:true},
  {id:'settings',icon:'⚙',label:'Settings',visible:true},
];
let tabConfig=load('flux_tabs',DEFAULT_TABS);
tabConfig=tabConfig.filter(t=>t.id!=='gmail'&&t.id!=='periodic'&&t.id!=='references'&&t.id!=='grades'&&t.id!=='workspace');
// Ensure new tabs get added if missing
DEFAULT_TABS.forEach(dt=>{if(!tabConfig.find(t=>t.id===dt.id))tabConfig.push({...dt});});
// Legacy tab label (older builds / stored flux_tabs)
tabConfig.forEach(t=>{if(t.id==='ai'&&/flux\s*agent/i.test(String(t.label||'')))t.label='Flux AI';});
tabConfig.forEach(t=>{if(t.id==='canvas'&&/gmail/i.test(String(t.label||'')))t.label='Canvas';});
(function migrateCanvasTabOrder(){
  const si=tabConfig.findIndex(t=>t.id==='school');
  const ci=tabConfig.findIndex(t=>t.id==='canvas');
  if(si<0||ci<0)return;
  if(ci!==si+1){
    const [row]=tabConfig.splice(ci,1);
    const nsi=tabConfig.findIndex(t=>t.id==='school');
    tabConfig.splice(nsi+1,0,row);
    save('flux_tabs',tabConfig);
  }
})();
save('flux_tabs',tabConfig);

let taskFilter='active',editingId=null,editingGoalId=null;
let aiHistory=[],aiPendingImg=null;
// Canvas + Gmail — declared here so renderProfile/renderCanvasStatus can access them at init time
let canvasToken=load('flux_canvas_token','');
let canvasUrl=load('flux_canvas_url','');
let gmailEmails=[];
let gmailToken=sessionStorage.getItem('flux_gmail_token')||null;
let fluxCanvasHubData=null;
let fluxCanvasHubSubTab=load('flux_canvas_hub_tab','assignments');
let fluxCanvasDueFilterDays=load('flux_canvas_due_filter',120);
let _canvasHubSel=new Set();
/** When set, next render of the Canvas "In Flux" tab loads this assignment into the reader. */
let _fluxCanvasReaderPending=null;
let calYear=TODAY.getFullYear(),calMonth=TODAY.getMonth(),calSelected=TODAY.getDate();
let currentNoteId=null,noteFilter='all',flashcards=[],fcIndex=0,fcFlipped=false;
let breathingActive=false,breathTimer=null;
let sidebarCollapsed=load('flux_sidebar_collapsed',false);

// ══ SUPABASE + API ══
const SB_URL='https://lfigdijuqmbensebnevo.supabase.co';
const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
const API={
  ai:`${SB_URL}/functions/v1/ai-proxy`,
  gemini:`${SB_URL}/functions/v1/gemini-proxy`,
  canvas:`${SB_URL}/functions/v1/canvas-proxy`,
  ecCollegeChat:`${SB_URL}/functions/v1/ec-college-chat`,
  userFeedback:`${SB_URL}/functions/v1/user-feedback`,
};

async function fluxAuthHeaders(){
  try{
    const s=await getSB()?.auth?.getSession();
    const t=s?.data?.session?.access_token||SB_ANON;
    return{'Content-Type':'application/json','Authorization':'Bearer '+t,'apikey':SB_ANON};
  }catch(e){
    return{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON};
  }
}

/** One-shot call to the same Supabase AI proxy as chat (for reference tools, JSON extraction, etc.). */
async function fluxAiSimple(system, userMessage, opts){
  const messages=[];
  if(system)messages.push({ role:'system', content:system });
  messages.push({ role:'user', content:userMessage });
  const body={ messages };
  if(opts&&opts.responseFormat==='json_object')body.responseFormat='json_object';
  let res;
  try{
    res=await fetch(API.ai,{ method:'POST', headers:await fluxAuthHeaders(), body:JSON.stringify(body) });
  }catch(e){
    const msg=String(e&&e.message||e);
    if(/failed to fetch|networkerror|load failed/i.test(msg)){
      console.warn('[Flux AI] fetch failed', e);
      throw new Error('Could not reach Flux AI (network or browser blocked the request). Try: disable VPN/ad-block for this site, use a normal browser tab, or redeploy Supabase functions after updating CORS. Your page origin must be allowed by the ai-proxy Edge function.');
    }
    throw e;
  }
  if(!res.ok){
    const err=await res.json().catch(()=>({ error:'HTTP '+res.status }));
    throw new Error(err.error||'AI request failed');
  }
  const data=await res.json();
  return data.content?.[0]?.text||'';
}
try{ window.fluxAiSimple=fluxAiSimple; }catch(e){}
try{
  window.__FluxExtensionAPI={
    fluxAuthHeaders,
    fluxAiSimple,
    API,
    SB_ANON,
  };
}catch(e){}

let _sb=null,currentUser=null;
function getSB(){
  if(!_sb&&window.supabase?.createClient){
    _sb=window.supabase.createClient(SB_URL,SB_ANON,{
      auth:{
        detectSessionInUrl:true, // OAuth: exchange ?code= / parse hash before session exists
        persistSession:true,
        autoRefreshToken:true,
        // PKCE (default) — required for Google OAuth + ?code= callback; implicit breaks session exchange
      }
    });
  }
  return _sb;
}

async function fetchAndCacheEntitlement(){
  if(!currentUser||!FLUX_FLAGS.PAYMENTS_ENABLED)return;
  if(Date.now()-_entitlementFetchedAt<ENTITLEMENT_CACHE_MS)return;
  try{
    const session=await getSB().auth.getSession();
    const token=session?.data?.session?.access_token;
    if(!token)return;
    const res=await fetch(`${SB_URL}/functions/v1/get-entitlement`,{
      method:'GET',
      headers:{
        'Authorization':'Bearer '+token,
        'apikey':SB_ANON,
        'Content-Type':'application/json',
      },
    });
    if(!res.ok){
      console.warn('[Flux] Failed to fetch entitlement:',res.status);
      return;
    }
    _entitlement=await res.json();
    _entitlementFetchedAt=Date.now();
    updatePlanUI();
    checkTrialExpiry();
  }catch(e){
    console.warn('[Flux] Entitlement fetch error:',e);
  }
}

// ══ HELPERS ══
const G=10.0000; // Physics constant — enforced everywhere
const precise=n=>Number(n).toFixed(4);
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const strip=html=>html.replace(/<[^>]+>/g,'').slice(0,120);
const todayStr=()=>TODAY.toISOString().slice(0,10);
const fmtTime=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);const ampm=h>=12?'PM':'AM';return`${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;};

function refreshAIContext(){
  const now=new Date();now.setHours(0,0,0,0);
  const ago7=new Date(now);ago7.setDate(now.getDate()-7);
  const fwd14=new Date(now);fwd14.setDate(now.getDate()+14);
  return{recent:tasks.filter(t=>t.done&&t.date&&new Date(t.date+'T00:00:00')>=ago7),upcoming:tasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')>=now&&new Date(t.date+'T00:00:00')<=fwd14)};
}
function quietHours(){if(!settings.quiet)return false;const now=new Date(),h=now.getHours(),m=now.getMinutes(),cur=h*60+m;const[sh,sm]=(settings.dndStart||'07:50').split(':').map(Number);const[eh,em]=(settings.dndEnd||'14:30').split(':').map(Number);return cur>=sh*60+sm&&cur<=eh*60+em;}
function panicCheck(task){if(!settings.panic||quietHours())return;const now=new Date(),due=new Date((task.date||'')+'T23:59:00');if((due-now)/3600000<12&&(due-now)>0)checkAllPanic();}
function checkAllPanic(){if(!settings.panic||quietHours()){hidePanic();return;}const now=new Date(),in12=new Date(now.getTime()+12*3600000),ts=todayStr();const urgent=tasks.filter(t=>{if(!t.done&&t.date){if(t.date===ts&&typeof isBreak==='function'&&isBreak(ts))return false;const d=new Date(t.date+'T23:59:00');return d>now&&d<=in12;}return false;});if(urgent.length)showPanic(urgent);else hidePanic();}
function showPanic(list){
  const banner=document.getElementById('panicBanner');if(banner)banner.classList.add('on');
  const pp=document.getElementById('panicPill');if(pp)pp.style.display='flex';
  const title=document.getElementById('panicTitle');
  if(title)title.textContent=list.length===1?'Due in the next 12 hours':`Due in the next 12 hours (${list.length})`;
  const pl=document.getElementById('panicList');if(pl)pl.textContent=list.map(t=>t.name).join(' · ');
}
function hidePanic(){const b=document.getElementById('panicBanner');if(b)b.classList.remove('on');const pp=document.getElementById('panicPill');if(pp)pp.style.display='none';}

// ══ SPLASH ══
// runSplash() is defined in splash.js and exposed on window
// This stub ensures nothing breaks if splash.js hasn't loaded yet
if(!window.runSplash){
  window.runSplash=function(cb){
    const s=document.getElementById('splash');
    if(s)s.style.display='none';
    cb();
  };
}

// ══ LOGIN FEATURE PILLS ══

// ══ NAV ══
function updateNavAriaCurrent(tabId){
  document.querySelectorAll('.nav-item[data-tab], .bnav-item[data-tab]').forEach(b=>{
    if(b.getAttribute('data-tab')===tabId)b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
}
function nav(id,btn,navOpt){
  if(id==='references'){ id='toolbox'; }
  if(id==='flux_control'){
    const r=getMyRole();
    if(r!=='owner'&&r!=='dev'){nav('dashboard');return;}
  }
  // Check if tab is visible
  const tc=tabConfig.find(t=>t.id===id);
  if(tc&&!tc.visible){nav('dashboard');return;}
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active','flux-panel-enter'));
  if(id!=='canvas'&&typeof window.fluxCanvasCloseMobileSidebar==='function'){
    try{ window.fluxCanvasCloseMobileSidebar(); }catch(e){}
  }
  const panel=document.getElementById(id);
  if(panel){
    panel.classList.add('active','flux-panel-enter');
    setTimeout(()=>panel.classList.remove('flux-panel-enter'),560);
  }
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll(`[data-tab="${id}"]`).forEach(b=>b.classList.add('active'));
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('active'));
  const bni=document.querySelector(`.bnav-item[data-tab="${id}"]`);
  if(bni){bni.classList.add('active');}
  else{
    // Target panel isn't one of the 5 primary tabs — light up the More button
    // so the user still gets a sense of where they are in the bottom nav.
    const moreBtn=document.getElementById('moreBtn');
    if(moreBtn)moreBtn.classList.add('active');
  }
  updateNavAriaCurrent(id);
  try{document.dispatchEvent(new CustomEvent('flux-nav',{detail:{panel:id}}));}catch(e){}
  try{
    if(window.FluxVisual&&typeof FluxVisual.animateNavIndicator==='function'){
      const tabBtn=document.querySelector(`.bnav-item[data-tab="${id}"]`);
      if(tabBtn)FluxVisual.animateNavIndicator(tabBtn);
    }
  }catch(e){}
  syncPanelScrollLayout();
  const tTitle=document.getElementById('topbarTitle');
  if(tTitle){
    if(id==='flux_control')tTitle.textContent=isOwner()?'Owner control':(getMyRole()==='dev'?'Dev panel':'Control');
    else tTitle.textContent=PANEL_TITLES[id]||id;
  }
  const fns={dashboard:()=>{renderStats();renderTasks();renderCountdown();renderSmartSug();checkTimePoverty();renderWorkloadForecast();renderSubjectHealth();renderGapFiller();renderExamConflictBanner();if(window.FluxIntel){FluxIntel.refreshStreakBadge();}if(window.FluxPersonal){FluxPersonal.applyDashboardOrder();}},calendar:()=>{if(window.FluxPersonal&&FluxPersonal.applyCalendarOrder)FluxPersonal.applyCalendarOrder();loadCalScheduleUI();renderCalendar();const gcalStatusEl=document.getElementById('gcalStatus');if(gcalStatusEl&&!gcalStatusEl.innerHTML)syncGoogleCalendar();},school:()=>renderSchool(),notes:()=>renderNotesList(),goals:()=>{renderExtrasList();renderSchoolsList();renderECGoals();initEcCollegeChatSelect();renderEcChatMessages();initEcCollegeChatListeners();},mood:()=>{renderMoodHistory();renderAffirmation();loadJournalLineUI();},timer:()=>{updateTDisplay();renderTDots();updateTStats();renderSubjectBudget();renderFocusHeatmap();},profile:()=>renderProfile(),ai:()=>{renderAISugs();initAIChats();try{if(window.FluxAIConnections&&typeof FluxAIConnections.renderConnectionsPanel==='function')FluxAIConnections.renderConnectionsPanel();}catch(e){}},settings:()=>{renderNoHWList();renderTabCustomizer();renderAboutStats();loadSettingsUI();},canvas:()=>renderCanvasHubPanel(),toolbox:()=>{if(typeof window.renderToolbox==='function')window.renderToolbox();},flux_control:()=>{if(typeof renderFluxControlTab==='function')renderFluxControlTab();}};
  fns[id]?.();
  if(id==='canvas'){
    try{
      const pend=_fluxCanvasReaderPending;
      if(pend&&pend.cid&&pend.aid){
        _fluxCanvasReaderPending=null;
        requestAnimationFrame(()=>{
          const crs=document.getElementById('fluxCanvasReaderCourse');
          const asn=document.getElementById('fluxCanvasReaderAssignment');
          if(crs)crs.value=String(pend.cid);
          if(typeof fluxCanvasReaderOnCourseChange==='function')fluxCanvasReaderOnCourseChange();
          if(asn)asn.value=String(pend.aid);
          if(typeof loadCanvasAssignmentIntoReader==='function')loadCanvasAssignmentIntoReader(pend.cid,pend.aid,{});
        });
      }
    }catch(e){}
  }
  if(typeof fluxApplyCanvasSplitLayout==='function')fluxApplyCanvasSplitLayout();
  if(window.FluxPersonal&&FluxPersonal.bumpNav)FluxPersonal.bumpNav(id);
  if(window.Flux100&&typeof Flux100.onNavAfter==='function')try{Flux100.onNavAfter(id);}catch(e){}
  if(typeof window.fluxAnimeNavAfter==='function'){try{window.fluxAnimeNavAfter(id);}catch(e){}}
  try{
    const np=document.getElementById(id);
    if(np&&window.FluxAnim?.panelFlash)FluxAnim.panelFlash(np);
  }catch(e){}
}
function navMob(id,opt){closeDrawer();closeMobileSheet();nav(id,null,opt);}

// ── Mobile "More" bottom sheet ──
function openMobileSheet(){
  const ov=document.getElementById('moreSheetOverlay');
  const sh=document.getElementById('moreSheet');
  if(!ov||!sh)return;
  ov.classList.add('open');
  sh.classList.add('open');
  ov.setAttribute('aria-hidden','false');
  sh.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  try{if(window.FluxAnim?.sheetOpen)FluxAnim.sheetOpen(sh,ov);}catch(e){}
}
function closeMobileSheet(){
  const ov=document.getElementById('moreSheetOverlay');
  const sh=document.getElementById('moreSheet');
  if(!ov||!sh)return;
  const done=()=>{
    ov.classList.remove('open');
    sh.classList.remove('open');
    ov.setAttribute('aria-hidden','true');
    sh.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  };
  try{
    if(window.FluxAnim?.sheetClose)FluxAnim.sheetClose(sh,ov,done);
    else done();
  }catch(e){done();}
}
window.openMobileSheet=openMobileSheet;
window.closeMobileSheet=closeMobileSheet;
// Close sheet on Escape
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const sh=document.getElementById('moreSheet');
    if(sh&&sh.classList.contains('open'))closeMobileSheet();
  }
});
// Swipe-down to dismiss the sheet
(function(){
  let startY=0,curY=0,dragging=false;
  document.addEventListener('touchstart',e=>{
    const sh=document.getElementById('moreSheet');
    if(!sh||!sh.classList.contains('open'))return;
    if(!sh.contains(e.target))return;
    if(sh.scrollTop>0)return;
    startY=e.touches[0].clientY;dragging=true;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!dragging)return;
    curY=e.touches[0].clientY;
    const dy=curY-startY;
    const sh=document.getElementById('moreSheet');
    if(sh&&dy>0)sh.style.transform=`translateY(${dy}px)`;
  },{passive:true});
  document.addEventListener('touchend',()=>{
    if(!dragging)return;
    dragging=false;
    const sh=document.getElementById('moreSheet');
    if(!sh)return;
    const dy=curY-startY;
    sh.style.transform='';
    if(dy>90)closeMobileSheet();
  });
})();

// ══ SIDEBAR ══
// ── Populate subject dropdowns dynamically from user's classes ──
function populateSubjectSelects(){
  const subjs=getSubjects();
  const opts='<option value="">No subject</option>'+Object.entries(subjs).map(([k,s])=>`<option value="${k}">${s.name}</option>`).join('');
  ['taskSubject','editSubject','noteSubjectTag','timerSubject','addEventSubject'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    const cur=el.value;
    el.innerHTML=opts;
    if(cur)el.value=cur;
  });
}

// Stroke-matched tab icons: shared by bottom nav, sidebar, drawer, and More sheet.
// Emojis in tabConfig remain for the tab customizer and legacy data; nav uses these SVGs.
const NAV_TAB_SVGS={
  dashboard:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/></svg>`,
  calendar:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  ai:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
  /* Horizontal “more” — not a 3×3 grid (avoid clash with app tiles / periodic) */
  more:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`,
  school:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v9"/><path d="M20 10v9"/><path d="M2 20h20"/><path d="m4 10 8-3 8 3"/><path d="M9 20v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4"/></svg>`,
  notes:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>`,
  timer:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 6V3"/><path d="M9 2h6"/><path d="M12 12l3.5-2.5"/></svg>`,
  /* LMS window + envelope — Canvas + Gmail at a glance */
  canvas:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12.5" y="4" width="9" height="7" rx="1"/><path d="M12.5 6.5h9"/><path d="M17 11v2.5"/><path d="M15 16.5h4"/><path d="M2.5 9.5h8a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 1 18v-7a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="m2.5 9.5 4 3 4-3"/></svg>`,
  toolbox:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/></svg>`,
  profile:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`,
  /* People / clubs — not concentric rings (was too close to old AI look) */
  goals:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  mood:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01"/><path d="M8.2 15a4 4 0 0 0 7.6 0"/></svg>`,
  /* Sliders — distinct from Flux AI sparkles */
  settings:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 3v5"/><path d="M20 21v-5"/><path d="M20 8V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 14h4"/></svg>`,
  flux_control:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/></svg>`,
  references:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/></svg>`,
  periodic:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  gmail:`<svg class="nt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"/><path d="m22 6-10 7L2 6"/></svg>`,
};
// Bottom bar primary five (Home, Calendar, AI, Study tools, More) — alias for existing code paths.
const BNAV_ICONS={
  dashboard:NAV_TAB_SVGS.dashboard,
  calendar:NAV_TAB_SVGS.calendar,
  ai:NAV_TAB_SVGS.ai,
  study:NAV_TAB_SVGS.toolbox,
  more:NAV_TAB_SVGS.more,
};

/** Sidebar / drawer / More: SVG when defined; else emoji from tabConfig. */
function getNavIconHtml(tabId,variant){
  const svg=NAV_TAB_SVGS[tabId]||null;
  if(svg){
    const wrap=variant==='moreSheet'?'ms-svg-wrap':'ni-svg-wrap';
    return`<span class="${wrap}" aria-hidden="true">${svg}</span>`;
  }
  const tc=tabConfig.find(t=>t.id===tabId)||DEFAULT_TABS.find(t=>t.id===tabId);
  return`<span class="ni-emoji" aria-hidden="true">${esc(tc?.icon||'•')}</span>`;
}
function syncMoreSheetNavIcons(){
  document.querySelectorAll('.more-sheet-item[data-nav-tab]').forEach(btn=>{
    const id=btn.getAttribute('data-nav-tab');
    const el=btn.querySelector('.more-sheet-icon');
    if(!el)return;
    el.innerHTML=getNavIconHtml(id,'moreSheet');
  });
}

function renderSidebars(){
  const groups=[
    {label:'Main',ids:['dashboard','calendar','ai']},
    {label:'School',ids:['school','canvas','notes','timer','toolbox']},
    {label:'Me',ids:['profile','goals','mood','settings']},
  ];
  const visibleIds=new Set(tabConfig.filter(t=>t.visible).map(t=>t.id));
  // Build nav HTML for both sidebar and drawer
  const buildNav=(clickFn)=>groups.map(g=>{
    const items=g.ids.filter(id=>visibleIds.has(id)).map(id=>{
      const tc=tabConfig.find(t=>t.id===id)||DEFAULT_TABS.find(t=>t.id===id);
      const lab=esc(tc?.label||id);
      return`<button type="button" class="nav-item" onclick="${clickFn}('${id}')" data-tab="${id}" aria-label="${lab}"><span class="ni">${getNavIconHtml(id)}</span><span class="nl">${tc?.label||id}</span></button>`;
    }).join('');
    if(!items)return'';
    return`<div class="nav-group"><div class="nav-group-label">${g.label}</div>${items}</div>`;
  }).join('');

  const sidebarNav=document.querySelector('.sidebar-nav');
  if(sidebarNav)sidebarNav.innerHTML=buildNav('nav');

  const drawerNav=document.querySelector('.mob-drawer-nav');
  if(drawerNav)drawerNav.innerHTML=buildNav('navMob');

  const role=getMyRole();
  if(role==='owner'||role==='dev'){
    const lab=role==='owner'?'Owner control':'Dev panel';
    const adminGroup=`<div class="nav-group"><div class="nav-group-label">Admin</div><button type="button" class="nav-item" onclick="nav('flux_control',this)" data-tab="flux_control" aria-label="${lab}"><span class="ni">${getNavIconHtml('flux_control')}</span><span class="nl">${lab}</span></button></div>`;
    const adminGroupMob=`<div class="nav-group"><div class="nav-group-label">Admin</div><button type="button" class="nav-item" onclick="navMob('flux_control')" data-tab="flux_control" aria-label="${lab}"><span class="ni">${getNavIconHtml('flux_control')}</span><span class="nl">${lab}</span></button></div>`;
    if(sidebarNav)sidebarNav.insertAdjacentHTML('beforeend',adminGroup);
    if(drawerNav)drawerNav.insertAdjacentHTML('beforeend',adminGroupMob);
  }

  const adminSlot=document.getElementById('moreSheetAdminSlot');
  if(adminSlot){
    if(role==='owner'||role==='dev'){
      const lab=role==='owner'?'Owner control':'Dev panel';
      adminSlot.innerHTML=`<button type="button" class="more-sheet-item" data-nav-tab="flux_control" onclick="navMob('flux_control')"><span class="more-sheet-icon" aria-hidden="true">${getNavIconHtml('flux_control','moreSheet')}</span><span class="more-sheet-label">${lab}</span></button>`;
    }else{
      adminSlot.innerHTML='';
    }
  }

  // Mobile bottom nav is always the same 5 spec tabs:
  // Home · Calendar · AI · Study · More (opens bottom sheet, not drawer).
  // Keep the More button wired to openMobileSheet so it matches the spec.
  const bnav=document.querySelector('.bottom-nav');
  if(bnav){
    const tabs=[
      {id:'dashboard',label:'Home',icon:BNAV_ICONS.dashboard,extra:'<span class="bnav-dot" aria-hidden="true"></span>'},
      {id:'calendar',label:'Calendar',icon:BNAV_ICONS.calendar},
      {id:'ai',label:'Flux AI',icon:BNAV_ICONS.ai},
      {id:'toolbox',label:'Study',icon:BNAV_ICONS.study},
    ];
    bnav.innerHTML=tabs.map(t=>{
      const lab=esc(t.label);
      return`<button type="button" class="bnav-item" onclick="nav('${t.id}',this)" data-tab="${t.id}" aria-label="${lab}"><span class="bni" aria-hidden="true">${t.icon}</span><span class="bnl">${lab}</span>${t.extra||''}</button>`;
    }).join('')
      +`<button type="button" class="bnav-item" onclick="openMobileSheet()" id="moreBtn" aria-label="More"><span class="bni" aria-hidden="true">${BNAV_ICONS.more}</span><span class="bnl">More</span></button>`;
  }
  syncMoreSheetNavIcons();
}
function toggleSidebar(){
  sidebarCollapsed=!sidebarCollapsed;
  save('flux_sidebar_collapsed',sidebarCollapsed);
  const sb=document.getElementById('sidebar');
  if(sb)sb.classList.toggle('collapsed',sidebarCollapsed);
  // Update toggle button icon
  const btn=document.querySelector('.sidebar-toggle');
  if(btn)btn.textContent=sidebarCollapsed?'»':'☰';
}

// ── Sidebar resize (drag handle) ──
function initSidebarResize(){
  const handle=document.getElementById('sidebarResizeHandle');
  const sidebar=document.getElementById('sidebar');
  if(!handle||!sidebar)return;
  let dragging=false,startX=0,startW=0;
  const MIN_W=60,MAX_W=420;
  handle.addEventListener('mousedown',e=>{
    dragging=true;startX=e.clientX;startW=sidebar.offsetWidth;
    document.body.style.cursor='col-resize';document.body.style.userSelect='none';e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const w=Math.min(MAX_W,Math.max(MIN_W,startW+(e.clientX-startX)));
    sidebar.style.width=w+'px';sidebar.style.minWidth=w+'px';
    if(w<90)sidebar.classList.add('collapsed');else sidebar.classList.remove('collapsed');
    save('flux_sidebar_w',w);
  });
  document.addEventListener('mouseup',()=>{if(!dragging)return;dragging=false;document.body.style.cursor='';document.body.style.userSelect='';});
  handle.addEventListener('touchstart',e=>{dragging=true;startX=e.touches[0].clientX;startW=sidebar.offsetWidth;e.preventDefault();},{passive:false});
  document.addEventListener('touchmove',e=>{if(!dragging)return;const w=Math.min(MAX_W,Math.max(MIN_W,startW+(e.touches[0].clientX-startX)));sidebar.style.width=w+'px';sidebar.style.minWidth=w+'px';if(w<90)sidebar.classList.add('collapsed');else sidebar.classList.remove('collapsed');});
  document.addEventListener('touchend',()=>{dragging=false;});
  const savedW=load('flux_sidebar_w',null);
  if(savedW&&!sidebarCollapsed){sidebar.style.width=savedW+'px';sidebar.style.minWidth=savedW+'px';}
}

function openDrawer(){
  // Detect which side the ☰ button is on and open drawer from that side
  const btn=document.getElementById('moreBtn')||document.querySelector('.mob-menu-btn');
  const drawer=document.getElementById('mobDrawer');
  if(drawer&&btn){
    const bRect=btn.getBoundingClientRect();
    const isRight=bRect.left>window.innerWidth/2;
    drawer.classList.toggle('drawer-right',isRight);
  }
  document.getElementById('drawerOverlay').classList.add('open');
  if(drawer)drawer.classList.add('open');
}
function closeDrawer(){document.getElementById('drawerOverlay').classList.remove('open');const d=document.getElementById('mobDrawer');if(d)d.classList.remove('open');}

// ══ TASKS ══
function calcUrgency(task){const now=new Date();now.setHours(0,0,0,0);const days=task.date?Math.max(0,Math.floor((new Date(task.date+'T00:00:00')-now)/86400000)):99;const pMap={high:3,med:2,low:1};return(pMap[task.priority]||2)*(task.difficulty||3)/Math.max(days,0.5);}
function addTask(){
  const name=document.getElementById('taskName').value.trim();if(!name)return;
  const wo=(document.getElementById('taskWaitingOn')?.value||'').trim();
  const _recTypeAdd=(document.getElementById('taskRecurringType')?.value)||'none';
  const task={id:Date.now(),name,date:document.getElementById('taskDate').value,subject:document.getElementById('taskSubject').value,priority:document.getElementById('taskPriority').value,type:document.getElementById('taskType').value,estTime:parseInt(document.getElementById('taskEstTime').value)||0,difficulty:parseInt(document.getElementById('taskDifficulty').value)||3,notes:document.getElementById('taskNotes').value.trim(),subtasks:[],done:false,rescheduled:0,createdAt:Date.now(),srsEnabled:document.getElementById('taskSRS')?.checked||false,recurringType:_recTypeAdd!=='none'?_recTypeAdd:undefined,recurringWeekly:_recTypeAdd==='weekly'||!!document.getElementById('taskRecurringWeekly')?.checked,waitingOn:wo||undefined};
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_TASK_LIMITS){
    const activeTasks=tasks.filter(t=>!t.done).length;
    const maxTasks=FLUX_PLANS[_entitlement.plan]?.maxActiveTasks??Infinity;
    if(activeTasks>=maxTasks&&maxTasks!==Infinity){
      showUpgradePrompt('maxActiveTasks',`You have ${activeTasks} active tasks. Flux Pro removes task limits.`);
      return;
    }
  }
  task.urgencyScore=calcUrgency(task);tasks.unshift(task);save('tasks',tasks);if(task.subject)setTimeout(()=>injectGhostDraft(task),1500);
  if(window.Flux100&&typeof Flux100.captureLastTaskFromModal==='function')try{Flux100.captureLastTaskFromModal(task);}catch(e){}
  document.getElementById('taskName').value='';document.getElementById('taskNotes').value='';
  closeDashAddTaskModal();
  renderStats();renderTasks();renderCalendar();renderCountdown();renderSmartSug();panicCheck(task);
  syncKey('tasks',tasks);
  requestAnimationFrame(()=>{try{const ne=document.querySelector(`[data-task-id="${task.id}"]`);if(ne)window.FluxAnim?.taskEnterSingle?.(ne);}catch(e){}});
  if(typeof window.fluxGCalAutoPushTask==='function')try{window.fluxGCalAutoPushTask(task);}catch(e){}
}
function toggleTask(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  snapshotTasks();
  const wasDone=t.done;
  t.done=!wasDone;
  let card=null;
  if(t.done){
    t.completedAt=Date.now();
    card=document.querySelector(`.task-item[data-task-id="${id}"]`)||document.querySelector(`[data-task-id="${id}"]`);
    if(card){
      card.classList.add('completing');
      setTimeout(()=>{try{if(card.isConnected)card.classList.remove('completing');}catch(_){}},620);
      const chk=card.querySelector('.check');
      if(chk)spawnTaskBurstFromEl(chk);
    }
    spawnConfetti();
    addMomentum();
    if(window.FluxIntel&&FluxIntel.recordCompletionStreak)FluxIntel.recordCompletionStreak();
    // effort tracking prompt removed
    if(t.srsEnabled)setTimeout(()=>generateSRSReviews(t),800);
    showUndoSnackbar('Task completed','undoLastChange');
    setTimeout(showAutoNext,1200);
    const recType=t.recurringType||(t.recurringWeekly?'weekly':null);
    if(recType&&t.date){
      const nd=new Date(t.date+'T12:00:00');
      if(recType==='weekly')nd.setDate(nd.getDate()+7);
      else if(recType==='biweekly')nd.setDate(nd.getDate()+14);
      else if(recType==='monthly')nd.setMonth(nd.getMonth()+1);
      const labels={weekly:'Next week',biweekly:'Biweekly',monthly:'Next month'};
      const nt={id:Date.now()+Math.random(),name:t.name,date:nd.toISOString().slice(0,10),subject:t.subject||'',priority:t.priority||'med',type:t.type||'hw',estTime:t.estTime||0,difficulty:t.difficulty||3,notes:t.notes||'',subtasks:(t.subtasks||[]).map(s=>({text:s.text,done:false})),done:false,rescheduled:0,createdAt:Date.now(),recurringType:recType,recurringWeekly:recType==='weekly',waitingOn:t.waitingOn,srsEnabled:false};
      nt.urgencyScore=calcUrgency(nt);tasks.unshift(nt);showToast((labels[recType]||'Repeat')+' repeat added','info');
    }
  }
  const flush=function(){
    save('tasks',tasks);renderStats();renderTasks();renderCalendar();renderCountdown();renderSmartSug();checkAllPanic();syncKey('tasks',tasks);
  };
  let skipAnime=false;
  try{
    skipAnime=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.getAttribute('data-flux-perf')==='on';
  }catch(_){}
  if(t.done&&!wasDone&&card&&typeof window.fluxAnimeOnTaskComplete==='function'&&!skipAnime){
    window.fluxAnimeOnTaskComplete(card,flush);
  }else{
    flush();
  }
}
function deleteTask(id){snapshotTasks();tasks=tasks.filter(x=>x.id!==id);save('tasks',tasks);showUndoSnackbar('Task deleted','undoLastChange');renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();syncKey('tasks',tasks);}
function setFilter(f,el){
  if(f==='reading'||f==='snoozed')f='active';
  taskFilter=f;
  document.querySelectorAll('#filterChips .tmode-btn').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  renderTasks();
}
function toggleCompletedTasks(){
  const show=!load('flux_show_completed',false);
  save('flux_show_completed',show);
  const wrap=document.getElementById('completedTasksWrap');
  const toggle=document.querySelector('.completed-toggle');
  if(wrap)wrap.style.display=show?'':'none';
  if(toggle)toggle.classList.toggle('collapsed',!show);
}
// ── TOPBAR TASK COUNT PILL ──────────────────────────────────
function updateTopbarStats(){
  const pill=document.getElementById('topbarTaskPill');
  if(!pill)return;
  const now=new Date();now.setHours(0,0,0,0);
  const active=tasks.filter(t=>!t.done);
  const overdue=active.filter(t=>t.date&&new Date(t.date+'T00:00:00')<now);
  const today=active.filter(t=>t.date===todayStr());
  if(overdue.length){
    pill.style.display='block';
    pill.textContent=overdue.length+' overdue';
    pill.style.background='rgba(244,63,94,.15)';
    pill.style.border='1px solid rgba(244,63,94,.3)';
    pill.style.color='var(--red)';
  } else if(today.length){
    pill.style.display='block';
    pill.textContent=today.length+' due today';
    pill.style.background='rgba(251,191,36,.1)';
    pill.style.border='1px solid rgba(251,191,36,.25)';
    pill.style.color='var(--gold)';
  } else if(active.length){
    pill.style.display='block';
    pill.textContent=active.length+' tasks';
    pill.style.background='rgba(var(--accent-rgb),.1)';
    pill.style.border='1px solid rgba(var(--accent-rgb),.2)';
    pill.style.color='var(--accent)';
  } else {
    pill.style.display='block';
    pill.textContent='✓ All done';
    pill.style.background='rgba(16,217,160,.1)';
    pill.style.border='1px solid rgba(16,217,160,.25)';
    pill.style.color='var(--green)';
  }
}

// ── TOPBAR NEXT CLASS PILL ───────────────────────────────────
function updateNextClassPill(){
  const pill=document.getElementById('topbarNextClass');
  if(!pill||!classes||!classes.length)return;
  const schedMode=getClassScheduleDisplayMode();
  if(schedMode==='hidden'||schedMode==='collapsed'){pill.style.display='none';return;}
  const ab=AB_MAP[todayStr()];
  if(!ab){pill.style.display='none';return;}
  const todayClasses=classes.filter(c=>{
    if(!c.days||c.days==='')return true;
    if(c.days.includes('Mon-Fri'))return true;
    if(c.days.includes(ab+' Day'))return true;
    return false;
  }).sort((a,b)=>(a.timeStart||'').localeCompare(b.timeStart||'')||a.period-b.period);
  if(!todayClasses.length){pill.style.display='none';return;}
  const now=new Date();
  const timeStr=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const next=todayClasses.find(c=>c.timeStart&&c.timeStart>timeStr)||todayClasses[0];
  if(!next){pill.style.display='none';return;}
  const timeLabel=next.timeStart?fmtTime(next.timeStart):'P'+next.period;
  pill.style.display='block';
  pill.textContent='Next: '+next.name+' · '+timeLabel;
}

// ── SHOW TOS MODAL ───────────────────────────────────────────
function showTOS(){
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML=`<div style="background:var(--card);border:1px solid var(--border2);border-radius:20px;max-width:540px;width:100%;max-height:80vh;overflow-y:auto;padding:28px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div style="font-size:1rem;font-weight:800">Terms of Service</div>
      <button onclick="this.closest('[style]').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.2rem;padding:4px">✕</button>
    </div>
    <div style="font-size:.8rem;color:var(--muted2);line-height:1.9;font-family:'JetBrains Mono',monospace">
      <div style="font-weight:700;color:var(--text);margin-bottom:6px">Last updated: March 2026</div>
      <p>By using Flux Planner you agree to these terms. Flux is provided free of charge as a student productivity tool.</p>
      <div style="font-weight:700;color:var(--text);margin:12px 0 4px">1. Use</div>
      <p>Flux is for personal, non-commercial educational use. You may not resell, redistribute, or misuse the platform.</p>
      <div style="font-weight:700;color:var(--text);margin:12px 0 4px">2. Your Data</div>
      <p>You own your data. We sync it to Supabase for your convenience. You can delete it anytime from Settings → Data.</p>
      <div style="font-weight:700;color:var(--text);margin:12px 0 4px">3. Google Integrations</div>
      <p>Gmail and Calendar access is read-only. We never send emails, create events, or modify your Google account.</p>
      <div style="font-weight:700;color:var(--text);margin:12px 0 4px">4. AI</div>
      <p>AI responses are generated by Groq/Llama and may not always be accurate. Do not rely on AI for critical academic decisions.</p>
      <div style="font-weight:700;color:var(--text);margin:12px 0 4px">5. Limitation of Liability</div>
      <p>Flux Planner is provided as-is. The developer (Azfer Mohammed) is not liable for any data loss or academic outcomes.</p>
      <div style="font-weight:700;color:var(--text);margin:12px 0 4px">6. Contact</div>
      <p>Questions? Email azfermohammed21@gmail.com</p>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.onclick=e=>{if(e.target===m)m.remove();};
}

// ── ABOUT STATS ──────────────────────────────────────────────
function renderAboutStats(){
  const el=document.getElementById('aboutStats');
  if(!el)return;
  const totalTasks=tasks.length;
  const doneTasks=tasks.filter(t=>t.done).length;
  const totalMins=sessionLog.reduce((s,l)=>s+l.mins,0);
  const noteCount=notes.length;
  const habitCount=habits.length;
  const classCount=classes.filter(c=>c&&c.name).length;
  el.innerHTML=[
    ['📝',totalTasks,'Total Tasks'],
    ['✅',doneTasks,'Completed'],
    ['⏱',Math.round(totalMins/60)+'h','Focus Time'],
    ['📓',noteCount,'Notes'],
    ['🔥',habitCount,'Habits'],
    ['🏫',classCount,'Classes'],
  ].map(([icon,val,label])=>`
    <div style="padding:12px;background:var(--card2);border-radius:10px;border:1px solid var(--border);text-align:center">
      <div style="font-size:1.2rem;margin-bottom:4px">${icon}</div>
      <div style="font-size:1.1rem;font-weight:800;color:var(--accent)">${val}</div>
      <div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-family:'JetBrains Mono',monospace">${label}</div>
    </div>`).join('');
  if(typeof renderStorageMeter==='function')renderStorageMeter();
}

function updateDashHero(){
  const greet=document.getElementById('dashGreeting');
  if(!greet)return;
  const raw=(localStorage.getItem('flux_user_name')||'there').trim()||'there';
  const first=raw.split(/\s+/)[0];
  const h=new Date().getHours();
  const part=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  greet.textContent='';
  const grad=document.createElement('span');
  grad.className='dash-v2-greet-gradient';
  grad.textContent=`${part}, ${first}`;
  greet.appendChild(grad);
  greet.appendChild(document.createTextNode(' 👋'));
  try{
    if(!window.matchMedia||!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      grad.classList.add('dash-v2-greet-typewriter');
      setTimeout(()=>grad.classList.remove('dash-v2-greet-typewriter'),3200);
    }
  }catch(e){}
}
function spawnTaskBurstFromEl(el){
  if(!el||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const r=el.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2;
  const colors=['#00C2FF','#7C5CFF','#22FF88'];
  const n=12;
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.className='task-burst-particle';
    p.style.left=cx+'px';p.style.top=cy+'px';
    p.style.background=colors[i%colors.length];
    document.body.appendChild(p);
    const ang=(Math.PI*2*i)/n+Math.random()*.35;
    const dist=40+Math.random()*48;
    const tx=Math.cos(ang)*dist,ty=Math.sin(ang)*dist;
    p.animate(
      [{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(.35)`,opacity:0}],
      {duration:480,easing:'cubic-bezier(.22,1,.36,1)'}
    );
    setTimeout(()=>p.remove(),500);
  }
}
/** Next 7 days: estimated workload from open tasks (by due date; overdue rolled into today). */
function renderDashWeekStrip(){
  const el=document.getElementById('dashWeekStrip');if(!el)return;
  const goalMin=Math.max(30,(settings.dailyGoalHrs||2)*60);
  const days=[];
  for(let i=0;i<7;i++){
    const d=new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+i);
    days.push(d);
  }
  const weekStart=days[0].toISOString().slice(0,10);
  const estMins=t=>{
    const m=parseInt(t.estTime,10);
    return Number.isFinite(m)&&m>0?m:30;
  };
  const effectiveDue=t=>{
    if(t.done||!t.date)return null;
    return t.date<weekStart?weekStart:t.date;
  };
    const byDay=days.map(day=>{
    const ds=day.toISOString().slice(0,10);
    let mins=0,n=0;
    tasks.forEach(t=>{
      if(effectiveDue(t)!==ds)return;
      mins+=estMins(t);n++;
    });
    const rest=typeof isBreak==='function'&&isBreak(ds);
    const rk=rest&&typeof restDayKind==='function'?restDayKind(ds):null;
    return{ds,mins,n,rest,rk};
  });
  const totalMins=byDay.reduce((a,x)=>a+x.mins,0);
  const totalTasks=byDay.reduce((a,x)=>a+x.n,0);
  const maxM=Math.max(1,...byDay.map(x=>x.mins));
  const label=days.map(d=>d.toLocaleDateString('en-US',{weekday:'short'}));
  const totalLabel=totalMins>=60?`~${(totalMins/60).toFixed(1)}h est`:`~${totalMins}m est`;
  el.innerHTML=`<div class="dash-week-strip-inner dash-workload-strip-inner">
    <div class="dash-week-head"><span class="dash-week-kicker">Next 7 days</span><span class="dash-week-total">${totalLabel}${totalTasks?` · ${totalTasks} task${totalTasks===1?'':'s'}`:''}</span></div>
    <div class="dash-week-bars" role="img" aria-label="Estimated minutes per day: ${byDay.map(x=>x.mins).join(', ')}">${byDay.map((row,i)=>{
      const {mins,n,rest,rk}=row;
      const h=Math.round(Math.max(14,(mins/maxM)*40));
      const heavy=!rest&&mins>goalMin;
      const restNote=rest?` · ${rk==='sick'?'Sick day':'Lazy day'} (rest)`:'';
      const tip=`${label[i]} ${days[i].getMonth()+1}/${days[i].getDate()}: ~${mins}m${n?` (${n} task${n===1?'':'s'})`:''}${restNote}${!rest&&heavy?' — over typical day goal':''}`.replace(/"/g,'&quot;');
      const num=mins>=60?`${(mins/60).toFixed(1)}h`:`${mins}m`;
      const restBadge=rest?`<span class="dash-week-rest" title="${rk==='sick'?'Sick day':'Lazy day'}">${rk==='sick'?'🤒':'🛋'}</span>`:'';
      return`<div class="dash-week-col ${rest?'dash-week-col--rest':''}" title="${tip}">${restBadge}<div class="dash-week-bar ${heavy?'dash-week-bar--heavy':''} ${rest?'dash-week-bar--rest':''}" style="height:${h}px"></div><span class="dash-week-daylbl">${label[i].slice(0,1)}</span>${mins>0&&!rest?`<span class="dash-week-num">${num}</span>`:rest?`<span class="dash-week-num dash-week-num--muted">—</span>`:''}</div>`;
    }).join('')}</div>
    <p class="dash-week-footnote">Open tasks by due date · sick/lazy days marked · default ~30m when no estimate</p>
  </div>`;
}
/** Avg estimated minutes for completed tasks in this subject (history-based hint). */
function avgEstMinutesForSubject(subjectKey){
  if(!subjectKey)return null;
  const done=tasks.filter(t=>t.done&&t.subject===subjectKey&&(t.estTime||0)>0);
  if(done.length<2)return null;
  let avg=Math.round(done.reduce((a,t)=>a+(t.estTime||0),0)/done.length);
  if(window.FluxEstimateLearn){
    const adj=FluxEstimateLearn.suggestedEstForSubject(subjectKey,avg);
    if(typeof adj==='number'&&adj>0)avg=adj;
  }
  return avg;
}
function autoSplitEditSubtasks(){
  const title=(document.getElementById('editText')?.value||'').trim();
  const ta=document.getElementById('editSubtasks');
  if(!ta||!title){if(typeof showToast==='function')showToast('Add a task title first','warning');return;}
  let parts=title.split(/[.;]\s+/).map(s=>s.trim()).filter(Boolean);
  if(parts.length<2){
    const halves=title.split(/\s+(?:and|&|\+)\s+/i);
    if(halves.length>=2)parts=halves.map(s=>s.trim()).filter(Boolean);
  }
  if(parts.length<2){
    const words=title.split(/\s+/);
    const mid=Math.ceil(words.length/2);
    parts=[words.slice(0,mid).join(' '),words.slice(mid).join(' ')].filter(Boolean);
  }
  ta.value=parts.slice(0,12).join('\n');
  if(typeof showToast==='function')showToast('Subtasks drafted — edit lines as needed','success');
}
// ══ MOBILE DASHBOARD RENDER ═══════════════════════════════════════════
// Populates the mobile-only dashboard stack (date strip, 4 stat chips,
// Do-This-Now card, and Today's tasks list up to 5). No effect on desktop
// — the mobile stack is hidden via CSS at >=769px.
function fluxRenderDashMob(){
  const dateEl=document.getElementById('dashMobDate');
  if(!dateEl)return; // only present on new mobile scaffold
  const today=new Date();
  today.setHours(0,0,0,0);
  const todayIso=today.toISOString().slice(0,10);
  // Date strip: "Friday, Apr 24"
  try{
    dateEl.textContent=today.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  }catch(e){ dateEl.textContent=todayIso; }
  // A/B pill (if schedule data indicates today as A or B day)
  const abEl=document.getElementById('dashMobAB');
  if(abEl){
    const ab=(typeof getABDayLabel==='function')?getABDayLabel(today):'';
    if(ab&&/^[AB]/.test(ab)){ abEl.textContent=ab; abEl.style.display='inline-flex'; }
    else{ abEl.style.display='none'; }
  }
  // Stats chips
  const activeTasks=tasks.filter(t=>!t.done);
  const doneToday=tasks.filter(t=>t.done&&t.completedAt&&String(t.completedAt).slice(0,10)===todayIso).length;
  const overdue=activeTasks.filter(t=>t.date&&t.date<todayIso).length;
  const high=activeTasks.filter(t=>t.priority==='high').length;
  const setN=(id,n)=>{ const el=document.getElementById(id); if(el)el.textContent=String(n); };
  setN('dashMobStatTasks',activeTasks.length);
  setN('dashMobStatDone',doneToday);
  setN('dashMobStatOverdue',overdue);
  setN('dashMobStatHigh',high);

  // Do This Now — pick the most important actionable task
  const doNowCandidate=(()=>{
    const sorted=activeTasks.slice().sort((a,b)=>{
      const pRank={high:0,med:1,low:2};
      const pa=pRank[a.priority||'med'],pb=pRank[b.priority||'med'];
      if(pa!==pb)return pa-pb;
      const da=a.date||'9999-12-31',db=b.date||'9999-12-31';
      if(da!==db)return da<db?-1:1;
      return 0;
    });
    // prefer overdue, then due-today, then high-priority upcoming
    return sorted.find(t=>t.date&&t.date<todayIso)
        ||sorted.find(t=>t.date===todayIso)
        ||sorted.find(t=>t.priority==='high')
        ||sorted[0]
        ||null;
  })();
  const doNow=document.getElementById('dashMobDoNow');
  const doNowEmpty=document.getElementById('dashMobDoNowEmpty');
  if(doNow&&doNowEmpty){
    if(doNowCandidate){
      doNow.style.display='block';
      doNowEmpty.style.display='none';
      const t=doNowCandidate;
      const subs=(typeof getSubjects==='function')?getSubjects():{};
      const sub=t.subject?subs[t.subject]:null;
      const title=document.getElementById('dashMobDoNowTitle');
      if(title)title.textContent=t.name||'Untitled task';
      const meta=document.getElementById('dashMobDoNowMeta');
      if(meta){
        const chips=[];
        if(sub)chips.push(`<span class="mob-meta-chip" style="background:${sub.color||'rgba(255,255,255,.05)'}20;color:${sub.color||'var(--text)'};border-color:${sub.color||'rgba(255,255,255,.1)'}40">${esc(sub.short||t.subject)}</span>`);
        if(t.priority==='high')chips.push(`<span class="mob-meta-chip" style="background:rgba(255,79,94,.12);color:#ff4f5e;border-color:rgba(255,79,94,.3)">High</span>`);
        if(t.date){
          const due=new Date(t.date+'T00:00:00');
          const diffDays=Math.round((due-today)/86400000);
          let label='';
          if(diffDays<0)label=`${Math.abs(diffDays)}d overdue`;
          else if(diffDays===0)label='Due today';
          else if(diffDays===1)label='Due tomorrow';
          else label=`Due in ${diffDays}d`;
          chips.push(`<span class="mob-meta-chip">${label}</span>`);
        }
        if(t.estTime)chips.push(`<span class="mob-meta-chip">${esc(String(t.estTime))}m</span>`);
        meta.innerHTML=chips.join('');
      }
      const cta=document.getElementById('dashMobDoNowCta');
      if(cta){
        cta.onclick=()=>{
          try{ localStorage.setItem('flux_timer_subject_prefill',t.subject||''); }catch(e){}
          if(typeof nav==='function')nav('timer');
        };
      }
    } else {
      doNow.style.display='none';
      doNowEmpty.style.display='block';
    }
  }

  // Today's tasks — up to 5 compact rows
  const todayList=document.getElementById('dashMobTodayList');
  const todayCount=document.getElementById('dashMobTodayCount');
  if(todayList){
    const pRank=t=>({high:0,med:1,low:2}[t.priority||'med']??1);
    const byPriority=(a,b)=>pRank(a)-pRank(b);
    const dueFirst=activeTasks
      .filter(t=>t.date===todayStr()||isTaskOverdueDay(t))
      .sort(byPriority);
    const seen=new Set(dueFirst.map(t=>t.id));
    const rest=activeTasks.filter(t=>!seen.has(t.id)).sort((a,b)=>{
      const aUnd=!a.date,bUnd=!b.date;
      if(aUnd&&!bUnd)return-1;
      if(!aUnd&&bUnd)return 1;
      if(aUnd&&bUnd)return byPriority(a,b);
      return String(a.date).localeCompare(String(b.date));
    });
    const todaysTasks=[...dueFirst,...rest].slice(0,5);
    if(todayCount)todayCount.textContent=String(todaysTasks.length);
    if(!todaysTasks.length){
      todayList.innerHTML=`<div class="dash-mob-task-empty">No open tasks. Add one from the + button.</div>`;
    } else {
      const subs=(typeof getSubjects==='function')?getSubjects():{};
      todayList.innerHTML=todaysTasks.map(t=>{
        const sub=t.subject?subs[t.subject]:null;
        const isOverdue=isTaskOverdueDay(t);
        const pri=`priority-${t.priority||'med'}`;
        let time='';
        if(isOverdue){
          const due=new Date(t.date+'T00:00:00');
          const days=Math.round((today-due)/86400000);
          time=`${days}d late`;
        } else if(!t.date){
          time='Anytime';
        } else if(t.date>todayIso){
          const due=new Date(t.date+'T00:00:00');
          const days=Math.round((due-today)/86400000);
          time=days===1?'Tomorrow':`in ${days}d`;
        } else if(t.estTime){
          time=`${t.estTime}m`;
        } else {
          time='Today';
        }
        return `<div class="dash-mob-task ${pri}${isOverdue?' overdue':''}" data-task-id="${t.id}" onclick="event.stopPropagation();openEdit(${t.id})">
          <span class="dash-mob-task-dot" aria-hidden="true"></span>
          <span class="dash-mob-task-name">${esc(t.name||'')}</span>
          ${sub?`<span class="dash-mob-task-sub">${esc(sub.short||t.subject)}</span>`:''}
          <span class="dash-mob-task-time">${time}</span>
        </div>`;
      }).join('');
    }
  }
}

try{ window.fluxRenderDashMob=fluxRenderDashMob; }catch(e){}

function renderStats(){
  renderDashWeekStrip();
  if(typeof updateTopbarStats==='function')updateTopbarStats();
  updateDashHero();
  if(typeof updateNextClassPill==='function')updateNextClassPill();
  if(typeof renderDynamicFocus==='function')renderDynamicFocus();
  updateDocTitle();
  renderSidebarMiniStats();
  fluxRenderDashMob();
  // Belt-and-suspenders: keep the "due in 12h" banner in sync with current task state
  if(typeof checkAllPanic==='function')checkAllPanic();
}
function renderTasks(){
  const el0=document.getElementById('taskList');
  if(el0){el0.style.display='';el0.style.gridTemplateColumns='';el0.style.gap='';el0.style.alignItems='';}
  const now=new Date();now.setHours(0,0,0,0);
  let list=[...tasks];
  if(taskFilter==='active')list=list.filter(t=>!t.done);
  if(taskFilter==='done')list=list.filter(t=>t.done);
  if(taskFilter==='overdue')list=list.filter(t=>isTaskOverdueDay(t));
  if(taskFilter==='today')list=list.filter(t=>t.date&&t.date===todayStr());
  if(taskFilter==='high')list=list.filter(t=>!t.done&&t.priority==='high');
  if(taskFilter==='active'){
    list.sort((a,b)=>{
      const d=fluxTaskDueDateMs(a)-fluxTaskDueDateMs(b);
      if(d!==0)return d;
      return (a.id||0)-(b.id||0);
    });
  }else{
  const energy=parseInt(localStorage.getItem('flux_energy')||'3');
  let moodStress=5;
  try{const mh=moodHistory&&moodHistory.length?moodHistory[moodHistory.length-1]:null;if(mh&&mh.stress!=null)moodStress=parseInt(mh.stress,10);}catch(e){}
  list.sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    if(fluxScopeSortKey(a)!==fluxScopeSortKey(b))return fluxScopeSortKey(a)-fluxScopeSortKey(b);
    if(energy<=2){const da=(a.difficulty||3),db=(b.difficulty||3);if(da!==db)return da-db;}
    else if(energy>=4){const heavy=['project','essay','lab'];const ha=heavy.includes(a.type||'')?0:1,hb=heavy.includes(b.type||'')?0:1;if(ha!==hb)return ha-hb;}
    if(moodStress>=8){const da=(a.difficulty||3),db=(b.difficulty||3);if(da!==db)return da-db;}
    if((b.urgencyScore||0)!==(a.urgencyScore||0))return(b.urgencyScore||0)-(a.urgencyScore||0);
    const da=window.FluxPersonal&&FluxPersonal.dnaFit?FluxPersonal.dnaFit(a):0,db=window.FluxPersonal&&FluxPersonal.dnaFit?FluxPersonal.dnaFit(b):0;
    if(db!==da)return db-da;
    if(a.date&&b.date)return new Date(a.date)-new Date(b.date);
    return 0;
  });
  }
  const el=document.getElementById('taskList');
  updateDocTitle();
  if(!list.length){
    const msgs={active:"You're free — want to plan your day or add one task?",done:'No completed tasks yet',overdue:'No overdue tasks',today:'Nothing due today',high:'No high-priority tasks',all:'No tasks yet — press T to quick add'};
    const icons={active:'✓',done:'🎉',overdue:'⏰',today:'📋',high:'🔥',all:'✦'};
    el.innerHTML=`<div class="empty flux-empty-smart flux-empty-animated"><div class="empty-icon flux-empty-bounce">${icons[taskFilter]||icons.all}</div><div class="empty-title">${msgs[taskFilter]||msgs.all}</div><div class="empty-sub">Use the <span class="kbd-hint">+</span> menu or <span class="kbd-hint">T</span> quick add · <span class="kbd-hint">⌘⇧K</span> search · <span class="kbd-hint">⌘K</span> palette</div></div>`;
    requestAnimationFrame(()=>{try{const em=el.querySelector('.empty');if(em)window.FluxAnim?.emptyStateIn?.(em);}catch(e){}});
    return;
  }
  const tm={hw:{l:'HW',c:'var(--muted)'},test:{l:'Test',c:'var(--red)'},quiz:{l:'Quiz',c:'var(--gold)'},project:{l:'Project',c:'var(--purple)'},essay:{l:'Essay',c:'var(--blue)'},lab:{l:'Lab',c:'var(--green)'},reading:{l:'Reading',c:'var(--blue)'},other:{l:'Other',c:'var(--muted)'}};
  const todayS=todayStr();
  const active=list.filter(t=>!t.done);
  const done=list.filter(t=>t.done);
  const renderCard=t=>{
    const sub=getSubjects()[t.subject];
    const isOver=isTaskOverdueDay(t);
    const isToday=t.date&&t.date===todayS&&!t.done;
    const isNP=t.date&&isBreak(t.date);
    const restEmoji=isNP?(restDayKind(t.date)==='sick'?'🤒':'🛋'):'';
    const ds=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
    const ti=tm[t.type]||tm.other;
    const priClass=t.priority==='high'?'priority-high':t.priority==='med'?'priority-med':'priority-low';
    const procras=(t.rescheduled||0)>=3?`<div class="procras-flag">Rescheduled ${t.rescheduled}×</div>`:'';
    const _frTier=(window.FluxBehavior&&typeof window.FluxBehavior.frictionTier==='function')?window.FluxBehavior.frictionTier(t):((t.rescheduled||0)>=5?'severe':(t.rescheduled||0)>=3?'aged':(t.rescheduled||0)>=1?'warning':'none');
    const frictionCls=_frTier==='none'?'':' friction-'+_frTier;
    const recoveryCls=(!t.done&&(t.priority==='high'||t.type==='exam'||t.type==='test'||((t.estTime||0)>0&&(t.estTime||0)<=15)))?'':' recovery-hidden';
    const stPct=t.subtasks?.length?Math.round(t.subtasks.filter(s=>s.done).length/t.subtasks.length*100):-1;
    const stBar=stPct>=0?`<div class="task-prog"><div class="task-prog-fill" style="width:${stPct}%"></div></div>`:'';
    const blocked=typeof isBlocked==='function'&&isBlocked(t);
    const depBadge=typeof renderDepBadge==='function'?renderDepBadge(t):'';
    const blockedStyle=blocked?'opacity:.45;pointer-events:auto':'';
    const priChip=t.priority?`<span class="task-chip task-chip-priority ${t.priority}">${t.priority}</span>`:'';
    const extraCls=(isOver?' task-overdue':'')+(isToday?' due-today':'');
    const sch=fluxEventScope(t)==='school';
    const histEst=!t.done&&t.subject?avgEstMinutesForSubject(t.subject):null;
    const estHist=histEst?`<span class="task-chip task-chip-hint" title="Typical time for completed work in this subject">~${histEst}m avg</span>`:'';
    const bulk=_taskBulkMode&&!t.done?`<input type="checkbox" class="task-bulk-cb" aria-label="Select" ${_bulkIds.has(t.id)?'checked':''} onclick="event.stopPropagation();toggleBulkOne(${t.id},this.checked)"/>`:'';
    const waitChip=t.waitingOn?`<span class="task-chip" title="Waiting on">⏳ ${esc(t.waitingOn)}</span>`:'';
    const recChip=t.recurringWeekly?`<span class="task-chip task-chip-recurring" title="Repeats weekly when completed">🔁 Weekly</span>`:'';
    const snz='';
    return`<div class="task-item ${priClass}${extraCls}${frictionCls}${recoveryCls} ${t.done?'task-done':''}" data-task-id="${t.id}" data-priority="${t.priority||'med'}" draggable="${!_taskBulkMode}" style="${blockedStyle}">
${bulk}
<div class="check ${t.done?'done':''}" onclick="${blocked?'showToast(\'Complete blockers first\',\'warning\');return':'toggleTask('+t.id+')'}">${t.done?'✓':blocked?'🔒':''}</div>
<div class="task-body">
<div class="task-text task-primary-line ${t.done?'done':''}">${esc(t.name)}${t.canvasAssignmentId?'<span class="task-canvas-badge" title="From Canvas">🎓</span>':''} ${depBadge}</div>
<div class="task-tags task-meta-line">
${sub?`<span class="task-chip task-chip-subject">${sub.short}</span>`:''}
${priChip}
${ds?`<span class="task-chip task-chip-due ${isOver?'overdue':''}${isToday?' due-today':''}" onclick="event.stopPropagation();openInlineDatePicker(${t.id},this)" title="Click to change date" style="cursor:pointer">${ds}${isNP?' '+restEmoji:''}</span>`:`<span class="task-chip task-chip-nodate" onclick="event.stopPropagation();openInlineDatePicker(${t.id},this)" title="Add due date" style="cursor:pointer;opacity:.42">+ date</span>`}
${t.estTime?`<span class="task-chip task-chip-time">${t.estTime}m</span>`:''}${estHist}
${waitChip}${recChip}${snz}
${(t.fluxTags||[]).length?(t.fluxTags||[]).map(tg=>`<span class="task-chip" style="background:rgba(var(--purple-rgb),.1);border-color:rgba(var(--purple-rgb),.22);font-size:.6rem">${esc(tg)}</span>`).join(''):''}
<span class="task-chip" style="background:rgba(255,255,255,.02);color:var(--muted);border:1px solid rgba(255,255,255,.04)">${ti.l}</span>
</div>
${stBar}${procras}
</div>
<div class="task-actions">
<button type="button" class="scope-pill mini ${sch?'scope-pill-school':'scope-pill-out'}" onclick="event.stopPropagation();toggleTaskScope(${t.id})" title="School vs outside">${sch?'🏫':'🌐'}</button>
${!t.done&&!_taskBulkMode?`<button type="button" class="task-action-btn" onclick="event.stopPropagation();startTimerFromTask(${t.id})" title="Start focus timer">⏱</button>`:''}
${!t.done&&t.date&&!_taskBulkMode?`<button type="button" class="task-action-btn task-action-btn--gcal" onclick="event.stopPropagation();window.fluxPushTaskToGCal&&fluxPushTaskToGCal(${t.id})" title="Push to Google Calendar" aria-label="Push to Google Calendar">📅</button>`:''}
<button class="task-action-btn" onclick="openEdit(${t.id})" title="Edit">✎</button>
<button class="task-action-btn task-action-btn--ai" onclick="event.stopPropagation();askFluxAIAboutTask(${t.id})" title="Ask Flux AI about this task" style="color:var(--accent);font-size:.72rem;letter-spacing:-.01em;padding:0 7px">✦</button>
<button class="task-action-btn" onclick="deleteTask(${t.id})" title="Delete">✕</button>
</div>
</div>`;
  };
  let html=active.map(renderCard).join('');
  if(done.length){
    const showDone=load('flux_show_completed',false);
    html+=`<div class="completed-toggle ${showDone?'':'collapsed'}" onclick="toggleCompletedTasks()">
      <span class="completed-toggle-label">Completed</span>
      <span class="completed-toggle-count">${done.length}</span>
      <span class="completed-toggle-chevron">▾</span>
    </div>`;
    html+=`<div id="completedTasksWrap" style="${showDone?'':'display:none'}">${done.map(renderCard).join('')}</div>`;
  }
  el.innerHTML=html;
  requestAnimationFrame(()=>{
    try{
      const items=[...el.querySelectorAll('.task-item')];
      if(items.length&&window.FluxAnim?.tasksEnter)FluxAnim.tasksEnter(items);
    }catch(e){}
  });
  if(typeof fluxAfterRenderTasks==='function')fluxAfterRenderTasks();
  if(typeof fluxRenderDashMob==='function')fluxRenderDashMob();
}
function renderSmartSug(){}
function openDashAddTaskModal(){
  const m=document.getElementById('dashAddTaskModal');
  if(!m)return;
  populateSubjectSelects();
  m.style.display='flex';
  const card=m.querySelector('.modal-card');
  try{if(window.FluxAnim?.modalOpen)FluxAnim.modalOpen(m,card||m);}catch(e){}
  setTimeout(()=>document.getElementById('taskName')?.focus(),80);
}
function closeDashAddTaskModal(){
  const m=document.getElementById('dashAddTaskModal');
  if(!m)return;
  const card=m.querySelector('.modal-card');
  const hide=()=>{m.style.display='none';};
  try{
    if(window.FluxAnim?.modalClose)FluxAnim.modalClose(m,card||m,hide);
    else hide();
  }catch(e){hide();}
  const w=document.getElementById('taskWaitingOn');if(w)w.value='';
  const rw=document.getElementById('taskRecurringWeekly');if(rw)rw.checked=false;
}
function renderCountdown(){const now=new Date();now.setHours(0,0,0,0);const next=tasks.filter(t=>!t.done&&(t.type==='test'||t.type==='quiz')&&t.date&&new Date(t.date+'T00:00:00')>=now).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];const card=document.getElementById('countdownCard');if(!next){card.style.display='none';return;}card.style.display='block';const diff=Math.max(0,Math.floor((new Date(next.date+'T00:00:00')-now)/86400000));const sub=getSubjects()[next.subject];const statusC=diff<=2?'var(--red)':diff<=5?'var(--gold)':'var(--green)';document.getElementById('countdownLabel').textContent=next.name+(sub?' · '+sub.short:'');document.getElementById('countdownGrid').innerHTML=[[diff,'Days','var(--accent)'],[Math.floor(diff/7),'Weeks','var(--accent)'],[new Date(next.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}),'Date','var(--accent)'],[diff<=2?'SOON ⚠':diff<=5?'NEAR':'OK ✓','Status',statusC]].map(([n,l,c])=>`<div style="background:var(--card2);border-radius:10px;padding:10px 6px;text-align:center"><div style="font-size:1.2rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${c}">${n}</div><div style="font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:3px">${l}</div></div>`).join('');}
function setEnergy(v){localStorage.setItem('flux_energy',v);const emojis=['','😴','😕','😐','😊','🚀'];const labels=['','Very Low','Low','Neutral','Good','Peak'];const el=document.getElementById('energyEmoji');if(el)el.textContent=emojis[v];const lb=document.getElementById('energyLabel');if(lb)lb.textContent=labels[v];renderSmartSug();}
function openEdit(id){const t=tasks.find(x=>x.id===id);if(!t)return;editingId=id;document.getElementById('editText').value=t.name;document.getElementById('editSubject').value=t.subject||'';document.getElementById('editPriority').value=t.priority||'med';document.getElementById('editType').value=t.type||'hw';document.getElementById('editDue').value=t.date||'';document.getElementById('editEstTime').value=t.estTime||'';document.getElementById('editDifficulty').value=t.difficulty||3;document.getElementById('editSubtasks').value=(t.subtasks||[]).map(s=>s.text).join('\n');document.getElementById('editNotes').value=t.notes||'';const er=document.getElementById('editRecurringWeekly');if(er)er.checked=!!t.recurringWeekly;const ert=document.getElementById('editRecurringType');if(ert)ert.value=t.recurringType||(t.recurringWeekly?'weekly':'none');const ew=document.getElementById('editWaitingOn');if(ew)ew.value=t.waitingOn||'';
  const depEl=document.getElementById('editDeps');
  if(depEl){
    const current=(t.blockedBy||[]).map(bid=>tasks.find(x=>x.id===bid)).filter(Boolean);
    const currentHtml=current.map(b=>`<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.15);border-radius:6px;margin-bottom:3px;font-size:.78rem"><span style="flex:1">${b.done?'✓ ':'🔒 '}${esc(b.name)}</span><button onclick="removeDependency(${id},${b.id});openEdit(${id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:0;transform:none;box-shadow:none">✕</button></div>`).join('');
    depEl.innerHTML=(currentHtml||'<div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">No dependencies</div>')+'<details style="margin-top:6px"><summary style="font-size:.72rem;color:var(--accent);cursor:pointer;font-weight:600">+ Add dependency</summary><div style="margin-top:6px">'+renderDepSelector(id)+'</div></details>';
  }
  document.getElementById('editModal').style.display='flex';
  try{
    const em=document.getElementById('editModal');
    const c=em?.querySelector('.modal-card');
    if(em&&window.FluxAnim?.modalOpen)FluxAnim.modalOpen(em,c||em);
  }catch(e){}
}
function closeEdit(){
  const m=document.getElementById('editModal');
  if(!m){editingId=null;return;}
  const card=m.querySelector('.modal-card');
  const hide=()=>{m.style.display='none';editingId=null;};
  try{
    if(window.FluxAnim?.modalClose)FluxAnim.modalClose(m,card||m,hide);
    else hide();
  }catch(e){hide();}
}
function completeAllSubtasksInEdit(){
  const t=tasks.find(x=>x.id===editingId);if(!t)return;
  const lines=document.getElementById('editSubtasks').value.split('\n').map(s=>s.trim()).filter(Boolean);
  t.subtasks=lines.map(s=>({text:s,done:true}));
  document.getElementById('editSubtasks').value=lines.join('\n');
  showToast('All subtasks marked complete','success');
}
function saveEdit(){const t=tasks.find(x=>x.id===editingId);if(!t)return;const oldDate=t.date;t.name=document.getElementById('editText').value.trim()||t.name;t.subject=document.getElementById('editSubject').value;t.priority=document.getElementById('editPriority').value;t.type=document.getElementById('editType').value;t.date=document.getElementById('editDue').value;t.estTime=parseInt(document.getElementById('editEstTime').value)||0;t.difficulty=parseInt(document.getElementById('editDifficulty').value)||3;t.notes=document.getElementById('editNotes').value.trim();const _recTypeEdit=(document.getElementById('editRecurringType')?.value)||'none';t.recurringType=_recTypeEdit!=='none'?_recTypeEdit:undefined;t.recurringWeekly=_recTypeEdit==='weekly'||!!document.getElementById('editRecurringWeekly')?.checked;const wo=(document.getElementById('editWaitingOn')?.value||'').trim();t.waitingOn=wo||undefined;const stLines=document.getElementById('editSubtasks').value.split('\n').map(s=>s.trim()).filter(Boolean);t.subtasks=stLines.map((s,i)=>({text:s,done:t.subtasks?.[i]?.done||false}));if(oldDate&&t.date!==oldDate)t.rescheduled=(t.rescheduled||0)+1;t.urgencyScore=calcUrgency(t);save('tasks',tasks);closeEdit();renderStats();renderTasks();renderCalendar();renderCountdown();syncKey('tasks',tasks);setTimeout(()=>checkFrictionIntervention(t),500);}
function spawnConfetti(){const colors=['#00C2FF','#7C5CFF','#22FF88','#4ddbff','#fbbf24','#a78bfa'];for(let i=0;i<22;i++){const p=document.createElement('div');p.className='confetti-piece';p.style.left=Math.random()*100+'vw';p.style.animationDelay=Math.random()*.5+'s';p.style.background=colors[Math.floor(Math.random()*colors.length)];document.body.appendChild(p);setTimeout(()=>p.remove(),1500);}}

// ══ CALENDAR ══
function changeMonth(d){
  const grid=document.getElementById('calGrid');
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate=grid&&!reduced&&window.innerWidth<=900;
  const outCls=d>0?'cal-grid-slide-out-l':'cal-grid-slide-out-r';
  const inCls=d>0?'cal-grid-slide-in-l':'cal-grid-slide-in-r';
  const apply=()=>{
    calMonth+=d;
    if(calMonth>11){calMonth=0;calYear++;}
    if(calMonth<0){calMonth=11;calYear--;}
    renderCalendar();
    const gdd=document.getElementById('calGlassDropdown');
    if(gdd&&!gdd.hidden&&typeof renderCalGlassDropdown==='function')renderCalGlassDropdown();
    if(animate){
      const g=document.getElementById('calGrid');
      if(g){
        g.classList.remove('cal-grid-slide-out-l','cal-grid-slide-out-r');
        g.classList.add(inCls);
        setTimeout(()=>g.classList.remove(inCls),300);
      }
    }
  };
  if(animate){
    grid.classList.add(outCls);
    setTimeout(apply,200);
  } else {
    apply();
  }
}
function selectDay(d){calSelected=d;renderCalendar();document.getElementById('calAddBtn').style.display='inline-flex';}

// ── Calendar glass date picker (month title dropdown; task-focused) ──
let calGlassMode='month';
function calGlassOpenTasksOn(y,m,d){
  const ds=fluxLocalYMD(new Date(y,m,d));
  return tasks.filter(t=>t.date===ds&&!t.done).length;
}
function toggleCalGlassDropdown(ev){
  if(ev&&typeof ev.stopPropagation==='function')ev.stopPropagation();
  const dd=document.getElementById('calGlassDropdown');
  const btn=document.getElementById('calMonthOpenBtn');
  if(!dd||!btn)return;
  if(!dd.hidden){closeCalGlassDropdown();return;}
  dd.hidden=false;
  btn.setAttribute('aria-expanded','true');
  renderCalGlassDropdown();
  setTimeout(()=>{document.addEventListener('click',calGlassOutsideClose,true);},0);
}
function closeCalGlassDropdown(){
  const dd=document.getElementById('calGlassDropdown');
  const btn=document.getElementById('calMonthOpenBtn');
  if(dd)dd.hidden=true;
  if(btn)btn.setAttribute('aria-expanded','false');
  document.removeEventListener('click',calGlassOutsideClose,true);
}
function calGlassOutsideClose(e){
  const dd=document.getElementById('calGlassDropdown');
  const btn=document.getElementById('calMonthOpenBtn');
  if(!dd||dd.hidden)return;
  if(dd.contains(e.target)||btn&&btn.contains(e.target))return;
  closeCalGlassDropdown();
}
function calGlassSetMode(mode){
  calGlassMode=mode==='week'?'week':'month';
  renderCalGlassDropdown();
}
function calGlassScrollToSchedule(){
  closeCalGlassDropdown();
  const el=document.querySelector('[data-flux-cal-section="schedule"]');
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}
function calGlassSelectDay(d){
  selectDay(d);
  closeCalGlassDropdown();
}
function calGlassSelectDayFromDate(y,ma,d){
  calYear=y;calMonth=ma;calSelected=d;
  renderCalendar();
  closeCalGlassDropdown();
}
function calGlassNoteQuick(){
  const ds=fluxLocalYMD(new Date(calYear,calMonth,calSelected));
  closeCalGlassDropdown();
  nav('notes');
  if(typeof showToast==='function')showToast('Notes — capture something for '+ds,'info');
}
function renderCalGlassDropdown(){
  const dd=document.getElementById('calGlassDropdown');
  if(!dd||dd.hidden)return;
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now=new Date();now.setHours(0,0,0,0);
  const y=calYear,m=calMonth;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const selStr=fluxLocalYMD(new Date(calYear,calMonth,calSelected));
  let daysHtml='';
  if(calGlassMode==='month'){
    for(let d=1;d<=daysInMonth;d++){
      const dt=new Date(y,m,d);
      const isToday=dt.getTime()===now.getTime();
      const isSel=fluxLocalYMD(dt)===selStr;
      const wk=dt.toLocaleDateString('en-US',{weekday:'short'}).charAt(0);
      const cnt=calGlassOpenTasksOn(y,m,d);
      daysHtml+=`<button type="button" class="flux-cal-glass-day${isSel?' is-selected':''}${isToday?' is-today':''}" onclick="calGlassSelectDay(${d})" aria-pressed="${isSel?'true':'false'}" aria-label="${months[m]} ${d}, ${cnt} open tasks">
        <span class="flux-cal-glass-dow">${wk}</span>
        <span class="flux-cal-glass-dn">${cnt>0?`<span class="flux-cal-glass-task-dot" aria-hidden="true"></span>`:''}${d}</span>
      </button>`;
    }
  }else{
    const ref=new Date(y,m,calSelected);
    const dow=ref.getDay();
    const start=new Date(ref);
    start.setDate(ref.getDate()-dow);
    for(let i=0;i<7;i++){
      const dt=new Date(start);
      dt.setDate(start.getDate()+i);
      const dy=dt.getDate(),dm=dt.getMonth(),dyy=dt.getFullYear();
      const isToday=dt.getTime()===now.getTime();
      const isSel=fluxLocalYMD(dt)===selStr;
      const wk=dt.toLocaleDateString('en-US',{weekday:'short'}).charAt(0);
      const cnt=calGlassOpenTasksOn(dyy,dm,dy);
      daysHtml+=`<button type="button" class="flux-cal-glass-day${isSel?' is-selected':''}${isToday?' is-today':''}" onclick="calGlassSelectDayFromDate(${dyy},${dm},${dy})" aria-pressed="${isSel?'true':'false'}">
        <span class="flux-cal-glass-dow">${wk}</span>
        <span class="flux-cal-glass-dn">${cnt>0?`<span class="flux-cal-glass-task-dot" aria-hidden="true"></span>`:''}${dy}</span>
      </button>`;
    }
  }
  const selDs=selStr;
  const openTasks=tasks.filter(t=>t.date===selDs&&!t.done).length;
  const evList=load('flux_events',[]);
  const dayEv=(Array.isArray(evList)?evList:[]).filter(e=>e.date===selDs).length;
  let summary=`${openTasks} open task${openTasks===1?'':'s'}`;
  if(dayEv)summary+=` · ${dayEv} event${dayEv===1?'':'s'}`;
  summary+=` · <strong>${selDs}</strong>`;
  dd.innerHTML=`
    <div class="flux-cal-glass-inner">
      <div class="flux-cal-glass-top">
        <div class="flux-cal-glass-tabs" role="tablist">
          <button type="button" role="tab" class="${calGlassMode==='week'?'on':''}" onclick="calGlassSetMode('week')">Weekly</button>
          <button type="button" role="tab" class="${calGlassMode==='month'?'on':''}" onclick="calGlassSetMode('month')">Monthly</button>
        </div>
        <button type="button" class="flux-cal-glass-iconbtn" onclick="calGlassScrollToSchedule()" title="Cycle &amp; weekly schedule">⚙</button>
      </div>
      <div class="flux-cal-glass-monthrow">
        <span class="flux-cal-glass-monthtitle">${months[m]} ${y}</span>
        <div class="flux-cal-glass-chevrow">
          <button type="button" aria-label="Previous month" onclick="changeMonth(-1)">‹</button>
          <button type="button" aria-label="Next month" onclick="changeMonth(1)">›</button>
        </div>
      </div>
      <div class="flux-cal-glass-scroll"><div class="flux-cal-glass-scroll-inner">${daysHtml}</div></div>
      <div class="flux-cal-glass-divider" aria-hidden="true"></div>
      <div class="flux-cal-glass-footer">
        <div class="flux-cal-glass-taskline" role="status">${summary}</div>
        <div class="flux-cal-glass-actions">
          <button type="button" class="flux-cal-glass-notehit" onclick="calGlassNoteQuick()">✎ Add a note…</button>
          <button type="button" class="flux-cal-glass-btn-task" onclick="closeCalGlassDropdown();openAddForDate();">＋ Task</button>
          <button type="button" class="flux-cal-glass-btn-ev" onclick="closeCalGlassDropdown();setAddEventType('event');openAddEventModal();">＋ Event</button>
        </div>
      </div>
    </div>`;
}
document.addEventListener('keydown',e=>{
  const dd=document.getElementById('calGlassDropdown');
  if(dd&&!dd.hidden&&e.key==='Escape'){e.preventDefault();closeCalGlassDropdown();}
});

function openAddForDate(){
  const dateStr=new Date(calYear,calMonth,calSelected).toISOString().slice(0,10);
  // Show inline add-task modal in calendar instead of navigating away
  showCalAddModal(dateStr);
}
function showCalAddModal(dateStr){
  const existing=document.getElementById('calAddModal');if(existing)existing.remove();
  const m=document.createElement('div');
  m.id='calAddModal';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)';
  m.innerHTML=`<div style="background:var(--card);border:1px solid var(--border2);border-radius:20px 20px 0 0;width:100%;max-width:560px;padding:24px;animation:slideUp .2s ease">
    <div style="font-size:1rem;font-weight:700;margin-bottom:14px">+ Task for ${new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</div>
    <input type="text" id="calModalName" placeholder="Task name..." style="width:100%;margin-bottom:10px" autofocus>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <select id="calModalSubject" style="margin:0"><option value="">No subject</option>${Object.entries(getSubjects()).map(([k,s])=>`<option value="${k}">${s.name}</option>`).join('')}</select>
      <select id="calModalPriority" style="margin:0"><option value="high">High Priority</option><option value="med" selected>Medium</option><option value="low">Low</option></select>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('calAddModal').remove()" class="btn-sec" style="flex:1">Cancel</button>
      <button onclick="submitCalTask('${dateStr}')" style="flex:1">+ Add Task</button>
    </div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(()=>document.getElementById('calModalName')?.focus(),100);
}
function submitCalTask(dateStr){
  const name=document.getElementById('calModalName')?.value.trim();
  if(!name)return;
  const task={id:Date.now(),name,date:dateStr,subject:document.getElementById('calModalSubject')?.value||'',priority:document.getElementById('calModalPriority')?.value||'med',type:'hw',estTime:0,difficulty:3,notes:'',subtasks:[],done:false,rescheduled:0,createdAt:Date.now(),scope:'school'};
  task.urgencyScore=calcUrgency(task);
  tasks.unshift(task);save('tasks',tasks);
  document.getElementById('calAddModal')?.remove();
  renderCalendar();renderStats();renderCountdown();
  syncKey('tasks',tasks);
  showToast('✓ Task added');
}
let _fluxCalRenderBusy=false;
function renderCalendar(){
  if(_fluxCalRenderBusy)return;
  _fluxCalRenderBusy=true;
  try{
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent=months[calMonth]+' '+calYear;
  const first=new Date(calYear,calMonth,1).getDay(),days=new Date(calYear,calMonth+1,0).getDate(),prevDays=new Date(calYear,calMonth,0).getDate();
  const now=new Date();now.setHours(0,0,0,0);
  const tMap={};tasks.filter(t=>t.date).forEach(t=>{const d=new Date(t.date+'T00:00:00');if(d.getFullYear()===calYear&&d.getMonth()===calMonth){const k=d.getDate();if(!tMap[k])tMap[k]=[];tMap[k].push(t);}});
  const evMap={};
  (load('flux_events',[])).filter(e=>e.date).forEach(e=>{
    const d=new Date(e.date+'T12:00:00');
    if(d.getFullYear()===calYear&&d.getMonth()===calMonth){const k=d.getDate();if(!evMap[k])evMap[k]=[];evMap[k].push(e);}
  });
  for(let d=1;d<=days;d++){
    const ds=fluxLocalYMD(new Date(calYear,calMonth,d));
    const wk=weeklyVirtualEventsForDate(ds);
    if(wk.length){if(!evMap[d])evMap[d]=[];evMap[d].push(...wk);}
  }
  let html=['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=first-1;i>=0;i--)html+=`<div class="cal-day other"><div class="cal-dn">${prevDays-i}</div></div>`;
  for(let d=1;d<=days;d++){const dt=new Date(calYear,calMonth,d),ds=fluxLocalYMD(dt);const isToday=dt.getTime()===now.getTime(),isNP=isBreak(ds),rk=isNP?restDayKind(ds)||'lazy':null,ab=getCycleDayLabel(ds);const rawT=tMap[d]||[],rawE=evMap[d]||[];const tlist=[...rawT].sort((a,b)=>fluxScopeSortKey(a)-fluxScopeSortKey(b)||fluxTimeSortMinutes(a.time)-fluxTimeSortMinutes(b.time));const elist=[...rawE].sort((a,b)=>fluxScopeSortKey(a)-fluxScopeSortKey(b)||fluxTimeSortMinutes(a.time)-fluxTimeSortMinutes(b.time));// Task bars — school items first
const taskBars=tlist.slice(0,3).map(t=>{const s=getSubjects()[t.subject];const c=s?s.color:'var(--accent)';const out=fluxEventScope(t)==='outside';const tm=t.time?formatCalTimeShort(t.time):'';const lab=tm?`${esc(t.name)} · ${esc(tm)}`:esc(t.name);return`<div class="cal-task-bar" style="background:${c}22;border-left:2px solid ${c};opacity:${out?0.75:(t.done?0.5:1)};text-decoration:${t.done?'line-through':'none'}">${lab}</div>`;}).join('');
const eventBars=elist.slice(0,2).map(e=>{const out=fluxEventScope(e)==='outside';const wk=e._weekly;const bg=wk?(out?'rgba(148,163,184,.1)':'rgba(0,194,255,.12)'):(out?'rgba(148,163,184,.12)':'rgba(192,132,252,.15)');const br=wk?(out?'var(--border2)':'var(--accent)'):(out?'var(--muted2)':'var(--purple)');const tm=e.time?formatCalTimeShort(e.time):'';const title=e.title||'Event';const lab=tm?`${esc(title)} · ${esc(tm)}`:esc(title);return`<div class="cal-task-bar" style="background:${bg};border-left:2px solid ${br}">${lab}</div>`;}).join('');
const allCount=tlist.length+elist.length;const dots=taskBars+eventBars;const abCol=ab==='A'?'var(--accent)':ab==='B'?'var(--green)':ab?'var(--gold)':'var(--muted)';const abLabel=ab?`<div style="font-size:${ab.length>2?'.4rem':'.45rem'};font-family:'JetBrains Mono',monospace;color:${abCol};line-height:1;margin-top:1px;max-width:100%;text-overflow:ellipsis;overflow:hidden">${esc(ab)}</div>`:'';const overFlag=tlist.some(t=>!t.done&&new Date(t.date+'T00:00:00')<now)?'<div style="position:absolute;top:1px;right:1px;width:5px;height:5px;border-radius:50%;background:var(--red)"></div>':'';const countBadge=allCount>3?`<div class="cal-day-count">+${allCount-3}</div>`:'';const restCls=isNP?` no-hw ${rk==='sick'?'rest-sick':'rest-lazy'}`:'';const dayMins=tlist.filter(t=>!t.done).reduce((s,t)=>s+(t.estTime||30),0);const heatCls=!isNP&&!d===calSelected?(dayMins>=180?' cal-heat-3':dayMins>=90?' cal-heat-2':dayMins>=30?' cal-heat-1':''):'';
// Compact dots for mobile — show up to 4 per day, colored by subject/event type
const _mobMax=4;const _taskDots=tlist.slice(0,_mobMax).map(t=>{const s=getSubjects()[t.subject];const c=s?s.color:'var(--accent)';return`<span class="cal-dot-compact" style="background:${c};opacity:${t.done?0.35:1}"></span>`;});const _evSlots=Math.max(0,_mobMax-_taskDots.length);const _evDots=elist.slice(0,_evSlots).map(e=>{const wk=e._weekly;const out=fluxEventScope(e)==='outside';const c=wk?(out?'var(--muted2)':'var(--accent)'):(out?'var(--muted2)':'var(--purple)');return`<span class="cal-dot-compact" style="background:${c};opacity:${wk?0.85:1}"></span>`;});const _dotsHTML=(_taskDots.concat(_evDots)).join('')+(allCount>_mobMax?`<span class="cal-dot-compact cal-dot-more">+${allCount-_mobMax}</span>`:'');const compactDotsEl=_dotsHTML?`<div class="cal-dots-mobile" aria-hidden="true">${_dotsHTML}</div>`:'';
html+=`<div class="cal-day ${isToday?'today ':''}${d===calSelected?'selected ':''}${restCls}${heatCls}" data-cal-date="${ds}" data-rest-kind="${rk||''}" ondragover="fluxCalDragOver(event)" ondragleave="fluxCalDragLeave(event)" ondrop="fluxCalDrop(event)" onclick="selectDay(${d})" style="position:relative">${overFlag}<div class="cal-dn">${d}</div>${abLabel}<div class="cal-dots">${dots}</div>${compactDotsEl}${countBadge}</div>`;}
  document.getElementById('calGrid').innerHTML=html;
  renderCalDay();
  if(typeof fluxAfterRenderCalendar==='function')fluxAfterRenderCalendar();
  }finally{_fluxCalRenderBusy=false;}
}

function renderCalDay(){
  const dt=new Date(calYear,calMonth,calSelected);
  const ds=fluxLocalYMD(dt);
  const titleEl=document.getElementById('calDayTitle');
  if(titleEl){
    const cyc=getCycleDayLabel(ds);
    const base=dt.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    titleEl.textContent=cyc?`${base} · ${cyc} day`:base;
  }
  const addBtn=document.getElementById('calAddBtn');if(addBtn)addBtn.style.display='inline-flex';
  const addEvBtn=document.getElementById('calAddEventBtn');if(addEvBtn)addEvBtn.style.display='inline-flex';
  const day=tasks.filter(t=>{if(!t.date)return false;const d=new Date(t.date+'T00:00:00');return d.getFullYear()===calYear&&d.getMonth()===calMonth&&d.getDate()===calSelected;});
  const events=(load('flux_events',[])).filter(e=>{if(!e.date)return false;const d=new Date(e.date+'T12:00:00');return d.getFullYear()===calYear&&d.getMonth()===calMonth&&d.getDate()===calSelected;});
  const weekly=weeklyVirtualEventsForDate(ds);
  const el=document.getElementById('calDayTasks');
  if(!day.length&&!events.length&&!weekly.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:4px 0">Nothing scheduled.</div>';return;}
  const blocks=[];weekly.forEach(w=>blocks.push({k:'w',o:w}));events.forEach(e=>blocks.push({k:'e',o:e}));day.forEach(t=>blocks.push({k:'t',o:t}));
  const ord={w:0,e:1,t:2};
  blocks.sort((a,b)=>{const s=fluxScopeSortKey(a.o)-fluxScopeSortKey(b.o);if(s!==0)return s;const ta=fluxTimeSortMinutes(a.o.time),tb=fluxTimeSortMinutes(b.o.time);if(ta!==tb)return ta-tb;return ord[a.k]-ord[b.k];});
  el.innerHTML=blocks.map(({k,o})=>{
    if(k==='w'){
      const sch=fluxEventScope(o)==='school';
      return`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,194,255,.08);border:1px solid rgba(var(--accent-rgb),.25);border-radius:10px;margin-bottom:6px"><span style="font-size:.85rem">🔁</span><div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:600;color:var(--accent)">Every week</div><div style="font-size:.85rem;font-weight:600">${esc(o.title)}</div>${o.time?`<div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(formatCalTimeShort(o.time))}</div>`:''}</div><button type="button" class="scope-pill ${sch?'scope-pill-school':'scope-pill-out'}" onclick="event.stopPropagation();toggleWeeklyRuleScope('${o.ruleId}')" title="School vs outside">${sch?'🏫':'🌐'}</button><button type="button" onclick="deleteWeeklyRule('${o.ruleId}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;padding:2px" title="Remove">✕</button></div>`;
    }
    if(k==='e'){
      const sch=fluxEventScope(o)==='school';
      return`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(192,132,252,.08);border:1px solid rgba(192,132,252,.2);border-radius:10px;margin-bottom:6px"><span style="font-size:.85rem">📅</span><div style="flex:1;min-width:0"><div style="font-size:.85rem;font-weight:600">${esc(o.title)}</div>${o.time?`<div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(formatCalTimeShort(o.time))}</div>`:''}</div><button type="button" class="scope-pill ${sch?'scope-pill-school':'scope-pill-out'}" onclick="event.stopPropagation();toggleOneOffEventScope('${o.id}')" title="School vs outside">${sch?'🏫':'🌐'}</button><button type="button" onclick="event.stopPropagation();openEditCalendarEventModal('${o.id}')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:.85rem;padding:2px 4px" title="Edit time &amp; details">✎</button><button type="button" onclick="deleteEvent('${o.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;padding:2px">✕</button></div>`;
    }
    const sch=fluxEventScope(o)==='school';
    return`<div class="task-item" style="margin-bottom:6px;display:flex;align-items:center;gap:6px"><div class="check ${o.done?'done':''}" onclick="toggleTask(${o.id})">${o.done?'✓':''}</div><div class="task-body" style="flex:1;min-width:0"><div class="task-text ${o.done?'done':''}">${esc(o.name)}</div>${o.time?`<div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(formatCalTimeShort(o.time))}</div>`:''}</div><button type="button" class="scope-pill ${sch?'scope-pill-school':'scope-pill-out'}" onclick="event.stopPropagation();toggleTaskScope(${o.id})" title="School vs outside">${sch?'🏫':'🌐'}</button><button class="btn-sm btn-del" onclick="deleteTask(${o.id})">✕</button></div>`;
  }).join('');
}

// ── Add event modal ──
let addEventType='task';
let editCalendarEventId=null;
function setAddEventScope(scope){
  const inp=document.getElementById('addEventScopeValue');
  if(inp)inp.value=scope==='outside'?'outside':'school';
  const sb=document.getElementById('addEventScopeSchoolBtn');
  const ob=document.getElementById('addEventScopeOutsideBtn');
  const onSchool=scope!=='outside';
  if(sb)sb.classList.toggle('event-scope-btn-on',onSchool);
  if(ob)ob.classList.toggle('event-scope-btn-on',!onSchool);
}
function openAddEventModal(){
  const modal=document.getElementById('addEventModal');if(!modal)return;
  editCalendarEventId=null;
  document.getElementById('addEventDate').value=new Date(calYear,calMonth,calSelected).toISOString().slice(0,10);
  document.getElementById('addEventTitle').value='';
  document.getElementById('addEventNotes').value='';
  const te=document.getElementById('addEventTime');if(te)te.value='';
  const mt=document.getElementById('addEventModalTitle');if(mt)mt.textContent='Add to Calendar';
  const pb=document.getElementById('addEventPrimaryBtn');if(pb)pb.textContent='Add';
  const trow=document.getElementById('addEventTypeRow');if(trow)trow.style.display='flex';
  setAddEventScope('school');
  setAddEventType('task');
  modal.style.display='flex';
}
function openEditCalendarEventModal(id){
  const events=load('flux_events',[]);
  const ev=events.find(x=>String(x.id)===String(id));
  if(!ev)return;
  editCalendarEventId=ev.id;
  const modal=document.getElementById('addEventModal');if(!modal)return;
  const mt=document.getElementById('addEventModalTitle');if(mt)mt.textContent='Edit calendar event';
  const pb=document.getElementById('addEventPrimaryBtn');if(pb)pb.textContent='Save';
  const trow=document.getElementById('addEventTypeRow');if(trow)trow.style.display='none';
  document.getElementById('addEventDate').value=ev.date||'';
  document.getElementById('addEventTitle').value=ev.title||'';
  document.getElementById('addEventTime').value=ev.time||'';
  document.getElementById('addEventNotes').value=ev.notes||'';
  setAddEventScope(ev.scope==='outside'?'outside':'school');
  setAddEventType('event');
  modal.style.display='flex';
}
function closeAddEventModal(){
  const modal=document.getElementById('addEventModal');if(modal)modal.style.display='none';
  editCalendarEventId=null;
  const trow=document.getElementById('addEventTypeRow');if(trow)trow.style.display='flex';
  const mt=document.getElementById('addEventModalTitle');if(mt)mt.textContent='Add to Calendar';
  const pb=document.getElementById('addEventPrimaryBtn');if(pb)pb.textContent='Add';
}
function setAddEventType(type){
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
}
function saveAddEvent(){
  const title=document.getElementById('addEventTitle').value.trim();if(!title)return;
  const date=document.getElementById('addEventDate').value;
  const time=document.getElementById('addEventTime').value;
  const notes=document.getElementById('addEventNotes').value.trim();
  const sc=document.getElementById('addEventScopeValue')?.value;
  const scope=sc==='outside'?'outside':'school';
  if(editCalendarEventId){
    const events=load('flux_events',[]);
    const ix=events.findIndex(x=>String(x.id)===String(editCalendarEventId));
    if(ix>=0){
      events[ix]={...events[ix],title,date,time:time||'',notes,scope};
      save('flux_events',events);
      syncKey('events',1);
    }
    closeAddEventModal();renderCalendar();showToast('✓ Event updated');return;
  }
  if(addEventType==='task'){
    const task={id:Date.now(),name:title,date,time:time||'',subject:document.getElementById('addEventSubject').value,priority:document.getElementById('addEventPriority').value,type:'hw',notes,done:false,rescheduled:0,createdAt:Date.now(),scope};
    task.urgencyScore=calcUrgency(task);tasks.unshift(task);save('tasks',tasks);
    renderStats();renderTasks();
  }else{
    const events=load('flux_events',[]);
    events.push({id:String(Date.now()),title,date,time:time||'',notes,scope});
    save('flux_events',events);
    syncKey('events',1);
  }
  syncKey('tasks',tasks);
  closeAddEventModal();renderCalendar();
}
function deleteEvent(id){
  if(String(id).startsWith('w_')){deleteWeeklyRule(String(id).slice(2));return;}
  const events=load('flux_events',[]).filter(e=>e.id!==id);
  save('flux_events',events);renderCalendar();
}
function saveCycleSchedule(){
  const enabled=document.getElementById('cycleEnabled')?.checked;
  const raw=document.getElementById('cyclePatternInput')?.value||'A, B';
  const pattern=raw.split(',').map(s=>s.trim()).filter(Boolean);
  const anchorDate=document.getElementById('cycleAnchorInput')?.value;
  const skipWeekends=document.getElementById('cycleSkipWeekends')?.checked!==false;
  if(!pattern.length){showToast('Add a pattern (e.g. A, B)','warning');return;}
  if(!anchorDate){showToast('Pick an anchor date','warning');return;}
  save('flux_cycle_config',{enabled:!!enabled,pattern,anchorDate,skipWeekends});
  const hint=document.getElementById('cycleSaveHint');
  if(hint)hint.textContent='Saved — calendar labels updated.';
  setTimeout(()=>{if(hint)hint.textContent='';},3500);
  renderCalendar();syncKey('cycle',pattern);
}
function loadCalScheduleUI(){
  const cfg=load('flux_cycle_config',null);
  const ce=document.getElementById('cycleEnabled');if(ce)ce.checked=!!cfg?.enabled;
  const cp=document.getElementById('cyclePatternInput');if(cp)cp.value=cfg?.pattern?.join(', ')||'A, B';
  const ca=document.getElementById('cycleAnchorInput');if(ca)ca.value=cfg?.anchorDate||fluxLocalYMD(new Date());
  const sw=document.getElementById('cycleSkipWeekends');if(sw)sw.checked=cfg?.skipWeekends!==false;
  renderWeeklyRulesList();
}
function renderWeeklyRulesList(){
  const el=document.getElementById('weeklyRulesList');if(!el)return;
  const rules=getWeeklyRules();
  const dayNames={0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  if(!rules.length){el.innerHTML='<div style="color:var(--muted);font-size:.78rem">No weekly activities yet.</div>';return;}
  el.innerHTML=rules.map(r=>{
    const days=(r.weekdays||[]).map(d=>dayNames[d]).join(', ');
    const sch=fluxEventScope(r)==='school';
    return`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--card2);border-radius:10px;margin-bottom:6px;border:1px solid var(--border2)"><div style="min-width:0"><div style="font-weight:600">${esc(r.title)}</div><div style="font-size:.68rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${days}${r.time?' · '+esc(r.time):''}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><button type="button" class="scope-pill mini ${sch?'scope-pill-school':'scope-pill-out'}" onclick="toggleWeeklyRuleScope('${r.id}')" title="School vs outside">${sch?'🏫':'🌐'}</button><button type="button" class="btn-sec" style="padding:4px 10px;font-size:.72rem" onclick="deleteWeeklyRule('${r.id}')">Remove</button></div></div>`;
  }).join('');
}
function addWeeklyRule(){
  const title=document.getElementById('weeklyTitleInput')?.value.trim();
  if(!title){showToast('Enter a title','warning');return;}
  const time=document.getElementById('weeklyTimeInput')?.value||'';
  const boxes=document.querySelectorAll('#calendar input[name="wd"]:checked');
  const weekdays=[...boxes].map(b=>parseInt(b.value,10)).sort((a,b)=>a-b);
  if(!weekdays.length){showToast('Pick at least one weekday','warning');return;}
  const outside=document.getElementById('weeklyScopeOutside')?.checked;
  const rules=getWeeklyRules();
  rules.push({id:String(Date.now()),title,time,weekdays,enabled:true,scope:outside?'outside':'school'});
  save('flux_weekly_events',rules);
  const ti=document.getElementById('weeklyTitleInput');if(ti)ti.value='';
  const tm=document.getElementById('weeklyTimeInput');if(tm)tm.value='';
  document.querySelectorAll('#calendar input[name="wd"]').forEach(c=>{c.checked=false;});
  const wo=document.getElementById('weeklyScopeOutside');if(wo)wo.checked=false;
  renderWeeklyRulesList();renderCalendar();syncKey('weekly',rules);
}
function deleteWeeklyRule(id){
  save('flux_weekly_events',getWeeklyRules().filter(r=>String(r.id)!==String(id)));
  renderWeeklyRulesList();renderCalendar();syncKey('weekly',1);
}
function toggleTaskScope(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  t.scope=t.scope==='outside'?'school':'outside';
  save('tasks',tasks);renderCalendar();if(typeof renderTasks==='function')renderTasks();syncKey('tasks',tasks);
}
function toggleOneOffEventScope(eid){
  const events=load('flux_events',[]);
  const ev=events.find(x=>String(x.id)===String(eid));if(!ev)return;
  ev.scope=ev.scope==='outside'?'school':'outside';
  save('flux_events',events);renderCalendar();syncKey('events',1);
}
function toggleWeeklyRuleScope(rid){
  const rules=getWeeklyRules();
  const r=rules.find(x=>String(x.id)===String(rid));if(!r)return;
  r.scope=r.scope==='outside'?'school':'outside';
  save('flux_weekly_events',rules);renderWeeklyRulesList();renderCalendar();syncKey('weekly',1);
}

// ── Google Calendar sync ──
async function syncGoogleCalendar(){
  const statusEl=document.getElementById('gcalStatus');
  const eventsEl=document.getElementById('gcalEvents');
  if(!gmailToken){
    if(statusEl)statusEl.innerHTML='<div class="sync-badge offline">○ Sign in with Google to sync</div>';return;
  }
  if(statusEl)statusEl.innerHTML='<div class="sync-badge syncing">↑ Syncing...</div>';
  try{
    const now=new Date().toISOString();
    const end=new Date();end.setDate(end.getDate()+30);
    const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(end.toISOString())}&maxResults=20&singleEvents=true&orderBy=startTime`,{
      headers:{'Authorization':`Bearer ${gmailToken}`}
    });
    if(res.status===401){if(statusEl)statusEl.innerHTML='<div class="sync-badge offline">○ Session expired — sign in again</div>';return;}
    if(!res.ok)throw new Error('Calendar API '+res.status);
    const data=await res.json();
    const items=data.items||[];
    if(statusEl)statusEl.innerHTML=`<div class="sync-badge synced">✓ Synced ${items.length} events</div>`;
    if(eventsEl){
      if(!items.length){eventsEl.innerHTML='<div style="color:var(--muted);font-size:.68rem">No upcoming events</div>';return;}
      eventsEl.innerHTML=items.map(ev=>{
        const start=ev.start?.dateTime||ev.start?.date||'';
        const d=start?new Date(start).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'';
        return`<div style="display:flex;gap:6px;align-items:flex-start;padding:5px 0;border-bottom:1px solid var(--border)">
          <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></div>
          <div style="flex:1;min-width:0"><div style="font-size:.72rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ev.summary||'(no title)')}</div><div style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${d}</div></div>
          <button onclick="addGCalEventAsTask('${encodeURIComponent(ev.summary||'')}','${start.slice(0,10)}')" style="padding:2px 6px;font-size:.62rem;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.25);color:var(--accent);border-radius:6px;flex-shrink:0">+ Task</button>
        </div>`;
      }).join('');
    }
  }catch(e){
    if(statusEl)statusEl.innerHTML=`<div style="color:var(--red);font-size:.78rem">${e.message}</div>`;
  }
}
function addGCalEventAsTask(encodedName,date){
  const name=decodeURIComponent(encodedName);
  const task={id:Date.now(),name,date,subject:'',priority:'med',type:'hw',done:false,rescheduled:0,createdAt:Date.now()};
  task.urgencyScore=calcUrgency(task);tasks.unshift(task);save('tasks',tasks);
  renderStats();renderTasks();renderCalendar();syncKey('tasks',tasks);
  const btn=event?.target;if(btn){btn.textContent='✓';btn.style.color='var(--green)';setTimeout(()=>{btn.textContent='+ Task';btn.style.color='var(--accent)';},1500);}
}

// ══ SCHOOL INFO ══
/** Parse period field: "4", "B4", "a 3" → { period, days }. Letter+number sets A Day / B Day; plain number uses fallbackDays (Days dropdown). */
function parseClassPeriodInput(raw,fallbackDays){
  const fb=fallbackDays||'';
  const s=String(raw||'').trim().replace(/\s+/g,'');
  if(!s)return{period:1,days:fb};
  const ab=s.match(/^([AB])(\d{1,2})$/i);
  if(ab){
    const num=parseInt(ab[2],10);
    if(num>=1&&num<=24)return{period:Math.min(24,num),days:ab[1].toUpperCase()==='A'?'A Day':'B Day'};
  }
  if(/^\d{1,2}$/.test(s)){
    const num=parseInt(s,10);
    if(!isNaN(num))return{period:Math.min(24,Math.max(1,num)),days:fb};
  }
  const n=parseInt(s,10);
  return{period:!isNaN(n)&&n>=1?Math.min(24,n):1,days:fb};
}
function formatClassPeriodField(c){
  if(!c)return'';
  if(c.days==='A Day')return'A'+c.period;
  if(c.days==='B Day')return'B'+c.period;
  return String(c.period??'');
}
function saveSchoolInfo(){schoolInfo={locker:document.getElementById('inputLocker').value.trim(),combo:document.getElementById('inputCombo').value.trim(),counselor:document.getElementById('inputCounselor').value.trim(),studentID:document.getElementById('inputStudentID').value.trim()};save('flux_school',schoolInfo);renderSchool();syncKey('school',schoolInfo);const b=event?.target;if(b){b.textContent='✓ Saved!';setTimeout(()=>b.textContent='Save Info',1500);}}
function addClass(){
  const rawPeriod=document.getElementById('classPeriod').value;
  const fallbackDays=document.getElementById('classDays').value;
  const {period,days}=parseClassPeriodInput(rawPeriod,fallbackDays);
  const name=document.getElementById('className').value.trim();
  const teacher=document.getElementById('classTeacher').value.trim();
  const room=document.getElementById('classRoom').value.trim();
  const timeStart=document.getElementById('classTimeStart').value;
  const timeEnd=document.getElementById('classTimeEnd').value;
  const color=document.getElementById('classColor')?.value||'';
  if(!name)return;
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_TASK_LIMITS){
    const maxClasses=FLUX_PLANS[_entitlement.plan]?.maxClasses??Infinity;
    if(classes.length>=maxClasses&&maxClasses!==Infinity){
      showUpgradePrompt('maxClasses',`Free plan supports up to ${FLUX_FREE_LIMITS.MAX_CLASSES} classes. Upgrade to add more.`);
      return;
    }
  }
  const COLORS=['#3b82f6','#f43f5e','#10d9a0','#fbbf24','#a78bfa','#fb923c','#e879f9','#22d3ee'];
  const cleanedName=cleanClassName(name);
  classes.push({id:Date.now(),period,name:cleanedName,teacher,room,days,timeStart,timeEnd,color:color||COLORS[classes.length%COLORS.length]});
  classes.sort((a,b)=>a.period-b.period);
  save('flux_classes',classes);
  const cd=document.getElementById('classDays');if(cd)cd.value=days;
  ['classPeriod','className','classTeacher','classRoom'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const cs=document.getElementById('classTimeStart');if(cs)cs.value='';
  const ce=document.getElementById('classTimeEnd');if(ce)ce.value='';
  renderSchool();populateSubjectSelects();syncKey('classes',classes);
  if(typeof updateNextClassPill==='function')updateNextClassPill();
  if(typeof renderDynamicFocus==='function')renderDynamicFocus();
}
function deleteClass(id){classes=classes.filter(c=>c.id!==id);save('flux_classes',classes);renderSchool();populateSubjectSelects();if(typeof updateNextClassPill==='function')updateNextClassPill();if(typeof renderDynamicFocus==='function')renderDynamicFocus();}
function addTeacherNote(){const teacher=document.getElementById('tNoteTeacher').value.trim(),note=document.getElementById('tNoteText').value.trim();if(!teacher||!note)return;teacherNotes.push({id:Date.now(),teacher,note});save('flux_teacher_notes',teacherNotes);document.getElementById('tNoteTeacher').value='';document.getElementById('tNoteText').value='';renderSchool();}
function deleteTeacherNote(id){teacherNotes=teacherNotes.filter(n=>n.id!==id);save('flux_teacher_notes',teacherNotes);renderSchool();}
function renderSchool(){
  const lockerEl=document.getElementById('inputLocker');
  const comboEl=document.getElementById('inputCombo');
  const counselorEl=document.getElementById('inputCounselor');
  const sidEl=document.getElementById('inputStudentID');
  if(lockerEl)lockerEl.value=schoolInfo.locker||'';
  if(comboEl){
    comboEl.value=schoolInfo.combo||'';
    comboEl.type='password';
    const cb=document.getElementById('revealComboBtn');if(cb){cb.textContent='👁';cb.setAttribute('title','Show');}
  }
  if(counselorEl)counselorEl.value=schoolInfo.counselor||'';
  if(sidEl){
    sidEl.value=schoolInfo.studentID||'';
    sidEl.type='password';
    const sb=document.getElementById('revealSIDBtn');if(sb){sb.textContent='👁';sb.setAttribute('title','Show');}
  }
  const cl=document.getElementById('classesList');
  if(!cl)return;
  if(!classes.length){cl.innerHTML='<div class="empty"><div class="empty-icon">📚</div><div class="empty-title">No classes yet</div><div class="empty-sub">Add classes below or import from a photo</div></div>';}
  else{
    const COLORS=['#3b82f6','#f43f5e','#10d9a0','#fbbf24','#a78bfa','#fb923c','#e879f9','#22d3ee'];
    const colorMap={};
    classes.forEach((c,i)=>{colorMap[c.id]=c.color||COLORS[i%COLORS.length];});
    // Check if any class uses A Day / B Day scheduling
    const hasAB=classes.some(c=>c.days&&(c.days==='A Day'||c.days==='B Day'));
    if(hasAB){
      const aClasses=classes.filter(c=>!c.days||c.days===''||c.days==='A Day'||c.days==='Mon-Fri'||c.days==='Mon/Wed/Fri'||c.days==='Tue/Thu'||(!c.days.includes('B Day'))).sort((a,b)=>a.period-b.period);
      const bClasses=classes.filter(c=>c.days&&c.days==='B Day').sort((a,b)=>a.period-b.period);
      const renderClassRow=(c,col)=>{
        const timeStr=c.timeStart?`${fmtTime(c.timeStart)}${c.timeEnd?' – '+fmtTime(c.timeEnd):''}` :'';
        const meta=[c.teacher,timeStr,c.room].filter(Boolean).join(' · ');
        return`<div class="class-row" style="border-left:3px solid ${col}"><div class="class-period" style="background:${col}22;color:${col}">${c.period}</div><div style="flex:1"><div style="font-size:.88rem;font-weight:700">${esc(c.name)}</div>${meta?`<div style="font-size:.72rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">${meta}</div>`:''}</div><button onclick="editClass(${c.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.8rem;padding:4px" title="Edit">✎</button><button onclick="deleteClass(${c.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">✕</button></div>`;
      };
      cl.innerHTML=`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:2px;color:var(--accent);font-family:'JetBrains Mono',monospace;padding:0 0 8px;border-bottom:1px solid rgba(var(--accent-rgb),.2);margin-bottom:10px;font-weight:700">A Day · ${aClasses.length} classes</div>
            ${aClasses.map(c=>renderClassRow(c,colorMap[c.id])).join('')}
          </div>
          <div>
            <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:2px;color:var(--green);font-family:'JetBrains Mono',monospace;padding:0 0 8px;border-bottom:1px solid rgba(16,217,160,.2);margin-bottom:10px;font-weight:700">B Day · ${bClasses.length} classes</div>
            ${bClasses.map(c=>renderClassRow(c,colorMap[c.id])).join('')}
          </div>
        </div>`;
    } else {
      cl.innerHTML=classes.map((c,i)=>{
        const col=colorMap[c.id];
        const timeStr=c.timeStart?`${fmtTime(c.timeStart)}${c.timeEnd?' – '+fmtTime(c.timeEnd):''}` :'';
        const meta=[c.teacher,c.days,timeStr,c.room].filter(Boolean).join(' · ');
        return`<div class="class-row" style="border-left:3px solid ${col}"><div class="class-period" style="background:${col}22;color:${col}">${c.period}</div><div style="flex:1"><div style="font-size:.88rem;font-weight:700">${esc(c.name)}</div>${meta?`<div style="font-size:.72rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">${meta}</div>`:''}</div><button onclick="editClass(${c.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.8rem;padding:4px" title="Edit">✎</button><button onclick="deleteClass(${c.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">✕</button></div>`;
      }).join('');
    }
  }
  const tn=document.getElementById('teacherNotesList');
  if(tn){
    if(!teacherNotes.length){tn.innerHTML='<div style="color:var(--muted);font-size:.82rem;margin-bottom:8px">No notes yet.</div>';}
    else{tn.innerHTML=teacherNotes.map(n=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font-size:.82rem;font-weight:700">${esc(n.teacher)}</div><div style="font-size:.75rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">${esc(n.note)}</div></div><button onclick="deleteTeacherNote(${n.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">✕</button></div>`).join('');}
  }
  const canvasSchool=document.getElementById('schoolCanvasLmsRow');
  if(canvasSchool){
    const tok=load('flux_canvas_token','');
    const host=load('flux_canvas_host',null)||(function(){try{const u=new URL((load('flux_canvas_url','')||'').trim().replace(/^([^/]+)$/,'https://$1'));return u.hostname||'';}catch(e){return'';}})();
    if(tok&&host){
      canvasSchool.style.display='block';
      canvasSchool.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div><span style="font-size:.72rem;color:var(--muted)">Canvas LMS</span><div style="font-size:.85rem;font-weight:600;margin-top:4px">Connected to ${esc(host)}</div></div>
        <button type="button" class="btn-sec" style="padding:6px 12px;font-size:.78rem" onclick="fluxCanvasDisconnectSchool()">Disconnect</button>
      </div>`;
    }else{
      canvasSchool.style.display='none';
      canvasSchool.innerHTML='';
    }
  }
}
window.fluxCanvasDisconnectSchool=function(){
  save('flux_canvas_token',null);
  save('flux_canvas_host',null);
  save('flux_canvas_url',null);
  try{canvasToken='';canvasUrl='';}catch(e){}
  if(window.CanvasState){CanvasState.token=null;CanvasState.host=null;CanvasState.connected=false;}
  schoolInfo=schoolInfo||{};
  delete schoolInfo.canvasLmsHost;
  save('flux_school',schoolInfo);
  renderSchool();
  if(typeof renderCanvasHubPanel==='function')renderCanvasHubPanel();
  showToast('Canvas disconnected on this device','info');
};

// Edit class inline
function editClass(id){
  const c=classes.find(x=>x.id===id);
  if(!c)return;
  const modal=document.getElementById('editClassModal');
  if(!modal){
    // Create modal if it doesn't exist
    const m=document.createElement('div');
    m.id='editClassModal';
    m.className='modal-overlay';
    m.onclick=function(e){if(e.target===this)this.style.display='none';};
    m.innerHTML=`<div class="modal-card">
      <div class="modal-title">Edit Class</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mrow"><label>Period</label><input type="text" id="ecPeriod" placeholder="e.g. 4 or A4 or B4"></div>
        <div class="mrow"><label>Color</label><input type="color" id="ecColor" style="width:100%;height:40px;margin:0;border-radius:8px;cursor:pointer;border:1px solid var(--border2)"></div>
        <div class="mrow" style="grid-column:span 2"><label>Class Name</label><input type="text" id="ecName"></div>
        <div class="mrow"><label>Teacher</label><input type="text" id="ecTeacher"></div>
        <div class="mrow"><label>Room</label><input type="text" id="ecRoom"></div>
        <div class="mrow"><label>Days</label><select id="ecDays">
          <option value="">Any day</option>
          <option value="Mon-Fri">Mon–Fri</option>
          <option value="A Day">A Day</option>
          <option value="B Day">B Day</option>
          <option value="Mon/Wed/Fri">Mon/Wed/Fri</option>
          <option value="Tue/Thu">Tue/Thu</option>
          <option value="Mon">Monday</option>
          <option value="Tue">Tuesday</option>
          <option value="Wed">Wednesday</option>
          <option value="Thu">Thursday</option>
          <option value="Fri">Friday</option>
        </select></div>
        <div class="mrow"><label>Time</label><div style="display:flex;gap:4px;align-items:center"><input type="time" id="ecStart" style="flex:1;margin:0"><span style="color:var(--muted)">–</span><input type="time" id="ecEnd" style="flex:1;margin:0"></div></div>
      </div>
      <div class="mactions"><button onclick="document.getElementById('editClassModal').style.display='none'" class="btn-sec">Cancel</button><button onclick="saveEditClass()">Save</button></div>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('editClassModal').dataset.classId=id;
  document.getElementById('ecPeriod').value=formatClassPeriodField(c);
  document.getElementById('ecName').value=c.name||'';
  document.getElementById('ecTeacher').value=c.teacher||'';
  document.getElementById('ecRoom').value=c.room||'';
  document.getElementById('ecDays').value=c.days||'';
  document.getElementById('ecStart').value=c.timeStart||'';
  document.getElementById('ecEnd').value=c.timeEnd||'';
  document.getElementById('ecColor').value=c.color||'#3b82f6';
  document.getElementById('editClassModal').style.display='flex';
}
function saveEditClass(){
  const id=parseInt(document.getElementById('editClassModal').dataset.classId);
  const c=classes.find(x=>x.id===id);
  if(!c)return;
  const rawP=document.getElementById('ecPeriod').value;
  const fbDays=document.getElementById('ecDays').value;
  const parsed=parseClassPeriodInput(rawP,fbDays);
  c.period=parsed.period;
  c.days=parsed.days;
  c.name=document.getElementById('ecName').value.trim()||c.name;
  c.teacher=document.getElementById('ecTeacher').value.trim();
  c.room=document.getElementById('ecRoom').value.trim();
  c.timeStart=document.getElementById('ecStart').value;
  c.timeEnd=document.getElementById('ecEnd').value;
  c.color=document.getElementById('ecColor').value;
  classes.sort((a,b)=>a.period-b.period);
  save('flux_classes',classes);
  document.getElementById('editClassModal').style.display='none';
  renderSchool();populateSubjectSelects();syncKey('classes',classes);
  if(typeof updateNextClassPill==='function')updateNextClassPill();
  if(typeof renderDynamicFocus==='function')renderDynamicFocus();
}

// ══ NOTES ══
function setNoteFilter(f,el){noteFilter=f;document.querySelectorAll('#notes .tmode-btn').forEach(b=>b.classList.remove('active'));if(el)el.classList.add('active');renderNotesList();}

// ══ EXTRACURRICULARS SYSTEM ══
let extras = load('flux_extras', []);
let ecSchools = load('flux_ec_schools', []);
let ecGoals = load('flux_ec_goals', []);

const EC_TYPES = [
  {id:'activity',label:'Activity'},
  {id:'award',label:'Award'},
  {id:'achievement',label:'Achievement'},
  {id:'leadership',label:'Leadership'},
  {id:'sport',label:'Sport'},
  {id:'art',label:'Art / Music'},
  {id:'volunteer',label:'Volunteer'},
  {id:'research',label:'Research'},
  {id:'work',label:'Work / Internship'}
];
const EC_COLORS = {activity:'var(--accent)',award:'var(--gold)',achievement:'var(--green)',leadership:'var(--purple)',sport:'var(--red)',art:'#e879f9',volunteer:'#10d9a0',research:'var(--accent)',work:'var(--orange)'};
let _selectedECTypes = new Set();

function renderECTypeChips(){
  const el = document.getElementById('extraTypeChips'); if(!el) return;
  el.innerHTML = EC_TYPES.map(t => {
    const sel = _selectedECTypes.has(t.id);
    const c = EC_COLORS[t.id] || 'var(--accent)';
    return `<button onclick="toggleECType('${t.id}')" style="
      padding:4px 10px;border-radius:14px;font-size:.68rem;font-weight:600;cursor:pointer;
      white-space:nowrap;transition:all .15s;border:1px solid ${sel?c+'55':'var(--border)'};
      background:${sel?c+'18':'transparent'};color:${sel?c:'var(--muted2)'};
    ">${t.label}</button>`;
  }).join('');
}
function toggleECType(id){
  if(_selectedECTypes.has(id)) _selectedECTypes.delete(id);
  else _selectedECTypes.add(id);
  renderECTypeChips();
}

function addExtra(){
  const editId = parseInt(document.getElementById('extraEditId')?.value);
  const name = document.getElementById('extraName')?.value.trim();
  const types = _selectedECTypes.size ? [..._selectedECTypes] : ['activity'];
  const hours = parseInt(document.getElementById('extraHours')?.value) || 0;
  const desc = document.getElementById('extraDesc')?.value.trim() || '';
  if(!name) return;
  if(editId){
    const idx = extras.findIndex(e => e.id === editId);
    if(idx !== -1) Object.assign(extras[idx], {name, types, hours, desc});
  } else {
    extras.push({id: Date.now(), name, types, hours, desc, createdAt: Date.now()});
  }
  save('flux_extras', extras);
  _clearExtraForm();
  renderExtrasList();
}
function editExtra(id){
  const e = extras.find(x => x.id === id); if(!e) return;
  document.getElementById('extraEditId').value = id;
  document.getElementById('extraName').value = e.name || '';
  document.getElementById('extraHours').value = e.hours || '';
  document.getElementById('extraDesc').value = e.desc || '';
  const typeArr = Array.isArray(e.types) ? e.types : (e.type ? [e.type] : ['activity']);
  _selectedECTypes = new Set(typeArr);
  renderECTypeChips();
  const btn = document.getElementById('extraSubmitBtn'); if(btn){ btn.textContent = '✓ Save'; }
  const cancel = document.getElementById('extraCancelBtn'); if(cancel) cancel.style.display = '';
  document.getElementById('extraName')?.focus();
}
function cancelEditExtra(){
  _clearExtraForm();
  renderECTypeChips();
}
function _clearExtraForm(){
  ['extraName','extraHours','extraDesc','extraEditId'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  _selectedECTypes.clear();
  const btn = document.getElementById('extraSubmitBtn'); if(btn) btn.textContent = '+';
  const cancel = document.getElementById('extraCancelBtn'); if(cancel) cancel.style.display = 'none';
}
function removeExtra(id){
  extras = extras.filter(e => e.id !== id);
  save('flux_extras', extras);
  renderExtrasList();
}
function renderExtrasList(){
  const el = document.getElementById('extrasList'); if(!el) return;
  if(!extras.length){ el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No activities added yet. Add your first one below!</div>'; return; }
  el.innerHTML = extras.map(e => {
    const typeArr = Array.isArray(e.types) ? e.types : (e.type ? [e.type] : ['activity']);
    const badges = typeArr.map(t => {
      const c = EC_COLORS[t] || 'var(--accent)';
      return `<span style="font-size:.6rem;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.5px;background:${c}18;padding:2px 7px;border-radius:10px;border:1px solid ${c}33">${t}</span>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:600">${esc(e.name)}</div>
        <div style="display:flex;gap:5px;margin-top:3px;align-items:center;flex-wrap:wrap">
          ${badges}
          ${e.hours ? `<span style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${e.hours} hrs/wk</span>` : ''}
        </div>
        ${e.desc ? `<div style="font-size:.75rem;color:var(--muted2);margin-top:3px;line-height:1.4">${esc(e.desc)}</div>` : ''}
      </div>
      <button onclick="editExtra(${e.id})" title="Edit" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.82rem;padding:4px;flex-shrink:0;opacity:.6;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">✎</button>
      <button onclick="removeExtra(${e.id})" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px;flex-shrink:0;opacity:.6;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">✕</button>
    </div>`;
  }).join('');
  renderECTypeChips();
}

// ══ TARGET SCHOOLS ══
function addSchool(){
  const name = document.getElementById('schoolName')?.value.trim();
  const tier = document.getElementById('schoolTier')?.value || 'target';
  if(!name) return;
  ecSchools.push({id: Date.now(), name, tier});
  save('flux_ec_schools', ecSchools);
  document.getElementById('schoolName').value = '';
  renderSchoolsList();
}
function removeSchool(id){
  ecSchools = ecSchools.filter(s => s.id !== id);
  save('flux_ec_schools', ecSchools);
  renderSchoolsList();
}
function renderSchoolsList(){
  const el = document.getElementById('schoolsList'); if(!el) return;
  if(!ecSchools.length){ el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No target schools yet.</div>'; return; }
  const tc = {reach:'var(--red)',target:'var(--gold)',safety:'var(--green)'};
  el.innerHTML = ecSchools.map(s => {
    const c = tc[s.tier] || 'var(--accent)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1"><span style="font-size:.88rem;font-weight:600">${esc(s.name)}</span></div>
      <span style="font-size:.6rem;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.5px;background:${c}18;padding:2px 8px;border-radius:10px;border:1px solid ${c}33">${s.tier}</span>
      <button onclick="removeSchool(${s.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">✕</button>
    </div>`;
  }).join('');
  initEcCollegeChatSelect();
}

// ══ EC GOALS ══
function addECGoal(){
  const title = document.getElementById('ecGoalTitle')?.value.trim();
  const deadline = document.getElementById('ecGoalDeadline')?.value || '';
  if(!title) return;
  ecGoals.push({id: Date.now(), title, deadline, done: false});
  save('flux_ec_goals', ecGoals);
  document.getElementById('ecGoalTitle').value = '';
  document.getElementById('ecGoalDeadline').value = '';
  renderECGoals();
}
function toggleECGoal(id){
  const g = ecGoals.find(x=>x.id===id); if(!g) return;
  g.done = !g.done;
  save('flux_ec_goals', ecGoals);
  renderECGoals();
}
function removeECGoal(id){
  ecGoals = ecGoals.filter(g=>g.id!==id);
  save('flux_ec_goals', ecGoals);
  renderECGoals();
}
function renderECGoals(){
  const el = document.getElementById('ecGoalsList'); if(!el) return;
  if(!ecGoals.length){ el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No goals yet.</div>'; return; }
  el.innerHTML = ecGoals.map(g => {
    const days = g.deadline ? Math.max(0, Math.floor((new Date(g.deadline+'T00:00:00') - new Date())/86400000)) : null;
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);${g.done?'opacity:.5':''}">
      <button onclick="toggleECGoal(${g.id})" style="width:22px;height:22px;border-radius:7px;border:1.5px solid ${g.done?'var(--green)':'var(--border2)'};background:${g.done?'var(--green)':'transparent'};cursor:pointer;font-size:11px;color:${g.done?'#080a0f':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">✓</button>
      <div style="flex:1">
        <div style="font-size:.88rem;font-weight:600;${g.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(g.title)}</div>
        ${days!==null ? `<div style="font-size:.68rem;color:var(--muted2);font-family:'JetBrains Mono',monospace;margin-top:2px">${days} days left</div>` : ''}
      </div>
      <button onclick="removeECGoal(${g.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:4px">✕</button>
    </div>`;
  }).join('');
}

// ══ EC AI — SUGGEST ACTIVITIES & ANALYZE SCHOOL FIT ══
async function ecAISuggest(){
  const resEl = document.getElementById('ecAIResult');
  resEl.style.display = 'block';
  resEl.innerHTML = '<div class="ai-bub bot"><div class="ai-think"><span></span><span></span><span></span></div></div>';
  const activitiesList = extras.map(e=>{const t=Array.isArray(e.types)?e.types.join(', '):(e.type||'activity');return`${e.name} (${t}${e.hours?' '+e.hours+'hrs/wk':''})`;}).join(', ') || 'None added yet';
  const schoolsList = ecSchools.map(s=>`${s.name} (${s.tier})`).join(', ') || 'None added yet';
  const prompt = `I'm a high school student. Here are my current extracurricular activities: ${activitiesList}.\n\nMy target schools: ${schoolsList}.\n\nBased on these, suggest 5-8 additional extracurricular activities I should consider. For each, explain WHY it would strengthen my profile (e.g. shows leadership, fills a gap, aligns with likely major). Be specific and actionable — not generic. Format each as a bullet with the activity name in bold.`;
  try {
    const res = await fetch(API.ai, {method:'POST', headers:await fluxAuthHeaders(), body:JSON.stringify({system:'You are an expert college admissions counselor. Give specific, actionable extracurricular suggestions.', messages:[{role:'user', content:prompt}]})});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Could not generate suggestions.';
    resEl.innerHTML = `<div style="font-size:.84rem;line-height:1.6;color:var(--text)">${fmtAI(reply)}</div>`;
  } catch(e) {
    resEl.innerHTML = `<div style="color:var(--red);font-size:.82rem">Error: ${e.message}</div>`;
  }
}

async function ecAIAnalyze(){
  const resEl = document.getElementById('ecAIResult');
  if(!ecSchools.length){
    resEl.style.display = 'block';
    resEl.innerHTML = '<div style="color:var(--muted2);font-size:.82rem">Add at least one target school first.</div>';
    return;
  }
  resEl.style.display = 'block';
  resEl.innerHTML = '<div class="ai-bub bot"><div class="ai-think"><span></span><span></span><span></span></div></div>';
  const activitiesList = extras.map(e=>{const t=Array.isArray(e.types)?e.types.join(', '):(e.type||'activity');return`${e.name} (${t}${e.hours?' '+e.hours+'hrs/wk':''}${e.desc?': '+e.desc:''})`;}).join('\n- ') || 'None';
  const schoolsList = ecSchools.map(s=>`${s.name} (${s.tier})`).join(', ');
  const prompt = `Analyze my extracurricular profile for college admissions.\n\nMy activities:\n- ${activitiesList}\n\nTarget schools: ${schoolsList}\n\nFor EACH school, give:\n1. A fit score (Weak / Moderate / Strong / Excellent)\n2. What my profile is missing for that school specifically\n3. One concrete activity I should add to improve my chances\n\nAlso give an overall assessment of my profile's strengths and gaps. Be honest but constructive.`;
  try {
    const res = await fetch(API.ai, {method:'POST', headers:await fluxAuthHeaders(), body:JSON.stringify({system:'You are an expert college admissions counselor with deep knowledge of what top universities look for in applicants. Be specific and honest in your analysis.', messages:[{role:'user', content:prompt}]})});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Could not generate analysis.';
    resEl.innerHTML = `<div style="font-size:.84rem;line-height:1.6;color:var(--text)">${fmtAI(reply)}</div>`;
  } catch(e) {
    resEl.innerHTML = `<div style="color:var(--red);font-size:.82rem">Error: ${e.message}</div>`;
  }
}

// ══ EC COLLEGE CHAT (server researches college per message) ══
let _ecCollegeChatBusy=false;
function loadEcCollegeChat(){return load('flux_ec_college_chat',{messages:[]});}
function saveEcCollegeChat(state){save('flux_ec_college_chat',state);}
function _ecActivitiesSummary(){
  return extras.map(e=>{
    const t=Array.isArray(e.types)?e.types.join(', '):(e.type||'activity');
    return `${e.name} (${t}${e.hours?' '+e.hours+'hrs/wk':''})`;
  }).join('; ')||'none listed yet';
}
function initEcCollegeChatSelect(){
  const sel=document.getElementById('ecChatCollegeSelect');if(!sel)return;
  const prev=sel.value;
  let html='<option value="__all__">All my target schools</option>';
  ecSchools.forEach(s=>{html+=`<option value="${s.id}">${esc(s.name)} (${esc(s.tier)})</option>`;});
  sel.innerHTML=html;
  if(prev&&[...sel.options].some(o=>o.value===prev))sel.value=prev;
}
function initEcCollegeChatListeners(){
  const ta=document.getElementById('ecChatInput');if(!ta||ta.dataset.ecBound)return;
  ta.dataset.ecBound='1';
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendEcCollegeChat();}
  });
}
function renderEcChatMessages(){
  const box=document.getElementById('ecChatMessages');if(!box)return;
  const inp=document.getElementById('ecChatInput');
  const {messages}=loadEcCollegeChat();
  if(inp)inp.style.minHeight=messages.length?'48px':'120px';
  if(!messages.length){
    box.innerHTML='';
    box.style.display='none';
    return;
  }
  box.style.display='block';
  box.innerHTML=messages.map(m=>{
    const isUser=m.role==='user';
    return`<div style="margin-bottom:12px;padding:10px 12px;border-radius:10px;background:${isUser?'rgba(var(--accent-rgb),.1)':'var(--card)'};border:1px solid var(--border2)">
      <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:5px;font-weight:700">${isUser?'You':'Flux'}</div>
      <div style="color:var(--text);word-break:break-word">${isUser?esc(m.content):fmtAI(m.content)}</div>
    </div>`;
  }).join('')+(_ecCollegeChatBusy?'<div class="ai-bub bot" style="margin-top:4px"><div class="ai-think"><span></span><span></span><span></span></div><div style="font-size:.72rem;color:var(--muted2);margin-top:8px">Researching college context…</div></div>':'');
  box.scrollTop=box.scrollHeight;
}
function _resolveEcCollegeFocus(){
  const custom=(document.getElementById('ecChatCollegeCustom')?.value||'').trim();
  if(custom)return custom;
  const sel=document.getElementById('ecChatCollegeSelect');
  if(!ecSchools.length)return '';
  if(sel?.value==='__all__')return ecSchools.map(s=>s.name).join('; ');
  const id=parseInt(sel?.value,10);
  const one=ecSchools.find(s=>s.id===id);
  return one?one.name:ecSchools[0].name;
}
async function sendEcCollegeChat(){
  if(_ecCollegeChatBusy)return;
  const inp=document.getElementById('ecChatInput');
  const text=(inp?.value||'').trim();
  if(!text)return;
  const collegeName=_resolveEcCollegeFocus();
  if(!collegeName){
    showToast('Add target schools or type a college name in the field.','warning');
    return;
  }
  const state=loadEcCollegeChat();
  state.messages.push({role:'user',content:text});
  saveEcCollegeChat(state);
  inp.value='';
  const meta=document.getElementById('ecChatMeta');
  if(meta)meta.textContent='';
  const btn=document.getElementById('ecChatSendBtn');
  _ecCollegeChatBusy=true;
  if(btn){btn.disabled=true;btn.textContent='…';}
  renderEcChatMessages();
  const apiMsgs=state.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-20).map(m=>({role:m.role,content:m.content}));
  try{
    const res=await fetch(API.ecCollegeChat,{
      method:'POST',
      headers:await fluxAuthHeaders(),
      body:JSON.stringify({
        collegeName,
        messages:apiMsgs,
        profile:{
          activities:_ecActivitiesSummary(),
          schools:ecSchools.map(s=>`${s.name} (${s.tier})`).join('; ')||'none',
        },
        plannerDigest:buildFullPlannerContextForAI({maxTotalChars:14000}),
      }),
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.error)throw new Error(data.error||'HTTP '+res.status);
    const reply=data.content?.[0]?.text||'No response.';
    const st=loadEcCollegeChat();
    st.messages.push({role:'assistant',content:reply});
    saveEcCollegeChat(st);
    if(meta&&data.meta?.sourcesUsed){
      const u=data.meta.sourcesUsed;
      const bits=[];
      if(u.wikipedia)bits.push('Wikipedia');
      if(u.webSearch)bits.push('Web search');
      if(u.applyingToCollegeReddit)bits.push('r/ApplyingToCollege');
      meta.textContent=bits.length?`Last reply grounded with: ${bits.join(' · ')}`:'Limited external context — verify on official sites.';
    }
  }catch(e){
    const st=loadEcCollegeChat();
    st.messages.push({role:'assistant',content:'**Could not reach Flux.** '+(e.message||'')+' Deploy the `ec-college-chat` Edge Function and ensure `GROQ_API_KEY` is set. Optional: `BRAVE_SEARCH_API_KEY` for richer official-page coverage.'});
    saveEcCollegeChat(st);
    if(meta)meta.textContent='';
    showToast('College chat failed — check deployment','error');
  }finally{
    _ecCollegeChatBusy=false;
    if(btn){btn.disabled=false;btn.textContent='Send';}
    renderEcChatMessages();
  }
}

function renderNotesList(){const el=document.getElementById('notesList');if(!el)return;const q=(document.getElementById('noteSearch').value||'').toLowerCase();let list=[...notes];if(noteFilter==='starred')list=list.filter(n=>n.starred);if(noteFilter==='flashcards')list=list.filter(n=>n.flashcards?.length);if(q)list=list.filter(n=>(n.title||'').toLowerCase().includes(q)||(n.body||'').toLowerCase().includes(q));if(!list.length){el.innerHTML='<div class="empty">No notes yet. Tap + New to create one.</div>';return;}el.innerHTML=list.sort((a,b)=>b.updatedAt-a.updatedAt).map(n=>{const sub=getSubjects()[n.subject];return`<div class="note-card" onclick="openNote(${n.id})"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div class="note-title">${esc(n.title||'Untitled')}</div>${n.starred?'<span style="color:var(--gold)">⭐</span>':''}${n.flashcards?.length?`<span class="badge badge-purple" style="padding:2px 6px;font-size:.6rem">🃏 ${n.flashcards.length}</span>`:''}</div>${sub?`<span class="badge badge-blue" style="padding:2px 6px;font-size:.62rem;margin-bottom:4px">${sub.short}</span>`:''}${(n.fluxTags||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">${(n.fluxTags||[]).map(tg=>`<span class="badge" style="padding:2px 6px;font-size:.58rem;background:rgba(var(--purple-rgb),.12);color:var(--purple);border-radius:6px">${esc(tg)}</span>`).join('')}</div>`:''}<div class="note-preview">${strip(n.body||'')}</div><div style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:5px">${new Date(n.updatedAt||Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div></div>`;}).join('');}
function openNewNote(){currentNoteId=null;document.getElementById('noteTitleInput').value='';document.getElementById('noteEditor').innerHTML='';document.getElementById('noteSubjectTag').value='';document.getElementById('starBtn').textContent='☆';document.getElementById('aiNoteResult').style.display='none';document.getElementById('notesListView').style.display='none';document.getElementById('notesEditorView').style.display='block';}
function openNote(id){const n=notes.find(x=>x.id===id);if(!n)return;currentNoteId=id;document.getElementById('noteTitleInput').value=n.title||'';document.getElementById('noteEditor').innerHTML=n.body||'';document.getElementById('noteSubjectTag').value=n.subject||'';document.getElementById('starBtn').textContent=n.starred?'⭐':'☆';document.getElementById('aiNoteResult').style.display='none';document.getElementById('notesListView').style.display='none';document.getElementById('notesEditorView').style.display='block';}
function backToNotesList(){document.getElementById('notesEditorView').style.display='none';document.getElementById('flashcardView').style.display='none';document.getElementById('notesListView').style.display='block';renderNotesList();}
function saveNote(){const title=document.getElementById('noteTitleInput').value.trim()||'Untitled';const body=document.getElementById('noteEditor').innerHTML;const subject=document.getElementById('noteSubjectTag').value;const starred=document.getElementById('starBtn').textContent==='⭐';if(currentNoteId){const n=notes.find(x=>x.id===currentNoteId);if(n){n.title=title;n.body=body;n.subject=subject;n.starred=starred;n.updatedAt=Date.now();}}else{const n={id:Date.now(),title,body,subject,starred,flashcards:[],createdAt:Date.now(),updatedAt:Date.now()};notes.unshift(n);currentNoteId=n.id;}save('flux_notes',notes);syncKey('notes',notes);const b=event?.target;if(b){b.textContent='✓ Saved';setTimeout(()=>b.textContent='Save',1500);}}
function deleteNote(){if(!currentNoteId)return;if(!confirm('Delete this note?'))return;notes=notes.filter(n=>n.id!==currentNoteId);save('flux_notes',notes);backToNotesList();}
function toggleStarNote(){const btn=document.getElementById('starBtn');btn.textContent=btn.textContent==='⭐'?'☆':'⭐';}
function fmt(cmd){document.execCommand(cmd,false,null);}
function insHeading(){document.execCommand('formatBlock',false,'<h3>');}
function insBullet(){document.execCommand('insertUnorderedList',false,null);}
function insCode(){document.execCommand('insertHTML',false,'<code style="background:var(--border);padding:2px 6px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:.82em">code</code>');}
async function summarizeNoteWithAI(){const body=strip(document.getElementById('noteEditor').innerHTML);if(!body.trim())return;const resEl=document.getElementById('aiNoteResult');resEl.style.display='block';resEl.innerHTML='<div class="ai-bub bot"><div class="ai-think"><span></span><span></span><span></span></div></div>';try{const res=await fetch(API.ai,{method:'POST',headers:await fluxAuthHeaders(),body:JSON.stringify({system:'Summarize the following student note concisely in bullet points.',messages:[{role:'user',content:body}]})});const data=await res.json();resEl.innerHTML=`<div class="ai-bub bot" style="max-width:100%">${fmtAI(data.content?.[0]?.text||'Could not summarize.')}</div>`;}catch(e){resEl.innerHTML=`<div style="color:var(--red);font-size:.82rem">${e.message}</div>`;}}
async function generateFlashcardsFromNote(){const body=strip(document.getElementById('noteEditor').innerHTML);if(!body.trim())return;const resEl=document.getElementById('aiNoteResult');resEl.style.display='block';resEl.innerHTML='<div style="color:var(--muted2);font-size:.82rem">Generating flashcards...</div>';try{const res=await fetch(API.ai,{method:'POST',headers:await fluxAuthHeaders(),body:JSON.stringify({system:'Generate 8-12 flashcards from these notes. Respond ONLY with a JSON array of {"q":"question","a":"answer"} objects.',messages:[{role:'user',content:body}]})});const data=await res.json();let txt=(data.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim();const cards=JSON.parse(txt);if(currentNoteId){const n=notes.find(x=>x.id===currentNoteId);if(n){n.flashcards=cards;save('flux_notes',notes);}}flashcards=cards;fcIndex=0;fcFlipped=false;resEl.innerHTML=`<div style="color:var(--green);font-size:.82rem">✓ Generated ${cards.length} flashcards!</div>`;openFlashcards();}catch(e){resEl.innerHTML=`<div style="color:var(--red);font-size:.82rem">Error generating flashcards.</div>`;}}
function openFlashcards(){if(!flashcards.length)return;fcIndex=0;fcFlipped=false;document.getElementById('notesEditorView').style.display='none';document.getElementById('flashcardView').style.display='block';renderFC();}
function closeFlashcards(){document.getElementById('flashcardView').style.display='none';document.getElementById('notesEditorView').style.display='block';}
function renderFC(){if(!flashcards.length)return;const fc=flashcards[fcIndex];document.getElementById('fcProgress').textContent=`Card ${fcIndex+1} / ${flashcards.length}`;document.getElementById('fcText').textContent=fcFlipped?fc.a:fc.q;document.getElementById('fcCard').style.background=fcFlipped?'rgba(var(--accent-rgb),.1)':'var(--card)';}
function flipFC(){fcFlipped=!fcFlipped;renderFC();}
function nextFC(){fcIndex=(fcIndex+1)%flashcards.length;fcFlipped=false;renderFC();}
function prevFC(){fcIndex=(fcIndex-1+flashcards.length)%flashcards.length;fcFlipped=false;renderFC();}

// (Old habits/goals/college functions removed — replaced by extracurriculars system above)

// ══ MOOD ══
function setMood(val,el){document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('active'));if(el)el.classList.add('active');localStorage.setItem('flux_mood_today',val);}
function setStress(v){const el=document.getElementById('stressVal');if(el)el.textContent=v;localStorage.setItem('flux_stress_today',v);}
function saveMoodEntry(){const mood=parseInt(localStorage.getItem('flux_mood_today')||'3');const stress=parseInt(document.getElementById('stressSlider').value||'3');const sleep=parseFloat(document.getElementById('sleepHours').value||'7');const entry={date:todayStr(),mood,stress,sleep};const idx=moodHistory.findIndex(m=>m.date===entry.date);if(idx>=0)moodHistory[idx]=entry;else moodHistory.push(entry);save('flux_mood',moodHistory);const b=event?.target;if(b){b.textContent='✓ Saved!';setTimeout(()=>b.textContent='Save Check-In',1500);}const ba=document.getElementById('burnoutAlert');if(ba)ba.style.display=(stress>=8&&sleep<6)?'block':'none';renderMoodHistory();if(window.FluxPersonal&&FluxPersonal.applyMoodTint)FluxPersonal.applyMoodTint();}
function renderMoodHistory(){const el=document.getElementById('moodHistory');if(!el)return;const last30=moodHistory.slice(-30);const moodEmoji=['','😞','😕','😐','🙂','😄'];if(!last30.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem">No entries yet.</div>';return;}el.innerHTML=last30.map(m=>`<div title="${m.date}" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:.95rem;background:var(--card2);border:1px solid var(--border)">${moodEmoji[m.mood]}</div>`).join('');const avg=last30.reduce((s,m)=>s+m.mood,0)/last30.length;const ins=document.getElementById('moodInsight');if(ins)ins.textContent=avg>=4?'😊 You\'ve been feeling pretty good lately!':avg<=2?'😟 Rough stretch — remember to rest.':'😐 Mood has been neutral. Keep pushing!';}
function renderAffirmation(){if(window.FluxPersonal&&FluxPersonal.renderAffirmation){FluxPersonal.renderAffirmation();return;}const el=document.getElementById('affirmation');if(!el)return;el.textContent='"Progress, not perfection."';}
function startBreathing(){if(breathingActive){clearInterval(breathTimer);breathingActive=false;document.getElementById('breathBtn').textContent='Start';document.getElementById('breathCircle').style.transform='scale(1)';document.getElementById('breathCircle').textContent='START';return;}breathingActive=true;document.getElementById('breathBtn').textContent='Stop';const phases=[{label:'Inhale',secs:4,scale:1.5},{label:'Hold',secs:7,scale:1.5},{label:'Exhale',secs:8,scale:1}];let pi=0,countdown=phases[0].secs;const tick=()=>{const p=phases[pi];document.getElementById('breathCircle').textContent=p.label+'\n'+countdown;document.getElementById('breathCircle').style.transform='scale('+p.scale+')';countdown--;if(countdown<0){pi=(pi+1)%3;countdown=phases[pi].secs;}};tick();breathTimer=setInterval(tick,1000);}

// ══ TIMER ══
const TM={pomodoro:{label:'Focus Time',mins:25},short:{label:'Short Break',mins:5},long:{label:'Long Break',mins:15}};
let tMode='pomodoro',tRunning=false,tInterval=null,tSecs=25*60,tTotal=25*60;
let _fluxPomoPillVisible=false;
let tDone=load('t_sessions',0),tMins=load('t_minutes',0),tStreak=load('t_streak',0),tLastDate=load('t_date','');
const CIRC=2*Math.PI*88;
function updateTLengths(){if(tRunning)return;TM.pomodoro.mins=parseInt(document.getElementById('customWork').value)||25;TM.short.mins=parseInt(document.getElementById('customShort').value)||5;if(tMode==='pomodoro'||tMode==='short'){tSecs=TM[tMode].mins*60;tTotal=tSecs;updateTDisplay();}}
function setTMode(mode,el){if(tRunning)return;tMode=mode;tSecs=TM[mode].mins*60;tTotal=tSecs;document.querySelectorAll('#timer .tmode-btn').forEach(b=>b.classList.remove('active'));if(el)el.classList.add('active');updateTDisplay();document.getElementById('tLbl').textContent=TM[mode].label;syncFluxPomoPill();}
function toggleTimer(){tRunning?pauseTimer():startTimer();}
function startTimer(){tRunning=true;document.getElementById('timerBtn').textContent='⏸ Pause';updateTDisplay();syncFluxPomoPill();tInterval=setInterval(()=>{tSecs--;updateTDisplay();if(tSecs<=0)timerDone();},1000);}
function pauseTimer(){tRunning=false;clearInterval(tInterval);document.getElementById('timerBtn').textContent='▶ Resume';syncFluxPomoPill();}
function resetTimer(){tRunning=false;clearInterval(tInterval);tSecs=TM[tMode].mins*60;tTotal=tSecs;document.getElementById('timerBtn').textContent='▶ Start';updateTDisplay();syncFluxPomoPill();}
function timerDone(){tRunning=false;clearInterval(tInterval);document.getElementById('timerBtn').textContent='▶ Start';syncFluxPomoPill();if(tMode==='pomodoro'){tDone++;tMins+=TM.pomodoro.mins;const ts=todayStr();if(tLastDate!==ts){const y=new Date(TODAY);y.setDate(TODAY.getDate()-1);tStreak=tLastDate===y.toISOString().slice(0,10)?tStreak+1:1;tLastDate=ts;save('t_date',tLastDate);}const sub=document.getElementById('timerSubject')?.value||'';sessionLog.push({date:ts,mins:TM.pomodoro.mins,subject:sub,hour:new Date().getHours()});save('flux_session_log',sessionLog);if(typeof FluxBus!=='undefined')FluxBus.emit('session_ended',{mins:TM.pomodoro.mins,subject:sub,date:ts,hour:new Date().getHours()});if(sub){subjectBudgets[sub]=(subjectBudgets[sub]||0)+(TM.pomodoro.mins/60);save('flux_budgets',subjectBudgets);}save('t_sessions',tDone);save('t_minutes',tMins);save('t_streak',tStreak);updateTStats();renderTDots();renderSubjectBudget();renderFocusHeatmap();
showSessionRecap(sub,TM.pomodoro.mins);
setTimeout(()=>{const mode=tDone%4===0?'long':'short';const btns=document.querySelectorAll('#timer .tmode-btn');setTMode(mode,btns[mode==='long'?2:1]);},400);}else{setTimeout(()=>{setTMode('pomodoro',document.querySelectorAll('#timer .tmode-btn')[0]);},400);}}
function updateTDisplay(){const m=Math.floor(tSecs/60),s=tSecs%60;const txt=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');const td=document.getElementById('tDisplay');if(td)td.textContent=txt;const pillT=document.getElementById('fluxPomoPillTime');if(pillT)pillT.textContent=txt;const offset=CIRC*(1-tSecs/tTotal);const ring=document.getElementById('timerRing');if(ring){ring.style.strokeDasharray=CIRC;ring.style.strokeDashoffset=offset;}try{if(window.FluxVisual&&typeof FluxVisual.updateTimerRingGlow==='function'&&tTotal>0)FluxVisual.updateTimerRingGlow((tSecs/tTotal)*100);}catch(e){}const mini=document.getElementById('fluxPomoMiniRing');if(mini&&window.FluxAnim?.updateMiniRing){try{const p=tTotal>0?tSecs/tTotal:0;FluxAnim.updateMiniRing(mini,p);}catch(e){}}syncFluxPomoPill();}
function syncFluxPomoPill(){const pill=document.getElementById('fluxPomoPill');if(!pill)return;const show=!!(tRunning&&tMode==='pomodoro');if(show!==_fluxPomoPillVisible){_fluxPomoPillVisible=show;if(show){pill.hidden=false;pill.setAttribute('aria-hidden','false');try{if(window.FluxAnim?.pillAppear)FluxAnim.pillAppear(pill);else{pill.style.display='flex';}}catch(e){pill.style.display='flex';}}else{try{if(window.FluxAnim?.pillDisappear)FluxAnim.pillDisappear(pill,()=>{pill.hidden=true;pill.style.display='none';pill.setAttribute('aria-hidden','true');});else{pill.hidden=true;pill.style.display='none';pill.setAttribute('aria-hidden','true');}}catch(e){pill.hidden=true;pill.style.display='none';pill.setAttribute('aria-hidden','true');}}}else if(show){pill.hidden=false;if(pill.style.display==='none'||!pill.style.display)pill.style.display='flex';}}
function fluxFocusPomoPill(){try{if(typeof matchMedia!=='undefined'&&matchMedia('(max-width:768px)').matches){if(typeof navMob==='function'){navMob('timer');return;}}const tab=document.querySelector('[data-tab="timer"]');if(typeof nav==='function')nav('timer',tab);}catch(e){if(typeof nav==='function')nav('timer');}}
try{window.fluxFocusPomoPill=fluxFocusPomoPill;}catch(e){}
function renderTDots(){const el=document.getElementById('timerDots');if(!el)return;const c=Math.min((tDone%4)||(tDone>0?4:0),4);el.innerHTML=[0,1,2,3].map(i=>`<div class="t-dot ${i<c?'done':''}"></div>`).join('');const lbl=document.getElementById('tSessionLbl');if(lbl)lbl.textContent=`Session ${(tDone%4)+1} of 4`;}
function updateTStats(){const a=document.getElementById('tSessions'),b=document.getElementById('tMinutes'),c=document.getElementById('tStreak');if(a)a.textContent=tDone;if(b)b.textContent=tMins;if(c)c.textContent=tStreak;}
function renderSubjectBudget(){
  const el=document.getElementById('subjectBudget');if(!el)return;
  const subjs=getSubjects();
  const entries=Object.entries(subjs);
  if(!entries.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem">Add classes in School Info to see subject budgets.</div>';return;}
  el.innerHTML='<div class="flux-subject-budget-list">'+entries.map(([k,s])=>{
    const done=parseFloat((subjectBudgets[k]||0).toFixed(1));
    const target=2; // default 2h/week per subject
    const pct=Math.min(Math.round(done/target*100),100);
    const c=pct>=100?'var(--green)':pct>=60?'var(--accent)':'var(--gold)';
    return`<div class="flux-subject-budget-row" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:${s.color}"></div><span style="font-size:.8rem;font-weight:600">${s.short}</span></div><span style="font-size:.72rem;font-family:'JetBrains Mono',monospace;color:${c}">${done}h / ${target}h</span></div><div class="budget-bar flux-budget-bar"><div class="budget-fill" style="width:${pct}%;background:linear-gradient(90deg,${s.color},rgba(var(--accent-rgb),.85))"></div></div></div>`;
  }).join('')+'</div>';
}
function renderFocusHeatmap(){const el=document.getElementById('focusHeatmap');if(!el)return;el.classList.add('flux-focus-heatmap');const weekStart=new Date(TODAY);weekStart.setDate(TODAY.getDate()-TODAY.getDay()+1);const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];el.innerHTML=days.map((day,i)=>{const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);const ds=d.toISOString().slice(0,10);const mins=sessionLog.filter(s=>s.date===ds).reduce((sum,s)=>sum+s.mins,0);const intensity=Math.min(mins/180,1);const isToday=ds===todayStr();const txt=intensity>.08?'var(--text)':'var(--muted2)';return`<div class="flux-fh-cell" style="flex:1;text-align:center"><div class="flux-fh-block" style="height:44px;border-radius:10px;background:linear-gradient(180deg,rgba(var(--accent-rgb),${(intensity*.92+.08).toFixed(3)}),rgba(var(--purple-rgb),${(intensity*.55).toFixed(3)}));border:1px solid ${isToday?'var(--accent)':'var(--border)'};box-shadow:${mins>60?'0 0 12px rgba(var(--accent-rgb),.15)':'none'};display:flex;align-items:center;justify-content:center;font-size:.65rem;font-family:'JetBrains Mono',monospace;color:${txt};font-weight:700">${mins>0?mins+'m':'—'}</div><div style="font-size:.58rem;color:var(--muted);margin-top:4px;font-family:'JetBrains Mono',monospace">${day}</div></div>`;}).join('');}

// ══ PROFILE ══
function normalizeProgramList(raw){
  if(Array.isArray(raw))return[...new Set(raw.filter(x=>typeof x==='string'&&x.trim()))];
  if(typeof raw==='string'&&raw.trim())return[raw.trim()];
  return[];
}
function formatProgramsDisplay(programs){
  return normalizeProgramList(programs).join(' · ');
}

function saveProfile(){
  const p={
    name:document.getElementById('name').value.trim(),
    grade:document.getElementById('grade').value,
    program:Array.from(document.querySelectorAll('input[name="programOpt"]:checked')).map(i=>i.value),
    school:document.getElementById('profileSchool').value.trim(),
  };
  localStorage.setItem('profile',JSON.stringify(p));
  localStorage.setItem('flux_user_name',p.name);
  checkProgramUpgrade(p);
  renderProfile();
  syncKey('profile',p);
  const b=event?.target;if(b){b.textContent='✓ Saved!';setTimeout(()=>b.textContent='Save Profile',1500);}
}

// Auto-upgrade MYP → DP when grade reaches 11
function checkProgramUpgrade(p){
  if(!p)return;
  const grade=parseInt(p.grade)||0;
  let programs=normalizeProgramList(p.program);
  if(grade>=11&&programs.includes('IB MYP')){
    programs=programs.filter(x=>x!=='IB MYP');
    if(!programs.includes('IB DP'))programs.push('IB DP');
    p.program=programs;
    localStorage.setItem('profile',JSON.stringify(p));
    // Show upgrade notification
    const notif=document.createElement('div');
    notif.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--accent),var(--purple));color:#fff;padding:14px 24px;border-radius:14px;font-size:.88rem;font-weight:700;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.4);animation:floatIn .3s ease';
    notif.innerHTML='🎓 Welcome to IB DP! Your program has been updated.';
    document.body.appendChild(notif);
    setTimeout(()=>notif.remove(),4000);
    save('flux_onboarded',true);
  }
}

function renderProfile(){
  const p=load('profile',{});
  if(p.grade)checkProgramUpgrade(p);
  const name=p.name||localStorage.getItem('flux_user_name')||'Student';
  const grade=p.grade||'';
  const programs=normalizeProgramList(p.program);
  const programDisplay=formatProgramsDisplay(programs);
  const school=p.school||'';

  const subline=[grade?`Grade ${grade}`:'',programDisplay,school].filter(Boolean).join(' · ');
  const profileNameEl=document.getElementById('profileName');if(profileNameEl)profileNameEl.textContent=name;
  const profileSubEl=document.getElementById('profileSubline');if(profileSubEl)profileSubEl.textContent=subline||'Set up your profile';

  if(p.name){
    const nameEl=document.getElementById('name');if(nameEl)nameEl.value=p.name;
    const gradeEl=document.getElementById('grade');if(gradeEl)gradeEl.value=p.grade||'';
    const schoolEl=document.getElementById('profileSchool');if(schoolEl)schoolEl.value=p.school||'';
  }
  document.querySelectorAll('input[name="programOpt"]').forEach(cb=>{cb.checked=programs.includes(cb.value);});

  const pic=localStorage.getItem('flux_profile_pic');
  const av=document.getElementById('pAvatar');
  if(av)av.innerHTML=(pic?`<img src="${pic}" loading="lazy" decoding="async" alt="">`:name.charAt(0).toUpperCase())+`<input type="file" id="picUpload" accept="image/*" style="display:none" onchange="handlePicUpload(event)">`;
  if(window.FluxPersonal&&FluxPersonal.styleProfileAvatar)FluxPersonal.styleProfileAvatar();

  const done=tasks.filter(t=>t.done).length;
  const badges=[];
  if(done>=40)badges.push({t:'🏆 On a roll',c:'badge-gold'});
  if(done>=20)badges.push({t:'✓ Task Master',c:'badge-green'});
  if(tStreak>=7)badges.push({t:'🔥 Study Streak',c:'badge-red'});
  if(programs.includes('IB DP'))badges.push({t:'📚 IB DP',c:'badge-blue'});
  if(programs.includes('IB MYP'))badges.push({t:'📖 IB MYP',c:'badge-purple'});
  if(notes.length>=10)badges.push({t:'📝 Note Taker',c:'badge-purple'});
  const badgeEl=document.getElementById('profileBadges');
  if(badgeEl)badgeEl.innerHTML=badges.length?badges.map(b=>`<span class="badge ${b.c}">${b.t}</span>`).join(''):'<span style="font-size:.75rem;color:var(--muted)">Complete tasks to earn badges!</span>';

  const ps=document.getElementById('profileStats');
  const focusHrs=Math.round((load('t_minutes',0)||0)/60);
  if(ps)ps.innerHTML=[[focusHrs+'h','Focus','var(--accent)'],[done,'Done','var(--green)'],[tasks.filter(t=>!t.done).length,'Active','var(--gold)'],[notes.length,'Notes','var(--purple)']].map(([n,l,c])=>`<div style="background:var(--card2);border-radius:10px;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:${c}">${n}</div><div style="font-size:.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:2px">${l}</div></div>`).join('');

  // Confidence sliders — now use dynamic subjects from user's classes
  const confEl=document.getElementById('confidenceSliders');
  const subjs=getSubjects();
  if(confEl){
    const subjEntries=Object.entries(subjs);
    if(!subjEntries.length){confEl.innerHTML='<div style="color:var(--muted);font-size:.82rem">Add your classes in School Info to see confidence sliders.</div>';return;}
    confEl.innerHTML=subjEntries.map(([k,s])=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:${s.color}"></div><span style="font-size:.82rem;font-weight:600">${s.short}</span></div><span style="font-size:.75rem;font-family:'JetBrains Mono',monospace;color:var(--accent);font-weight:700" id="cv-${k}">${confidences[k]||5}/10</span></div><input type="range" min="1" max="10" value="${confidences[k]||5}" oninput="document.getElementById('cv-${k}').textContent=this.value+'/10';confidences['${k}']=parseInt(this.value)" style="width:100%"></div>`).join('');
  }

  studyDNA.forEach(d=>{const btn=document.getElementById('dna-'+d);if(btn)btn.classList.add('active');});
}

function handlePicUpload(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{localStorage.setItem('flux_profile_pic',ev.target.result);const av=document.getElementById('pAvatar');if(av)av.innerHTML=`<img src="${ev.target.result}" loading="lazy" decoding="async" alt=""><input type="file" id="picUpload" accept="image/*" style="display:none" onchange="handlePicUpload(event)">`;if(window.FluxPersonal&&FluxPersonal.styleProfileAvatar)FluxPersonal.styleProfileAvatar();};r.readAsDataURL(file);}
function setDNA(type){const idx=studyDNA.indexOf(type);if(idx>=0)studyDNA.splice(idx,1);else studyDNA.push(type);save('flux_dna',studyDNA);document.querySelectorAll('[id^=dna-]').forEach(b=>b.classList.remove('active'));studyDNA.forEach(d=>{const btn=document.getElementById('dna-'+d);if(btn)btn.classList.add('active');});const tips={visual:'Use diagrams, charts, color-coded notes.',audio:'Read aloud, record yourself, use podcasts.',reading:'Textbooks, detailed notes, rewrite summaries.',practice:'Do problems, flashcards, practice tests.'};const el=document.getElementById('studyDNAResult');if(el)el.textContent=studyDNA.map(d=>tips[d]).join(' ');renderTasks();}
function saveConfidences(){save('flux_conf',confidences);const b=event?.target;if(b){b.textContent='✓ Saved';setTimeout(()=>b.textContent='Save',1500);}}

// ══ THEMES ══
const THEMES={
  dark:{
    label:'🌙 Midnight',
    vars:{'--bg':'#0a0b10','--bg2':'#0d0e15','--card':'#161826','--card2':'#1a1d2c','--card-solid':'#161826','--border':'rgba(255,255,255,.07)','--border2':'rgba(255,255,255,.1)','--text':'#eef0f7','--muted':'#6b7280','--muted2':'#9ca3af','--accent':'#00bfff','--accent-rgb':'0,191,255','--green':'#10d9a0','--red':'#f43f5e','--gold':'#fbbf24','--purple':'#c084fc','--orange':'#fb923c'}
  },
  light:{
    label:'☀️ Cloud',
    vars:{'--bg':'#f0f2f8','--bg2':'#e4e8f2','--card':'#ffffff','--card2':'#f5f7ff','--card-solid':'#ffffff','--border':'rgba(0,0,0,.09)','--border2':'rgba(0,0,0,.13)','--text':'#1a1d2e','--muted':'#6b7280','--muted2':'#4b5563','--accent':'#6366f1','--accent-rgb':'99,102,241','--green':'#059669','--red':'#dc2626','--gold':'#d97706','--purple':'#9333ea','--orange':'#ea580c'}
  },
  aurora:{
    label:'🌌 Aurora',
    vars:{'--bg':'#060a12','--bg2':'#080d18','--card':'#08101e','--card2':'#0a1424','--card-solid':'#08101e','--border':'rgba(100,200,255,.09)','--border2':'rgba(100,200,255,.14)','--text':'#e0f0ff','--muted':'#5a7a9a','--muted2':'#7a9aba','--accent':'#22d3ee','--accent-rgb':'34,211,238','--green':'#34d399','--red':'#f87171','--gold':'#fbbf24','--purple':'#818cf8','--orange':'#fb923c'}
  },
  ember:{
    label:'🔥 Ember',
    vars:{'--bg':'#0d0804','--bg2':'#120a05','--card':'#1c1008','--card2':'#221408','--card-solid':'#1c1008','--border':'rgba(255,120,40,.09)','--border2':'rgba(255,120,40,.14)','--text':'#fff4ec','--muted':'#8a5a3a','--muted2':'#b07a5a','--accent':'#f97316','--accent-rgb':'249,115,22','--green':'#fbbf24','--red':'#ef4444','--gold':'#f59e0b','--purple':'#fb923c','--orange':'#f97316'}
  },
  forest:{
    label:'🌿 Forest',
    vars:{'--bg':'#060d08','--bg2':'#080f0a','--card':'#0a140c','--card2':'#0d1a0f','--card-solid':'#0a140c','--border':'rgba(80,200,100,.09)','--border2':'rgba(80,200,100,.14)','--text':'#e8f5ea','--muted':'#4a7a52','--muted2':'#6a9a72','--accent':'#22c55e','--accent-rgb':'34,197,94','--green':'#4ade80','--red':'#f87171','--gold':'#fbbf24','--purple':'#a3e635','--orange':'#fb923c'}
  },
  rose:{
    label:'🌸 Rose',
    vars:{'--bg':'#0d0608','--bg2':'#120809','--card':'#1c0a0e','--card2':'#220c12','--card-solid':'#1c0a0e','--border':'rgba(255,100,130,.09)','--border2':'rgba(255,100,130,.14)','--text':'#fff0f3','--muted':'#8a4a58','--muted2':'#b07080','--accent':'#f43f5e','--accent-rgb':'244,63,94','--green':'#fb7185','--red':'#e11d48','--gold':'#fbbf24','--purple':'#e879f9','--orange':'#fb923c'}
  },
  ocean:{
    label:'🌊 Deep Ocean',
    vars:{'--bg':'#020810','--bg2':'#030a14','--card':'#04101e','--card2':'#061424','--card-solid':'#04101e','--border':'rgba(30,100,200,.11)','--border2':'rgba(30,100,200,.17)','--text':'#dceeff','--muted':'#3a5a7a','--muted2':'#5a80a0','--accent':'#3b82f6','--accent-rgb':'59,130,246','--green':'#22d3ee','--red':'#f87171','--gold':'#fbbf24','--purple':'#818cf8','--orange':'#fb923c'}
  },
  candy:{
    label:'🍬 Candy',
    vars:{'--bg':'#0e0814','--bg2':'#120a18','--card':'#14101e','--card2':'#1a1428','--card-solid':'#14101e','--border':'rgba(200,100,255,.09)','--border2':'rgba(200,100,255,.14)','--text':'#f5e8ff','--muted':'#7a4a9a','--muted2':'#a070c0','--accent':'#a855f7','--accent-rgb':'168,85,247','--green':'#f472b6','--red':'#f43f5e','--gold':'#fbbf24','--purple':'#e879f9','--orange':'#fb923c'}
  },
};

/** Apply palette from a named theme. When `withPresetAccent` is true (settings button), theme accent + glass hue update. */
function applyThemeVars(key,withPresetAccent){
  const theme=THEMES[key];if(!theme)return;
  const root=document.documentElement;
  Object.keys(THEMES.dark.vars).forEach(k=>root.style.removeProperty(k));
  const entries=Object.entries(theme.vars).filter(([k])=>
    withPresetAccent||k!=='--accent'&&k!=='--accent-rgb');
  entries.forEach(([k,v])=>root.style.setProperty(k,v));
}

function applyTheme(key){
  const theme=THEMES[key];if(!theme)return;
  applyThemeVars(key,true);
  document.body.setAttribute('data-theme',key);
  localStorage.setItem('flux_theme',key);
  const custom=load('flux_custom_colors',{});
  Object.entries(custom)
    .filter(([k])=>k!=='--accent'&&k!=='--accent-rgb')
    .forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  if(theme.vars['--accent']){
    localStorage.setItem('flux_accent',theme.vars['--accent']);
    localStorage.setItem('flux_accent_rgb',theme.vars['--accent-rgb']||hexToRgb(theme.vars['--accent']));
  }
  updateLogoColor(theme.vars['--accent']||localStorage.getItem('flux_accent')||'#00bfff');
}
function themeDark(){applyTheme('dark');}
function themeCrimson(){applyTheme('ember');}
function themeFocus(){applyTheme('forest');}
function themeSepia(){applyTheme('rose');}
function toggleTheme(){
  const cur=localStorage.getItem('flux_theme')||'dark';
  applyTheme(cur==='light'?'dark':'light');
  if(typeof showToast==='function'){
    const next=localStorage.getItem('flux_theme')||'dark';
    showToast('Theme: '+(THEMES[next]?.label||next),'info');
  }
}
window.toggleTheme=toggleTheme;

function applyThemeByName(name){
  document.body.classList.remove('crimson','focus','sepia','cloud','aurora','ember','forest','rose','deep-ocean','candy');
  if(name&&name!=='dark'&&name!=='midnight')document.body.classList.add(name);
}
function loadTheme(){
  const custom=load('flux_custom_colors',{});
  if(custom['--accent']||custom['--accent-rgb']){
    delete custom['--accent'];delete custom['--accent-rgb'];
    save('flux_custom_colors',custom);
  }
  // Auto-detect OS color scheme on first visit
  if(!localStorage.getItem('flux_theme')){
    const prefersDark=typeof matchMedia==='undefined'||matchMedia('(prefers-color-scheme:dark)').matches;
    localStorage.setItem('flux_theme',prefersDark?'dark':'light');
  }
  const raw=localStorage.getItem('flux_theme')||'dark';
  const key=THEMES[raw]?raw:'dark';
  const theme=THEMES[key];
  applyThemeVars(key,false);
  document.body.setAttribute('data-theme',key);
  Object.entries(custom)
    .filter(([k])=>k!=='--accent'&&k!=='--accent-rgb')
    .forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  let acc=(localStorage.getItem('flux_accent')||theme.vars['--accent']||'#00bfff').replace(/^"|"$/g,'');
  let rgb=(localStorage.getItem('flux_accent_rgb')||theme.vars['--accent-rgb']||'0,191,255').replace(/^"|"$/g,'');
  localStorage.setItem('flux_accent',acc);
  localStorage.setItem('flux_accent_rgb',rgb);
  document.documentElement.style.setProperty('--accent',acc);
  document.documentElement.style.setProperty('--accent-rgb',rgb);
  setTimeout(()=>{updateLogoColor(acc);clearSvgLogoGradientStyles();},0);
}

function applyCustomVar(varName,value){
  document.documentElement.style.setProperty(varName,value);
  // Never store accent in flux_custom_colors — managed separately via flux_accent
  if(varName==='--accent'||varName==='--accent-rgb')return;
  const custom=load('flux_custom_colors',{});
  custom[varName]=value;
  save('flux_custom_colors',custom);
}
function resetCustomColors(){
  save('flux_custom_colors',{});
  const key=localStorage.getItem('flux_theme')||'dark';
  applyTheme(key);
  const b=event?.target;if(b){b.textContent='✓ Reset!';setTimeout(()=>b.textContent='↺ Reset colors',1500);}
}
function accent2FromHex(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  if(isNaN(r))return'#7ae8ff';
  const lift=n=>Math.min(255,Math.round(n+(255-n)*.38));
  return`rgb(${lift(r)},${lift(g)},${lift(b)})`;
}
function updateLogoColor(hex){
  if(!hex)return;
  const rgb=hexToRgb(hex);
  const a2=accent2FromHex(hex);
  // 1. Set on documentElement inline style (overrides stylesheet)
  document.documentElement.style.setProperty('--accent',hex);
  document.documentElement.style.setProperty('--accent-rgb',rgb);
  document.documentElement.style.setProperty('--accent2',a2);
  document.documentElement.style.setProperty('--accent-glow',`rgba(${rgb},.34)`);
  // 2. Inject/update persistent <style> tag with !important
  let styleTag=document.getElementById('fluxAccentStyle');
  if(!styleTag){
    styleTag=document.createElement('style');
    styleTag.id='fluxAccentStyle';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent=`
    :root{--accent:${hex}!important;--accent-rgb:${rgb}!important;--accent2:${a2}!important;--accent-glow:rgba(${rgb},.34)!important}
    html{--accent:${hex}!important;--accent-rgb:${rgb}!important;--accent2:${a2}!important;--accent-glow:rgba(${rgb},.34)!important}
    .sidebar-logo svg circle[stroke],.sidebar-logo svg path[stroke]{stroke:${hex}!important}
    #fluxWG stop:nth-child(2),#fluxWG2 stop:nth-child(2),#fluxWG3 stop:nth-child(2),#fluxWGAbout stop:nth-child(2),#fluxCG stop:nth-child(2),#fluxCG2 stop:nth-child(2),#fluxCG3 stop:nth-child(2),#fluxCGAbout stop:nth-child(2){stop-color:${hex}!important}
    #fluxWG stop:nth-child(3),#fluxWG2 stop:nth-child(3),#fluxWG3 stop:nth-child(3),#fluxWGAbout stop:nth-child(3){stop-color:${hex}aa!important}
    .bottom-nav .bnav-item.active{color:${hex}!important}
    .nav-item.active{color:${hex}!important;background:rgba(${rgb},.12)!important}
    .nav-item.active::before{background:${hex}!important}
    button.active,a.active,[class*="active"]{--accent:${hex}!important}
  `;
  // 3. Re-check every 100ms for 2s after any render to catch late overwrites
  if(window._accentGuard)clearInterval(window._accentGuard);
  let checks=0;
  window._accentGuard=setInterval(()=>{
    const cur=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    if(cur!==hex){
      document.documentElement.style.setProperty('--accent',hex);
      document.documentElement.style.setProperty('--accent-rgb',rgb);
    }
    if(++checks>=20)clearInterval(window._accentGuard);
  },100);
}
function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return isNaN(r)?'0,191,255':`${r},${g},${b}`;
}
/** Rotate a #RRGGBB accent on the hue wheel (degrees). Used by splash + theme tooling. */
function shiftHueHex(hex,deg){
  if(!hex||hex[0]!=='#'||hex.length<7)return hex||'#00bfff';
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  if([r,g,b].some(Number.isNaN))return hex;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d>1e-6){
    if(max===r)h=60*((((g-b)/d)%6+6)%6);
    else if(max===g)h=60*((((b-r)/d)+2)%6);
    else h=60*((((r-g)/d)+4)%6);
  }
  const l=(max+min)/2;
  const s=d<1e-6?0:d/(1-Math.abs(2*l-1)||1);
  const nh=(h+(deg||0)+360)%360;
  const c=(1-Math.abs(2*l-1))*s;
  const seg=c*(1-Math.abs((nh/60)%2-1));
  const m=l-c/2;
  let rp=0,gp=0,bp=0;
  if(nh<60){rp=c;gp=seg;}
  else if(nh<120){rp=seg;gp=c;}
  else if(nh<180){gp=c;bp=seg;}
  else if(nh<240){gp=seg;bp=c;}
  else if(nh<300){rp=seg;bp=c;}
  else{rp=c;bp=seg;}
  const R=Math.round((rp+m)*255),G=Math.round((gp+m)*255),B=Math.round((bp+m)*255);
  const toHex=n=>('0'+Math.max(0,Math.min(255,n)).toString(16)).slice(-2);
  return '#'+toHex(R)+toHex(G)+toHex(B);
}
try{window.shiftHueHex=shiftHueHex;}catch(e){}
function clearSvgLogoGradientStyles(){
  document.querySelectorAll('.sidebar-logo,.mob-drawer-logo,.login-logo,.login-logo-wrap').forEach(el=>{
    if(!el||!el.querySelector('svg'))return;
    el.style.removeProperty('background');
    el.style.removeProperty('-webkit-background-clip');
    el.style.removeProperty('-webkit-text-fill-color');
    el.style.removeProperty('background-clip');
  });
}
function setAccent(hex,rgb,el){
  // Use updateLogoColor which injects persistent <style> tag
  applyCustomVar('--accent',hex);
  applyCustomVar('--accent-rgb',rgb);
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  if(el)el.classList.add('active');
  clearSvgLogoGradientStyles();
  // Text-gradient logos only — SVG wordmarks break if background-clip:text is applied
  const logoGrad=`linear-gradient(135deg,${hex},${hex}bb)`;
  document.querySelectorAll('.sidebar-logo,.mob-drawer-logo,.login-logo,[class*="logo"]').forEach(logoEl=>{
    if(!logoEl||logoEl.querySelector('img.flux-brand-logo')||logoEl.querySelector('svg'))return;
    logoEl.style.background=logoGrad;
    logoEl.style.webkitBackgroundClip='text';
    logoEl.style.webkitTextFillColor='transparent';
    logoEl.style.backgroundClip='text';
  });
  const tp=document.getElementById('topbarTaskPill');
  if(tp)tp.style.borderColor=`rgba(${rgb},.3)`;
  // Persist to localStorage as raw strings (NOT via save() which JSON.stringify wraps in quotes)
  localStorage.setItem('flux_accent',hex);
  localStorage.setItem('flux_accent_rgb',rgb);
  syncKey('accent',{accent:hex,accentRgb:rgb});
  updateLogoColor(hex);
  try{if(window.FluxVisual&&typeof FluxVisual.updateNavSquiggle==='function')FluxVisual.updateNavSquiggle(hex);}catch(e){}
}
function applyCustomColor(){
  const hex=document.getElementById('customColor').value;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  setAccent(hex,`${r},${g},${b}`,null);
}

// ══ SETTINGS ══
function switchStab(id,el){
  document.querySelectorAll('#settings .stab').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false');});
  document.querySelectorAll('#settings .spane').forEach(p=>p.classList.remove('active'));
  if(el){el.classList.add('active');el.setAttribute('aria-selected','true');}
  const pane=document.getElementById('spane-'+id);
  if(pane)pane.classList.add('active');
  if(id==='appearance'){applyFontScale();applyReduceMotion();if(window.FluxPersonal&&FluxPersonal.initSettingsUI)FluxPersonal.initSettingsUI();if(window.FluxPersonal&&FluxPersonal.renderPanelLayoutSettings)FluxPersonal.renderPanelLayoutSettings();}
  if(id==='data'&&typeof renderStorageMeter==='function')renderStorageMeter();
  if(id==='account'&&typeof renderSubscriptionCard==='function')renderSubscriptionCard();
}
function toggleSetting(k,el){settings[k]=!settings[k];el.classList.toggle('on',settings[k]);save('flux_settings',settings);}
function toggleNotifyBrowser(el){
  if(!('Notification' in window)){showToast('Notifications not supported','warning');return;}
  const next=!settings.notifyBrowser;
  if(next&&Notification.permission==='default'){
    Notification.requestPermission().then(p=>{
      settings.notifyBrowser=p==='granted';
      el.classList.toggle('on',settings.notifyBrowser);
      save('flux_settings',settings);loadSettingsUI();
      if(settings.notifyBrowser){showToast('Due-soon reminders on','success');checkDueNotifications();}
    });
    return;
  }
  if(next&&Notification.permission==='denied'){
    showToast('Unblock notifications in browser settings for this site','warning');return;
  }
  settings.notifyBrowser=next;
  el.classList.toggle('on',settings.notifyBrowser);
  save('flux_settings',settings);loadSettingsUI();
}
function saveDND(){settings.dndStart=document.getElementById('dndStart').value;settings.dndEnd=document.getElementById('dndEnd').value;save('flux_settings',settings);const b=event?.target;if(b){b.textContent='✓';setTimeout(()=>b.textContent='Save',1500);}}
function saveDailyGoal(){settings.dailyGoalHrs=parseFloat(document.getElementById('dailyGoalHrs').value)||2;save('flux_settings',settings);const done=tMins/60,goal=settings.dailyGoalHrs;const el=document.getElementById('dailyGoalStatus');if(el)el.textContent=done>=goal?`✓ Goal reached! (${done.toFixed(1)}h / ${goal}h)`:`Progress: ${done.toFixed(1)}h / ${goal}h`;}
function saveClassScheduleDisplay(v){
  const ok=['full','collapsed','hidden'];
  settings.classScheduleDisplay=ok.includes(v)?v:'full';
  save('flux_settings',settings);
  if(typeof updateNextClassPill==='function')updateNextClassPill();
  if(typeof renderDynamicFocus==='function')renderDynamicFocus();
}
function loadSettingsUI(){
  const pt=document.getElementById('panicToggle');if(pt)pt.classList.toggle('on',settings.panic!==false);
  const qt=document.getElementById('quietToggle');if(qt)qt.classList.toggle('on',settings.quiet!==false);
  const ds=document.getElementById('dndStart');if(ds)ds.value=settings.dndStart||'07:50';
  const de=document.getElementById('dndEnd');if(de)de.value=settings.dndEnd||'14:30';
  const dg=document.getElementById('dailyGoalHrs');if(dg)dg.value=settings.dailyGoalHrs||2;
  const nb=document.getElementById('notifyBrowserToggle');if(nb)nb.classList.toggle('on',!!settings.notifyBrowser);
  const ns=document.getElementById('notifyStatusLine');if(ns){
    if(!('Notification' in window))ns.textContent='Not supported in this browser.';
    else if(Notification.permission==='granted')ns.textContent='Notifications allowed.';
    else if(Notification.permission==='denied')ns.textContent='Blocked in browser settings — enable for this site to get reminders.';
    else ns.textContent='Optional — tap Enable to allow due-soon reminders.';
  }
  renderNoHWList();
  const csd=document.getElementById('classScheduleDisplaySelect');
  if(csd){
    const v=settings.classScheduleDisplay;
    csd.value=v==='collapsed'||v==='hidden'?v:'full';
  }
  if(window.FluxPersonal&&FluxPersonal.initSettingsUI)FluxPersonal.initSettingsUI();
  if(typeof window.fluxGoogleDocsLoadSettingsUI==='function')window.fluxGoogleDocsLoadSettingsUI();
  updateMasterBacklogCardVisibility();
}
function requestFluxNotifications(){
  if(!('Notification' in window)){showToast('Notifications not supported here','warning');return;}
  Notification.requestPermission().then(p=>{
    loadSettingsUI();
    if(p==='granted'){settings.notifyBrowser=true;save('flux_settings',settings);const nb=document.getElementById('notifyBrowserToggle');if(nb)nb.classList.add('on');showToast('Notifications enabled','success');checkDueNotifications();}
    else showToast('Permission not granted','info');
  });
}
function renderNoHWList(){
  const el=document.getElementById('noHWList');if(!el)return;
  const days=loadRestDaysList();
  if(!days.length){el.innerHTML='<div style="color:var(--muted);font-size:.78rem">No rest days yet.</div>';return;}
  const sorted=[...days].sort((a,b)=>a.date.localeCompare(b.date));
  el.innerHTML=sorted.map(r=>{
    const lab=r.kind==='sick'?'🤒 Sick':'🛋 Lazy';
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span><strong style="font-size:.72rem;color:var(--muted2)">${lab}</strong> · ${new Date(r.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><button type="button" onclick="removeRestDay('${r.date}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.8rem;padding:2px 6px" aria-label="Remove">✕</button></div>`;
  }).join('');
}
function addRestDay(){
  const inp=document.getElementById('noHWInput');
  const kindEl=document.getElementById('restDayKind');
  if(!inp||!inp.value)return;
  const kind=(kindEl&&kindEl.value==='sick')?'sick':'lazy';
  const days=loadRestDaysList().filter(x=>x.date!==inp.value);
  days.push({date:inp.value,kind});
  saveRestDaysList(days);
  inp.value='';
  renderNoHWList();
  if(typeof renderCalendar==='function')renderCalendar();
  if(typeof renderDashWeekStrip==='function')renderDashWeekStrip();
  if(typeof checkTimePoverty==='function')checkTimePoverty();
  if(typeof renderDynamicFocus==='function')renderDynamicFocus();
  if(window.FluxMega&&FluxMega.render)FluxMega.render();
  if(currentUser&&typeof syncToCloud==='function')syncToCloud();
}
function removeRestDay(d){
  const days=loadRestDaysList().filter(x=>x.date!==d);
  saveRestDaysList(days);
  renderNoHWList();
  if(typeof renderCalendar==='function')renderCalendar();
  if(typeof renderDashWeekStrip==='function')renderDashWeekStrip();
  if(typeof checkTimePoverty==='function')checkTimePoverty();
  if(typeof renderDynamicFocus==='function')renderDynamicFocus();
  if(window.FluxMega&&FluxMega.render)FluxMega.render();
  if(currentUser&&typeof syncToCloud==='function')syncToCloud();
}
function addNoHWDay(){addRestDay();}
function removeNoHWDay(d){removeRestDay(d);}

function renderTabCustomizer(){
  const el=document.getElementById('tabCustomizerList');if(!el)return;
  el.innerHTML=tabConfig.map((t,i)=>`
    <div class="tab-row" draggable="true" data-idx="${i}"
      ondragstart="tcDragStart(event,${i})"
      ondragover="tcDragOver(event,${i})"
      ondragleave="tcDragLeave(event)"
      ondrop="tcDrop(event,${i})"
      ondragend="tcDragEnd(event)">
      <span class="tab-drag-handle" title="Drag to reorder">⠿</span>
      <span class="tab-row-icon">${t.icon}</span>
      <span class="tab-row-name">${t.label}</span>
      <button class="tab-row-toggle ${t.visible?'on':''}" onclick="tcToggle(${i})" title="${t.visible?'Hide':'Show'}"></button>
    </div>`).join('');
}
let tcDragIdx=null;
function tcDragStart(e,i){
  tcDragIdx=i;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',String(i));
  setTimeout(()=>e.currentTarget.style.opacity='.4',0);
}
function tcDragOver(e,i){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  // Highlight drop target
  document.querySelectorAll('.tab-row').forEach(r=>r.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}
function tcDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function tcDragEnd(e){
  e.currentTarget.style.opacity='';
  document.querySelectorAll('.tab-row').forEach(r=>{r.classList.remove('drag-over');r.style.opacity='';});
}
function tcDrop(e,i){
  e.preventDefault();
  document.querySelectorAll('.tab-row').forEach(r=>r.classList.remove('drag-over'));
  if(tcDragIdx===null||tcDragIdx===i){tcDragIdx=null;return;}
  const moved=tabConfig.splice(tcDragIdx,1)[0];
  tabConfig.splice(i,0,moved);
  tcDragIdx=null;
  save('flux_tabs',tabConfig);
  renderTabCustomizer();
  renderSidebars();
}
function tcToggle(i){
  if(tabConfig[i].id==='settings'&&tabConfig[i].visible){return;}
  tabConfig[i].visible=!tabConfig[i].visible;
  save('flux_tabs',tabConfig);
  renderTabCustomizer();
  renderSidebars();
}
function resetTabs(){
  tabConfig=DEFAULT_TABS.map(t=>({...t}));
  save('flux_tabs',tabConfig);
  renderTabCustomizer();
  renderSidebars();
  const b=event?.target;if(b){b.textContent='✓ Reset!';setTimeout(()=>b.textContent='↺ Reset to defaults',1500);}
}
function exportData(){const data={tasks,notes:notes.map(n=>({...n,body:strip(n.body)})),habits,goals,colleges,moodHistory,schoolInfo,classes,settings,extras,ecSchools,ecGoals,flux_cycle_config:load('flux_cycle_config',null),flux_weekly_events:load('flux_weekly_events',[]),flux_events:load('flux_events',[]),exportDate:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='flux-data.json';a.click();URL.revokeObjectURL(url);}
function exportToICal(){
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_EXPORT_GATE&&requiresPro('exportIcal')){
    showUpgradePrompt('exportIcal','Export your tasks to iCal with Flux Pro');
    return;
  }
  const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Flux Planner//EN','CALSCALE:GREGORIAN'];
  tasks.filter(t=>t.date&&!t.done).forEach(t=>{
    const d=t.date.replace(/-/g,'');
    lines.push('BEGIN:VEVENT','UID:flux-task-'+t.id+'@fluxplanner','DTSTART;VALUE=DATE:'+d,'SUMMARY:'+esc(t.name),
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Flux reminder','TRIGGER:-P1D','END:VALARM','END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='flux.ics';a.click();URL.revokeObjectURL(url);
  showToast('Calendar exported (with day-before alerts)','success');
}
function clearCache(){
  const inp=prompt('Type DELETE to confirm wiping all planner data. This cannot be undone.');
  if(inp!=='DELETE'){if(inp!==null)alert('Cancelled — you must type DELETE exactly.');return;}
  const keep=[
    'flux_settings','flux_accent','flux_accent_rgb','flux_theme','profile','flux_user_name',
    'flux_liquid_glass','flux_perf_snappy','flux_ui_density','flux_mood_tint_enabled',
    'flux_nav_counts_v1','flux_layout_dashboard_v1','flux_layout_calendar_v1',
  ];
  Object.keys(localStorage).forEach(k=>{if(!keep.includes(k))localStorage.removeItem(k);});
  tasks=[];notes=[];habits=[];goals=[];colleges=[];moodHistory=[];extras=[];ecSchools=[];ecGoals=[];
  renderStats();renderTasks();
  showToast('All planner data cleared.','info');
}

// ══ MOD / DEV ACCOUNT ══
// ══ OWNER / DEV ACCOUNT SYSTEM ══
const OWNER_EMAIL='azfermohammed21@gmail.com';

// Permission levels: owner > dev > user
// Dev accounts + their permissions stored in Supabase under owner's row
function isOwner(){return currentUser&&currentUser.email===OWNER_EMAIL;}
function getMyRole(){
  if(isOwner())return'owner';
  const devAccounts=load('flux_dev_accounts',[]);
  const me=devAccounts.find(d=>d.email===currentUser?.email);
  return me?'dev':'user';
}
/** Owner or dev (admin-tier) — used for internal roadmap UI. */
function canAccessMasterBacklog(){
  const r=getMyRole();
  return r==='owner'||r==='dev';
}
function updateMasterBacklogCardVisibility(){
  const mb=document.getElementById('settingsMasterBacklogCard');
  if(mb)mb.style.display=canAccessMasterBacklog()?'block':'none';
}
function getMyDevPerms(){
  const devAccounts=load('flux_dev_accounts',[]);
  const me=devAccounts.find(d=>d.email===currentUser?.email);
  return me?.perms||[];
}
function hasDevPerm(perm){
  if(isOwner())return true;
  return getMyDevPerms().includes(perm);
}

/** Sections the owner can show/hide on ⚡ Dev Panel for dev accounts (owner always sees all + this editor). */
const DEV_PANEL_SECTION_META=[
  {id:'devMode',label:'Dev Mode toggle',desc:'Flip local dev mode for testing'},
  {id:'featureFlags',label:'Feature flags',desc:'Planner tab visibility toggles'},
  {id:'actions',label:'Clear & sync',desc:'Clear my data and force cloud sync'},
  {id:'stagedRollout',label:'Staged rollout',desc:'Build preview and push to all users'},
];
function getDevPanelSectionsMap(){
  const pc=load('flux_platform_config',{})||{};
  const raw=pc.devPanelSections&&typeof pc.devPanelSections==='object'?pc.devPanelSections:{};
  const out={};
  DEV_PANEL_SECTION_META.forEach(s=>{out[s.id]=raw[s.id]!==false;});
  return out;
}
function devPanelShowsSection(sectionId){
  if(isOwner())return true;
  if(getMyRole()!=='dev')return false;
  return getDevPanelSectionsMap()[sectionId]===true;
}
function saveDevPanelSectionsMap(map){
  const next={...getDevPanelSectionsMap(),...map};
  if(typeof savePlatformConfig==='function'){
    savePlatformConfig({devPanelSections:next});
  }else{
    const pc=load('flux_platform_config',{})||{};
    pc.devPanelSections=next;
    save('flux_platform_config',pc);
  }
  try{if(typeof syncKey==='function')syncKey('platform',1);}catch(_){}
  try{if(isOwner()&&typeof syncToCloud==='function')void syncToCloud();}catch(_){}
  try{if(typeof ownerAuditAppend==='function')ownerAuditAppend('dev_panel_layout',JSON.stringify(next));}catch(_){}
}
function renderDevPanelLayoutEditorHtml(){
  if(!isOwner())return'';
  const map=getDevPanelSectionsMap();
  return`<div class="dev-panel-layout-editor-wrap" style="margin-bottom:16px;padding:12px 14px;background:var(--card2);border:1px solid var(--border2);border-radius:12px">
    <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:6px">Dev panel layout</div>
    <div style="font-size:.72rem;color:var(--muted2);margin-bottom:10px;line-height:1.45">Toggle what <b>dev accounts</b> see in ⚡ Dev Panel. You always see every section.</div>
    ${DEV_PANEL_SECTION_META.map(s=>{
      const on=map[s.id];
      return`<label style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:.8rem">
        <input type="checkbox" data-dev-panel-section="${s.id}" ${on?'checked':''} style="margin-top:3px;width:15px;height:15px;flex-shrink:0">
        <span><b>${esc(s.label)}</b><br><span style="font-size:.68rem;color:var(--muted2)">${esc(s.desc)}</span></span>
      </label>`;
    }).join('')}
    <button type="button" onclick="saveDevPanelSectionsFromCheckboxes(this)" style="margin-top:12px;width:100%;padding:9px;font-size:.78rem;font-weight:700;border-radius:10px;background:rgba(var(--accent-rgb),.14);border:1px solid rgba(var(--accent-rgb),.32);color:var(--accent);cursor:pointer">Save layout for devs</button>
  </div>`;
}
window.saveDevPanelSectionsFromCheckboxes=function(anchor){
  if(!isOwner())return;
  const wrap=anchor&&anchor.closest?anchor.closest('.dev-panel-layout-editor-wrap'):null;
  const scope=wrap||document;
  const next={};
  scope.querySelectorAll('[data-dev-panel-section]').forEach(cb=>{
    next[cb.getAttribute('data-dev-panel-section')]=cb.checked;
  });
  saveDevPanelSectionsMap(next);
  if(typeof showToast==='function')showToast('Dev panel layout saved','success');
  if(document.getElementById('flux_control')?.classList.contains('active')&&typeof renderFluxControlTab==='function')renderFluxControlTab();
  else if(document.getElementById('modPanel'))openModPanel();
  else if(typeof reopenOwnerSuite==='function')reopenOwnerSuite('team');
};
window.renderDevPanelLayoutEditorHtml=renderDevPanelLayoutEditorHtml;

function isDevMode(){return load('flux_dev_mode',false);}

// Load dev accounts from cloud (stored under owner's Supabase row)
async function loadDevAccounts(){
  const sb=getSB();if(!sb)return;
  try{
    const{data}=await sb.from('user_data').select('data').eq('id',currentUser.id).single();
    if(data?.data?.devAccounts){
      save('flux_dev_accounts',data.data.devAccounts);
    }
  }catch(e){}
}

// Save dev accounts to cloud under owner's row
async function saveDevAccounts(devAccounts){
  save('flux_dev_accounts',devAccounts);
  // Also push to cloud immediately
  if(isOwner())await syncToCloud();
}

function initModFeatures(){
  /* Owner / dev tools: sidebar → Admin → Owner control or Dev panel (full planner tab). */
}

function buildModPanelCardHtml(embed){
  const role=getMyRole();
  const devMode=isDevMode();
  const devAccounts=load('flux_dev_accounts',[]);
  const allPerms=['clear_data','feature_flags','dev_mode','manage_devs','view_users'];
  const permLabels={clear_data:'Clear Data',feature_flags:'Feature Flags',dev_mode:'Dev Mode Toggle',manage_devs:'Manage Dev Accounts',view_users:'View Users'};
  const myPerms=getMyDevPerms();
  const showDevModeBlock=devPanelShowsSection('devMode')&&(isOwner()||myPerms.includes('dev_mode'));
  const showFlagsBlock=devPanelShowsSection('featureFlags')&&(isOwner()||myPerms.includes('feature_flags'));
  const showActionsBlock=devPanelShowsSection('actions');
  const showClearBtn=showActionsBlock&&(isOwner()||myPerms.includes('clear_data'));
  const showForceSync=showActionsBlock;
  const showStagedBlock=devPanelShowsSection('stagedRollout');
  const devPanelEmpty=!isOwner()&&!showDevModeBlock&&!showFlagsBlock&&!showActionsBlock&&!showStagedBlock;
  const dismissClick=embed?`onclick="nav('dashboard')"`:`onclick="document.getElementById('modPanel')?.remove()"`;
  const cardScroll=embed?'max-height:none;overflow:visible':'max-height:90vh;overflow-y:auto';

  const devAccountsHTML=isOwner()?`
    <div style="margin-top:18px">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:10px">Dev Accounts</div>
      <div id="devAccountsList">
        ${devAccounts.length?devAccounts.map((d,i)=>`
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:.82rem;font-weight:700;flex:1">${d.email}</span>
              <button onclick="removeDevAccount(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:2px 6px">✕ Remove</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${allPerms.map(p=>`<button onclick="toggleDevPerm(${i},'${p}',this)" style="padding:3px 10px;font-size:.68rem;border-radius:20px;background:${d.perms?.includes(p)?'rgba(var(--accent-rgb),.15)':'rgba(255,255,255,.04)'};border:1px solid ${d.perms?.includes(p)?'rgba(var(--accent-rgb),.35)':'var(--border2)'};color:${d.perms?.includes(p)?'var(--accent)':'var(--muted2)'}">${permLabels[p]}</button>`).join('')}
            </div>
          </div>`).join(''):'<div style="color:var(--muted);font-size:.78rem;margin-bottom:10px">No dev accounts yet.</div>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="email" id="newDevEmail" placeholder="email@gmail.com" style="flex:1;margin:0;padding:8px 12px;font-size:.8rem">
        <button onclick="addDevAccount()" style="padding:8px 14px;font-size:.78rem;flex-shrink:0">+ Add Dev</button>
      </div>
    </div>`:'';

  return`
    <div style="background:var(--card);border:1px solid ${role==='owner'?'rgba(251,191,36,.4)':'rgba(var(--accent-rgb),.3)'};border-radius:22px;padding:24px;width:100%;max-width:500px;box-shadow:${embed?'0 8px 40px rgba(0,0,0,.2)':'0 32px 80px rgba(0,0,0,.6)'};${cardScroll}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="font-size:1.4rem">${role==='owner'?'👑':'⚡'}</div>
        <div>
          <div style="font-size:1rem;font-weight:800">${role==='owner'?'Owner Panel':'Dev Panel'}</div>
          <div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${currentUser?.email}</div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          <span style="font-size:.65rem;padding:3px 8px;border-radius:20px;background:${role==='owner'?'rgba(251,191,36,.15)':'rgba(var(--accent-rgb),.12)'};border:1px solid ${role==='owner'?'rgba(251,191,36,.3)':'rgba(var(--accent-rgb),.25)'};color:${role==='owner'?'var(--gold)':'var(--accent)'};font-family:JetBrains Mono,monospace">${role.toUpperCase()} · ${isDevMode()?'DEV':'LIVE'}</span>
          <button type="button" ${dismissClick} style="background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;padding:0" aria-label="${embed?'Back to planner':'Close'}">✕</button>
        </div>
      </div>

      ${isOwner()?renderDevPanelLayoutEditorHtml():''}

      ${devPanelEmpty?`<div style="padding:14px 12px;margin-bottom:8px;background:var(--card2);border:1px solid var(--border2);border-radius:12px;font-size:.78rem;color:var(--muted2);line-height:1.5">No sections are enabled for dev accounts on this panel. Ask the owner to turn sections on in <b>Dev Panel</b> or <b>Owner Suite → Team &amp; roles</b>.</div>`:''}

      ${showDevModeBlock?`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
        <div><div style="font-size:.87rem;font-weight:700">🧪 Dev Mode</div><div style="font-size:.72rem;color:var(--muted)">Test features before pushing to users</div></div>
        <button onclick="toggleDevMode()" style="padding:6px 16px;font-size:.78rem;background:${devMode?'var(--green)':'rgba(255,255,255,.06)'};border:1px solid ${devMode?'var(--green)':'var(--border2)'};color:${devMode?'#080a0f':'var(--muted2)'}">${devMode?'ON':'OFF'}</button>
      </div>`:''}

      ${showFlagsBlock?`
      <div style="margin-top:14px;margin-bottom:6px;font-size:.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-family:'JetBrains Mono',monospace">Feature Flags</div>
      ${['ai','canvas','calendar','goals','mood','timer','notes'].map(f=>{
        const enabled=load('flux_feat_'+f,true);
        return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.85rem;font-weight:500">${f.charAt(0).toUpperCase()+f.slice(1)}</span>
          <button onclick="toggleFeatureFlag('${f}',this)" style="padding:4px 12px;font-size:.72rem;background:${enabled?'rgba(var(--accent-rgb),.15)':'rgba(255,255,255,.04)'};border:1px solid ${enabled?'rgba(var(--accent-rgb),.3)':'var(--border2)'};color:${enabled?'var(--accent)':'var(--muted2)'}">${enabled?'Enabled':'Disabled'}</button>
        </div>`;
      }).join('')}`:''}

      ${showActionsBlock?`<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
        ${showClearBtn?`<button onclick="clearMyPlannerData()" style="flex:1;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);color:var(--red);font-size:.78rem;min-width:120px">🗑 Clear My Data</button>`:''}
        ${showForceSync?`<button onclick="forceSyncNow()" style="flex:1;font-size:.78rem;min-width:100px">⟳ Force Sync</button>`:''}
      </div>`:''}

      ${showStagedBlock?(()=>{
        const buildId=(typeof FLUX_BUILD_ID!=='undefined'&&FLUX_BUILD_ID)||(window.FLUX_BUILD_ID||'unknown');
        const gate=(typeof FluxRelease!=='undefined'&&FluxRelease.getGate())||null;
        const released=gate&&gate.released?String(gate.released).replace(/^build-/,''):'— none yet';
        const preview=String(buildId).replace(/^build-/,'');
        const isLive=gate&&gate.released===buildId;
        return`
        <div style="margin-top:16px;padding:12px 14px;background:linear-gradient(135deg,rgba(251,191,36,.1),rgba(124,92,255,.08));border:1px solid rgba(251,191,36,.28);border-radius:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:.6rem;font-weight:800;letter-spacing:.08em;color:#fbbf24;font-family:JetBrains Mono,monospace">STAGED ROLLOUT</span>
            <span style="margin-left:auto;font-size:.62rem;color:var(--muted);font-family:JetBrains Mono,monospace">${isLive?'live':'preview'}</span>
          </div>
          <div style="font-size:.72rem;color:var(--muted2);line-height:1.55;margin-bottom:10px">Preview build <b style="color:var(--text)">${preview}</b> · users on <b style="color:var(--text)">${released}</b>${isLive?' ✓':''}</div>
          <button type="button" onclick="window.FluxRelease&&window.FluxRelease.openPushDialog()" ${isLive?'disabled':''} style="width:100%;padding:8px;font-size:.78rem;font-weight:700;border-radius:10px;background:${isLive?'var(--card2)':'linear-gradient(135deg,#fbbf24,#f59e0b)'};border:1px solid ${isLive?'var(--border)':'rgba(251,191,36,.4)'};color:${isLive?'var(--muted)':'#080a0f'};cursor:${isLive?'default':'pointer'};opacity:${isLive?0.6:1}">${isLive?'✓ Build already released':'🚀 Push this build to all users'}</button>
        </div>`;
      })():''}

      ${devAccountsHTML}
    </div>`;
}

function refreshFluxControlIfActive(){
  const p=document.getElementById('flux_control');
  if(p&&p.classList.contains('active')&&typeof renderFluxControlTab==='function'){
    renderFluxControlTab();
    return true;
  }
  return false;
}

function renderFluxControlTab(){
  const mount=document.getElementById('fluxControlMount');
  if(!mount)return;
  document.getElementById('modPanel')?.remove();
  document.getElementById('ownerSuite')?.remove();
  const role=getMyRole();
  if(role==='owner'&&typeof openOwnerSuite==='function'){
    const pref=window.__fluxOwnerPrefTab;
    window.__fluxOwnerPrefTab=null;
    openOwnerSuite(pref,{mount,skipNav:true});
  }else if(role==='dev'){
    openModPanel({mount});
  }
}
window.renderFluxControlTab=renderFluxControlTab;

function openModPanel(opts){
  opts=opts||{};
  const role=getMyRole();
  if(role==='user')return;
  if(opts.mount){
    opts.mount.innerHTML=`<div class="flux-mod-panel-embed" style="max-width:520px;margin:0 auto">${buildModPanelCardHtml(true)}</div>`;
    return;
  }
  const existing=document.getElementById('modPanel');if(existing)existing.remove();
  const panel=document.createElement('div');
  panel.id='modPanel';
  panel.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);overflow-y:auto';
  panel.innerHTML=buildModPanelCardHtml(false);
  document.body.appendChild(panel);
}

function refreshDevAccountUI(){
  if(document.getElementById('flux_control')?.classList.contains('active')&&typeof renderFluxControlTab==='function'){
    renderFluxControlTab();
    return;
  }
  if(typeof reopenOwnerSuite==='function'&&document.getElementById('ownerSuite'))reopenOwnerSuite();
  else if(document.getElementById('ownerSuite')&&typeof openOwnerSuite==='function')openOwnerSuite(undefined,{overlay:true});
  else openModPanel();
}

function addDevAccount(){
  if(!isOwner())return;
  const email=(document.getElementById('osNewDevEmail')||document.getElementById('newDevEmail'))?.value?.trim();
  if(!email||!email.includes('@')){alert('Enter a valid email.');return;}
  const devAccounts=load('flux_dev_accounts',[]);
  if(devAccounts.find(d=>d.email===email)){alert('Already a dev account.');return;}
  devAccounts.push({email,role:'viewer',perms:['view_users'],addedAt:Date.now()});
  saveDevAccounts(devAccounts);
  refreshDevAccountUI();
}

function removeDevAccount(idx){
  if(!isOwner())return;
  const devAccounts=load('flux_dev_accounts',[]);
  devAccounts.splice(idx,1);
  saveDevAccounts(devAccounts);
  refreshDevAccountUI();
}

function toggleDevPerm(idx,perm,btn){
  if(!isOwner())return;
  const devAccounts=load('flux_dev_accounts',[]);
  const acc=devAccounts[idx];if(!acc)return;
  if(!acc.perms)acc.perms=[];
  const has=acc.perms.includes(perm);
  if(has)acc.perms=acc.perms.filter(p=>p!==perm);
  else acc.perms.push(perm);
  saveDevAccounts(devAccounts);
  btn.style.background=!has?'rgba(var(--accent-rgb),.15)':'rgba(255,255,255,.04)';
  btn.style.borderColor=!has?'rgba(var(--accent-rgb),.35)':'var(--border2)';
  btn.style.color=!has?'var(--accent)':'var(--muted2)';
  if(typeof ownerAuditAppend==='function')ownerAuditAppend('dev_perm_toggle',JSON.stringify({idx,perm,on:!has}));
}

function toggleDevMode(){
  const cur=isDevMode();
  save('flux_dev_mode',!cur);
  if(!refreshFluxControlIfActive())openModPanel();
}

function toggleFeatureFlag(feature,btn){
  const cur=load('flux_feat_'+feature,true);
  save('flux_feat_'+feature,!cur);
  btn.textContent=cur?'Disabled':'Enabled';
  btn.style.background=cur?'rgba(255,255,255,.04)':'rgba(var(--accent-rgb),.15)';
  btn.style.borderColor=cur?'var(--border2)':'rgba(var(--accent-rgb),.3)';
  btn.style.color=cur?'var(--muted2)':'var(--accent)';
  const tc=tabConfig.find(t=>t.id===feature);
  if(tc){tc.visible=!cur;save('flux_tabs',tabConfig);renderSidebars();}
  if(isOwner()&&typeof ownerAuditAppend==='function')ownerAuditAppend('feature_flag',feature+':'+(!cur));
}

function clearMyPlannerData(){
  if(!confirm('Clear ALL your planner data? This cannot be undone.'))return;
  tasks=[];notes=[];habits=[];goals=[];colleges=[];moodHistory=[];extras=[];ecSchools=[];ecGoals=[];
  save('tasks',tasks);save('flux_notes',notes);
  save('flux_habits',habits);save('flux_goals',goals);save('flux_colleges',colleges);
  save('flux_mood',moodHistory);
  save('flux_extras',extras);save('flux_ec_schools',ecSchools);save('flux_ec_goals',ecGoals);
  renderStats();renderTasks();renderNotesList();
  renderExtrasList();renderSchoolsList();renderECGoals();renderMoodHistory();
  if(currentUser)syncToCloud();
  document.getElementById('modPanel')?.remove();
  refreshFluxControlIfActive();
  const n=document.createElement('div');
  n.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--green);color:#080a0f;padding:10px 20px;border-radius:10px;font-size:.82rem;font-weight:700;z-index:9999';
  n.textContent='✓ Planner data cleared';
  document.body.appendChild(n);setTimeout(()=>n.remove(),2500);
}


// ══════════════════════════════════════════
// FEATURE ENHANCEMENTS v3
// ══════════════════════════════════════════

// ── DYNAMIC FOCUS CARD ──
function updateDynamicFocus(){
  const el=document.getElementById('dynamicFocus');if(!el)return;
  const now=new Date();
  const todayClasses=classes.filter(c=>{
    if(!c.timeStart)return false;
    const days=c.days||'';
    const dayMap={0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
    const d=dayMap[now.getDay()];
    if(days&&days!=='Mon-Fri'&&days!=='Any day'&&days!=='')return days.includes(d);
    return true;
  }).sort((a,b)=>a.timeStart?.localeCompare(b.timeStart));

  // Find next class
  let nextClass=null,gapMin=null;
  for(const c of todayClasses){
    if(!c.timeStart)continue;
    const[h,m]=c.timeStart.split(':').map(Number);
    const classTime=new Date(now);classTime.setHours(h,m,0,0);
    if(classTime>now){
      nextClass=c;
      gapMin=Math.round((classTime-now)/60000);
      break;
    }
  }

  if(!nextClass){
    el.innerHTML=`<div class="focus-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:1.6rem">🌙</div>
        <div><div class="focus-time" style="font-size:1.4rem">No more classes</div><div class="focus-label">Free for the rest of the day</div></div>
      </div>
    </div>`;
    return;
  }

  const hrs=Math.floor(gapMin/60),mins=gapMin%60;
  const timeStr=hrs>0?`${hrs}h ${mins}m`:`${mins}m`;

  // Find a task that fits in the gap
  const fitTask=tasks.filter(t=>!t.done&&t.estTime&&parseInt(t.estTime)<=gapMin).sort((a,b)=>(b.urgencyScore||0)-(a.urgencyScore||0))[0];
  const sugHtml=fitTask?`<div style="margin-top:12px;padding:10px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid var(--border)">
    <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:4px">Suggested task for this gap</div>
    <div style="font-size:.85rem;font-weight:600">${esc(fitTask.name)}</div>
    <div style="font-size:.7rem;color:var(--muted2)">⏱ ${fitTask.estTime}m — fits before ${nextClass.name}</div>
  </div>`:'';

  el.innerHTML=`<div class="focus-card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <div>
        <div class="focus-label">Next class in</div>
        <div class="focus-time">${timeStr}</div>
        <div style="font-size:.8rem;color:var(--muted2);margin-top:4px">${esc(nextClass.name)}${nextClass.room?' · '+esc(nextClass.room):''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-family:'JetBrains Mono',monospace">Starts</div>
        <div style="font-size:1rem;font-weight:700;font-family:'JetBrains Mono',monospace">${fmtTime(nextClass.timeStart)}</div>
      </div>
    </div>
    ${sugHtml}
  </div>`;
}

// ── TIME POVERTY DETECTOR ─// ══ AI CHAT HISTORY / TABS ══
let aiChats=[];
function getAIChatKey(){return currentUser?'flux_ai_chats_'+currentUser.id:'flux_ai_chats_guest';}
function loadAIChatsForUser(){aiChats=load(getAIChatKey(),[]);if(!Array.isArray(aiChats))aiChats=[];}
function saveAIChats(){save(getAIChatKey(),aiChats);}
let aiCurrentChatId=null;

function syncAISidebarLayout(){
  const root=document.querySelector('#ai.flux-ai-panel.ai-root');
  const side=document.querySelector('#ai.flux-ai-panel.ai-root .ai-sidebar');
  if(!root||!side)return;
  const hidden=localStorage.getItem('flux_ai_sidebar_hidden')==='1';
  const compact=!hidden&&localStorage.getItem('flux_ai_chats_compact')==='1';
  root.classList.toggle('ai-root--sidebar-hidden',hidden);
  side.classList.toggle('ai-sidebar--chats-compact',compact&&!hidden);
  const btn=document.getElementById('aiChatCompactBtn');
  if(btn){
    btn.setAttribute('aria-pressed',compact&&!hidden?'true':'false');
    btn.title=hidden?'Sidebar hidden — use ☰ in header to show':(compact?'Expand sidebar (roomy tabs)':'Compact tabs — again to hide sidebar');
    btn.setAttribute('aria-label',hidden?'Sidebar hidden':`Cycle sidebar: ${compact?'compact':'full'}`);
  }
  const rev=document.getElementById('aiSidebarRevealBtn');
  if(rev)rev.hidden=!hidden;
}
function fluxRevealAISidebar(){
  try{
    localStorage.setItem('flux_ai_sidebar_hidden','0');
    localStorage.setItem('flux_ai_chats_compact','0');
  }catch(e){}
  syncAISidebarLayout();
}
function toggleAIChatListCompact(){
  const hidden=localStorage.getItem('flux_ai_sidebar_hidden')==='1';
  const compact=localStorage.getItem('flux_ai_chats_compact')==='1';
  try{
    if(!hidden&&!compact){
      localStorage.setItem('flux_ai_chats_compact','1');
    }else if(!hidden&&compact){
      localStorage.setItem('flux_ai_sidebar_hidden','1');
      localStorage.setItem('flux_ai_chats_compact','0');
    }else{
      localStorage.setItem('flux_ai_sidebar_hidden','0');
      localStorage.setItem('flux_ai_chats_compact','0');
    }
  }catch(e){}
  syncAISidebarLayout();
}
try{window.fluxRevealAISidebar=fluxRevealAISidebar;}catch(e){}

function initAIChats(){
  loadAIChatsForUser();
  if(!aiChats.length)newAIChat();
  else loadAIChat(aiChats[0].id);
  wireAIComposerInput();
  if(typeof updateFluxCanvasAIBadge==='function')updateFluxCanvasAIBadge();
  syncAISidebarLayout();
}

function newAIChat(){
  const id='chat_'+Date.now();
  const chat={id,title:'New Chat',messages:[],createdAt:Date.now()};
  aiChats.unshift(chat);
  if(aiChats.length>10)aiChats=aiChats.slice(0,10); // keep last 10
  saveAIChats();
  loadAIChat(id);
  renderAIChatTabs();
}

function loadAIChat(id){
  aiCurrentChatId=id;
  const chat=aiChats.find(c=>c.id===id);
  if(!chat)return;
  aiHistory=chat.messages.map(m=>({role:m.role,content:m.content}));
  // Render messages
  const wrap=document.getElementById('aiMsgs');
  const sugs=document.getElementById('aiSugs');
  if(!wrap)return;
  wrap.innerHTML='';
  if(sugs)sugs.style.display=chat.messages.length?'none':'flex';
  chat.messages.forEach(m=>{
    if(m.role==='user')appendMsg('user',m.content);
    else if(m.role==='assistant')appendMsg('bot',m.content);
  });
  renderAIChatTabs();
  // Scroll to bottom
  const msgWrap=document.getElementById('aiMsgsWrap');
  if(msgWrap)setTimeout(()=>msgWrap.scrollTop=msgWrap.scrollHeight,50);
}

function saveCurrentChat(){
  if(!aiCurrentChatId)return;
  const chat=aiChats.find(c=>c.id===aiCurrentChatId);
  if(!chat)return;
  chat.messages=aiHistory.map(m=>({role:m.role,content:typeof m.content==='string'?m.content:JSON.stringify(m.content)}));
  // Auto-title from first user message
  const firstUser=chat.messages.find(m=>m.role==='user');
  if(firstUser&&chat.title==='New Chat'){
    chat.title=firstUser.content.slice(0,30)+(firstUser.content.length>30?'…':'');
  }
  chat.updatedAt=Date.now();
  saveAIChats();
  renderAIChatTabs();
}

function deleteAIChat(id,e){
  e?.stopPropagation();
  aiChats=aiChats.filter(c=>c.id!==id);
  saveAIChats();
  if(aiCurrentChatId===id){
    if(aiChats.length)loadAIChat(aiChats[0].id);
    else newAIChat();
  }
  renderAIChatTabs();
}

function renderAIChatTabs(){
  const el=document.getElementById('aiChatTabs');if(!el)return;
  syncAISidebarLayout();
  if(!aiChats.length){el.innerHTML='';return;}
  el.innerHTML=aiChats.map(c=>`
    <div class="flux-ai-tab${c.id===aiCurrentChatId?' flux-ai-tab--active':''}" role="button" onclick="loadAIChat('${c.id}')">
      <span class="flux-ai-tab__title">${c.title||'Chat'}</span>
      <span class="flux-ai-tab__close" onclick="deleteAIChat('${c.id}',event)" title="Delete">×</span>
    </div>`).join('');
}

function clearAIChat(){
  aiHistory=[];
  const wrap=document.getElementById('aiMsgs');if(wrap)wrap.innerHTML='';
  const sugs=document.getElementById('aiSugs');if(sugs)sugs.style.display='flex';
  // Reset current chat
  if(aiCurrentChatId){
    const chat=aiChats.find(c=>c.id===aiCurrentChatId);
    if(chat){chat.messages=[];chat.title='New Chat';saveAIChats();renderAIChatTabs();}
  }
}
function filterAIResponse(text){
  const startPhrases=[
    /^certainly[!,.]?\s*/i,
    /^of course[!,.]?\s*/i,
    /^great question[!,.]?\s*/i,
    /^absolutely[!,.]?\s*/i,
    /^sure[!,.]?\s*/i,
    /^happy to help[!,.]?\s*/i,
    /^i'd be happy to\s*/i,
    /^i'm happy to\s*/i,
    /^glad you asked[!,.]?\s*/i,
    /^excellent question[!,.]?\s*/i,
    /^that's a great question[!,.]?\s*/i,
    /^what a great question[!,.]?\s*/i,
    /^good question[!,.]?\s*/i,
  ];
  const endPhrases=[
    /\s*is there anything else i can help (you with|with)[?.]?\s*$/i,
    /\s*let me know if you have any (other )?questions[.!]?\s*$/i,
    /\s*feel free to ask if you need anything else[.!]?\s*$/i,
    /\s*hope (that |this )?helps[.!]?\s*$/i,
    /\s*i hope this (was helpful|helps)[.!]?\s*$/i,
    /\s*let me know if you'd like me to (elaborate|explain further|go deeper)[.!]?\s*$/i,
    /\s*don't hesitate to ask[.!]?\s*$/i,
  ];
  let result=String(text||'').trim();
  for(const pattern of startPhrases)result=result.replace(pattern,'');
  for(const pattern of endPhrases)result=result.replace(pattern,'');
  if(result.length>0)result=result.charAt(0).toUpperCase()+result.slice(1);
  return result.trim();
}
function fmtAI(raw){
  let t=String(raw);

  // 1. Fence code blocks  ```lang\n...\n```
  t=t.replace(/```(\w*)\n?([\s\S]*?)```/g,(_, lang, code)=>{
    const esc_code=code.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const label=lang?`<span style="font-size:.6rem;opacity:.5;letter-spacing:.06em;text-transform:uppercase;font-family:'JetBrains Mono',monospace">${lang}</span>`:'';
    return`<pre class="ai-code-block">${label}<code>${esc_code}</code></pre>`;
  });

  // 2. Escape remaining HTML (not inside code blocks we already processed)
  // Split on our pre tags to avoid double-escaping
  const parts=t.split(/(<pre class="ai-code-block">[\s\S]*?<\/pre>)/g);
  t=parts.map((p,i)=>{
    if(i%2===1)return p; // already-processed code block
    return p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }).join('');

  // 3. Markdown links [text](url)
  t=t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>');
  // 4. Bare URLs not already in href
  t=t.replace(/(?<!href=")(https?:\/\/[^\s<>")\]]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>');

  // 5. Horizontal rule
  t=t.replace(/^---+$/gm,'<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">');

  // 6. Headers — process largest first
  t=t.replace(/^# (.+)$/gm,'<div class="ai-h1">$1</div>');
  t=t.replace(/^## (.+)$/gm,'<div class="ai-h2">$1</div>');
  t=t.replace(/^### (.+)$/gm,'<div class="ai-h3">$1</div>');

  // 7. Bold / italic / inline code
  t=t.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  t=t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  t=t.replace(/\*(.+?)\*/g,'<em>$1</em>');
  t=t.replace(/`([^`]+)`/g,'<code class="ai-inline-code">$1</code>');

  // 8. Blockquote
  t=t.replace(/^&gt; (.+)$/gm,'<div class="ai-blockquote">$1</div>');

  // 9. Numbered lists — group consecutive items
  t=t.replace(/^(\d+)\. (.+)$/gm,'<li class="ai-li-num" data-n="$1">$2</li>');
  t=t.replace(/(<li class="ai-li-num"[^>]*>[\s\S]*?<\/li>)(\n<li class="ai-li-num")/g,'$1$2');
  // wrap consecutive num items
  t=t.replace(/((?:<li class="ai-li-num"[^>]*>.*?<\/li>\n?)+)/g,'<ol class="ai-ol">$1</ol>');

  // 10. Bullet lists
  t=t.replace(/^[-•] (.+)$/gm,'<li class="ai-li">$2</li>'.replace('$2','$1'));
  t=t.replace(/((?:<li class="ai-li">.*?<\/li>\n?)+)/g,'<ul class="ai-ul">$1</ul>');

  // 11. Flashcard Q/A labels
  t=t.replace(/Q:\s*(.+)/g,'<span class="ai-q">Q:</span> $1');
  t=t.replace(/A:\s*(.+)/g,'<span class="ai-a">A:</span> $1');

  // 12. Newlines to <br> (but not inside block elements)
  t=t.replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');

  return t;
}
function appendMsg(role,content,isThink){const wrap=document.getElementById('aiMsgs');if(!wrap)return document.createElement('div');const div=document.createElement('div');div.className='ai-msg ai-msg--gpt '+role;const isBot=role==='bot';if(isThink){div.id='aiThink';div.innerHTML='<div class="ai-av bot">✦</div><div class="ai-bub bot"><div class="ai-think" id="aiThinkingIndicator"><span></span><span></span><span></span></div></div>';}else{const botText=isBot?filterAIResponse(String(content||'')):String(content||'');const f=isBot?fmtAI(botText):esc(botText);const init=(localStorage.getItem('flux_user_name')||'U').charAt(0).toUpperCase();div.innerHTML=`<div class="ai-av ${isBot?'bot':'me'}">${isBot?'✦':init}</div><div class="ai-bub ${isBot?'bot':'user'}">${f}</div>`;}wrap.appendChild(div);// Scroll inner wrapper, not the page
const msgWrap=document.getElementById('aiMsgsWrap');if(msgWrap)setTimeout(()=>msgWrap.scrollTop=msgWrap.scrollHeight,30);return div;}
function setFluxAIMode(mode,btn){
  const ok=['default','research','deep','overtime'];
  const m=ok.includes(mode)?mode:'default';
  localStorage.setItem('flux_ai_mode',m);
  document.querySelectorAll('.flux-ai-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  const sel=document.getElementById('aiModeSelect');
  if(sel)sel.value=m;
  if(btn&&typeof showToast==='function')showToast('AI mode: '+(btn.textContent||'').trim(),'info');
}
function setFluxAIModeFromSelect(value){
  const ok=['default','research','deep','overtime'];
  const m=ok.includes(value)?value:'default';
  setFluxAIMode(m,null);
  const labels={default:'Balanced',research:'Research',deep:'Deep think',overtime:'Overtime'};
  if(typeof showToast==='function')showToast('AI style: '+(labels[m]||m),'info');
}
function syncFluxAIModeButtons(){
  const m=localStorage.getItem('flux_ai_mode')||'default';
  document.querySelectorAll('.flux-ai-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  const sel=document.getElementById('aiModeSelect');
  if(sel)sel.value=m;
}
function openAIConnections(){
  try{nav('ai');}catch(e){}
  if(window.FluxAIConnections&&typeof FluxAIConnections.setView==='function')FluxAIConnections.setView('connections');
}
function openAIChatWorkspace(){
  if(window.FluxAIConnections&&typeof FluxAIConnections.setView==='function')FluxAIConnections.setView('chat');
}
function wireAIComposerInput(){
  const inp=document.getElementById('aiInput');
  if(!inp||inp.dataset.fluxComposerWired)return;
  inp.dataset.fluxComposerWired='1';
  inp.addEventListener('input',()=>{inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,160)+'px';});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}});
}
function getFluxAIModeInstructions(){
  const mode=localStorage.getItem('flux_ai_mode')||'default';
  if(mode==='research')return`\n<mode_research>\nResearch mode: lead with the most credible, specific sources first — official .gov/.edu pages, Google Scholar, PubMed, major digital libraries. Format links as [title](url). Wikipedia is a starting point, not a citation. Always tell the student to verify before citing. Don't substitute a list of links for actual thinking — links support their work, they don't replace it.\n</mode_research>`;
  if(mode==='deep')return`\n<mode_deep_think>\nDeep Think mode: slow down, prioritize accuracy. Cross-check claims against the planner snapshot. Separate what you know from what you're inferring. For anything that touches dates or school policy — tell the student exactly what to verify and where. When uncertain, hedge explicitly rather than projecting false confidence.\n</mode_deep_think>`;
  if(mode==='overtime')return`\n<mode_overtime>\nOvertime mode: the student needs to move now. Lead with the single most important action, then tight concrete bullets with time-boxes. Cut theory unless it directly unlocks a decision. Keep replies short and scannable.\n</mode_overtime>`;
  return'';
}
function renderAISugs(){
  const el=document.getElementById('aiSugs');
  if(!el)return;
  el.innerHTML='';
  const sugs=[
    {ico:'📅', label:"What's due this week?",        prompt:"What's due this week?"},
    {ico:'⚡', label:"What should I work on now?",   prompt:"What should I work on right now?"},
    {ico:'🧭', label:"Plan my week",                 prompt:"/plan — study plan using my tasks"},
    {ico:'📊', label:"How am I doing overall?",      prompt:"How am I doing overall? Summarize my progress and what to focus on."},
    {ico:'🎯', label:"Optimize my schedule",         prompt:"/optimize — review my plan and suggest improvements."},
    {ico:'🛠', label:"Fix overdue items",            prompt:"/fix — help me catch up on overdue work."},
  ];
  sugs.forEach(s=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='ai-sug';
    btn.innerHTML=`<span class="ai-sug__ico" aria-hidden="true">${s.ico}</span><span class="ai-sug__lbl">${s.label}</span>`;
    btn.setAttribute('aria-label',s.label);
    btn.onclick=()=>{
      const inp=document.getElementById('aiInput');
      if(inp){inp.value=s.prompt;try{inp.dispatchEvent(new Event('input',{bubbles:true}));}catch(_){}}
      sendAI();
    };
    el.appendChild(btn);
  });
}
function handleAIImg(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_AI_LIMITS&&requiresPro('imageAnalysis')){
      showUpgradePrompt('imageAnalysis','Analyze photos of worksheets, textbooks, and schedules with Flux Pro');
      const inp=document.getElementById('aiImgUpload');if(inp)inp.value='';
      return;
    }
    aiPendingImg={data:e.target.result.split(',')[1],mime:file.type,name:file.name};
    const prev=document.getElementById('aiImgPreview');
    if(prev){
      prev.style.display='block';
      prev.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.2);border-radius:10px;margin-bottom:4px">
        <img src="${e.target.result}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0">
        <div style="flex:1;font-size:.75rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</div>
        <button onclick="aiPendingImg=null;document.getElementById('aiImgPreview').style.display='none';document.getElementById('aiImgUpload').value='';const b=document.getElementById('aiImgBtn');if(b){b.style.borderColor='';b.style.color='';}" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:2px;flex-shrink:0">✕</button>
      </div>`;
    }
    const btn=document.getElementById('aiImgBtn');
    if(btn){btn.style.borderColor='var(--accent)';btn.style.color='var(--accent)';}
  };
  reader.readAsDataURL(file);
}

/* ══ FLUX SKILLS (injected before buildAIPrompt) ══ */
const FluxSkills = {
  registry: new Map(),
  enabled: new Set(),

  register(skill) {
    this.registry.set(skill.id, skill);
    const saved = load('flux_skill_' + skill.id, skill.enabledByDefault !== false);
    if (saved) this.enabled.add(skill.id);
  },

  enable(skillId) {
    this.enabled.add(skillId);
    save('flux_skill_' + skillId, true);
    if (typeof renderSkillsPanel === 'function') renderSkillsPanel();
  },

  disable(skillId) {
    this.enabled.delete(skillId);
    save('flux_skill_' + skillId, false);
    if (typeof renderSkillsPanel === 'function') renderSkillsPanel();
  },

  getEnabled() {
    return [...this.enabled].map((id) => this.registry.get(id)).filter(Boolean);
  },

  buildSkillContext() {
    const enabled = this.getEnabled();
    if (!enabled.length) return '';
    const lines = enabled.map(
      (s) =>
        `- **${s.name}** (\`${s.id}\`): ${s.description}\n  Usage: \`\`\`skill\n{"skill":"${s.id}","params":{${s.paramDocs || ''}}}\n\`\`\``
    );
    return `\n\n## Available Skills\nYou have access to these skills. Use them when relevant by outputting a \`\`\`skill\`\`\` code block:\n\n${lines.join('\n')}`;
  },

  parseSkillCalls(responseText) {
    const calls = [];
    const regex = /```skill\s*([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(responseText)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        calls.push(parsed);
      } catch (e) {
        /* skip */
      }
    }
    return calls;
  },

  async execute(skillCall) {
    const skill = this.registry.get(skillCall.skill);
    if (!skill) return { error: 'Unknown skill: ' + skillCall.skill };
    if (!this.enabled.has(skillCall.skill)) return { error: 'Skill not enabled: ' + skillCall.skill };
    try {
      return await skill.execute(skillCall.params || {});
    } catch (e) {
      return { error: e.message };
    }
  },
};
window.FluxSkills = FluxSkills;

FluxSkills.register({
  id: 'add-task',
  name: 'Add Task',
  icon: '📌',
  description: 'Add a task to the planner',
  category: 'planner',
  enabledByDefault: true,
  paramDocs: '"name":"task name","date":"YYYY-MM-DD","priority":"high|med|low","subject":"subject key","estTime":30',
  async execute({ name, date, priority, subject, estTime, notes }) {
    if (!name) return { error: 'Task name required' };
    const task = {
      id: Date.now() + Math.random(),
      name,
      date: date || '',
      priority: priority || 'med',
      subject: subject || '',
      estTime: estTime || 0,
      notes: notes || '',
      done: false,
      type: 'hw',
      createdAt: Date.now(),
    };
    task.urgencyScore = calcUrgency(task);
    tasks.unshift(task);
    save('tasks', tasks);
    renderStats();
    renderTasks();
    renderCalendar();
    syncKey('tasks', tasks);
    return { ok: true, taskId: task.id, message: `Task "${name}" added to your planner` };
  },
});

FluxSkills.register({
  id: 'read-emails',
  name: 'Read Emails',
  icon: '📧',
  description: 'Read recent Gmail emails',
  category: 'integrations',
  enabledByDefault: false,
  paramDocs: '"count":10,"filter":"unread|all"',
  async execute({ count = 10, filter = 'all' }) {
    if (typeof fetchGmailMessages !== 'function') return { error: 'Gmail helpers not loaded.' };
    if (!window.gmailToken) return { error: 'Gmail not connected. Connect Google in the app first.' };
    try {
      const result = await fetchGmailMessages(count, filter);
      return { ok: true, emails: result, message: `Fetched ${result.length} emails` };
    } catch (e) {
      return { error: 'Gmail fetch failed: ' + e.message };
    }
  },
});

FluxSkills.register({
  id: 'draft-email-reply',
  name: 'Draft Reply',
  icon: '↩',
  description: 'Draft an email reply in your style (from recent sent mail)',
  category: 'integrations',
  enabledByDefault: false,
  paramDocs: '"emailId":"id","tone":"professional|casual|brief"',
  async execute({ emailId, tone = 'casual' }) {
    if (typeof fetchSentEmails !== 'function') return { error: 'Gmail helpers not loaded.' };
    if (!window.gmailToken) return { error: 'Gmail not connected.' };
    const sentEmails = await fetchSentEmails(5);
    const styleContext = (sentEmails || []).map((e) => (e.body || e.snippet || '').slice(0, 500)).join('\n---\n');
    return {
      ok: true,
      requiresAI: true,
      prompt: `Write an email reply${emailId ? ' (thread id: ' + emailId + ')' : ''}. Match this writing style (from sent mail samples):\n${styleContext}\n\nTone: ${tone}. Keep it substantive and concise.`,
      message: 'Analyzing your writing style…',
    };
  },
});

FluxSkills.register({
  id: 'web-search',
  name: 'Web Search',
  icon: '🔍',
  description: 'Search the web (DuckDuckGo instant answer)',
  category: 'research',
  enabledByDefault: true,
  paramDocs: '"query":"search query"',
  async execute({ query }) {
    if (!query) return { error: 'Search query required' };
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      const data = await res.json();
      const results = {
        abstract: data.Abstract || data.AbstractText,
        source: data.AbstractSource,
        url: data.AbstractURL,
        relatedTopics: (data.RelatedTopics || []).slice(0, 5).map((t) => ({
          text: t.Text,
          url: t.FirstURL,
        })),
        answer: data.Answer,
        definition: data.Definition,
      };
      return { ok: true, results, message: `Web search completed for: ${query}` };
    } catch (e) {
      return { error: 'Search failed: ' + e.message };
    }
  },
});

FluxSkills.register({
  id: 'create-study-plan',
  name: 'Study Plan',
  icon: '📚',
  description: 'Create a multi-day study plan as tasks',
  category: 'planner',
  enabledByDefault: true,
  paramDocs: '"subject":"name","testDate":"YYYY-MM-DD","topics":["a","b"]',
  async execute({ subject, testDate, topics = [] }) {
    if (!subject || !testDate) return { error: 'Subject and test date required' };
    const test = new Date(testDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((test - today) / 86400000);
    if (daysLeft <= 0) return { error: 'Test date must be in the future' };
    const sessionsPerTopic = Math.max(1, Math.floor(daysLeft / Math.max(topics.length, 1)));
    const addedTasks = [];
    topics.forEach((topic, i) => {
      for (let day = 0; day < sessionsPerTopic; day++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i * sessionsPerTopic + day);
        if (d >= test) break;
        const task = {
          id: Date.now() + Math.random(),
          name: `Study: ${topic}`,
          subject,
          date: d.toISOString().slice(0, 10),
          priority: daysLeft <= 3 ? 'high' : 'med',
          estTime: 45,
          type: 'study',
          done: false,
          createdAt: Date.now(),
        };
        task.urgencyScore = calcUrgency(task);
        tasks.push(task);
        addedTasks.push(task);
      }
    });
    save('tasks', tasks);
    renderStats();
    renderTasks();
    renderCalendar();
    syncKey('tasks', tasks);
    return { ok: true, tasksAdded: addedTasks.length, message: `Created ${addedTasks.length} study sessions for ${subject}` };
  },
});

FluxSkills.register({
  id: 'add-event',
  name: 'Add Event',
  icon: '📅',
  description: 'Add an event to the Flux calendar list',
  category: 'planner',
  enabledByDefault: true,
  paramDocs: '"title":"name","date":"YYYY-MM-DD","time":"HH:MM","notes":"details"',
  async execute({ title, date, time, notes }) {
    if (!title || !date) return { error: 'Title and date required' };
    const ev = {
      id: Date.now() + Math.random(),
      title,
      date,
      time: time || '',
      notes: notes || '',
      type: 'event',
      createdAt: Date.now(),
    };
    const events = load('flux_events', []);
    events.push(ev);
    save('flux_events', events);
    syncKey('flux_events', events);
    renderCalendar();
    return { ok: true, message: `Event "${title}" added for ${date}` };
  },
});

FluxSkills.register({
  id: 'summarize-note',
  name: 'Summarize Note',
  icon: '✏️',
  description: 'Summarize a saved note',
  category: 'notes',
  enabledByDefault: true,
  paramDocs: '"noteId":"id"',
  async execute({ noteId }) {
    const note = notes?.find((n) => String(n.id) === String(noteId) || n.id === parseInt(noteId, 10));
    if (!note) return { error: 'Note not found' };
    const plain = String(note.body || '')
      .replace(/<[^>]*>/g, '')
      .slice(0, 3000);
    return {
      ok: true,
      requiresAI: true,
      prompt: `Summarize this note into key points and a short study guide.\n\nTitle: ${note.title}\n\n${plain}`,
      message: 'Summarizing note…',
    };
  },
});

FluxSkills.register({
  id: 'export-to-gcal',
  name: 'Push to Google Cal',
  icon: '📆',
  description: 'Push upcoming tasks to Google Calendar (per-task)',
  category: 'integrations',
  enabledByDefault: false,
  paramDocs: '"days":7',
  async execute({ days = 7 }) {
    if (typeof window.fluxPushTaskToGCal !== 'function') {
      return { error: 'Google Calendar push not available. Sign in with Google and enable Calendar scope.' };
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);
    const upcoming = tasks.filter((t) => {
      if (t.done || !t.date) return false;
      const d = new Date(t.date + 'T00:00:00');
      return d <= cutoff && d >= now;
    });
    let pushed = 0;
    for (const task of upcoming) {
      try {
        await window.fluxPushTaskToGCal(task.id);
        pushed++;
      } catch (e) {}
    }
    return { ok: true, message: `Pushed ${pushed} tasks toward (${days}d window)` };
  },
});

function renderSkillsPanel() {
  const el = document.getElementById('fluxSettingsSkillsMount');
  if (!el) return;
  const categories = {};
  FluxSkills.registry.forEach((skill) => {
    if (!categories[skill.category]) categories[skill.category] = [];
    categories[skill.category].push(skill);
  });
  el.innerHTML = Object.entries(categories)
    .map(
      ([cat, sks]) => `
    <div style="margin-bottom:16px">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:8px">${cat}</div>
      ${sks
        .map(
          (skill) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
          <span style="font-size:1.2rem;flex-shrink:0">${skill.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.85rem;font-weight:600">${skill.name}</div>
            <div style="font-size:.72rem;color:var(--muted2)">${skill.description}</div>
          </div>
          <label class="toggle-wrap" style="flex-shrink:0">
            <input type="checkbox" ${FluxSkills.enabled.has(skill.id) ? 'checked' : ''}
              data-flux-skill-id="${skill.id}">
            <span class="toggle-track"></span>
          </label>
        </div>`
        )
        .join('')}
    </div>`
    )
    .join('');
  el.querySelectorAll('input[data-flux-skill-id]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const id = inp.getAttribute('data-flux-skill-id');
      if (inp.checked) FluxSkills.enable(id);
      else FluxSkills.disable(id);
    });
  });
}

function openAddSkillModal() {
  const modal = document.createElement('div');
  modal.id = 'fluxCustomSkillModal';
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:20px;padding:26px;width:100%;max-width:440px;box-shadow:var(--shadow-float)">
      <div style="font-size:1rem;font-weight:800;margin-bottom:4px">Add Custom Skill</div>
      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:16px">Define what Flux can do when this skill is triggered</div>
      <div class="mrow"><label>Skill Name</label><input id="customSkillName" placeholder="e.g. Create Flashcards"></div>
      <div class="mrow"><label>Icon (emoji)</label><input id="customSkillIcon" placeholder="📚" maxlength="4"></div>
      <div class="mrow"><label>Description</label><input id="customSkillDesc" placeholder="What this skill does"></div>
      <div class="mrow"><label>Instructions for AI</label><textarea id="customSkillPrompt" style="min-height:80px" placeholder="When this skill is used…"></textarea></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button type="button" id="fluxCustomSkillSave" style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-weight:700;cursor:pointer">Add Skill</button>
        <button type="button" id="fluxCustomSkillCancel" style="padding:12px 18px;background:var(--card2);border:1px solid var(--border);border-radius:12px;color:var(--muted2);cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  document.getElementById('fluxCustomSkillCancel').onclick = () => modal.remove();
  document.getElementById('fluxCustomSkillSave').onclick = () => saveCustomSkill();
}

function saveCustomSkill() {
  const name = document.getElementById('customSkillName')?.value.trim();
  const icon = document.getElementById('customSkillIcon')?.value.trim() || '⚡';
  const desc = document.getElementById('customSkillDesc')?.value.trim();
  const prompt = document.getElementById('customSkillPrompt')?.value.trim();
  if (!name || !desc) {
    showToast('Name and description required', 'error');
    return;
  }
  const id = 'custom-' + name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  FluxSkills.register({
    id,
    name,
    icon,
    description: desc,
    category: 'custom',
    enabledByDefault: true,
    customPrompt: prompt,
    async execute(params) {
      return {
        ok: true,
        requiresAI: true,
        prompt: `${prompt}\n\nContext: ${JSON.stringify(params)}`,
        message: `Running skill: ${name}`,
      };
    },
  });
  FluxSkills.enable(id);
  const customSkills = load('flux_custom_skills', []);
  customSkills.push({ id, name, icon, description: desc, category: 'custom', customPrompt: prompt });
  save('flux_custom_skills', customSkills);
  document.getElementById('fluxCustomSkillModal')?.remove();
  renderSkillsPanel();
  showToast(`Skill "${name}" added`);
}

function loadCustomSkills() {
  const customSkills = load('flux_custom_skills', []);
  customSkills.forEach((s) => {
    FluxSkills.register({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      category: s.category || 'custom',
      customPrompt: s.customPrompt,
      enabledByDefault: true,
      async execute(params) {
        return {
          ok: true,
          requiresAI: true,
          prompt: `${s.customPrompt}\n\nContext: ${JSON.stringify(params)}`,
          message: `Running skill: ${s.name}`,
        };
      },
    });
    if (load('flux_skill_' + s.id, true)) FluxSkills.enable(s.id);
  });
}
window.openAddSkillModal = openAddSkillModal;
window.saveCustomSkill = saveCustomSkill;
window.renderSkillsPanel = renderSkillsPanel;
window.loadCustomSkills = loadCustomSkills;

loadCustomSkills();

function buildAIPrompt(){
  const ctx=refreshAIContext();
  const name=localStorage.getItem('flux_user_name')||'Student';
  const p=load('profile',{});
  const grade=p.grade||'';
  const program=formatProgramsDisplay(p.program);
  const now=new Date();now.setHours(0,0,0,0);
  const mood=moodHistory.slice(-1)[0];
  const subjs=getSubjects();
  const fmt=t=>{const due=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'no date';const over=t.date&&new Date(t.date+'T00:00:00')<now?' OVERDUE':'';const np=t.date&&isBreak(t.date)?` [REST ${restDayKind(t.date)==='sick'?'SICK':'LAZY'}]`:'';const s=subjs[t.subject];return`- [${(t.priority||'med').toUpperCase()}|${s?s.short:t.subject||'—'}|${t.type||'hw'}|Due ${due}${over}${np}]: ${t.name}`;};

  // Calendar context — upcoming events + classes
  const today=todayStr();
  const in7=new Date(now);in7.setDate(now.getDate()+7);
  const calEvAi=(load('flux_events',[])).filter(e=>{if(!e.date)return false;const d=new Date(e.date+'T00:00:00');return d>=now&&d<=in7;});
  calEvAi.sort((a,b)=>fluxScopeSortKey(a)-fluxScopeSortKey(b));
  const calEvents=calEvAi.map(e=>`- [EVENT|${e.date}${e.time?' '+e.time:''}|${fluxEventScope(e)==='school'?'SCHOOL':'OUT'}]: ${e.title}`).join('\n')||'None';
  const todayClasses=classes.filter(c=>c.name).map(c=>`P${c.period}: ${c.name}${c.teacher?' ('+c.teacher+')':''}`).join(', ')||'Not set up';

  const activeTaskLines=tasks.filter(t=>!t.done).slice(0,20).map(fmt).join('\n')||'None';
  const upcomingLines=ctx.upcoming.length?ctx.upcoming.map(fmt).join('\n'):'None';
  const recentNames=ctx.recent.length?ctx.recent.map(t=>t.name).join(', '):'None';

  return`<identity>
You are Flux, an AI built into a student planner. You think carefully and respond with precision. Here is how you communicate:

VOICE AND TONE:
- Direct and honest. Say what you mean without softening it into meaninglessness.
- Warm but not performatively enthusiastic. You are interested in the student's actual problem, not in appearing helpful.
- Intellectually engaged. When something is genuinely interesting or has a non-obvious answer, explore it properly.
- Calibrated confidence. Say "I'm not sure" when you are not sure. Say "this is likely" when it is likely. Do not state uncertain things as fact.
- Appropriately concise. Short questions get short answers. Complex problems get thorough ones. Do not pad responses.

WHAT YOU NEVER DO:
- Never start a response with "Certainly!", "Of course!", "Great question!", "Absolutely!", "Sure!", "Happy to help!", "I'd be happy to", or any variation of these.
- Never say "As an AI" or "As a language model" or refer to yourself as an AI assistant.
- Never apologize for giving a direct answer.
- Never add hollow affirmations like "That's a great point" or "You're absolutely right".
- Never use filler phrases like "In summary", "To summarize", "In conclusion", "It's worth noting that", "It's important to remember".
- Never repeat what the student just said back to them as an introduction to your response.
- Never end with "Is there anything else I can help you with?" or "Let me know if you have any other questions" or similar.
- Never be sycophantic.

WHAT YOU ALWAYS DO:
- Get to the point in the first sentence.
- Give concrete, specific answers — not vague suggestions.
- When a student is stressed or overwhelmed, acknowledge it briefly and then focus on the most useful thing you can actually do: help them make a plan, prioritize, or break down the problem.
- Use structure (numbered lists, headers) when it genuinely helps clarity. Do not use structure to make a simple answer look more impressive.
- If a question has a straightforward answer, give it. Do not hedge a simple answer with unnecessary caveats.
- When you disagree with what a student is about to do, say so clearly and explain why. Be honest, not just agreeable.
- Treat the student as an intelligent person capable of handling honest information.

CONTEXT:
You have access to the student's full planner — their tasks, classes, schedule, goals, and notes. Use this context actively. When they ask about plans, notes, or projects, use planner data from the snapshot. When they ask "what should I do next", look at their actual tasks and give a specific recommendation based on urgency and their schedule. Do not give generic productivity advice when you have their real data.
</identity>

<student_context>
Student: ${name}${grade?' \u00b7 Grade '+grade:''}${program?' \u00b7 '+program:''}
Today: ${TODAY.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
${mood?`Recent check-in: mood ${mood.mood}/5 \u00b7 stress ${mood.stress}/10 \u00b7 sleep ${mood.sleep}h`:''}
Classes today: ${todayClasses}

Calendar this week:
${calEvents}

Active tasks (up to 20):
${activeTaskLines}

Upcoming (14d):
${upcomingLines}

Recently completed (7d): ${recentNames}
</student_context>

<full_planner_snapshot>
${buildFullPlannerContextForAI({maxTotalChars:24000})}
</full_planner_snapshot>

<how_you_work>
PLANNER DATA: The snapshot above includes tasks, notes, mood, timer sessions, classes, extracurriculars, and settings. Answer questions about any part of the planner from this data. The Extracurriculars tab (internal id: "goals") holds activities, target schools, and EC goals. Google Calendar events load live in the Calendar tab and may not fully appear in this snapshot.

CANVAS: If sections "Canvas — pinned in Flux" or "Canvas — synced assignments" appear, they are from the student's Canvas LMS (API + optional reader pin in the Canvas tab). Help them understand assignments, due dates, and instructions from that text. You cannot see their Canvas iframe if the school blocks embedding — rely on these sections.

REASONING: For complex questions \u2014 scheduling trade-offs, physics problems, essay structure, study strategy \u2014 think it through step by step. Show your reasoning when it helps the student understand, not just the conclusion.

HONESTY: Distinguish between what you can see in the planner data, what you can reason about, and what the student should verify elsewhere. Never fabricate. If unsure, say so.

NUMBERS: Physics: g = 10\u2009m/s\u00b2 unless explicitly stated otherwise.
${getStudyDNAPrompt()}
DEPTH: Default to high-leverage help: trace logic from first principles when it helps, show alternate approaches, stress-test edge cases, and surface common mistakes. When speed matters, lead with the decisive result then optional depth. For work that will be turned in for a grade, build mastery—full solutions with different numbers, outlines, checklists, and verification steps the student can execute—so they understand and can defend their own write-up.
</how_you_work>
${(()=>{
  try{
    if(window.CanvasState&&window.CanvasState.pageContext&&window.CanvasState.connected){
      let s=JSON.stringify(window.CanvasState.pageContext,null,2);
      if(s.length>3800)s=s.slice(0,3800)+'\n…';
      return`\n\n## Canvas — What the student is currently viewing\nThe student has the Canvas LMS panel open and is currently looking at:\n${s}\n\nUse this context to give highly specific, relevant help. Reference the actual assignment names, due dates, and course details. Do not be generic.\n`;
    }
  }catch(e){}
  return'';
})()}
${getFluxAIModeInstructions()}

<task_actions>
When the student asks you to add, complete, or delete tasks, append ONLY this block at the very end of your reply. No confirmation text. No empty block.
\`\`\`actions
[{"action":"add_task","name":"...","priority":"high","date":"YYYY-MM-DD","type":"hw","subject":"SUBJECT_KEY"}]
\`\`\`
</task_actions>${typeof FluxSkills!=='undefined'&&FluxSkills.buildSkillContext?FluxSkills.buildSkillContext():''}`
}
function execActions(reply){
  const match=reply.match(/```actions\s*([\s\S]*?)(?:```|$)/);
  if(!match)return null;
  let actions;
  try{actions=JSON.parse(match[1].trim());}catch(e){return null;}
  if(!Array.isArray(actions))return null;
  const results=[];
  let changed=false;
  actions.forEach(a=>{
    if(a.action==='add_task'){
      const t={id:Date.now()+Math.random(),name:a.name||'Task',subject:a.subject||'',priority:a.priority||'med',date:a.date||'',type:a.type||'hw',done:false,rescheduled:0,createdAt:Date.now()};
      t.urgencyScore=calcUrgency(t);
      tasks.unshift(t);
      results.push('✓ Added: '+a.name);
      changed=true;
    }else if(a.action==='delete_done'){
      const c=tasks.filter(t=>t.done).length;
      tasks=tasks.filter(t=>!t.done);
      results.push('✓ Removed '+c+' done tasks');
      changed=true;
    }else if(a.action==='mark_done'){
      const t=tasks.find(x=>x.name?.toLowerCase().includes((a.name||'').toLowerCase()));
      if(t){t.done=true;t.completedAt=Date.now();results.push('✓ Done: '+t.name);changed=true;}
    }
  });
  if(changed){save('tasks',tasks);renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();}
  return results.length?`<div style="padding:8px 10px;background:rgba(var(--accent-rgb),.08);border-radius:8px;font-size:.8rem;border:1px solid rgba(var(--accent-rgb),.2)">${results.join('<br>')}</div>`:null;
}
async function sendAI(optionalUserText, depth){
  const d=typeof depth==='number'?depth:0;
  if(d>5){
    showToast('Skill chain stopped (too many nested steps).','warning');
    return;
  }
  const input=document.getElementById('aiInput'),btn=document.getElementById('aiSendBtn');
  if(!input||!btn)return;
  const nested=typeof optionalUserText==='string'&&optionalUserText.length>0;
  const text=nested?optionalUserText.trim():input.value.trim();
  if(!nested&&!text&&!aiPendingImg)return;
  if(nested&&!text)return;
  if(btn.disabled)return;
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_AI_LIMITS){
    const dailyUsed=_entitlement.usage?.daily_used??0;
    const dailyLimit=_entitlement.usage?.daily_limit??FLUX_FREE_LIMITS.AI_DAILY_MESSAGES;
    if(dailyUsed>=dailyLimit){
      showAILimitReached();
      return;
    }
    if(dailyUsed>=dailyLimit-3){
      showToast(`${dailyLimit-dailyUsed} AI messages remaining today`,'warning');
    }
  }
  const _aiSugsEl=document.getElementById('aiSugs');if(_aiSugsEl)_aiSugsEl.style.display='none';
  const imgSnapshot=nested?null:aiPendingImg;
  if(!nested){
    appendMsg('user',text||(imgSnapshot?'📷 Analyze image':''));
    aiPendingImg=null;
    const prev=document.getElementById('aiImgPreview');if(prev)prev.style.display='none';
  }else{
    appendMsg('user',text);
  }
  const userMsg=nested?text:(text||(imgSnapshot?'Please analyze this image.':''));
  aiHistory.push({role:'user',content:userMsg});
  if(!nested){try{const c=parseInt(localStorage.getItem('flux_ai_msg_count')||'0',10)||0;localStorage.setItem('flux_ai_msg_count',String(c+1));}catch(e){}}
  saveCurrentChat();
  if(!nested){input.value='';input.style.height='auto';}
  btn.disabled=true;
  let thinkAnim=null;
  const thinkEl=appendMsg('bot','',true);
  const thinkHost=document.getElementById('aiThinkingIndicator')||thinkEl;
  try{thinkAnim=window.FluxAnim?.aiThinking?.(thinkHost);}catch(e){}
  try{
    if(window.FluxOrchestrator&&FluxOrchestrator.beginThinking)FluxOrchestrator.beginThinking(thinkEl);
    try{if(window.FluxAIConnections&&typeof FluxAIConnections.beforeSend==='function')await FluxAIConnections.beforeSend(text);}catch(e){}
    if(!nested&&window.FluxOrchestrator&&FluxOrchestrator.handleSlashCommand){
      const slashNote=FluxOrchestrator.handleSlashCommand(text);
      if(slashNote&&FluxOrchestrator.thinkingStep)FluxOrchestrator.thinkingStep('Ran /fix — schedule relief applied on-device.');
    }
    const baseSys=buildAIPrompt();
    let system=(window.FluxOrchestrator&&FluxOrchestrator.augmentSystemPrompt)?FluxOrchestrator.augmentSystemPrompt(baseSys,text):baseSys;
    if(window.FluxAIConnections&&typeof FluxAIConnections.appendToSystem==='function')system=FluxAIConnections.appendToSystem(system);
    if(window.FluxAIConnections&&typeof FluxAIConnections.isRoutingConfigured==='function'&&!FluxAIConnections.isRoutingConfigured()){
      showToast('Connections: finish Models & routing (save API key + model) or pick Flux default.','warning');
      try{thinkAnim?.cancel?.();}catch(e){}
      thinkEl.remove();
      btn.disabled=false;input.focus();
      return;
    }
    const body={system,messages:aiHistory.map(m=>({role:m.role,content:typeof m.content==='string'?m.content:JSON.stringify(m.content)}))};
    try{if(window.FluxKit?.getAIContext)body.fluxPlannerContext=window.FluxKit.getAIContext();}catch(e){}
    try{
      const routeExtra=window.FluxAIConnections&&typeof FluxAIConnections.getRoutingPayload==='function'?FluxAIConnections.getRoutingPayload():null;
      if(routeExtra&&typeof routeExtra==='object')Object.assign(body,routeExtra);
    }catch(e){}
    if(imgSnapshot){body.imageBase64=imgSnapshot.data;body.mimeType=imgSnapshot.mime;}
    if(window.FluxOrchestrator&&FluxOrchestrator.thinkingStep)FluxOrchestrator.thinkingStep('Calling model with planner + agent context…');
    const res=await fetch(API.ai,{method:'POST',headers:await fluxAuthHeaders(),body:JSON.stringify(body)});
    if(!res.ok){
      const errData=await res.json().catch(()=>({}));
      if(errData.error==='daily_limit_reached'){
        _entitlement.usage=_entitlement.usage||{};
        _entitlement.usage.daily_used=errData.daily_used;
        _entitlement.usage.daily_limit=errData.daily_limit;
        showAILimitReached();
        try{thinkAnim?.cancel?.();}catch(e){}
        thinkEl.remove();
        btn.disabled=false;input.focus();
        return;
      }
      if(errData.error==='feature_requires_pro'){
        showUpgradePrompt('imageAnalysis',errData.message||'Upgrade to Flux Pro for image analysis');
        try{thinkAnim?.cancel?.();}catch(e){}
        thinkEl.remove();
        btn.disabled=false;input.focus();
        return;
      }
      if(String(errData.error||'').includes('Invalid or expired token')||res.status===401){
        showToast('Session expired. Please sign in again.','error');
        if(typeof handleSignedOut==='function')handleSignedOut();
        try{thinkAnim?.cancel?.();}catch(e){}
        thinkEl.remove();
        btn.disabled=false;input.focus();
        return;
      }
      throw new Error(errData.error||'HTTP '+res.status);
    }
    const data=await res.json();
    const reply=data.content?.[0]?.text||"I didn't get a response — try again.";
    if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_AI_LIMITS){
      _entitlement.usage=_entitlement.usage||{};
      _entitlement.usage.daily_used=(_entitlement.usage.daily_used??0)+1;
      updatePlanUI();
    }
    const skillFollowUps=[];
    if(window.FluxSkills&&typeof FluxSkills.parseSkillCalls==='function'&&FluxSkills.getEnabled().length){
      const skillCalls=FluxSkills.parseSkillCalls(reply);
      for(const call of skillCalls){
        const result=await FluxSkills.execute(call);
        if(result&&result.error)showToast('Skill failed: '+result.error,'error');
        else if(result&&result.message)showToast('✓ '+result.message,'success');
        if(result&&result.requiresAI&&result.prompt)skillFollowUps.push(result.prompt);
      }
    }
    const ar=execActions(reply);
    let clean=reply;
    const toolsRun=[];
    if(window.FluxOrchestrator&&FluxOrchestrator.processAssistantReply){
      if(window.FluxOrchestrator.thinkingStep)FluxOrchestrator.thinkingStep('Parsing tools & updating scratch pad…');
      FluxOrchestrator.processAssistantReply(reply,toolsRun);
      clean=window.FluxOrchestrator.stripFluxTools?FluxOrchestrator.stripFluxTools(clean):clean;
    }
    try{thinkAnim?.cancel?.();}catch(e){}
    thinkEl.remove();
    clean=clean.replace(/`{3,}actions[\s\S]*?`{3,}/gi,'');
    clean=clean.replace(/`{3,}actions[\s\S]*$/gi,'');
    clean=clean.replace(/```skill[\s\S]*?```/g,'');
    clean=clean.replace(/```\s*\[\s*\]\s*```/g,'');
    clean=clean.replace(/\[\s*\{[\s\S]*?"action"[\s\S]*?\}\s*\]/g,'');
    clean=clean.replace(/\s*\[\s*\]\s*$/,'');
    clean=clean.replace(/\n{3,}/g,'\n\n').trim();
    clean=filterAIResponse(clean);
    if(clean){appendMsg('bot',clean);}
    if(ar){
      const confDiv=document.createElement('div');
      confDiv.style.cssText='font-size:.78rem;padding:6px 10px;margin-top:-4px;margin-bottom:8px;opacity:.8';
      confDiv.innerHTML=ar;
      document.getElementById('aiMsgs').appendChild(confDiv);
      confDiv.scrollIntoView({behavior:'smooth',block:'end'});
    }
    aiHistory.push({role:'assistant',content:clean});
    if(aiHistory.length>24)aiHistory=aiHistory.slice(-24);
    saveCurrentChat();
    try{if(window.FluxAICore&&typeof FluxAICore.afterExchange==='function')FluxAICore.afterExchange(userMsg,clean);}catch(e){}
    for(const p of skillFollowUps){
      if(typeof p==='string'&&p.trim())await sendAI(p.trim(),d+1);
    }
  }catch(err){
    try{thinkAnim?.cancel?.();}catch(e){}
    thinkEl.remove();
    appendMsg('bot','Something went wrong: '+err.message+'\n\nCheck that your Supabase Edge Functions are deployed and API keys are set.');
  }
  btn.disabled=false;input.focus();
}

// ══ ONBOARDING TOUR (once per account; synced) ══
function isTourCompleted(){
  if(load('flux_tour_completed',false))return true;
  if(load('flux_tour_done',false)){
    save('flux_tour_completed',true);
    return true;
  }
  return false;
}
function markTourCompleted(){
  save('flux_tour_completed',true);
  save('flux_tour_done',true);
  if(currentUser){
    clearTimeout(window._tourSyncT);
    window._tourSyncT=setTimeout(()=>syncToCloud(),400);
  }
}
function resetPlannerTour(){
  save('flux_tour_completed',false);
  save('flux_tour_done',false);
  if(currentUser)syncToCloud();
  showToast('Starting planner tour…');
  nav('dashboard');
  setTimeout(()=>startOnboardingTour(),500);
}

// ══ SUPABASE SYNC ══
const SYNC_KEYS=['tasks','notes','habits','goals','colleges','moodHistory','schoolInfo','classes','teacherNotes','profile','flux_extras','flux_ec_schools','flux_ec_goals'];
function setSyncStatus(status){
  const el=document.getElementById('syncIndicator');const sl=document.getElementById('syncStatus');const bh=document.getElementById('syncBadgeHolder');
  if(!el)return;
  if(status==='synced'){el.className='sync-badge synced sync-badge--quiet sync-dot';el.textContent='Synced';if(sl)sl.textContent='All data synced to cloud';if(bh)bh.innerHTML='<span class="sync-badge synced sync-badge--quiet">Synced</span>';}
  else if(status==='syncing'){el.className='sync-badge syncing sync-dot';el.textContent='↑ Syncing...';if(sl)sl.textContent='Syncing...';}
  else{el.className='sync-badge offline sync-dot';el.textContent='○ Local';if(sl)sl.textContent='Not signed in — data is local only';}
  el.style.display=currentUser?'flex':'none';
  if(currentUser){
    if(status==='syncing')el.title='Syncing with cloud…';
    else if(status==='offline')el.title='Not connected — changes stay on this device';
    else{
      const ts=load('flux_last_sync',0);
      el.title=ts?('Last sync: '+new Date(ts).toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'})):'Cloud sync ready';
    }
  }else el.removeAttribute('title');
  // Show guest banner in account settings if guest
  const guestBanner=document.getElementById('guestAccountBanner');
  const signedOutMsg=document.getElementById('accountSignedOutMsg');
  const wasGuest=load('flux_was_guest',false);
  if(guestBanner){guestBanner.style.display=wasGuest&&!currentUser?'block':'none';}
  if(signedOutMsg){signedOutMsg.style.display=wasGuest&&!currentUser?'none':'block';}
}
function getIbProgramProgress(){
  return{
    tok:!!load('flux_pt_tok',false),
    ee:!!load('flux_pt_ee',false),
    cas:!!load('flux_pt_cas',false),
    pp:!!load('flux_pt_pp',false),
    comm:!!load('flux_pt_comm',false),
  };
}

/** Plain-text snapshot of the whole planner for Flux AI (trimmed to fit model context). */
function buildFullPlannerContextForAI(opts){
  const maxTotal=(opts&&opts.maxTotalChars!=null)?opts.maxTotalChars:24000;
  const clip=(s,m)=>{const t=String(s??'');return t.length<=m?t:t.slice(0,m)+'…';};
  const plain=(html,m)=>clip(String(html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),m);
  const sections=[];
  const add=(title,content)=>{
    if(content==null||content==='')return;
    const body=typeof content==='string'?content:JSON.stringify(content,null,2);
    sections.push(`## ${title}\n${body}`);
  };

  const p=load('profile',{});
  const displayName=[localStorage.getItem('flux_user_name'),p.name].filter(Boolean).join(' · ')||'Student';
  add('Student',displayName);
  add('Profile (JSON)',clip(JSON.stringify(p),1400));

  // Extracurriculars tab FIRST — otherwise long tasks/notes hit maxTotal and this block was cut off entirely.
  add('Extracurriculars tab (sidebar: Extracurriculars / internal id goals)','This section is the Extracurriculars tab: activities, college list, and EC milestones.');
  const exLines=extras.map(e=>{
    const ty=Array.isArray(e.types)?e.types.join(','):(e.type||'activity');
    return `- ${e.name} (${ty}) ${e.hours||0}h/wk ${plain(e.desc,220)}`;
  }).join('\n');
  add('My activities (EC tab)',exLines||'(none yet)');
  add('EC target schools',clip(JSON.stringify(ecSchools),2200));
  const eg=ecGoals.map(g=>`${g.done?'✓':'○'} ${g.title} ${g.deadline||''}`).join('\n');
  add('EC goals & milestones',eg||'(none)');
  add('IB program tracker (on EC tab)',JSON.stringify(getIbProgramProgress()));

  const subjs=getSubjects();
  const fmtT=t=>{
    const st=t.done?'done':'open';
    const sub=subjs[t.subject]?.short||t.subject||'—';
    const due=t.date||'—';
    const subN=(t.subtasks&&t.subtasks.length)?` +${t.subtasks.length}sub`:'';
    return `- [${st}|${t.priority||'med'}|${sub}|${t.type||'hw'}|${due}] ${t.name}${t.estTime?` ~${t.estTime}m`:''}${subN}${t.notes?` note:${plain(t.notes,100)}`:''}${t.ghostDraft?` draft:${plain(t.ghostDraft,160)}`:''}`;
  };
  add('Tasks — all open',clip(tasks.filter(t=>!t.done).map(fmtT).join('\n')||'(none)',6500));
  add('Tasks — last 40 completed',clip(tasks.filter(t=>t.done).slice(-40).map(fmtT).join('\n')||'(none)',3200));

  const noteBlock=notes.slice(0,50).map(n=>{
    const dt=n.updatedAt?new Date(n.updatedAt).toISOString().slice(0,10):'—';
    return `• "${plain(n.title,100)}" subj:${n.subject||'—'} ${dt} ★${n.starred?'y':'n'} fc:${(n.flashcards||[]).length}\n  ${plain(n.body,500)}`;
  }).join('\n');
  add('Notes (≤50, excerpted)',noteBlock||'(none)');

  add('Habits',clip(JSON.stringify(habits),2200));
  add('Goals (legacy list)',clip(JSON.stringify(goals),2200));
  add('Colleges (legacy)',clip(JSON.stringify(colleges),1800));

  const moodBlock=moodHistory.slice(-30).map(m=>{
    const d=m.date||'?';
    return `${d} mood:${m.mood} stress:${m.stress} sleep:${m.sleep}h`;
  }).join('\n');
  add('Mood history (last 30)',moodBlock||'(none)');

  add('School info',clip(JSON.stringify(schoolInfo),900));
  add('Classes / schedule',clip(JSON.stringify(classes),4000));
  add('Teacher notes',clip(JSON.stringify(teacherNotes),2200));

  const sess=sessionLog.slice(-50).map(s=>`${s.date||'?'} ${s.mins||0}m subj:${s.subject||'—'}`).join('\n');
  add('Focus timer sessions (last 50)',sess||'(none)');
  add('Subject time budgets',clip(JSON.stringify(subjectBudgets),1400));
  add('Timer counters',{sessionsDone:load('t_sessions',0),totalMins:load('t_minutes',0),streakDays:load('t_streak',0)});

  add('Study DNA',clip(JSON.stringify(studyDNA),900));
  add('Confidences by subject',clip(JSON.stringify(confidences),1800));

  add('Calendar events',clip(JSON.stringify(load('flux_events',[]).slice(0,70)),4000));
  add('Weekly repeating activities',clip(JSON.stringify(load('flux_weekly_events',[])),2000));
  add('Cycle day config',clip(JSON.stringify(load('flux_cycle_config',null)),800));
  add('Rest days (sick/lazy)',clip(JSON.stringify(loadRestDaysList()),800));
  add('App settings',clip(JSON.stringify(settings),1400));

  add('Enabled app tabs (goals = Extracurriculars in UI)',tabConfig.filter(t=>t.visible).map(t=>t.id).join(', '));
  add('Linked integrations',{canvas:!!(canvasToken&&canvasUrl),gmail:!!gmailToken});

  if(canvasToken&&canvasUrl){
    try{
      const f=load('flux_canvas_ai_focus',null);
      if(f&&f.bodyPlain){
        const head=`# ${String(f.title||'Canvas').replace(/\n/g,' ')}\nCourse: ${String(f.courseName||'').replace(/\n/g,' ')}\nPinned: ${f.updatedAt?new Date(f.updatedAt).toLocaleString():''}${f.html_url?'\nLink: '+f.html_url:''}\n`;
        add('Canvas — pinned in Flux (reader; ask questions about this)',clip(head+String(f.bodyPlain),9200));
      }
    }catch(e){}
    const hubSnap=buildCanvasHubAssignmentsAISnapshot(26);
    if(hubSnap)add('Canvas — synced assignments (instruction excerpts)',clip(hubSnap,6200));
    const hubJson=buildCanvasHubStructuredAIContext(16);
    if(hubJson)add('Canvas — structured hub (JSON)',clip(hubJson,4500));
  }

  let out=`# FULL PLANNER SNAPSHOT (read-only for Flux)\nLocal today: ${TODAY.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}\n\n`+sections.join('\n\n');
  if(out.length>maxTotal)out=out.slice(0,maxTotal)+'\n…[planner snapshot truncated]';
  return out;
}

function getCloudPayload(){
  // Include colors in sync now — user wants same colors everywhere
  return{
    accent:localStorage.getItem('flux_accent')||'#00bfff',
    accentRgb:localStorage.getItem('flux_accent_rgb')||'0,191,255',
    theme:localStorage.getItem('flux_theme')||'dark',
    tasks,
    notes:notes.map(n=>({...n,body:n.body||''})),
    habits,
    goals,
    colleges,
    moodHistory,
    schoolInfo,
    classes,
    teacherNotes,
    profile:load('profile',{}),
    studyDNA,
    confidences,
    sessionLog,
    onboarded:!!load('flux_onboarded',false),
    noHWDays:loadRestDaysList().map(r=>r.date),
    restDays:loadRestDaysList(),
    flux_ui_density:load('flux_ui_density','comfortable'),
    flux_mood_tint_enabled:load('flux_mood_tint_enabled',true),
    flux_liquid_glass:load('flux_liquid_glass',null),
    flux_nav_counts_v1:load('flux_nav_counts_v1',{}),
    events:load('flux_events',[]),
    cycleConfig:load('flux_cycle_config',null),
    weeklyEvents:load('flux_weekly_events',[]),
    settings:settings,
    tourCompleted:isTourCompleted(),
    extras,
    ecSchools,
    ecGoals,
    ibProgramProgress:getIbProgramProgress(),
    ...(isOwner()?{
      devAccounts:load('flux_dev_accounts',[]),
      ownerEmail:OWNER_EMAIL,
      platformConfig:load('flux_platform_config',{}),
      ownerAuditLog:load('flux_owner_audit',[]),
      feedbackInbox:load('flux_feedback_inbox',[]),
    }:{}),
  };
}
async function syncToCloud(){
  if(!currentUser)return;
  const sb=getSB();if(!sb)return;
  setSyncStatus('syncing');
  try{
    let payload=getCloudPayload();
    if(isOwner()){
      try{
        const {data:row}=await sb.from('user_data').select('data').eq('id',currentUser.id).maybeSingle();
        const remote=row?.data?.feedbackInbox;
        const local=load('flux_feedback_inbox',[]);
        const tomb=new Set((load('flux_feedback_tombstones',[])||[]).map(String));
        const mergedMap=new Map();
        if(Array.isArray(remote)){
          remote.forEach(x=>{
            if(x&&x.id&&!tomb.has(String(x.id)))mergedMap.set(x.id,x);
          });
        }
        if(Array.isArray(local)){
          local.forEach(x=>{
            if(x&&x.id&&!tomb.has(String(x.id)))mergedMap.set(x.id,x);
          });
        }
        const merged=[...mergedMap.values()].sort((a,b)=>(a.t||0)-(b.t||0)).slice(-300);
        save('flux_feedback_inbox',merged);
        payload.feedbackInbox=merged;
      }catch(e){console.warn('[Flux] feedback inbox merge skipped',e);}
    }
    const{error}=await sb.from('user_data').upsert({id:currentUser.id,data:payload,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error){
      console.error('Sync error:',error);
      setSyncStatus('offline');
      window._fluxSyncFailed=true;
      if(typeof updateConnectivityBanner==='function')updateConnectivityBanner();
      const el=document.getElementById('syncStatus');
      if(el)el.textContent='Sync failed: '+error.message;
      return;
    }
    window._fluxSyncFailed=false;
    if(typeof updateConnectivityBanner==='function')updateConnectivityBanner();
    setSyncStatus('synced');
    save('flux_last_sync',Date.now());
    console.log('✓ Synced to cloud at',new Date().toLocaleTimeString());
  }catch(e){
    console.error('Sync error:',e);
    window._fluxSyncFailed=true;
    if(typeof updateConnectivityBanner==='function')updateConnectivityBanner();
    setSyncStatus('offline');
  }
}

async function forceSyncNow(){
  const btn=event?.target;
  if(btn){btn.textContent='Syncing...';btn.disabled=true;}
  await syncToCloud();
  await syncFromCloud();
  // Re-render everything so pulled data appears immediately without refresh
  renderStats();renderTasks();renderCalendar();renderCountdown();renderSmartSug();
  renderProfile();renderNotesList();
  renderExtrasList();renderSchoolsList();renderECGoals();renderMoodHistory();
  renderSchool();updateTStats();populateSubjectSelects();
  // Re-apply accent AFTER all renders (renderSidebars rebuilds SVG logo)
  updateLogoColor(localStorage.getItem('flux_accent')||'#00bfff');
  if(typeof FluxPersonal!=='undefined')FluxPersonal.applyAll();
  if(btn){btn.textContent='✓ Synced';setTimeout(()=>{btn.textContent='Force Sync Now';btn.disabled=false;},2000);}
  showToast('✓ Data synced');
}
async function syncFromCloud(){
  if(!currentUser)return;
  const sb=getSB();if(!sb)return;
  setSyncStatus('syncing');
  try{
    const{data,error}=await sb.from('user_data').select('data').eq('id',currentUser.id).single();
    if(error||!data){
      window._fluxSyncFailed=true;
      if(typeof updateConnectivityBanner==='function')updateConnectivityBanner();
      setSyncStatus('offline');
      return;
    }
    const d=data.data;
    if(d.tasks){tasks=d.tasks;save('tasks',tasks);migrateCompletedAtBackfill();}
    if(d.notes){notes=d.notes;save('flux_notes',notes);}
    if(d.habits){habits=d.habits;save('flux_habits',habits);}
    if(d.goals){goals=d.goals;save('flux_goals',goals);}
    if(d.colleges){colleges=d.colleges;save('flux_colleges',colleges);}
    if(d.moodHistory){moodHistory=d.moodHistory;save('flux_mood',moodHistory);}
    if(d.schoolInfo){schoolInfo=d.schoolInfo;save('flux_school',schoolInfo);}
    if(d.classes){classes=d.classes;save('flux_classes',classes);}
    if(d.teacherNotes){teacherNotes=d.teacherNotes;save('flux_teacher_notes',teacherNotes);}
    if(d.profile&&d.profile.name){localStorage.setItem('profile',JSON.stringify(d.profile));localStorage.setItem('flux_user_name',d.profile.name.split(' ')[0]);}
    if(d.studyDNA){studyDNA=d.studyDNA;save('flux_dna',studyDNA);}
    if(d.confidences){confidences=d.confidences;save('flux_conf',confidences);}
    if(d.sessionLog){sessionLog=d.sessionLog;save('flux_session_log',sessionLog);}
    if(d.extras){extras=d.extras;save('flux_extras',extras);}
    if(d.ecSchools){ecSchools=d.ecSchools;save('flux_ec_schools',ecSchools);}
    if(d.ecGoals){ecGoals=d.ecGoals;save('flux_ec_goals',ecGoals);}
    if(d.ibProgramProgress&&typeof d.ibProgramProgress==='object'){
      ['tok','ee','cas','pp','comm'].forEach(k=>{
        if(typeof d.ibProgramProgress[k]==='boolean')save('flux_pt_'+k,d.ibProgramProgress[k]);
      });
    }
    if(Array.isArray(d.restDays)&&d.restDays.length){saveRestDaysList(d.restDays.filter(x=>x&&x.date));}
    else if(d.noHWDays&&Array.isArray(d.noHWDays)){saveRestDaysList(d.noHWDays.map(x=>typeof x==='string'?{date:x,kind:'lazy'}:x));}
    if(d.flux_ui_density)save('flux_ui_density',d.flux_ui_density);
    if(d.flux_mood_tint_enabled!==undefined)save('flux_mood_tint_enabled',d.flux_mood_tint_enabled);
    if(d.flux_liquid_glass===true||d.flux_liquid_glass===false)save('flux_liquid_glass',d.flux_liquid_glass);
    if(d.flux_nav_counts_v1&&typeof d.flux_nav_counts_v1==='object')save('flux_nav_counts_v1',d.flux_nav_counts_v1);
    if(d.events){save('flux_events',d.events);}
    if(d.cycleConfig!==undefined)save('flux_cycle_config',d.cycleConfig);
    if(Array.isArray(d.weeklyEvents)){save('flux_weekly_events',d.weeklyEvents);}
    if(d.settings){
      settings={...settings,...d.settings};
      save('flux_settings',settings);
    }
    if(d.tourCompleted){
      save('flux_tour_completed',true);
      save('flux_tour_done',true);
    }
    // Restore synced colors — write to localStorage FIRST so applyTheme reads correct values
    const syncAccent=d.accent||'#00bfff';
    const syncRgb=d.accentRgb||'0,191,255';
    localStorage.setItem('flux_accent',syncAccent);
    localStorage.setItem('flux_accent_rgb',syncRgb);
    if(d.theme)localStorage.setItem('flux_theme',d.theme);
    loadTheme();
    // Mark active swatch
    document.querySelectorAll('.swatch').forEach(s=>{
      s.classList.toggle('active', s.style.background===syncAccent||s.getAttribute('onclick')?.includes(syncAccent));
    });
    
    if(d.onboarded)save('flux_onboarded',true);
    else{
      const legacyDone=tasks.length>0||notes.length>0||classes.length>0;
      if(legacyDone)save('flux_onboarded',true);
    }
    // Load devAccounts — owner's list syncs to all dev accounts too
    if(d.devAccounts)save('flux_dev_accounts',d.devAccounts);
    if(isOwner()){
      if(d.platformConfig&&typeof d.platformConfig==='object')save('flux_platform_config',d.platformConfig);
      if(Array.isArray(d.ownerAuditLog))save('flux_owner_audit',d.ownerAuditLog.slice(-300));
      if(Array.isArray(d.feedbackInbox)){
        const tomb=new Set((load('flux_feedback_tombstones',[])||[]).map(String));
        const next=d.feedbackInbox.filter(x=>x&&x.id&&!tomb.has(String(x.id)));
        save('flux_feedback_inbox',next.slice(-300));
      }
    }
    // Dev accounts + release gate: fetch from owner's row (single source of truth).
    // Owner's row also hosts platformConfig.releaseGate which controls staged rollout.
    if(!isOwner()){
      try{
        if(!window.__fluxOwnerRowId){
          const rows=await sb.from('user_data').select('id,data').limit(100);
          const hit=(rows.data||[]).find(r=>r?.data?.ownerEmail===OWNER_EMAIL);
          if(hit)window.__fluxOwnerRowId=hit.id;
          if(hit?.data?.devAccounts)save('flux_dev_accounts',hit.data.devAccounts);
          if(hit?.data?.platformConfig)savePublicPlatformBroadcastFromOwner(hit.data.platformConfig);
          if(hit?.data?.platformConfig?.releaseGate){
            save('flux_release_gate',hit.data.platformConfig.releaseGate);
          }
        }else{
          const ownerRes=await sb.from('user_data').select('data').eq('id',window.__fluxOwnerRowId).single();
          const od=ownerRes?.data?.data;
          if(od?.devAccounts)save('flux_dev_accounts',od.devAccounts);
          if(od?.platformConfig)savePublicPlatformBroadcastFromOwner(od.platformConfig);
          if(od?.platformConfig?.releaseGate)save('flux_release_gate',od.platformConfig.releaseGate);
        }
      }catch(e){}
    }
    if(typeof FluxRelease!=='undefined'&&FluxRelease&&typeof FluxRelease.applyGate==='function'){
      FluxRelease.applyGate();
    }
    maybeFluxOwnerAnnouncementToast();
    try{fluxRenderMaintenanceOverlay();}catch(_){}
    try{maybeFluxBroadcastPopup();}catch(_){}
    setSyncStatus('synced');
    window._fluxSyncFailed=false;
    if(typeof updateConnectivityBanner==='function')updateConnectivityBanner();
    renderStats();renderTasks();renderCalendar();renderCountdown();renderSmartSug();renderProfile();renderNotesList();renderExtrasList();renderSchoolsList();renderECGoals();renderMoodHistory();renderSchool();updateTStats();
    populateSubjectSelects();
    // Re-apply accent after renders in case sidebar was rebuilt
    updateLogoColor(localStorage.getItem('flux_accent')||'#00bfff');
    if(typeof FluxPersonal!=='undefined')FluxPersonal.applyAll();
    updateMasterBacklogCardVisibility();
  }catch(e){console.error('Sync from cloud error',e);setSyncStatus('offline');}
}

/** Non-sensitive platform strings from owner's row — safe for non-owner clients (announcement toast, advisory hints). */
function savePublicPlatformBroadcastFromOwner(pc){
  if(!pc||typeof pc!=='object')return;
  const merged={
    announcement:String(pc.announcement||'').trim(),
    announcementRevision:(typeof pc.announcementRevision==='number'&&!isNaN(pc.announcementRevision))?Math.max(0,Math.floor(pc.announcementRevision)):0,
    sessionIdleWarnMins:Math.min(480,Math.max(5,parseInt(pc.sessionIdleWarnMins,10)||60)),
    complianceContact:String(pc.complianceContact||'').trim(),
    dataRetentionDays:Math.min(3650,Math.max(30,parseInt(pc.dataRetentionDays,10)||365)),
    // Nuke-control broadcast fields:
    maintenanceMode:!!pc.maintenanceMode,
    maintenanceMessage:String(pc.maintenanceMessage||'').trim(),
    signInPopup:String(pc.signInPopup||'').trim(),
    signInPopupTitle:String(pc.signInPopupTitle||'').trim(),
    signInPopupRevision:(typeof pc.signInPopupRevision==='number'&&!isNaN(pc.signInPopupRevision))?Math.max(0,Math.floor(pc.signInPopupRevision)):0,
  };
  save('flux_platform_broadcast',merged);
}

function maybeFluxOwnerAnnouncementToast(){
  try{
    if(!currentUser||typeof load!=='function'||typeof showToast!=='function')return;
    const raw=isOwner()?load('flux_platform_config',{}):load('flux_platform_broadcast',{});
    const ann=String(raw.announcement||'').trim();
    if(!ann)return;
    const rev=(typeof raw.announcementRevision==='number'&&!isNaN(raw.announcementRevision))?Math.max(0,Math.floor(raw.announcementRevision)):0;
    const sig=`${rev}|${ann}`;
    const seen=load('flux_platform_ann_seen_sig','');
    if(seen===sig)return;
    save('flux_platform_ann_seen_sig',sig);
    showToast(ann,'info',9500);
  }catch(e){console.warn('[Flux] announcement toast',e);}
}

/* ── Owner-broadcast sign-in popup ──────────────────────────────────
   Shown to every user on their next sign-in / page load when the owner
   sets a popup in the Nuke Controls tab. Tracks per-revision to avoid
   nagging the same person twice for the same broadcast. */
function fluxShowSignInPopup(opts){
  opts=opts||{};
  const existing=document.getElementById('fluxBroadcastPopup');
  if(existing)existing.remove();
  const ov=document.createElement('div');
  ov.id='fluxBroadcastPopup';
  ov.style.cssText='position:fixed;inset:0;z-index:10070;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,8,16,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)';
  const titleSafe=String(opts.title||'A message from Flux').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'})[c]);
  const bodySafe=String(opts.body||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'})[c]).replace(/\n/g,'<br>');
  ov.innerHTML=`
    <div style="max-width:480px;width:100%;background:var(--card);border:1px solid var(--border2);border-radius:22px;padding:26px;box-shadow:0 28px 80px rgba(0,0,0,.55);position:relative">
      <div style="font-size:.66rem;color:var(--accent);text-transform:uppercase;letter-spacing:.18em;font-family:JetBrains Mono,monospace;font-weight:700;margin-bottom:8px">${opts.preview?'PREVIEW · NOT BROADCAST':'BROADCAST'}</div>
      <h2 style="margin:0 0 12px;font-size:1.4rem;font-weight:900;letter-spacing:-.02em">${titleSafe}</h2>
      <div style="font-size:.92rem;line-height:1.55;color:var(--muted2);margin-bottom:22px;max-height:50vh;overflow-y:auto">${bodySafe||'<i style="color:var(--muted)">(empty)</i>'}</div>
      <button type="button" id="fluxBroadcastClose" style="width:100%;padding:12px;font-size:.9rem;font-weight:800;border:none;border-radius:12px;background:var(--accent);color:#0a0d18;cursor:pointer">Got it</button>
    </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  document.getElementById('fluxBroadcastClose')?.addEventListener('click',close);
  ov.addEventListener('click',(e)=>{if(e.target===ov)close();});
}
window.fluxShowSignInPopup=fluxShowSignInPopup;

function maybeFluxBroadcastPopup(){
  try{
    if(!currentUser)return;
    const raw=isOwner()?load('flux_platform_config',{}):load('flux_platform_broadcast',{});
    const body=String(raw.signInPopup||'').trim();
    if(!body)return;
    const rev=(typeof raw.signInPopupRevision==='number')?Math.max(0,Math.floor(raw.signInPopupRevision)):0;
    const title=String(raw.signInPopupTitle||'A message from Flux');
    const sig=`${rev}|${body}`;
    const seen=load('flux_platform_signin_popup_seen_sig','');
    if(seen===sig)return;
    save('flux_platform_signin_popup_seen_sig',sig);
    setTimeout(()=>fluxShowSignInPopup({title,body}),900);
  }catch(e){console.warn('[Flux] broadcast popup',e);}
}
window.maybeFluxBroadcastPopup=maybeFluxBroadcastPopup;

/* ── Maintenance ("Flux under update") overlay ──────────────────────
   When the owner toggles maintenanceMode ON, every non-owner client
   renders a full-screen overlay until the owner toggles it off.  The
   owner themselves never gets blocked (so they can disable it). */
function fluxRenderMaintenanceOverlay(){
  try{
    const raw=isOwner()?load('flux_platform_config',{}):load('flux_platform_broadcast',{});
    const on=!!raw.maintenanceMode&&!isOwner();
    const existing=document.getElementById('fluxMaintOverlay');
    if(!on){if(existing)existing.remove();return;}
    const msg=String(raw.maintenanceMessage||'Flux is undergoing an update. We\'ll be back shortly.');
    if(existing){
      const t=existing.querySelector('[data-maint-msg]');
      if(t)t.textContent=msg;
      return;
    }
    const ov=document.createElement('div');
    ov.id='fluxMaintOverlay';
    ov.style.cssText='position:fixed;inset:0;z-index:10080;background:radial-gradient(circle at 50% 35%,#101a30 0%,#06080f 70%);color:#e6edf6;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;text-align:center';
    ov.innerHTML=`
      <div style="max-width:480px">
        <div style="font-size:3rem;margin-bottom:14px">🛠</div>
        <div style="font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;font-family:JetBrains Mono,monospace;color:#fbbf24;margin-bottom:10px">Flux is under update</div>
        <h1 style="margin:0 0 12px;font-size:1.8rem;font-weight:900;letter-spacing:-.02em">Just a moment…</h1>
        <p data-maint-msg style="margin:0 0 24px;font-size:1rem;line-height:1.55;color:#8a93a7">${String(msg).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'})[c])}</p>
        <button type="button" onclick="location.reload()" style="padding:11px 20px;font-size:.85rem;font-weight:800;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#e6edf6;cursor:pointer">Try again</button>
      </div>`;
    document.body.appendChild(ov);
  }catch(e){console.warn('[Flux] maintenance overlay',e);}
}
window.fluxRenderMaintenanceOverlay=fluxRenderMaintenanceOverlay;

let _fluxIdleTimer=null;
let _fluxActBound=null;
let _fluxScrollBound=null;

function stopFluxSessionIdleAdvisory(){
  if(_fluxIdleTimer){clearInterval(_fluxIdleTimer);_fluxIdleTimer=null;}
  if(_fluxActBound){
    window.removeEventListener('keydown',_fluxActBound,true);
    window.removeEventListener('click',_fluxActBound,true);
    window.removeEventListener('touchstart',_fluxActBound,true);
  }
  if(_fluxScrollBound)window.removeEventListener('scroll',_fluxScrollBound);
  _fluxActBound=null;
  _fluxScrollBound=null;
}

function fluxMarkUserActivity(){window._fluxLastActivityMs=Date.now();}

function initFluxSessionIdleAdvisory(){
  if(typeof currentUser==='undefined'||!currentUser)return;
  stopFluxSessionIdleAdvisory();
  window._fluxLastActivityMs=Date.now();
  _fluxActBound=function(){fluxMarkUserActivity();};
  _fluxScrollBound=function(){fluxMarkUserActivity();};
  window.addEventListener('keydown',_fluxActBound,true);
  window.addEventListener('click',_fluxActBound,true);
  window.addEventListener('touchstart',_fluxActBound,true);
  window.addEventListener('scroll',_fluxScrollBound,{passive:true});
  _fluxIdleTimer=setInterval(function(){
    try{
      if(typeof currentUser==='undefined'||!currentUser)return;
      const raw=isOwner()?load('flux_platform_config',{}):load('flux_platform_broadcast',{});
      const mins=Math.min(480,Math.max(5,parseInt(raw.sessionIdleWarnMins,10)||60));
      const rev=(typeof raw.announcementRevision==='number'&&!isNaN(raw.announcementRevision))?raw.announcementRevision:0;
      const sigKey='flux_idle_'+String(isOwner()?'owner':'all')+'_'+mins+'_'+rev;
      try{
        if(sessionStorage.getItem('flux_idle_tip')===sigKey)return;
      }catch(_){}
      const last=window._fluxLastActivityMs||Date.now();
      if((Date.now()-last)<mins*60000)return;
      const contact=String(raw.complianceContact||'').trim();
      const msg=contact?('Session idle reminder (~'+mins+'m). Reach out: '+contact):('You\'ve been quiet for ~'+mins+' minutes — stretch, hydrate, then dive back in.');
      try{sessionStorage.setItem('flux_idle_tip',sigKey);}catch(_){}
      if(typeof showToast==='function')showToast(msg,'info',6500);
    }catch(_){/* ignore */}
  },90000);
}
const syncDebounceTimers={};
const SYNC_DEBOUNCE_MS=600;
const SYNC_DEBOUNCE_TASKS_MS=350;
function clearAllSyncDebounceTimers(){
  Object.keys(syncDebounceTimers).forEach(k=>{ clearTimeout(syncDebounceTimers[k]); delete syncDebounceTimers[k]; });
}
/**
 * Pushes the latest in-memory + localStorage state to Supabase.
 * Use after any cloud-backed edit; debounced by syncKey, or call directly for a flush.
 */
function flushPendingSyncToCloud(){
  if(!currentUser)return;
  clearAllSyncDebounceTimers();
  void syncToCloud();
}
/**
 * Unload / tab-close: PostgREST upsert with fetch keepalive so the browser does not
 * drop the request when the page tears down (normal syncToCloud may never finish).
 * Skips if payload is too large for the ~64KB keepalive body limit.
 */
function trySyncToCloudKeepalive(){
  if(!currentUser)return;
  const sb=getSB();
  if(!sb)return;
  sb.auth.getSession().then(res=>{
    const session=res?.data?.session;
    if(!session?.access_token)return;
    try{
      const payload=getCloudPayload();
      const body=JSON.stringify([{id:currentUser.id,data:payload,updated_at:new Date().toISOString()}]);
      if(body.length>62000){
        if(typeof console!=='undefined'&&console.warn)console.warn('Flux: payload large for keepalive; rely on last visibility flush');
        return;
      }
      fetch(SB_URL+'/rest/v1/user_data?on_conflict=id',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SB_ANON,
          'Authorization':'Bearer '+session.access_token,
          'Prefer':'return=minimal,resolution=merge-duplicates',
        },
        body,
        keepalive:true,
      }).catch(()=>{});
    }catch(e){}
  }).catch(()=>{});
}
function initSyncLifecycle(){
  if(typeof window!=='undefined'&&window._fluxSyncLifecycleWired)return;
  if(typeof window!=='undefined')window._fluxSyncLifecycleWired=1;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='hidden'||!currentUser)return;
    flushPendingSyncToCloud();
  });
  const onLeave=()=>{
    if(!currentUser)return;
    clearAllSyncDebounceTimers();
    trySyncToCloudKeepalive();
  };
  window.addEventListener('pagehide',onLeave);
  window.addEventListener('beforeunload',onLeave);
}
function syncKey(key,val){
  if(!currentUser)return;
  clearTimeout(syncDebounceTimers[key]);
  const delay=key==='tasks'?SYNC_DEBOUNCE_TASKS_MS:SYNC_DEBOUNCE_MS;
  syncDebounceTimers[key]=setTimeout(()=>{ void syncToCloud(); },delay);
}

// ══ USER FEEDBACK → owner cloud inbox (Edge Function user-feedback) ══
function openFluxFeedbackModal(){
  const m=document.getElementById('fluxFeedbackModal');
  if(!m)return;
  m.classList.add('flux-feedback-modal--open');
  m.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  const ta=document.getElementById('fluxFeedbackText');
  if(ta){ta.value='';ta.focus();}
  const hint=document.getElementById('fluxFeedbackHint');
  if(hint)hint.style.display=currentUser?'none':'block';
  const sub=document.getElementById('fluxFeedbackSubmit');
  if(sub)sub.disabled=!currentUser;
}
function closeFluxFeedbackModal(){
  const m=document.getElementById('fluxFeedbackModal');
  if(!m)return;
  m.classList.remove('flux-feedback-modal--open');
  m.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
async function submitFluxFeedback(){
  const ta=document.getElementById('fluxFeedbackText');
  const cat=document.getElementById('fluxFeedbackCategory');
  const err=document.getElementById('fluxFeedbackError');
  const sub=document.getElementById('fluxFeedbackSubmit');
  if(err){err.textContent='';err.style.display='none';}
  if(!currentUser){
    if(typeof showToast==='function')showToast('Sign in to send feedback','info');
    return;
  }
  const msg=(ta?.value||'').trim();
  if(!msg){
    if(err){err.textContent='Write something first.';err.style.display='block';}
    return;
  }
  if(sub){sub.disabled=true;sub.textContent='Sending…';}
  try{
    const session=await getSB()?.auth?.getSession();
    const token=session?.data?.session?.access_token;
    if(!token)throw new Error('Session expired — sign in again.');
    const res=await fetch(API.userFeedback,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':SB_ANON},
      body:JSON.stringify({
        message:msg,
        category:(cat?.value||'general'),
        path:location.pathname+location.search,
      }),
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||('HTTP '+res.status));
    if(typeof showToast==='function')showToast('Thanks — feedback sent!','success');
    closeFluxFeedbackModal();
  }catch(e){
    if(err){err.textContent=e.message||'Could not send.';err.style.display='block';}
    if(typeof showToast==='function')showToast('Feedback failed to send','error');
  }finally{
    if(sub){sub.disabled=false;sub.textContent='Send feedback';}
  }
}
function initFluxFeedbackModal(){
  const m=document.getElementById('fluxFeedbackModal');
  if(!m||m.dataset.bound)return;
  m.dataset.bound='1';
  m.querySelector('[data-flux-feedback-overlay]')?.addEventListener('click',closeFluxFeedbackModal);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&m.classList.contains('flux-feedback-modal--open'))closeFluxFeedbackModal();
  });
}

window.ownerRefreshFeedbackInbox=async function(){
  if(typeof isOwner!=='function'||!isOwner())return;
  try{
    await syncFromCloud();
    if(typeof showToast==='function')showToast('Inbox refreshed','success');
  }catch(e){}
  const os=document.getElementById('ownerSuite');
  if(os&&typeof window.__osSetTab==='function')window.__osSetTab('feedback');
  else if(typeof reopenOwnerSuite==='function')reopenOwnerSuite('feedback');
};

window.ownerDismissFeedback=function(fid){
  if(typeof isOwner!=='function'||!isOwner())return;
  const ts=load('flux_feedback_tombstones',[]);
  if(fid&&!ts.includes(fid)){
    ts.push(fid);
    save('flux_feedback_tombstones',ts.slice(-500));
  }
  const arr=(load('flux_feedback_inbox',[])||[]).filter(x=>x&&x.id!==fid);
  save('flux_feedback_inbox',arr);
  void syncToCloud();
  try{if(typeof ownerAuditAppend==='function')ownerAuditAppend('feedback_dismiss',{id:fid});}catch(_){}
  const os=document.getElementById('ownerSuite');
  if(os&&typeof window.__osSetTab==='function')window.__osSetTab('feedback');
  else if(typeof reopenOwnerSuite==='function')reopenOwnerSuite('feedback');
};

window.ownerExportFeedbackJson=function(){
  if(typeof isOwner!=='function'||!isOwner())return;
  const arr=load('flux_feedback_inbox',[]);
  const blob=new Blob([JSON.stringify(arr,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='flux-feedback-inbox.json';
  a.click();
  URL.revokeObjectURL(a.href);
  try{if(typeof ownerAuditAppend==='function')ownerAuditAppend('feedback_export',{n:arr.length});}catch(_){}
};

// ══ OFFLINE BANNER · NOTIFICATIONS · DEEPLINKS ══
let _fluxConnInit=false;
function updateConnectivityBanner(){
  const el=document.getElementById('connectivityBanner');if(!el)return;
  if(!navigator.onLine){
    el.textContent='Offline — changes stay on this device. Reconnect to sync.';
    el.dataset.state='offline';
    if(typeof syncNoticesBar==='function')syncNoticesBar();return;
  }
  if(window._fluxSyncFailed&&currentUser){
    el.textContent='Couldn’t sync to the cloud. Check Settings → Force sync.';
    el.dataset.state='syncfail';
    if(typeof syncNoticesBar==='function')syncNoticesBar();return;
  }
  el.style.display='none';
  el.removeAttribute('data-state');
  if(typeof syncNoticesBar==='function')syncNoticesBar();
}
function initConnectivityAndNotifications(){
  if(_fluxConnInit)return;
  _fluxConnInit=true;
  window._fluxSyncFailed=false;
  updateConnectivityBanner();
  window.addEventListener('online',updateConnectivityBanner);
  window.addEventListener('offline',updateConnectivityBanner);
  setInterval(()=>{
    if(settings.notifyBrowser)checkDueNotifications();
  },15*60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDueNotifications();});
  setTimeout(checkDueNotifications,4000);
  if(typeof initSyncLifecycle==='function')initSyncLifecycle();
}
function checkDueNotifications(){
  if(!settings.notifyBrowser)return;
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  if(quietHours())return;
  const now=new Date();
  const horizon=new Date(now.getTime()+24*3600000);
  let log={};
  try{log=JSON.parse(localStorage.getItem('flux_notify_log')||'{}');}catch(e){log={};}
  tasks.forEach(t=>{
    if(t.done||!t.date)return;
    const due=new Date(t.date+'T23:59:59');
    if(due<now||due>horizon)return;
    const key=String(t.id)+'_'+t.date;
    if(log[key])return;
    try{
      new Notification('Due soon: '+t.name.slice(0,72),{body:'Due '+t.date+(t.priority==='high'?' · High priority':''),tag:'flux-'+t.id});
    }catch(e){}
    log[key]=Date.now();
  });
  const pruned=Object.fromEntries(Object.entries(log).filter(([,ts])=>Date.now()-ts<7*86400000));
  localStorage.setItem('flux_notify_log',JSON.stringify(pruned));
}
function handleDeepLinkParams(){
  try{
    const u=new URL(location.href);
    const q=u.searchParams.get('quick');
    const shareText=(u.searchParams.get('text')||u.searchParams.get('title')||'').trim();
    const shareUrl=(u.searchParams.get('url')||'').trim();
    const combined=[shareText,shareUrl].filter(Boolean).join(' ').trim();
    if(u.searchParams.get('upgrade')==='1'){
      if(FLUX_FLAGS.SHOW_PRICING_PAGE)setTimeout(()=>{if(typeof showPricingPage==='function')showPricingPage();},600);
      u.searchParams.delete('upgrade');
      const qs=u.searchParams.toString();
      history.replaceState({},'',u.pathname+(qs?'?'+qs:'')+u.hash);
    }
    if(q==='task'){
      nav('dashboard');
      setTimeout(()=>{if(typeof openQuickAdd==='function')openQuickAdd();},400);
    }else if(q==='ai'){
      nav('ai');
      setTimeout(()=>document.getElementById('aiInput')?.focus(),450);
    }else if(combined){
      nav('dashboard');
      setTimeout(()=>openQuickAddWithText(combined),450);
    }
    if(q||combined){
      u.search='';
      history.replaceState({},'',u.pathname+u.hash);
    }
  }catch(e){/* ignore */}
}
function openQuickAddWithText(text){
  const panel=document.getElementById('quickAddPanel');if(!panel)return;
  panel.classList.add('open');
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','Quick add task');
  const input=document.getElementById('quickAddInput');
  if(input){input.value=text||'';input.focus();updateQuickAddPreview(text||'');}
  refreshQuickAddDatalist();
}
function explainMyWeek(){
  nav('ai');
  setTimeout(()=>{
    const inp=document.getElementById('aiInput');
    if(inp){
      inp.value='Summarize my upcoming week using my tasks, due dates, and types (tests, projects). Flag risks and suggest three concrete priorities.';
      inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,120)+'px';
      sendAI();
    }
  },480);
}

// ══ ONBOARDING ══
let obCurrentStep=1;
const OB_TOTAL=5;
let obSelectedGrade='10';
let obSelectedTrack='';
let obSelectedFocus='deadlines';
let obScheduleImgData=null;
let obExtractedClasses=[];
let obSchedulePdfPages=[];
let obScheduleFile=null;
let schoolSchedulePdfPages=[];
const OB_TRACK_PRECEDENCE=['IB DP','IB MYP','AP','Honours','General'];

function prefillOnboardingFromProfile(){
  const p=load('profile',{});
  const nameEl=document.getElementById('obName');
  if(nameEl)nameEl.value=(p.name&&String(p.name).trim())?String(p.name).trim():'';
  const g=String(p.grade||obSelectedGrade||'10');
  obSelectedGrade=g;
  const gradeChip=Array.from(document.querySelectorAll('#obGradeChips .ob-chip')).find(c=>(c.getAttribute('onclick')||'').includes(`'${g}'`));
  if(gradeChip)selectObChip(gradeChip,'obGrade',g);
  let focus=(p.termFocus&&String(p.termFocus).trim())?String(p.termFocus).trim():'deadlines';
  let focusChip=Array.from(document.querySelectorAll('#obFocusChips .ob-chip')).find(c=>(c.getAttribute('onclick')||'').includes(`'${focus}'`));
  if(!focusChip){focus='deadlines';focusChip=Array.from(document.querySelectorAll('#obFocusChips .ob-chip')).find(c=>(c.getAttribute('onclick')||'').includes("'deadlines'"));}
  obSelectedFocus=focus;
  if(focusChip)selectObChip(focusChip,'obFocus',focus);
  document.querySelectorAll('#obFeatureChips .ob-chip').forEach(c=>c.classList.remove('active'));
  const feats=Array.isArray(p.plannerFeatures)&&p.plannerFeatures.length?p.plannerFeatures:['tasks'];
  document.querySelectorAll('#obFeatureChips .ob-chip').forEach(el=>{
    if(feats.includes(el.dataset.feat))el.classList.add('active');
  });
  const si=schoolInfo&&typeof schoolInfo==='object'?schoolInfo:{};
  const sch=document.getElementById('obSchool');if(sch)sch.value=si.schoolName||'';
  const cou=document.getElementById('obCounselor');if(cou)cou.value=si.counselor||'';
  const programs=normalizeProgramList(p.program);
  obSelectedTrack='';
  for(const t of OB_TRACK_PRECEDENCE){
    if(programs.includes(t)){
      const tc=Array.from(document.querySelectorAll('#obTrackChips .ob-chip')).find(c=>(c.getAttribute('onclick')||'').includes(`'${t}'`));
      if(tc){selectObChip(tc,'obTrack',t);obSelectedTrack=t;}
      break;
    }
  }
  if(Array.isArray(classes)&&classes.length)obExtractedClasses=classes.map(c=>({...c}));
  document.querySelectorAll('.ob-step .ob-chip[data-dna]').forEach(c=>c.classList.remove('active'));
  if(Array.isArray(studyDNA)&&studyDNA.length){
    studyDNA.forEach(d=>{
      const el=document.querySelector(`.ob-step .ob-chip[data-dna="${d}"]`);
      if(el)el.classList.add('active');
    });
  }
  const goalSlider=document.getElementById('obStudyGoal');
  const goalLbl=document.getElementById('obGoalLabel');
  if(goalSlider){
    const hrs=typeof settings.dailyGoalHrs==='number'&&!Number.isNaN(settings.dailyGoalHrs)?settings.dailyGoalHrs:2;
    goalSlider.value=String(Math.min(6,Math.max(0.5,hrs)));
    if(goalLbl)goalLbl.textContent=goalSlider.value+'h';
  }
  updateObPreview();
}

function showOnboarding(startStep){
  const step=typeof startStep==='number'&&startStep>=1&&startStep<=OB_TOTAL?Math.floor(startStep):1;
  obCurrentStep=step;
  document.getElementById('loginScreen')?.classList.remove('visible');
  document.getElementById('app')?.classList.remove('visible');
  const ob=document.getElementById('onboarding');
  if(ob)ob.classList.add('visible');
  prefillOnboardingFromProfile();
  renderObProgress();
  showObStep(obCurrentStep);
}

function openQuestionnaireRedo(){
  window._fluxOnboardingRedo=true;
  showOnboarding(2);
}

function cancelQuestionnaireRedo(){
  window._fluxOnboardingRedo=false;
  const ob=document.getElementById('onboarding');
  if(ob)ob.classList.remove('visible');
  const gc=document.getElementById('obRedoGlobalCancel');
  const sb=document.getElementById('obRedoSaveBtn');
  if(gc)gc.style.display='none';
  if(sb)sb.style.display='none';
  showApp();
}

function finishQuestionnaireRedoOnly(){
  const p=load('profile',{});
  p.termFocus=obSelectedFocus||'deadlines';
  const feats=Array.from(document.querySelectorAll('#obFeatureChips .ob-chip.active')).map(c=>c.dataset.feat).filter(Boolean);
  p.plannerFeatures=feats.length?feats:['tasks'];
  save('profile',p);
  window._fluxOnboardingRedo=false;
  const ob=document.getElementById('onboarding');
  if(ob)ob.classList.remove('visible');
  const gc=document.getElementById('obRedoGlobalCancel');
  const sb=document.getElementById('obRedoSaveBtn');
  if(gc)gc.style.display='none';
  if(sb)sb.style.display='none';
  showApp();
  renderProfile();
  if(currentUser)syncToCloud();
  if(typeof showToast==='function')showToast('Preferences saved','success');
}
function renderObProgress(){
  const el=document.getElementById('obProgress');if(!el)return;
  el.innerHTML=Array.from({length:OB_TOTAL},(_,i)=>{
    const n=i+1;
    const cls=n<obCurrentStep?'done':n===obCurrentStep?'active':'';
    return`<div class="ob-dot ${cls}"></div>`;
  }).join('');
}
function showObStep(n){
  document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));
  const s=document.getElementById('ob-step-'+n);if(s)s.classList.add('active');
  obCurrentStep=n;renderObProgress();
  const redo=!!window._fluxOnboardingRedo;
  const gc=document.getElementById('obRedoGlobalCancel');
  const sb=document.getElementById('obRedoSaveBtn');
  if(gc)gc.style.display=redo?'block':'none';
  if(sb)sb.style.display=redo&&n===2?'block':'none';
  if(n===4){
    bindScheduleImportDropzones();
    ensurePdfJsLoaded().catch(()=>{});
  }
}
function selectObChip(el,key,val){
  el.closest('.ob-chip-wrap,.ob-chips').querySelectorAll('.ob-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  if(key==='obGrade')obSelectedGrade=val;
  if(key==='obTrack')obSelectedTrack=val;
  if(key==='obFocus')obSelectedFocus=val;
}
function updateObPreview(){
  const name=(document.getElementById('obName')?.value||'').trim();
  const av=document.getElementById('obAvatar');
  if(av&&name&&!av.querySelector('img'))av.textContent=name.charAt(0).toUpperCase();
}
function handleObPic(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    localStorage.setItem('flux_profile_pic',e.target.result);
    const av=document.getElementById('obAvatar');
    if(av)av.innerHTML=`<img src="${e.target.result}"><input type="file" id="obPicInput" accept="image/*" style="display:none" onchange="handleObPic(event)">`;
  };
  reader.readAsDataURL(file);
}
function obNext(){
  if(obCurrentStep===1){
    const name=document.getElementById('obName')?.value.trim();
    if(!name){document.getElementById('obName')?.focus();return;}
    const p=load('profile',{});
    p.name=name;
    p.grade=obSelectedGrade;
    save('profile',p);
    localStorage.setItem('flux_user_name',name.split(' ')[0]);
    _updateSidebarName(name);
  }
  if(obCurrentStep===2){
    const p=load('profile',{});
    p.termFocus=obSelectedFocus||'deadlines';
    const feats=Array.from(document.querySelectorAll('#obFeatureChips .ob-chip.active')).map(c=>c.dataset.feat).filter(Boolean);
    p.plannerFeatures=feats.length?feats:['tasks'];
    save('profile',p);
  }
  if(obCurrentStep===3){
    schoolInfo.schoolName=document.getElementById('obSchool')?.value.trim()||'';
    schoolInfo.counselor=document.getElementById('obCounselor')?.value.trim()||'';
    schoolInfo.locker=document.getElementById('obLocker')?.value.trim()||'';
    schoolInfo.combo=document.getElementById('obCombo')?.value.trim()||'';
    save('flux_school',schoolInfo);
    const p=load('profile',{});
    if(obSelectedTrack){
      const existing=normalizeProgramList(p.program);
      if(!existing.includes(obSelectedTrack))existing.push(obSelectedTrack);
      p.program=existing;
    }
    save('profile',p);
  }
  if(obCurrentStep===4){
    if(obExtractedClasses.length){classes=obExtractedClasses;save('flux_classes',classes);}
  }
  if(obCurrentStep===5){obFinish();return;}
  showObStep(obCurrentStep+1);
}
function obBack(){if(obCurrentStep>1)showObStep(obCurrentStep-1);}
function obFinish(){
  const wasRedo=!!window._fluxOnboardingRedo;
  window._fluxOnboardingRedo=false;
  const gc=document.getElementById('obRedoGlobalCancel');
  const sb=document.getElementById('obRedoSaveBtn');
  if(gc)gc.style.display='none';
  if(sb)sb.style.display='none';
  // Capture DNA + study goal from step 5 if set
  const dnaChips=document.querySelectorAll('.ob-chip[data-dna].active');
  if(dnaChips.length){studyDNA=Array.from(dnaChips).map(c=>c.dataset.dna);save('flux_dna',studyDNA);}
  const goalSlider=document.getElementById('obStudyGoal');
  if(goalSlider){settings.dailyGoalHrs=parseFloat(goalSlider.value)||2;save('flux_settings',settings);}
  save('flux_onboarded',true);
  const ob=document.getElementById('onboarding');if(ob)ob.classList.remove('visible');
  showApp();
  if(!wasRedo)spawnConfetti();
  if(currentUser)syncToCloud();
  if(!wasRedo&&!isTourCompleted()){
    setTimeout(()=>startOnboardingTour(),1600);
  }
  if(wasRedo&&typeof showToast==='function')showToast('Setup updated','success');
}
function _updateSidebarName(name){
  const sn=document.getElementById('sidebarName');if(sn)sn.textContent=name;
  const mn=document.getElementById('mobName');if(mn)mn.textContent=name;
}

const FLUX_PDFJS_SRC='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
const FLUX_PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
const FLUX_PDF_PREVIEW_MAX_PAGES=28;
let _fluxPdfJsPromise=null;

function isPdfScheduleFile(file){
  if(!file)return false;
  if(file.type==='application/pdf')return true;
  return /\.pdf$/i.test(file.name||'');
}

function ensurePdfJsLoaded(){
  if(typeof window.pdfjsLib!=='undefined'&&window.pdfjsLib){
    try{window.pdfjsLib.GlobalWorkerOptions.workerSrc=FLUX_PDFJS_WORKER;}catch(e){}
    return Promise.resolve();
  }
  if(_fluxPdfJsPromise)return _fluxPdfJsPromise;
  const existing=document.querySelector('script[data-flux-pdfjs="1"]');
  if(existing){
    _fluxPdfJsPromise=new Promise((resolve,reject)=>{
      const finish=()=>{
        try{
          if(typeof window.pdfjsLib==='undefined'||!window.pdfjsLib){reject(new Error('PDF.js not available'));return;}
          window.pdfjsLib.GlobalWorkerOptions.workerSrc=FLUX_PDFJS_WORKER;
          resolve();
        }catch(err){reject(err);}
      };
      if(typeof window.pdfjsLib!=='undefined'&&window.pdfjsLib)finish();
      else{
        existing.addEventListener('load',finish);
        existing.addEventListener('error',()=>reject(new Error('Could not load PDF processor')));
      }
    });
  }else{
    _fluxPdfJsPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=FLUX_PDFJS_SRC;
      s.async=true;
      s.dataset.fluxPdfjs='1';
      s.onload=()=>{
        try{
          if(typeof window.pdfjsLib==='undefined'||!window.pdfjsLib){reject(new Error('PDF.js not available'));return;}
          window.pdfjsLib.GlobalWorkerOptions.workerSrc=FLUX_PDFJS_WORKER;
          resolve();
        }catch(err){reject(err);}
      };
      s.onerror=()=>reject(new Error('Could not load PDF processor'));
      document.head.appendChild(s);
    });
  }
  _fluxPdfJsPromise=_fluxPdfJsPromise.catch(err=>{_fluxPdfJsPromise=null;throw err;});
  return _fluxPdfJsPromise;
}

async function pdfFileToPageScreenshots(file,scale=1.35){
  await ensurePdfJsLoaded();
  const buf=await file.arrayBuffer();
  const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
  const nPages=Math.min(pdf.numPages||0,FLUX_PDF_PREVIEW_MAX_PAGES);
  const out=[];
  for(let i=1;i<=nPages;i++){
    const page=await pdf.getPage(i);
    const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas not available');
    canvas.height=viewport.height;
    canvas.width=viewport.width;
    await page.render({canvasContext:ctx,viewport}).promise;
    out.push({id:`page-${i}`,dataUrl:canvas.toDataURL('image/png'),pageNumber:i});
  }
  return out;
}

function bindScheduleImportDropzones(){
  if(window._fluxScheduleDropBound)return;
  window._fluxScheduleDropBound=true;
  function wire(zoneId,inputId){
    const z=document.getElementById(zoneId);
    const inp=document.getElementById(inputId);
    if(!z||!inp)return;
    ['dragenter','dragover'].forEach(ev=>z.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();z.classList.add('flux-pdf-import__drop--active');}));
    z.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();z.classList.remove('flux-pdf-import__drop--active');});
    z.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();z.classList.remove('flux-pdf-import__drop--active');
      const f=e.dataTransfer.files&&e.dataTransfer.files[0];
      if(!f)return;
      const ok=/^image\//.test(f.type)||f.type==='application/pdf'||/\.pdf$/i.test(f.name);
      if(!ok){if(typeof showToast==='function')showToast('Drop a PDF or image file','info');return;}
      try{
        const dt=new DataTransfer();
        dt.items.add(f);
        inp.files=dt.files;
        inp.dispatchEvent(new Event('change',{bubbles:true}));
      }catch(err){console.error(err);}
    });
    z.addEventListener('keydown',ke=>{if(ke.key==='Enter'||ke.key===' '){ke.preventDefault();inp.click();}});
  }
  wire('obScheduleDropZone','scheduleImg');
  wire('schoolScheduleDropZone','schoolScheduleFile');
}

function renderObSchedulePages(){
  const col=document.getElementById('obSchedulePageCol');
  const grid=document.getElementById('obSchedulePages');
  const clearBtn=document.getElementById('obScheduleClearBtn');
  const root=document.getElementById('obScheduleImportRoot');
  if(!col||!grid)return;
  if(!obSchedulePdfPages.length){
    col.hidden=true;
    grid.innerHTML='';
    if(clearBtn)clearBtn.style.display='none';
    if(root)root.classList.remove('flux-pdf-import--has-pages');
    return;
  }
  col.hidden=false;
  if(clearBtn)clearBtn.style.display='inline-flex';
  if(root)root.classList.add('flux-pdf-import--has-pages');
  grid.innerHTML=obSchedulePdfPages.map(shot=>`<div class="flux-pdf-import__thumb"><span class="flux-pdf-import__thumb-badge">Page ${shot.pageNumber}</span><img src="${shot.dataUrl}" alt="Page ${shot.pageNumber}" loading="lazy" decoding="async"></div>`).join('');
}

function updateObFileMeta(file,pageCount){
  const meta=document.getElementById('obScheduleFileMeta');
  const nameEl=document.getElementById('obScheduleFileName');
  const detEl=document.getElementById('obScheduleFileDetails');
  if(!meta||!nameEl||!detEl||!file)return;
  meta.hidden=false;
  nameEl.textContent=file.name;
  const mb=(file.size/1024/1024).toFixed(2);
  detEl.textContent=`${mb} MB · ${pageCount} ${pageCount===1?'page':'pages'}`;
}

function clearObScheduleImport(){
  obScheduleImgData=null;
  obSchedulePdfPages=[];
  obScheduleFile=null;
  const inp=document.getElementById('scheduleImg');
  if(inp)inp.value='';
  const prev=document.getElementById('schedulePreview');
  const prevImg=document.getElementById('schedulePreviewImg');
  if(prev)prev.style.display='none';
  if(prevImg){prevImg.removeAttribute('src');}
  document.getElementById('obScheduleFileMeta')?.setAttribute('hidden','');
  const err=document.getElementById('obScheduleImportError');
  if(err){err.textContent='';err.setAttribute('hidden','');}
  document.getElementById('obScheduleClearBtn')&&(document.getElementById('obScheduleClearBtn').style.display='none');
  document.getElementById('obScheduleImportRoot')?.classList.remove('flux-pdf-import--has-pages');
  renderObSchedulePages();
}

function renderSchoolSchedulePages(){
  const col=document.getElementById('schoolSchedulePageCol');
  const grid=document.getElementById('schoolSchedulePages');
  const clearBtn=document.getElementById('schoolScheduleClearBtn');
  const root=document.getElementById('schoolScheduleImportRoot');
  if(!col||!grid)return;
  if(!schoolSchedulePdfPages.length){
    col.hidden=true;
    grid.innerHTML='';
    if(clearBtn)clearBtn.style.display='none';
    if(root)root.classList.remove('flux-pdf-import--has-pages');
    return;
  }
  col.hidden=false;
  if(clearBtn)clearBtn.style.display='inline-flex';
  if(root)root.classList.add('flux-pdf-import--has-pages');
  grid.innerHTML=schoolSchedulePdfPages.map(shot=>`<div class="flux-pdf-import__thumb"><span class="flux-pdf-import__thumb-badge">Page ${shot.pageNumber}</span><img src="${shot.dataUrl}" alt="Page ${shot.pageNumber}" loading="lazy" decoding="async"></div>`).join('');
}

function updateSchoolFileMeta(file,pageCount){
  const meta=document.getElementById('schoolScheduleFileMeta');
  const nameEl=document.getElementById('schoolScheduleFileName');
  const detEl=document.getElementById('schoolScheduleFileDetails');
  if(!meta||!nameEl||!detEl||!file)return;
  meta.hidden=false;
  nameEl.textContent=file.name;
  const mb=(file.size/1024/1024).toFixed(2);
  detEl.textContent=`${mb} MB · ${pageCount} ${pageCount===1?'page':'pages'}`;
}

function clearSchoolScheduleImport(){
  schoolSchedulePdfPages=[];
  const inp=document.getElementById('schoolScheduleFile');
  if(inp)inp.value='';
  document.getElementById('schoolScheduleFileMeta')?.setAttribute('hidden','');
  const err=document.getElementById('schoolScheduleImportError');
  if(err){err.textContent='';err.setAttribute('hidden','');}
  document.getElementById('schoolScheduleClearBtn')&&(document.getElementById('schoolScheduleClearBtn').style.display='none');
  document.getElementById('schoolScheduleImportRoot')?.classList.remove('flux-pdf-import--has-pages');
  renderSchoolSchedulePages();
  const res=document.getElementById('schoolImgResult');
  if(res){res.style.display='none';res.innerHTML='';}
}

async function handleScheduleImg(event){
  const file=event.target?.files?.[0];
  if(!file)return;
  const errEl=document.getElementById('obScheduleImportError');
  if(errEl){errEl.textContent='';errEl.setAttribute('hidden','');}
  const prev=document.getElementById('schedulePreview');
  const prevImg=document.getElementById('schedulePreviewImg');
  const overlay=document.getElementById('obSchedulePdfOverlay');

  if(isPdfScheduleFile(file)){
    if(overlay)overlay.removeAttribute('hidden');
    try{
      await ensurePdfJsLoaded();
      const pages=await pdfFileToPageScreenshots(file);
      if(!pages.length)throw new Error('No pages found in PDF.');
      obSchedulePdfPages=pages;
      obScheduleImgData=pages[0].dataUrl;
      obScheduleFile=file;
      if(prev)prev.style.display='none';
      if(prevImg)prevImg.removeAttribute('src');
      renderObSchedulePages();
      updateObFileMeta(file,pages.length);
    }catch(e){
      console.error(e);
      obSchedulePdfPages=[];
      obScheduleImgData=null;
      obScheduleFile=null;
      renderObSchedulePages();
      if(errEl){errEl.textContent=e.message||'Could not read this PDF.';errEl.removeAttribute('hidden');}
      if(typeof showToast==='function')showToast('PDF import failed','error');
    }finally{
      if(overlay)overlay.setAttribute('hidden','');
    }
    if(obScheduleImgData)analyzeScheduleImg();
    return;
  }

  obSchedulePdfPages=[];
  obScheduleFile=file;
  const reader=new FileReader();
  reader.onload=e=>{
    obScheduleImgData=e.target.result;
    if(prev)prev.style.display='block';
    if(prevImg)prevImg.src=e.target.result;
    document.getElementById('obScheduleImportRoot')?.classList.remove('flux-pdf-import--has-pages');
    renderObSchedulePages();
    updateObFileMeta(file,1);
    const cb=document.getElementById('obScheduleClearBtn');
    if(cb)cb.style.display='inline-flex';
    document.getElementById('obSchedulePageCol')&&(document.getElementById('obSchedulePageCol').hidden=true);
    analyzeScheduleImg();
  };
  reader.readAsDataURL(file);
}
async function analyzeScheduleImg(){
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_SCHEDULE_IMPORT_GATE&&requiresPro('schedulePhotoImport')){
    showUpgradePrompt('schedulePhotoImport','Import your class schedule from a photo with Flux Pro');
    return;
  }
  if(!obScheduleImgData)return;
  const analyzing=document.getElementById('obAnalyzing');
  const resultEl=document.getElementById('obExtractedClasses');
  if(analyzing)analyzing.style.display='flex';
  if(resultEl)resultEl.innerHTML='';
  try{
    const base64=obScheduleImgData.split(',')[1];
    const mime=obScheduleImgData.split(';')[0].split(':')[1];
    const res=await fetch(API.gemini,{
      method:'POST',headers:await fluxAuthHeaders(),
      body:JSON.stringify({imageBase64:base64,mimeType:mime,
        prompt:'This is a student class schedule image. Extract every class/period. Return ONLY a valid JSON array with no extra text, no markdown, no backticks: [{"period":1,"name":"Chemistry","teacher":"Mr. Smith","room":"204"}]. Number periods sequentially if not shown. Empty string for missing fields. ONLY the JSON array.'})
    });
    if(!res.ok)throw new Error('Gemini error '+res.status);
    const data=await res.json();
    let txt=(data.text||'').replace(/```json/g,'').replace(/```/g,'').trim();
    if(!txt)throw new Error('Gemini returned empty response — check GEMINI_API_KEY in Supabase secrets');
    const start=txt.indexOf('[');const end=txt.lastIndexOf(']');
    if(start===-1||end===-1)throw new Error('No class list found. Try a clearer photo.');
    const parsed=JSON.parse(txt.slice(start,end+1));
    obExtractedClasses=parsed.map((c,i)=>({id:Date.now()+i,period:c.period||i+1,name:cleanClassName(c.name||'Class '+(i+1)),teacher:c.teacher||'',room:c.room||''}));
    if(resultEl){
      resultEl.style.display='block';
      resultEl.innerHTML='<div style="color:var(--green);font-weight:700;margin-bottom:8px;font-size:.82rem">✓ Found '+obExtractedClasses.length+' classes</div>'+
        obExtractedClasses.map(c=>`<div class="ob-class-row"><div class="ob-class-period">${c.period}</div><div style="flex:1"><div style="font-size:.85rem;font-weight:700">${esc(c.name)}</div><div style="font-size:.7rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">${c.teacher}${c.room?' · Rm '+c.room:''}</div></div></div>`).join('');
    }
  }catch(e){
    if(resultEl){resultEl.style.display='block';resultEl.innerHTML='<div style="color:var(--red);font-size:.82rem">Could not read schedule. Add classes manually in the School tab.</div>';}
  }finally{
    if(analyzing)analyzing.style.display='none';
  }
}
function renderObExtractedClasses(){
  const el=document.getElementById('obExtractedClasses');
  if(!el)return;
  if(!obExtractedClasses.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML='<div style="color:var(--green);font-weight:700;margin-bottom:8px;font-size:.82rem">✓ '+obExtractedClasses.length+' class'+(obExtractedClasses.length===1?'':'es')+'</div>'+
    obExtractedClasses.map((c,i)=>`<div class="ob-class-row"><div class="ob-class-period">${c.period}</div><div style="flex:1"><div style="font-size:.85rem;font-weight:700">${esc(c.name)}</div><div style="font-size:.7rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">${esc(c.teacher||'')}${c.room?' · Rm '+esc(c.room):''}</div></div><button type="button" class="ob-class-del" aria-label="Remove" onclick="removeObClass(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.1rem;padding:0 4px">×</button></div>`).join('');
}
function addObClass(){
  const pEl=document.getElementById('obManualPeriod');
  const nEl=document.getElementById('obManualName');
  const tEl=document.getElementById('obManualTeacher');
  const name=(nEl?.value||'').trim();
  if(!name){if(nEl){nEl.focus();}if(typeof showToast==='function')showToast('Enter a class name','info');return;}
  const period=parseInt(pEl?.value||'',10)||(obExtractedClasses.length+1);
  const teacher=(tEl?.value||'').trim();
  obExtractedClasses.push({id:Date.now()+obExtractedClasses.length,period,name:cleanClassName(name),teacher,room:''});
  if(pEl)pEl.value='';
  if(nEl)nEl.value='';
  if(tEl)tEl.value='';
  if(nEl)nEl.focus();
  renderObExtractedClasses();
}
function removeObClass(idx){
  if(idx<0||idx>=obExtractedClasses.length)return;
  obExtractedClasses.splice(idx,1);
  renderObExtractedClasses();
}

// ══ AUTH ══
// OAuth redirect must match this URL exactly in Supabase Dashboard → Authentication → URL Configuration
function getRedirectURL(){
  const loc=window.location;
  let path=loc.pathname;
  if(path.endsWith('.html')){
    path=path.replace(/[^/]+\.html$/,'');
  }
  if(path&&!path.endsWith('/'))path+='/';
  if(path==='/'||path==='')return loc.origin+'/';
  return loc.origin+path;
}

// Sign in with Google while keeping all existing guest data
// ══ EMAIL / PASSWORD AUTH ══
let _authMode='signin'; // 'signin' | 'signup'

function toggleAuthMode(){
  _authMode=_authMode==='signin'?'signup':'signin';
  const nameRow=document.getElementById('loginNameRow');
  const btn=document.getElementById('loginEmailBtn');
  const toggleText=document.getElementById('loginToggleText');
  const toggleAction=document.getElementById('loginToggleAction');
  if(_authMode==='signup'){
    if(nameRow)nameRow.style.display='block';
    if(btn)btn.textContent='Create account';
    if(toggleText)toggleText.textContent='Already have an account?';
    if(toggleAction)toggleAction.textContent='Sign in';
  } else {
    if(nameRow)nameRow.style.display='none';
    if(btn)btn.textContent='Sign in';
    if(toggleText)toggleText.textContent="Don't have an account?";
    if(toggleAction)toggleAction.textContent='Sign up';
  }
  const errEl=document.getElementById('loginAuthError');
  if(errEl){errEl.textContent='';errEl.classList.remove('show');}
}

function showAuthError(msg){
  const el=document.getElementById('loginAuthError');
  if(!el)return;
  el.textContent=msg;el.classList.add('show');
}

async function handleEmailAuth(){
  const email=document.getElementById('loginEmail')?.value.trim();
  const password=document.getElementById('loginPassword')?.value;
  const name=document.getElementById('loginDisplayName')?.value.trim();
  if(!email||!password){showAuthError('Please enter your email and password.');return;}
  if(password.length<6){showAuthError('Password must be at least 6 characters.');return;}
  const sb=getSB();if(!sb){showAuthError('Auth not available.');return;}
  const btn=document.getElementById('loginEmailBtn');
  if(btn){btn.textContent='...';btn.disabled=true;}
  try{
    let result;
    if(_authMode==='signup'){
      result=await sb.auth.signUp({
        email,password,
        options:{data:{full_name:name||email.split('@')[0]}}
      });
      if(result.error)throw result.error;
      if(result.data?.user&&!result.data.session){
        showAuthError('Check your email for a confirmation link!');
        if(btn){btn.textContent='Create account';btn.disabled=false;}
        return;
      }
    } else {
      result=await sb.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
    }
  }catch(e){
    showAuthError(e.message||'Authentication failed. Please try again.');
    if(btn){btn.textContent=_authMode==='signup'?'Create account':'Sign in';btn.disabled=false;}
  }
}

/** Open Flux AI tab with optional prefill. Full planner context via buildAIPrompt. */
function openFluxAgent(opts){
  opts=opts||{};
  const aiBtn=document.querySelector('.sidebar-nav [data-tab=ai]')||document.querySelector('[data-tab=ai]');
  nav('ai',aiBtn);
  const placeholder=opts.placeholder||'Ask Flux AI anything — tasks, calendar, notes, timer, school, ECs, Gmail, settings…';
  const delay=typeof opts.delay==='number'?opts.delay:140;
  setTimeout(()=>{
    const inp=document.getElementById('aiInput');
    if(!inp)return;
    inp.placeholder=placeholder;
    if(opts.prefill!=null&&opts.prefill!=='')inp.value=opts.prefill;
    else if(opts.clearInput)inp.value='';
    inp.focus();
    try{inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,120)+'px';}catch(e){}
    const wrap=document.getElementById('aiMsgsWrap');
    if(wrap)wrap.scrollTop=wrap.scrollHeight;
  },delay);
}

function closeFAB(){
  document.getElementById('fabMenu')?.classList.remove('open');
  document.getElementById('fabBtn')?.classList.remove('open');
}
function fabAddTask(){
  closeFAB();
  const qa=document.getElementById('quickAddInput');
  if(qa){nav('dashboard');setTimeout(()=>{qa.focus();qa.scrollIntoView({behavior:'smooth',block:'center'});},120);}
}
function fabFocus(){
  closeFAB();
  nav('timer');
}

// ══ KEYBOARD SHORTCUTS ══
function initKeyboardShortcuts(){
  document.addEventListener('keydown',e=>{
    // ⌘⇧K / Ctrl+Shift+K — Global search · ⌘K / Ctrl+K — Command palette
    if((e.metaKey||e.ctrlKey)&&e.key?.toLowerCase()==='k'){
      e.preventDefault();
      if(e.shiftKey)openGlobalSearch();
      else openCommandPalette();
      return;
    }
    // Cmd+D — Deep Work mode
    if((e.metaKey||e.ctrlKey)&&e.key==='d'){e.preventDefault();startDeepWork();return;}
    // Cmd+P — Present Mode
    if((e.metaKey||e.ctrlKey)&&e.key==='p'){e.preventDefault();startPresentMode();return;}
    // Ctrl+Z / Cmd+Z — Undo
    if((e.metaKey||e.ctrlKey)&&e.key==='z'){
      const tag=document.activeElement?.tagName;
      if(!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();undoLastChange();return;}
    }
    // Don't fire letter shortcuts when typing in inputs
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    switch(e.key){
      case 'n': case 'N': case 't': case 'T':
        e.preventDefault();
        if(typeof openQuickAdd==='function')openQuickAdd();
        break;
      case '/':
        e.preventDefault();
        nav('ai');
        setTimeout(()=>document.getElementById('aiInput')?.focus(),150);
        break;
      case 'g': case 'G':
        e.preventDefault();nav('toolbox');break;
      case 'c': case 'C':
        e.preventDefault();nav('calendar');break;
      case 'k': case 'K':
        e.preventDefault();openCommandPalette();break;
      case '?':
        e.preventDefault();openShortcutOverlay();break;
    }
  });
}

// ══ CMD+K COMMAND PALETTE ══
let _cpOpen = false;
function openCommandPalette(){
  if(_cpOpen)return;
  _cpOpen=true;
  const overlay=document.createElement('div');
  overlay.id='cmdPalette';
  overlay.className='cmd-palette-overlay';
  overlay.innerHTML=`
    <div class="cmd-palette-dialog" role="dialog" aria-modal="true" aria-label="Command palette" style="width:100%;max-width:580px;background:var(--card);border:1px solid rgba(var(--accent-rgb),.3);border-radius:18px;box-shadow:0 32px 80px rgba(0,0,0,.5),0 0 0 1px rgba(var(--accent-rgb),.1);overflow:hidden;animation:cmdIn .15s ease">
      <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)">
        <span style="color:var(--accent);font-size:1rem" aria-hidden="true">⌘</span>
        <input id="cmdInput" placeholder="Search tasks, navigate, add task…" style="flex:1;background:none;border:none;outline:none;font-size:.95rem;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif" autocomplete="off" aria-label="Filter commands">
        <kbd style="font-size:.65rem;padding:2px 6px;background:var(--card2);border:1px solid var(--border2);border-radius:4px;color:var(--muted)">Esc</kbd>
      </div>
      <div id="cmdResults" style="max-height:380px;overflow-y:auto;padding:8px"></div>
      <div class="cmd-palette-footer">⌘⇧K / Ctrl+Shift+K search · ↑↓ choose · Enter run · Esc close</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCommandPalette();});
  const input=document.getElementById('cmdInput');
  input.focus();
  input.addEventListener('input',renderCmdResults);
  input.addEventListener('keydown',handleCmdKey);
  renderCmdResults();
}
function closeCommandPalette(){
  const el=document.getElementById('cmdPalette');
  if(el)el.remove();
  _cpOpen=false;
}
let _cmdIdx=0;
function handleCmdKey(e){
  const items=document.querySelectorAll('.cmd-item');
  if(e.key==='ArrowDown'){e.preventDefault();_cmdIdx=Math.min(_cmdIdx+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('cmd-active',i===_cmdIdx));}
  else if(e.key==='ArrowUp'){e.preventDefault();_cmdIdx=Math.max(_cmdIdx-1,0);items.forEach((el,i)=>el.classList.toggle('cmd-active',i===_cmdIdx));}
  else if(e.key==='Enter'){e.preventDefault();const active=document.querySelector('.cmd-active');if(active)active.click();}
  else if(e.key==='Escape'){closeCommandPalette();}
}
function renderCmdResults(){
  const q=(document.getElementById('cmdInput')?.value||'').toLowerCase().trim();
  _cmdIdx=0;
  const res=document.getElementById('cmdResults');if(!res)return;
  
  // Build commands
  const cmds=[];
  cmds.push({icon:'🔍',label:'Search tasks & notes',cat:'Actions',action:()=>{closeCommandPalette();openGlobalSearch();}});
  cmds.push({icon:'💬',label:'Send feedback',cat:'Actions',action:()=>{closeCommandPalette();openFluxFeedbackModal();}});
  
  // Navigation
  const navItems=[
    {icon:'⚡',label:'Dashboard',action:()=>{nav('dashboard');closeCommandPalette();}},
    {icon:'📅',label:'Calendar',action:()=>{nav('calendar');closeCommandPalette();}},
    {icon:'✦',label:'Flux AI',action:()=>{nav('ai');closeCommandPalette();}},
    {icon:'🏫',label:'School Info',action:()=>{nav('school');closeCommandPalette();}},
    {icon:'📝',label:'Notes',action:()=>{nav('notes');closeCommandPalette();}},
    {icon:'⏱',label:'Focus Timer',action:()=>{nav('timer');closeCommandPalette();}},
    {icon:'🎯',label:'Goals',action:()=>{nav('goals');closeCommandPalette();}},
    {icon:'🔥',label:'Habits',action:()=>{nav('goals');closeCommandPalette();}},
    {icon:'😊',label:'Mood',action:()=>{nav('mood');closeCommandPalette();}},
    {icon:'🎓',label:'Canvas & Gmail',action:()=>{nav('canvas');closeCommandPalette();}},
    {icon:'🎓',label:'Canvas LMS panel',action:()=>{closeCommandPalette();nav('canvas');}},
    {icon:'⚙️',label:'Settings',action:()=>{nav('settings');closeCommandPalette();}},
  ];
  navItems.forEach(n=>{if(!q||n.label.toLowerCase().includes(q))cmds.push({...n,cat:'Navigate'});});

  const rNav=typeof getMyRole==='function'?getMyRole():'user';
  if(rNav==='owner'||rNav==='dev'){
    const pl=rNav==='owner'?'Owner control':'Dev panel';
    if(!q||pl.toLowerCase().includes(q)||q==='admin'||q==='owner'||q==='dev')
      cmds.push({icon:rNav==='owner'?'👑':'⚡',label:pl,cat:'Navigate',action:()=>{nav('flux_control');closeCommandPalette();}});
  }

  const refTools=[
    {icon:'📚',label:'Study Tools',action:()=>{nav('toolbox');closeCommandPalette();}},
    {icon:'📐',label:'Math Formula Sheet',action:()=>{closeCommandPalette();window.openMathFormulas&&window.openMathFormulas();}},
    {icon:'⚗️',label:'Chemistry Reference',action:()=>{closeCommandPalette();window.openChemReference&&window.openChemReference();}},
    {icon:'🧬',label:'Biology Codon Table',action:()=>{closeCommandPalette();window.openCodonTable&&window.openCodonTable();}},
    {icon:'🗺️',label:'History Map',action:()=>{closeCommandPalette();window.openHistoryMap&&window.openHistoryMap();}},
    {icon:'🇪🇸',label:'Spanish Conjugator',action:()=>{closeCommandPalette();window.openSpanishConjugator&&window.openSpanishConjugator();}},
    {icon:'🇫🇷',label:'French Conjugator',action:()=>{closeCommandPalette();window.openFrenchConjugator&&window.openFrenchConjugator();}},
    {icon:'🔁',label:'Unit Converter',action:()=>{closeCommandPalette();window.openUnitConverter&&window.openUnitConverter();}},
    {icon:'💻',label:'CS Reference',action:()=>{closeCommandPalette();window.openCSReference&&window.openCSReference();}},
    {icon:'🧪',label:'Periodic Table',action:()=>{closeCommandPalette();if(typeof window.openPeriodicTableModal==='function')window.openPeriodicTableModal();else if(typeof window.openPeriodicTable==='function')window.openPeriodicTable();else nav('toolbox');}},
    {icon:'🪐',label:'Physics Formula Sheet',action:()=>{closeCommandPalette();if(typeof window.openPhysicsSandbox==='function')window.openPhysicsSandbox();else nav('toolbox');}},
  ];
  refTools.forEach(r=>{if(!q||r.label.toLowerCase().includes(q))cmds.push({...r,cat:'Study Tools'});});

  // Task search
  const matchTasks=tasks.filter(t=>!t.done&&t.name.toLowerCase().includes(q)).slice(0,5);
  matchTasks.forEach(t=>cmds.push({icon:'✓',label:t.name,sub:t.date?'Due '+t.date:'',cat:'Tasks',action:()=>{nav('dashboard');closeCommandPalette();setTimeout(()=>{const el=document.querySelector('[data-task-id="'+t.id+'"]');if(el)el.scrollIntoView({behavior:'smooth'});},300);}}));
  
  // Add task shortcut
  if(q&&!q.startsWith('/')){
    cmds.unshift({icon:'＋',label:'Add task: "'+q+'"',cat:'Actions',action:()=>{
      const t={id:Date.now(),name:q,date:'',subject:'',priority:'med',type:'hw',estTime:0,difficulty:3,notes:'',subtasks:[],done:false,rescheduled:0,createdAt:Date.now()};
      t.urgencyScore=calcUrgency(t);tasks.unshift(t);save('tasks',tasks);
      renderStats();renderTasks();renderCalendar();syncKey('tasks',tasks);
      showToast('✓ Task added');closeCommandPalette();
    }});
  }
  
  // Actions
  const actions=[
    {icon:'🔄',label:'Force Sync',cat:'Actions',action:()=>{closeCommandPalette();forceSyncNow();}},
    {icon:'🎯',label:'Start Deep Work Mode',cat:'Actions',action:()=>{closeCommandPalette();startDeepWork();}},
    {icon:'📆',label:'Explain my week (Flux AI)',cat:'Actions',action:()=>{closeCommandPalette();explainMyWeek();}},
    {icon:'🖨',label:'Print / save as PDF',cat:'Actions',action:()=>{closeCommandPalette();window.print();}},
    {icon:'🔐',label:'Import encrypted backup',cat:'Actions',action:()=>{closeCommandPalette();document.getElementById('importEncryptedFile')?.click();}},
  ];
  actions.forEach(a=>{if(!q||a.label.toLowerCase().includes(q))cmds.push(a);});
  if(window.Flux100&&typeof Flux100.getExtraCommands==='function'){
    try{Flux100.getExtraCommands(q).forEach(x=>{if(!q||x.label.toLowerCase().includes(q))cmds.push(x);});}catch(e){}
  }
  if(window.FluxOrchestrator&&typeof FluxOrchestrator.getPaletteCommands==='function'){
    try{FluxOrchestrator.getPaletteCommands(q).forEach(x=>{if(!q||x.label.toLowerCase().includes(q))cmds.push(x);});}catch(e){}
  }
  if(!cmds.length){res.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem">No results</div>';return;}
  
  // Group by cat
  const cats={};
  cmds.forEach(c=>{if(!cats[c.cat])cats[c.cat]=[];cats[c.cat].push(c);});
  let html='';let idx=0;
  Object.entries(cats).forEach(([cat,items])=>{
    html+=`<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);padding:8px 12px 4px;font-family:'JetBrains Mono',monospace">${cat}</div>`;
    items.forEach(item=>{
      const isFirst=idx===0;
      html+=`<div class="cmd-item${isFirst?' cmd-active':''}" data-idx="${idx}" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:background .1s">
        <span style="font-size:.95rem;width:20px;text-align:center;flex-shrink:0">${item.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.label)}</div>
          ${item.sub?`<div style="font-size:.7rem;color:var(--muted)">${esc(item.sub)}</div>`:''}
        </div>
        <span style="font-size:.65rem;color:var(--muted);flex-shrink:0">${item.cat}</span>
      </div>`;
      // Store action
      idx++;
    });
  });
  res.innerHTML=html;
  
  // Attach click handlers
  const allCmds=[];
  Object.values(cats).forEach(items=>items.forEach(i=>allCmds.push(i)));
  res.querySelectorAll('.cmd-item').forEach((el,i)=>{
    el.addEventListener('click',()=>allCmds[i]?.action());
    el.addEventListener('mouseenter',()=>{
      _cmdIdx=i;
      res.querySelectorAll('.cmd-item').forEach((e2,j)=>e2.classList.toggle('cmd-active',i===j));
    });
  });
}


// Keyboard hint tooltip
function showKeyHint(){
  const hint=document.getElementById('keyHint');
  if(!hint||load('flux_keyhint_dismissed',false))return;
  setTimeout(()=>{
    hint.style.display='flex';
    hint.style.animation='slideUp .3s var(--ease-spring)';
    setTimeout(()=>{hint.style.opacity='0';hint.style.transition='opacity .3s';setTimeout(()=>hint.style.display='none',300);},4000);
  },2000);
}

// ══ PANIC GLOW (task-level) ══
function applyPanicGlow(){
  if(document.hidden)return;
  if(!settings.panic)return;
  const now=new Date();
  const in12h=new Date(now.getTime()+12*60*60*1000);
  const anySoon=tasks.some(t=>{
    if(t.done||!t.date)return false;
    try{const due=new Date(t.date+'T23:59:00');return due<=in12h&&due>=now;}catch(_){return false;}
  });
  if(!anySoon)return;
  document.querySelectorAll('[data-task-id]').forEach(el=>{
    const id=parseInt(el.dataset.taskId);
    const t=tasks.find(x=>x.id===id);
    if(!t||t.done)return;
    if(t.date){
      const due=new Date(t.date+'T23:59:00');
      if(due<=in12h&&due>=now){
        el.style.boxShadow='0 0 0 1px rgba(255,77,109,.3),0 4px 20px rgba(255,77,109,.15)';
        el.style.borderColor='rgba(255,77,109,.3)';
      }
    }
  });
}

// ══ ITEM 21 — FIXED LAYOUT: PANEL SCROLL INDEPENDENCE ══
/** Inline flex/scroll on *every* .panel caused inactive panels (e.g. #toolbox) to stack over the active tab in the flex column. Only the active direct child of main gets scroll sizing. */
function syncPanelScrollLayout(){
  const mainContent=document.querySelector('.main-content');
  if(!mainContent)return;
  if(document.body.classList.contains('flux-canvas-ai-split')){
    mainContent.querySelectorAll(':scope > .panel').forEach(panel=>{
      panel.style.flex='';
      panel.style.removeProperty('overflow-y');
    });
    const cv=document.getElementById('canvas');
    const ai=document.getElementById('ai');
    if(cv&&cv.classList.contains('active')){
      cv.style.flex='1 1 55%';
      /* Inner .canvas-content scrolls; panel-level auto fights nested layout */
      cv.style.setProperty('overflow-y','hidden','important');
      cv.style.minWidth='0';
    }
    if(ai&&ai.classList.contains('flux-ai-split-visible')){
      ai.style.flex='1 1 45%';
      ai.style.overflow='hidden';
      ai.style.minWidth='0';
    }
    return;
  }
  mainContent.querySelectorAll(':scope > .panel').forEach(panel=>{
    panel.style.flex='';
    panel.style.removeProperty('overflow-y');
    panel.style.overscrollBehavior='';
    panel.style.webkitOverflowScrolling='';
  });
  const active=mainContent.querySelector(':scope > .panel.active');
  if(active){
    active.style.flex='1 1 0%';
    if(active.id==='canvas'){
      active.style.setProperty('overflow-y','hidden','important');
      active.style.overscrollBehavior='contain';
      active.style.webkitOverflowScrolling='touch';
    }else{
      active.style.overflowY='auto';
      active.style.overscrollBehavior='contain';
      active.style.webkitOverflowScrolling='touch';
    }
  }
  const aiPanel=document.getElementById('ai');
  if(aiPanel&&aiPanel.classList.contains('active')){
    aiPanel.style.overflow='hidden';
    aiPanel.style.flex='1 1 0%';
  }
}

function initScrollLayout(){
  // App container: sidebar + main are fixed height, main scrolls independently
  const app=document.getElementById('app');
  if(!app)return;
  app.style.height='100vh';
  app.style.overflow='hidden';
  app.style.display='flex';

  const mainContent=document.querySelector('.main-content');
  if(mainContent){
    mainContent.style.height='100vh';
    mainContent.style.overflow='hidden';
    mainContent.style.display='flex';
    mainContent.style.flexDirection='column';
  }

  const sidebar=document.getElementById('sidebar');
  if(sidebar){
    sidebar.style.height='100vh';
    sidebar.style.overflowY='auto';
    sidebar.style.position='sticky';
    sidebar.style.top='0';
    sidebar.style.flexShrink='0';
  }

  const topbar=document.querySelector('.topbar');
  if(topbar){
    topbar.style.flexShrink='0';
    topbar.style.position='relative';
    topbar.style.zIndex='30';
  }

  syncPanelScrollLayout();
}

/** Pop-up OAuth → opener tab stays on login; same strings in initAuth callback window */
const FLUX_OAUTH_PM_SUCCESS='flux-oauth-success';
const FLUX_OAUTH_PM_ERROR='flux-oauth-error';

function initOAuthPostMessageListener(){
  if(window.__fluxOAuthPmListener)return;
  window.__fluxOAuthPmListener=true;
  window.addEventListener('message',async ev=>{
    if(ev.origin!==location.origin||!ev.data||typeof ev.data.type!=='string')return;
    if(ev.data.type===FLUX_OAUTH_PM_ERROR){
      if(typeof showToast==='function')showToast(String(ev.data.message||'Sign-in was cancelled or failed.'),'warning');
      return;
    }
    if(ev.data.type!==FLUX_OAUTH_PM_SUCCESS)return;
    const sb=getSB();
    if(!sb)return;
    const{data:{session}}=await sb.auth.getSession();
    if(session?.user){
      await handleSignedIn(session.user,session);
      if(typeof showToast==='function')showToast('Signed in with Google','success');
    }else if(typeof showToast==='function'){
      showToast('Could not read session — try refreshing the page.','warning');
    }
  });
}

async function signInWithGoogleKeepData(){
  // Mark that we want to migrate guest data after sign-in
  save('flux_migrate_guest',true);
  await signInWithGoogle();
}

async function signInWithGoogle(){
  const sb=getSB();
  if(!sb){alert('Auth not available — please refresh.');return;}
  initOAuthPostMessageListener();
  try{
    const{data,error}=await sb.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:getRedirectURL(),
        skipBrowserRedirect:true,
        scopes:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
        queryParams:{access_type:'offline',prompt:'select_account'},
      }
    });
    if(error)throw error;
    if(!data?.url){
      alert('Could not start Google sign-in. Please refresh and try again.');
      return;
    }
    const feat='width=520,height=720,left=80,top=60,scrollbars=yes,resizable=yes';
    const w=window.open(data.url,'fluxGoogleOAuth',feat);
    if(!w||w.closed==null){
      window.location.href=data.url;
      return;
    }
    try{w.focus();}catch(e){}
    if(typeof showToast==='function')showToast('Complete sign-in in the pop-up. This tab will stay here.','info');
  }catch(e){
    console.error('OAuth error:',e);
    alert('Sign in failed: '+e.message);
  }
}

async function signOut(){
  if(!confirm('Sign out?'))return;
  if(typeof stopFluxSessionIdleAdvisory==='function')stopFluxSessionIdleAdvisory();
  if(window._syncInterval){clearInterval(window._syncInterval);window._syncInterval=null;}
  const sb=getSB();
  if(sb) await sb.auth.signOut();
  handleSignedOut();
}

// ── GUEST LOGIN ──
function skipLogin(){
  showGuestDisclaimer();
}

function showGuestDisclaimer(){
  const existing=document.getElementById('guestModal');if(existing)existing.remove();
  const modal=document.createElement('div');
  modal.id='guestModal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML=`
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:22px;padding:30px 24px;width:100%;max-width:380px;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.5)">
      <div style="font-size:2.2rem;margin-bottom:14px">👤</div>
      <div style="font-size:1.1rem;font-weight:800;margin-bottom:8px">Continuing as Guest</div>
      <div style="font-size:.84rem;color:var(--muted2);line-height:1.75;margin-bottom:22px">
        Your data will be saved <strong style="color:var(--gold)">on this device only</strong>.<br>
        It won't sync across devices and could be lost if you clear your browser storage.<br><br>
        <span style="font-size:.72rem;color:var(--muted);font-family:'JetBrains Mono',monospace">You can sign in with Google anytime from Settings to back everything up.</span>
      </div>
      <button onclick="confirmGuestLogin()" style="width:100%;padding:13px;margin-bottom:10px;font-size:.92rem">Got it — Continue as Guest</button>
      <button onclick="document.getElementById('guestModal').remove()" class="btn-sec" style="width:100%;padding:11px;font-size:.85rem">← Back to Sign In</button>
    </div>`;
  document.body.appendChild(modal);
}

function confirmGuestLogin(){
  const modal=document.getElementById('guestModal');if(modal)modal.remove();
  save('flux_was_guest',true);
  document.getElementById('loginScreen').classList.remove('visible');
  document.getElementById('loginScreen').style.display='none';
  const splash=document.getElementById('splash');
  if(splash)splash.style.display='block';
  const finishGuestEntry=()=>{
    const onboarded=load('flux_onboarded',false);
    const hasData=tasks.length>0||notes.length>0||classes.length>0;
    if(!onboarded&&!hasData){
      showOnboarding();
    }else{
      showApp();
      if(!isTourCompleted())setTimeout(()=>startOnboardingTour(),1600);
    }
    setSyncStatus('offline');
  };
  if(typeof window.runSplash==='function'){
    window.runSplash(finishGuestEntry,true);
  }else{
    finishGuestEntry();
  }
}

// Wait for PKCE code exchange / hash parsing — getSession() can briefly return null on redirect
async function getSessionAfterOAuth(sb){
  let{data:{session}}=await sb.auth.getSession();
  const hash=window.location.hash;
  const params=new URLSearchParams(window.location.search);
  const oauthPending=hash.includes('access_token')||hash.includes('error')||params.has('code')||params.has('error');
  if(session||!oauthPending)return session;
  for(let i=0;i<150;i++){
    await new Promise(r=>setTimeout(r,100));
    ({data:{session}}=await sb.auth.getSession());
    if(session)return session;
    if(window.location.hash.includes('error='))return null;
  }
  return(await sb.auth.getSession()).data.session;
}

async function initAuth(){
  const sb=getSB();
  if(!sb){
    showLoginScreen();
    return;
  }
  initOAuthPostMessageListener();
  try{
    const hash=window.location.hash;
    const params=new URLSearchParams(window.location.search);
    const isOAuthCallback=hash.includes('access_token')||hash.includes('error')||params.has('code')||params.has('error');

    const session=await getSessionAfterOAuth(sb);

    if(isOAuthCallback){
      const cleanPath=window.location.pathname;
      window.history.replaceState(null,'',cleanPath);
    }

    const oauthPopupNotify=()=>{
      const op=window.opener;
      if(!op||op.closed)return false;
      const errInUrl=!!(params.get('error')||hash.includes('error='));
      let errMsg='Could not complete sign-in. Try again.';
      if(errInUrl){
        const raw=params.get('error_description')||params.get('error')||'Sign-in failed';
        try{errMsg=decodeURIComponent(String(raw).replace(/\+/g,' '));}catch(e){errMsg=String(raw);}
      }
      try{
        if(session?.user)op.postMessage({type:FLUX_OAUTH_PM_SUCCESS},location.origin);
        else op.postMessage({type:FLUX_OAUTH_PM_ERROR,message:errMsg},location.origin);
      }catch(e){console.warn('OAuth postMessage',e);}
      const ok=!!session?.user;
      const title=ok?'Signed in':'Sign-in did not finish';
      const sub=ok
        ?'This window will close — continue in your other Flux tab.'
        :'You can close this window and try again from the other tab.';
      document.body.innerHTML='<div style="font-family:system-ui,sans-serif;padding:48px 24px;text-align:center;color:#e8ecff;background:#0B0F1A;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px"><p style="font-weight:600;margin:0;font-size:16px">'+title+'</p><p style="opacity:.72;font-size:14px;margin:0;max-width:280px;line-height:1.5">'+sub+'</p></div>';
      setTimeout(()=>{try{window.close();}catch(e){}},ok?280:400);
      return true;
    };

    if(isOAuthCallback&&window.opener&&!window.opener.closed){
      if(oauthPopupNotify())return;
    }
    
    // STEP 2: Sign in or show login
    if(session?.user){
      await handleSignedIn(session.user,session);
    }else{
      showLoginOrApp();
    }

    // STEP 3: Listen for future auth changes
    sb.auth.onAuthStateChange(async(event,s)=>{
      if(event==='SIGNED_IN'&&s?.user){
        // Hide login immediately
        const ls=document.getElementById('loginScreen');
        if(ls){ls.style.display='none';ls.classList.remove('visible');}
        // Only do full sign-in flow if this is a new user or account switch
        if(!currentUser||currentUser.id!==s.user.id){
          await handleSignedIn(s.user,s);
        }else{
          _updateUserUI(s.user,s.user.user_metadata?.full_name||s.user.email?.split('@')[0]);
        }
      }
      else if(event==='SIGNED_OUT'){
        handleSignedOut();
      }
      else if(event==='TOKEN_REFRESHED'&&s?.user&&currentUser){
        _updateUserUI(s.user,s.user.user_metadata?.full_name||s.user.email?.split('@')[0]);
      }
    });
  }catch(e){
    console.error('Auth init error:',e);
    showLoginOrApp();
  }
}

function showLoginOrApp(){
  const onboarded=load('flux_onboarded',false);
  const hasData=tasks.length>0||notes.length>0||classes.length>0;
  const wasGuest=load('flux_was_guest',false);
  if(wasGuest&&(onboarded||hasData)){
    showApp();
    if(!isTourCompleted())setTimeout(()=>startOnboardingTour(),1600);
    setSyncStatus('offline');
  }else{
    showLoginScreen();
  }
}

let _loginDemoInterval=null;
const LOGIN_DEMO_LINES=[
  'Break down assignments into steps with Flux AI study plans.',
  'Snap a syllabus or schedule — Vision Import turns it into tasks.',
  'Sync Google Calendar and see tasks beside class blocks.',
  'Log extracurriculars and get school-fit suggestions.',
  'Capture notes with tags, then ask Flux AI to quiz you.',
  'Use the focus timer and streaks to build study habits.',
  'See exam conflicts and cognitive load at a glance.'
];
function stopLoginDemoRotator(){
  if(_loginDemoInterval){clearInterval(_loginDemoInterval);_loginDemoInterval=null;}
}

let _loginScrollIO=null;
function teardownLoginScrollAnimations(){
  if(_loginScrollIO){_loginScrollIO.disconnect();_loginScrollIO=null;}
}
function initLoginScrollAnimations(){
  teardownLoginScrollAnimations();
  const root=document.getElementById('loginScreen');
  if(!root)return;
  root.scrollTop=0;
  root.querySelectorAll('.login-scroll-section').forEach(s=>s.classList.remove('login-scroll-section--visible'));
  let reduce=false;
  try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){}
  if(reduce){
    root.querySelectorAll('.login-scroll-section').forEach(s=>s.classList.add('login-scroll-section--visible'));
    return;
  }
  try{
    if(document.documentElement.getAttribute('data-flux-perf')==='on'){
      root.querySelectorAll('.login-scroll-section').forEach(s=>s.classList.add('login-scroll-section--visible'));
      return;
    }
  }catch(_){}
  _loginScrollIO=new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        en.target.classList.add('login-scroll-section--visible');
        _loginScrollIO.unobserve(en.target);
      }
    });
  },{root,threshold:0.1,rootMargin:'0px 0px -8% 0px'});
  root.querySelectorAll('.login-scroll-section').forEach(sec=>{
    /** Above-the-fold hero: show immediately — IO used to hide it briefly and left an empty gap under the top bar */
    if(sec.classList.contains('login-scroll-hero')){
      sec.classList.add('login-scroll-section--visible');
      return;
    }
    _loginScrollIO.observe(sec);
  });
}
function initLoginDemoRotator(){
  stopLoginDemoRotator();
  const left=document.getElementById('loginDemoLineLeft');
  const card=document.getElementById('loginDemoLineCard');
  if(!left&&!card)return;
  let idx=0;
  function apply(){
    const line=LOGIN_DEMO_LINES[idx%LOGIN_DEMO_LINES.length];
    if(left)left.textContent=line;
    if(card)card.textContent=line;
    idx++;
  }
  apply();
  try{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  }catch(_){}
  _loginDemoInterval=setInterval(apply,4200);
}

function showLoginScreen(){
  const ls=document.getElementById('loginScreen');
  const app=document.getElementById('app');
  if(typeof teardownFluxAnimeApp==='function')teardownFluxAnimeApp();
  if(ls){ls.style.display='block';ls.classList.add('visible');ls.scrollTop=0;}
  if(app)app.classList.remove('visible');
  initFeaturePills();
  initLoginFeatureCards();
  initLoginScrollAnimations();
  setTimeout(()=>{
    if(typeof initLoginAmbient==='function')initLoginAmbient();
    if(typeof initFluxAnimeLogin==='function')initFluxAnimeLogin();
    initLoginDemoRotator();
  },40);
}
function showApp(){
  const ls=document.getElementById('loginScreen');
  const app=document.getElementById('app');
  if(typeof stopLoginAmbient==='function')stopLoginAmbient();
  if(typeof teardownFluxAnimeLogin==='function')teardownFluxAnimeLogin();
  teardownLoginScrollAnimations();
  stopLoginDemoRotator();
  if(ls){ls.style.display='none';ls.classList.remove('visible');}
  if(app)app.classList.add('visible');
  renderSidebars();
  populateSubjectSelects();
  initModFeatures();
  initDashboardFeatures();
  renderStats();renderTasks();renderCalendar();renderCountdown();
  renderSmartSug();renderProfile();
  renderNotesList();renderExtrasList();renderSchoolsList();renderECGoals();renderMoodHistory();
  renderSchool();updateTStats();
  renderExamConflictBanner();
  applyFontScale();
  applyReduceMotion();
  if(typeof initConnectivityAndNotifications==='function')initConnectivityAndNotifications();
  if(typeof handleDeepLinkParams==='function')handleDeepLinkParams();
  updateNavAriaCurrent('dashboard');
  // Update user card now that #app is visible
  if(currentUser){
    _updateUserUI(currentUser, currentUser.user_metadata?.full_name||currentUser.email?.split('@')[0]||'');
  }
  updateMasterBacklogCardVisibility();
  syncFluxAIModeButtons();
  clearSvgLogoGradientStyles();
  if(typeof FluxRelease!=='undefined'&&FluxRelease&&typeof FluxRelease.applyGate==='function'){
    FluxRelease.applyGate();
  }
  setTimeout(function(){
    if(typeof initFluxAnimeApp==='function')initFluxAnimeApp();
    try{
      const main=document.getElementById('flux-main');
      if(main&&window.FluxAnim?.initScrollReveal)FluxAnim.initScrollReveal(main);
    }catch(e){}
    try{
      const logo=document.querySelector('.sidebar-logo svg');
      if(logo&&window.FluxAnim?.logoDrawIn)FluxAnim.logoDrawIn(logo);
    }catch(e){}
  },100);
  // Always open to the dashboard on load (no tab restore)
  try{localStorage.removeItem('flux_last_tab');localStorage.removeItem('flux_last_tab_ts');}catch(e){}
  // Smart next-day warning
  setTimeout(checkTomorrowLoad,4500);
  setTimeout(checkWeeklyReview,5000);
  if(typeof updatePlanUI==='function')updatePlanUI();
  try{if(typeof renderSkillsPanel==='function')renderSkillsPanel();}catch(e){}
  try{if(typeof initFluxExtensionIdSettings==='function')initFluxExtensionIdSettings();}catch(e){}
}

function initFluxExtensionIdSettings(){
  const inp=document.getElementById('fluxChromeExtensionIdInput');
  if(!inp)return;
  var v='';
  try{v=(localStorage.getItem('flux_chrome_extension_id')||window.FLUX_CHROME_EXTENSION_ID||'').trim();}catch(e){v=(window.FLUX_CHROME_EXTENSION_ID||'').trim();}
  inp.value=v;
}
function saveFluxExtensionIdFromSettings(){
  const inp=document.getElementById('fluxChromeExtensionIdInput');
  if(!inp)return;
  const id=String(inp.value||'').trim().replace(/\s+/g,'');
  if(!id){if(typeof showToast==='function')showToast('Paste your extension ID first','error');return;}
  if(!/^[a-p]{32}$/.test(id)){if(typeof showToast==='function')showToast('That does not look like a Chrome extension ID (32 letters a–p).','error');return;}
  try{localStorage.setItem('flux_chrome_extension_id',id);}catch(e){}
  window.FLUX_CHROME_EXTENSION_ID=id;
  if(typeof syncTokenToExtension==='function')syncTokenToExtension();
  if(typeof showToast==='function')showToast('Extension linked — session synced','success');
}
window.initFluxExtensionIdSettings=initFluxExtensionIdSettings;
window.saveFluxExtensionIdFromSettings=saveFluxExtensionIdFromSettings;

window.FLUX_CHROME_EXTENSION_ID=window.FLUX_CHROME_EXTENSION_ID||'';
function syncTokenToExtension(){
  if(!currentUser||typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
  const extId=(typeof localStorage!=='undefined'&&localStorage.getItem('flux_chrome_extension_id'))||window.FLUX_CHROME_EXTENSION_ID;
  if(!extId||!String(extId).trim())return;
  const sb=getSB();
  if(!sb)return;
  sb.auth.getSession().then(({data})=>{
    const token=data?.session?.access_token;
    if(!token)return;
    try{
      chrome.runtime.sendMessage(String(extId).trim(),{type:'SET_AUTH_TOKEN',token,userId:currentUser.id},()=>{try{void chrome.runtime.lastError;}catch(e){}});
    }catch(e){}
  });
}

async function handleSignedIn(user,session){
  if(currentUser&&currentUser.id===user.id){
    const ls=document.getElementById('loginScreen');
    if(ls){ls.style.display='none';ls.classList.remove('visible');}
    stopLoginDemoRotator();
    teardownLoginScrollAnimations();
    const appEl=document.getElementById('app');
    if(appEl&&!appEl.classList.contains('visible'))showApp();
    checkTesterMode();
    if(FLUX_FLAGS.PAYMENTS_ENABLED){
      _entitlementFetchedAt=0;
      fetchAndCacheEntitlement().then(()=>{
        checkTesterMode();
        updatePlanUI();
        renderSubscriptionCard();
      });
    }else{
      _entitlement.plan='pro';
      _entitlement.imageAnalysis=true;
      _entitlement.canvasSync=true;
      _entitlement.schedulePhotoImport=true;
    }
    _updateUserUI(user,user.user_metadata?.full_name||user.email?.split('@')[0]||'');
    if(session?.provider_token){
      gmailToken=session.provider_token;
      sessionStorage.setItem('flux_gmail_token',session.provider_token);
    }
    try{
      if(window.FluxAIConnections&&typeof FluxAIConnections.renderConnectionsPanel==='function'){
        FluxAIConnections.renderConnectionsPanel(true);
      }
    }catch(e){}
    renderTesterBadge();
    syncTokenToExtension();
    return;
  }
  // ── ACCOUNT SWITCH: wipe previous user's data ──────────────
  const lastId = localStorage.getItem('flux_last_user_id');
  if(lastId && lastId !== user.id){
    // Different account — clear app data but NEVER clear sb-* keys (Supabase auth session)
    // localStorage.clear() was wiping the new OAuth tokens → immediate SIGNED_OUT
    const survivingKeys=['flux_splash_shown','flux_theme'];
    const survived={};
    survivingKeys.forEach(k=>{const v=localStorage.getItem(k);if(v!==null)survived[k]=v;});
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&(k.startsWith('sb-')||k.includes('supabase')))survived[k]=localStorage.getItem(k);
    }
    localStorage.clear();
    Object.entries(survived).forEach(([k,v])=>localStorage.setItem(k,v));
    // Reset all in-memory state
    tasks=[];notes=[];habits=[];goals=[];colleges=[];extras=[];ecSchools=[];ecGoals=[];
    moodHistory=[];schoolInfo={};classes=[];teacherNotes=[];
    sessionLog=[];studyDNA=[];confidences={};
    aiChats=[];aiHistory=[];
    console.log('🔄 Account switched — wiped previous user data');
  }
  localStorage.setItem('flux_last_user_id', user.id);
  localStorage.setItem('flux_last_user_email', user.email||'');
  // ────────────────────────────────────────────────────────────

  currentUser=user;
  checkTesterMode();
  save('flux_was_guest',false);
  if(session?.provider_token){
    gmailToken=session.provider_token;
    sessionStorage.setItem('flux_gmail_token',session.provider_token);
  }
  try{
    if(window.FluxAIConnections&&typeof FluxAIConnections.renderConnectionsPanel==='function'){
      FluxAIConnections.renderConnectionsPanel(true);
    }
  }catch(e){}
  // hide login immediately
  const _ls=document.getElementById('loginScreen');if(_ls){_ls.style.display='none';_ls.classList.remove('visible');}
  stopLoginDemoRotator();
  teardownLoginScrollAnimations();
  const name=user.user_metadata?.full_name||user.email?.split('@')[0]||'Student';
  const firstName=name.split(' ')[0];
  localStorage.setItem('flux_user_name',firstName);
  _updateUserUI(user,name);
  setSyncStatus('syncing');

  // If migrating from guest account, push local data to cloud first
  const migratingGuest=load('flux_migrate_guest',false);
  if(migratingGuest){
    save('flux_migrate_guest',false);
    save('flux_onboarded',true);
    await syncToCloud();
  }

  await syncFromCloud();

  initFluxSessionIdleAdvisory();

  const onboarded=load('flux_onboarded',false);
  const hasLocalData=tasks.length>0||notes.length>0||classes.length>0;
  // Do not use profile.name here — step 1 saves name before flux_onboarded; excluding profile blocked resume
  const isFirstTime=!onboarded&&!hasLocalData;

  if(isFirstTime){
    const sp=document.getElementById('splash');
    if(sp)sp.style.display='block';
    if(typeof window.runSplash==='function'){
      window.runSplash(()=>showOnboarding(),true);
    }else{
      showOnboarding();
    }
  }else{
    const ob=document.getElementById('onboarding');
    if(ob)ob.classList.remove('visible');
    showApp();
    if(!isTourCompleted())setTimeout(()=>startOnboardingTour(),1600);
    // Call _updateUserUI AFTER showApp() so DOM elements are visible
    _updateUserUI(user, user.user_metadata?.full_name||user.email?.split('@')[0]||'');
  }
  if(FLUX_FLAGS.PAYMENTS_ENABLED){
    _entitlementFetchedAt=0;
    fetchAndCacheEntitlement().then(()=>{
      checkTesterMode();
      updatePlanUI();
      checkTrialExpiry();
      renderSubscriptionCard();
    });
  }else{
    _entitlement.plan='pro';
    _entitlement.imageAnalysis=true;
    _entitlement.canvasSync=true;
    _entitlement.schedulePhotoImport=true;
    updatePlanUI();
  }
  renderTesterBadge();
  syncTokenToExtension();
  // Full cloud push every minute while logged in (faster cross-device; debounced typing still uses syncKey)
  if(!window._syncInterval)window._syncInterval=setInterval(()=>{ if(currentUser)void syncToCloud(); },60*1000);
}

function _updateUserUI(user,name){
  const firstName=(name||user.email?.split('@')[0]||'User').split(' ')[0];
  const fullName=name||firstName;
  localStorage.setItem('flux_user_name',firstName);
  const avatarUrl=user.user_metadata?.avatar_url||user.user_metadata?.picture||'';
  const avatarHTML=avatarUrl
    ?`<img src="${avatarUrl}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`
    :`<span style="font-size:.9rem;font-weight:700;line-height:1">${firstName.charAt(0).toUpperCase()}</span>`;
  // Update every user display element
  ['sidebarAv','mobAv'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=avatarHTML;});
  ['sidebarName','mobName'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fullName;});
  ['sidebarEmail','mobEmail'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=user.email||'';});
  const asd=document.getElementById('accountSignedOut');if(asd)asd.style.display='none';
  const asi=document.getElementById('accountSignedIn');if(asi)asi.style.display='block';
  const emailEl=document.getElementById('accountEmail');if(emailEl)emailEl.textContent=user.email||'';
  const topUser=document.getElementById('topbarUser');if(topUser)topUser.textContent=firstName;
  // Mobile topbar avatar chip (rebuilt mobile UI)
  const topMobAv=document.getElementById('topbarMobAv');
  if(topMobAv){
    const initial=firstName.charAt(0).toUpperCase();
    topMobAv.innerHTML=avatarUrl
      ?`<img src="${avatarUrl}" referrerpolicy="no-referrer" alt="${esc(firstName)}">`
      :`<span id="topbarMobAvInitial">${initial}</span>`;
  }
  // Re-call after DOM fully ready in case elements weren't present
  setTimeout(()=>{
    ['sidebarAv','mobAv'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.innerHTML.includes(firstName.charAt(0))&&!el.querySelector('img'))el.innerHTML=avatarHTML;});
    ['sidebarName','mobName'].forEach(id=>{const el=document.getElementById(id);if(el&&el.textContent!==fullName)el.textContent=fullName;});
  },500);
}

function handleSignedOut(){
  FLUX_FLAGS.TESTER_MODE = false;
  _entitlementFetchedAt=0;
  _entitlement.plan='free';
  _entitlement.status='trialing';
  _entitlement.isTrialing=true;
  _entitlement.imageAnalysis=false;
  _entitlement.canvasSync=false;
  _entitlement.schedulePhotoImport=false;
  _entitlement.usage={daily_used:0,daily_limit:FLUX_FREE_LIMITS.AI_DAILY_MESSAGES,monthly_used:0,monthly_limit:FLUX_FREE_LIMITS.AI_MONTHLY_MESSAGES};
  document.querySelectorAll('.flux-tester-badge').forEach(el => el.remove());
  currentUser=null;gmailToken=null;
  if(window._syncInterval){clearInterval(window._syncInterval);window._syncInterval=null;}
  sessionStorage.clear();
  const keysToKeep=[
    'flux_splash_shown','flux_theme','flux_accent','flux_accent_rgb',
    'flux_liquid_glass','flux_perf_snappy','flux_ui_density','flux_mood_tint_enabled',
    'flux_nav_counts_v1','flux_layout_dashboard_v1','flux_layout_calendar_v1',
    'flux_data_version',
    'flux_canvas_token','flux_canvas_url','flux_canvas_host',
    'flux_canvas_last_view','flux_canvas_last_params',
    'flux_canvas_autosync','flux_canvas_last_sync',
    'flux_canvas_due_filter','flux_canvas_hub_tab',
    'flux_canvas_split','flux_canvas_sidebar_collapsed',
    'flux_canvas_embed_url','flux_canvas_hub_cache','flux_canvas_ai_focus',
    'flux_ai_connections_items_v1','flux_ai_connections_custom_v1','flux_ai_model_route_v1',
    'flux_chrome_extension_id',
  ];
  const kept={};
  keysToKeep.forEach(k=>{const v=localStorage.getItem(k);if(v!==null)kept[k]=v;});
  localStorage.clear();
  Object.entries(kept).forEach(([k,v])=>localStorage.setItem(k,v));
  window.location.replace(getRedirectURL());
}

// ══ FEATURE PILLS — scrolling bar(s) on login screen (left column + sign-in card) ══
function buildFeatPillsHtml(){
  const pills=[
    {label:'✦ Flux AI Tutor',c:'#6366f1'},
    {label:'📷 Vision Import',c:'#10d9a0'},
    {label:'📊 4-decimal GPA',c:'#fbbf24'},
    {label:'⏱ Focus timer',c:'#a78bfa'},
    {label:'📅 Smart calendar',c:'#3b82f6'},
    {label:'☁️ Cloud sync',c:'#10d9a0'},
    {label:'🃏 AI flashcards',c:'#e879f9'},
    {label:'🚨 Panic mode',c:'#f43f5e'},
    {label:'📧 Gmail → tasks',c:'#fb923c'},
    {label:'📝 Tagged notes',c:'#6366f1'},
    {label:'🎯 Extracurriculars',c:'#fbbf24'},
    {label:'🧠 Cognitive load',c:'#22c55e'},
    {label:'📛 Exam conflicts',c:'#f472b6'},
    {label:'🌙 Themes & accent',c:'#38bdf8'},
    {label:'📈 Grade what-if',c:'#eab308'},
    {label:'🎓 Canvas & Gmail',c:'#94a3b8'},
    {label:'😊 Mood check-ins',c:'#fb7185'},
    {label:'🔗 iCal / Google',c:'#34d399'},
  ];
  const all=[...pills,...pills];
  return all.map(p=>`<div class="feat-pill" style="color:${p.c};border-color:${p.c}33;background:${p.c}11">${p.label}</div>`).join('');
}
function initFeaturePills(){
  const html=buildFeatPillsHtml();
  ['featPills','featPillsLoginCard'].forEach(id=>{
    const wrap=document.getElementById(id);
    if(wrap)wrap.innerHTML=html;
  });
}

// ══ LOGIN FEATURE CARDS — interactive color theming ══
function initLoginFeatureCards(){
  document.querySelectorAll('.login-feature-card').forEach(card=>{
    const rgb=card.dataset.color||'99,102,241';
    card.style.setProperty('--fc-color',rgb);
    const icon=card.querySelector('.login-feature-icon');
    if(icon){
      icon.style.background=`rgba(${rgb},.1)`;
      icon.style.border=`1px solid rgba(${rgb},.2)`;
    }
    card.addEventListener('mouseenter',()=>{
      card.style.setProperty('--fc-color',rgb);
    });
  });
}

// ══ ITEM 4 — TOPBAR FULL IMPLEMENTATION ══
function initTopbar(){
  function updateClock(){
    const now=new Date();
    const timeStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
    const el=document.getElementById('topbarClock');if(el)el.textContent=timeStr;
  }
  updateClock();setInterval(updateClock,10000);
  function updateEnergyPill(){
    const energy=parseInt(localStorage.getItem('flux_energy')||'3');
    const emojis=['','😴','😕','😐','😊','🚀'];
    const el=document.getElementById('topbarEnergy');if(el)el.textContent=emojis[energy]||'😐';
  }
  updateEnergyPill();
  const _orig=window.setEnergy;
  if(_orig&&!window._topbarEnergyPatched){
    window._topbarEnergyPatched=true;
    window.setEnergy=function(v){_orig(v);updateEnergyPill();};
  }
}

// ══ ITEM 20 — DASHBOARD SECTION REORDER ══
function reorderDashboard(){
  // Sections are now in fixed wrapper divs — no reordering needed.
}

// ══ ITEM 22 — QUICK-ADD TASK BAR ══
// Enter is handled globally → submitQuickAdd() (unified NL parse). Esc closes the floating panel.
function initQuickAdd(){
  const qa=document.getElementById('quickAddInput');if(!qa)return;
}

// ══ ITEM 24 — DRAG TO REORDER TASKS ══
let _dragTaskId=null,_dragOverId=null;
function initTaskDrag(){
  const list=document.getElementById('taskList');if(!list)return;
  list.addEventListener('dragstart',e=>{
    const item=e.target.closest('[data-task-id]');if(!item)return;
    _dragTaskId=parseInt(item.dataset.taskId);
    e.dataTransfer.effectAllowed='move';
    setTimeout(()=>item.classList.add('task-dragging'),0);
  });
  list.addEventListener('dragend',e=>{
    const item=e.target.closest('[data-task-id]');if(item)item.classList.remove('task-dragging');
    list.querySelectorAll('.drag-over-task').forEach(el=>el.classList.remove('drag-over-task'));
    _dragTaskId=null;_dragOverId=null;
  });
  list.addEventListener('dragover',e=>{
    e.preventDefault();
    const item=e.target.closest('[data-task-id]');if(!item||!_dragTaskId)return;
    const overId=parseInt(item.dataset.taskId);if(overId===_dragTaskId)return;
    if(_dragOverId!==overId){
      list.querySelectorAll('.drag-over-task').forEach(el=>el.classList.remove('drag-over-task'));
      item.classList.add('drag-over-task');_dragOverId=overId;
    }
  });
  list.addEventListener('drop',e=>{
    e.preventDefault();
    if(!_dragTaskId||!_dragOverId||_dragTaskId===_dragOverId)return;
    const fi=tasks.findIndex(t=>t.id===_dragTaskId),ti=tasks.findIndex(t=>t.id===_dragOverId);
    if(fi<0||ti<0)return;
    const[moved]=tasks.splice(fi,1);tasks.splice(ti,0,moved);
    save('tasks',tasks);renderTasks();syncKey('tasks',tasks);
    _dragTaskId=null;_dragOverId=null;
  });
}

// ══ ITEM 9 — MODAL ANIMATION POLISH ══
function openModal(id){
  const overlay=document.getElementById(id);if(!overlay)return;
  overlay.style.display='flex';
  requestAnimationFrame(()=>{
    overlay.style.animation='fadeIn .18s var(--ease-out)';
    const card=overlay.querySelector('.modal-card');
    if(card){card.style.animation='none';requestAnimationFrame(()=>card.style.animation='slideUpModal .28s var(--ease-spring)');}
  });
  document.body.style.overflow='hidden';
}
function closeModal(id){
  const overlay=document.getElementById(id);if(!overlay)return;
  overlay.style.opacity='0';overlay.style.transition='opacity .15s';
  setTimeout(()=>{overlay.style.display='none';overlay.style.opacity='';overlay.style.transition='';},160);
  document.body.style.overflow='';
}

// ══ ITEM 33 — LOADING STATES ══
function setLoading(btnEl,loading,origText){
  if(!btnEl)return;
  if(loading){btnEl.classList.add('btn-loading');btnEl.disabled=true;}
  else{btnEl.classList.remove('btn-loading');btnEl.disabled=false;if(origText)btnEl.textContent=origText;}
}
function showSectionLoading(containerId,rows=3){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML=Array(rows).fill(`<div class="skeleton" style="height:54px;border-radius:10px;margin-bottom:6px"></div>`).join('');
}

// ══ ITEM 34 — ERROR STATES ══
function showError(containerId,msg,retryFnStr){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML=`<div style="text-align:center;padding:32px 16px">
    <div style="font-size:2rem;margin-bottom:10px">⚠️</div>
    <div style="font-size:.9rem;font-weight:700;color:var(--text);margin-bottom:5px">Something went wrong</div>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.6">${esc(msg||'Please try again.')}</div>
    ${retryFnStr?`<button onclick="${retryFnStr}" style="font-size:.78rem;padding:7px 18px;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent)">↺ Try again</button>`:''}
  </div>`;
}

// ══ ITEM 3 — MOBILE NAV FULL ACTIVATION ══
function initMobileNav(){
  const bnav=document.querySelector('.bottom-nav');if(!bnav)return;
  // Active state + haptic on every tab click
  bnav.addEventListener('click',e=>{
    const btn=e.target.closest('.bnav-item');
    if(!btn||btn.id==='moreBtn')return;
    bnav.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    if(navigator.vibrate)navigator.vibrate(6);
  });
  // Scroll active tab into view
  const updateBnavScroll=()=>{
    const active=bnav.querySelector('.bnav-item.active');
    if(active)active.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
  };
  bnav.addEventListener('click',updateBnavScroll);
  // Prevent page bounce on nav touch
  bnav.addEventListener('touchstart',e=>{if(e.touches.length>0)e.stopPropagation();},{passive:true});
}

// ══ DASHBOARD INIT ══
function initDashboardFeatures(){
  initTopbar();
  initQuickAdd();
  initTaskDrag();
  initMobileNav();
  smartReorderDashboard();
  checkTimePoverty();
  setInterval(()=>{checkTimePoverty();updateCognitiveLoadMeter();if(typeof updateNextClassPill==='function')updateNextClassPill();if(typeof renderDynamicFocus==='function')renderDynamicFocus();},60000);
  initIntelligenceEngine();
  // New systems
  initPomodoroVisibilityPause();
  initTaskSwipeGestures();
  applyCollapsedSections();
  applyHighContrast();
  renderSavedViewsDropdown();
  updateCognitiveLoadMeter();setInterval(updateCognitiveLoadMeter,5*60*1000);
  if(typeof updateMomentumUI==='function'){try{updateMomentumUI();}catch(_){}}
  renderEffortReport();
  renderSubjectEfficiencyHeatmap();
  initV4Systems();
}

// ── Recovery Mode → "Show Quick Wins" CTA ─────────────────────────
window.fluxOpenQuickWins=function(){
  const wins=(window.FluxBehavior&&window.FluxBehavior.getQuickWins)
    ? window.FluxBehavior.getQuickWins(tasks,15)
    : (Array.isArray(tasks)?tasks.filter(t=>!t.done&&(t.estTime||0)>0&&(t.estTime||0)<=15):[]);
  if(!wins.length){
    if(typeof showToast==='function')showToast('No quick wins (≤15 min) right now. Add an estimate to a task to surface one.','info');
    return;
  }
  if(typeof navTo==='function'){try{navTo('tasks');}catch(_){}}
  taskFilter='active';
  if(typeof renderTasks==='function')renderTasks();
  const first=wins[0];
  if(first){
    requestAnimationFrame(()=>{
      const el=document.querySelector('[data-task-id="'+first.id+'"]');
      if(el){
        el.scrollIntoView({behavior:'smooth',block:'center'});
        el.classList.add('quick-win-flash');
        setTimeout(()=>el.classList.remove('quick-win-flash'),1600);
      }
    });
  }
  if(typeof showToast==='function')showToast('Highlighted '+wins.length+' quick win'+(wins.length===1?'':'s')+' — start the shortest first.','success');
};

function handleCheckoutReturn(){
  const params=new URLSearchParams(window.location.search);
  const checkoutStatus=params.get('checkout');
  if(checkoutStatus==='success'){
    params.delete('checkout');
    params.delete('session_id');
    const qs=params.toString();
    window.history.replaceState({},'',window.location.pathname+(qs?'?'+qs:'')+window.location.hash);
    const showSuccess=()=>{
      if(typeof spawnConfetti==='function')spawnConfetti();
      const trialEnd=_entitlement.trialEndsAt
        ?new Date(_entitlement.trialEndsAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
        :null;
      const modal=document.createElement('div');
      modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
      modal.innerHTML=`
        <div style="background:var(--card);border:1px solid rgba(var(--accent-rgb),.3);border-radius:20px;padding:32px;width:100%;max-width:400px;text-align:center;box-shadow:var(--shadow-float)">
          <div style="font-size:3rem;margin-bottom:14px">🎉</div>
          <div style="font-size:1.2rem;font-weight:800;margin-bottom:8px">Welcome to Flux Pro!</div>
          <div style="font-size:.85rem;color:var(--muted2);line-height:1.6;margin-bottom:20px">
            You now have access to all Pro features.
            ${trialEnd?`Your first charge is on ${trialEnd}.`:'Your subscription is now active.'}
          </div>
          <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:20px;text-align:left">
            ${['200 AI messages/day','Image analysis','Canvas sync','Unlimited tasks'].map(f=>
              `<div style="display:flex;align-items:center;gap:8px;font-size:.82rem;padding:4px 0"><span style="color:var(--green)">✓</span>${f}</div>`
            ).join('')}
          </div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:13px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-weight:700;cursor:pointer">
            Let's go! ✦
          </button>
        </div>`;
      document.body.appendChild(modal);
      _entitlementFetchedAt=0;
      if(FLUX_FLAGS.PAYMENTS_ENABLED)void fetchAndCacheEntitlement();
    };
    if(typeof currentUser!=='undefined'&&currentUser){
      setTimeout(showSuccess,1000);
    }else{
      const interval=setInterval(()=>{
        if(typeof currentUser!=='undefined'&&currentUser){
          clearInterval(interval);
          setTimeout(showSuccess,500);
        }
      },500);
      setTimeout(()=>clearInterval(interval),15000);
    }
  }
  if(checkoutStatus==='canceled'){
    params.delete('checkout');
    const qs=params.toString();
    window.history.replaceState({},'',window.location.pathname+(qs?'?'+qs:'')+window.location.hash);
    setTimeout(()=>showToast('No worries — your free plan is still active','info'),1000);
  }
}

// ══ INIT ══
(function init(){
  handleCheckoutReturn();
  initOAuthPostMessageListener();
  loadTheme();
  migrateCompletedAtBackfill();
  loadSettingsUI();
  const sb=document.getElementById('sidebar');if(sb&&sidebarCollapsed)sb.classList.add('collapsed');
  document.getElementById('datePill').textContent=TODAY.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const ab=AB_MAP[todayStr()];
  if(ab){const p=document.getElementById('abPill');p.textContent=ab+' Day';p.style.display='block';p.style.background=ab==='A'?'rgba(99,102,241,.15)':'rgba(16,217,160,.15)';p.style.color=ab==='A'?'var(--accent)':'var(--green)';p.style.border='1px solid '+(ab==='A'?'rgba(99,102,241,.3)':'rgba(16,217,160,.3)');}
  updateTopbarStats();
  updateNextClassPill();
  const td=document.getElementById('taskDate');if(td)td.valueAsDate=TODAY;
  setEnergy(document.getElementById('energySlider')?.value||3);
  renderStats();renderTasks();renderCalendar();renderCountdown();renderSmartSug();
  renderProfile();
  renderNotesList();renderExtrasList();renderSchoolsList();renderECGoals();
  renderMoodHistory();renderAffirmation();renderAISugs();syncFluxAIModeButtons();renderSchool();
  renderSubjectBudget();renderFocusHeatmap();
  updateTDisplay();renderTDots();updateTStats();
  checkAllPanic();setInterval(checkAllPanic,60000);
  initFeaturePills();
  initLoginFeatureCards();
  bindScheduleImportDropzones();
  initFluxFeedbackModal();
  renderSidebars();
  populateSubjectSelects();
  initSidebarResize();
  initKeyboardShortcuts();
  initScrollLayout();
  showKeyHint();
  setInterval(applyPanicGlow,25000);

  // ── FLOW: Splash (once per session) → Login → (1st time) Onboarding → App ──
  const afterSplash = () => initAuth();

  // Show splash only on first ever visit or fresh install
  const shownSplash = localStorage.getItem('flux_splash_shown');
  const isFirstTimeSplash = !shownSplash;
  if(!shownSplash){
    localStorage.setItem('flux_splash_shown','1');
  }
  const s=document.getElementById('splash');
  if(s)s.style.display='block';
  setTimeout(()=>{
    if(typeof window.runSplash==='function'){
      window.runSplash(afterSplash, isFirstTimeSplash);
    }else{
      if(s)s.style.display='none';
      afterSplash();
    }
  },30);
})();

// ══ SPACED REPETITION SYSTEM ══════════════════════════════════
function generateSRSReviews(originalTask){
  if(!originalTask.srsEnabled)return;
  const intervals=[1,7,30];
  const base=new Date(originalTask.date||todayStr()+'T00:00:00');
  intervals.forEach(days=>{
    const d=new Date(base);d.setDate(d.getDate()+days);
    const review={
      id:Date.now()+Math.random(),
      name:'🔄 Review: '+originalTask.name,
      subject:originalTask.subject||'',
      priority:'low',
      type:'study',
      date:d.toISOString().slice(0,10),
      estTime:Math.round((originalTask.estTime||30)*0.5),
      difficulty:Math.max(1,(originalTask.difficulty||3)-1),
      notes:'SRS review — original task: '+originalTask.name,
      srsReview:true,cogLoadWeight:0.5,
      done:false,rescheduled:0,createdAt:Date.now()
    };
    review.urgencyScore=calcUrgency(review);
    tasks.push(review);
  });
  save('tasks',tasks);
  showToast('🔄 3 spaced reviews scheduled (1d, 7d, 30d)','success');
  syncKey('tasks',tasks);
}


// ══ GHOST DRAFT INJECTOR ══════════════════════════════════════
async function injectGhostDraft(task){
  if(!currentUser||!task.subject)return;
  const subj=getSubjects()[task.subject];
  if(!subj)return;
  const isPhysics=/physics|kinematics|mechanics|motion|force|energy/i.test(subj.name);
  const prompt=isPhysics
    ?`For a student task "${task.name}" in ${subj.name}: give 3-5 starting points. Use g = ${G.toFixed(4)} m/s² for all physics. Show all calculations to 4 decimal places. Be concise bullet points.`
    :`For a student task "${task.name}" in ${subj.name}: give 3-5 helpful starting points, key concepts, or formulas to begin. Concise bullet points only.`;
  try{
    const res=await fetch(API.ai,{method:'POST',headers:await fluxAuthHeaders(),
      body:JSON.stringify({system:'You are a helpful study assistant. Be brief and practical.',
        messages:[{role:'user',content:prompt}]})});
    const data=await res.json();
    const txt=(data.content?.[0]?.text||'').replace(/```actions[\s\S]*?```/g,'').trim();
    if(!txt)return;
    const t=tasks.find(x=>x.id===task.id);
    if(t){t.ghostDraft=txt;save('tasks',tasks);renderTasks();}
  }catch(e){console.warn('Ghost draft failed:',e);}
}


// ══ CONTEXT SWITCH WARNING ════════════════════════════════════
const HEAVY_SUBJECTS=/math|physics|chemistry|calculus|bio|science|language|spanish|french|latin|chinese/i;
function checkContextSwitches(blocks){
  for(let i=0;i<blocks.length-1;i++){
    const a=blocks[i],b=blocks[i+1];
    const aHeavy=HEAVY_SUBJECTS.test(a.subject||'');
    const bHeavy=HEAVY_SUBJECTS.test(b.subject||'');
    if(aHeavy&&bHeavy&&a.subject!==b.subject){
      showToast('⚠ Context switch: '+a.subject+' → '+b.subject+'. Consider a 10min break.','warning');
      return true;
    }
  }
  return false;
}


// ══ FRICTION TRACKER — task aging ════════════════════════════
function getFrictionStyle(task){
  const r=task.rescheduled||0;
  if(r===0)return{border:'',glow:''};
  if(r===1)return{border:'3px solid rgba(251,191,36,.5)',glow:''};
  if(r===2)return{border:'3px solid rgba(251,146,60,.7)',glow:'0 0 8px rgba(251,146,60,.25)'};
  return{border:'3px solid rgba(244,63,94,.8)',glow:'0 0 14px rgba(244,63,94,.3)'};
}
async function checkFrictionIntervention(task){
  if((task.rescheduled||0)>=3&&!task.frictionHandled){
    task.frictionHandled=true;save('tasks',tasks);
    showToast('⚠ "'+task.name.slice(0,30)+'" rescheduled 3×. Breaking it down...','warning');
    await breakItDown(task.id);
  }
}


// ══ DAILY SHUTDOWN PROTOCOL ══════════════════════════════════
async function dailyShutdown(){
  const existing=document.getElementById('shutdownPanel');
  if(existing){existing.remove();return;}
  const today=todayStr();
  const completed=tasks.filter(t=>t.done&&t.completedAt&&new Date(t.completedAt).toISOString().slice(0,10)===today);
  const planned=tasks.filter(t=>t.date===today);
  const eff=planned.length?Math.round((completed.length/planned.length)*100):100;
  const totalMins=sessionLog.filter(s=>s.date===today).reduce((sum,s)=>sum+s.mins,0);
  const panel=document.createElement('div');
  panel.id='shutdownPanel';
  panel.style.cssText='position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(12px)';
  panel.innerHTML=`
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:24px;max-width:480px;width:100%;padding:28px;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.6)">
      <div style="font-size:2rem;margin-bottom:8px">🌙</div>
      <div style="font-size:1.1rem;font-weight:800;letter-spacing:-.3px;margin-bottom:4px">Daily Shutdown</div>
      <div style="font-size:.72rem;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:20px">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="background:var(--card2);border-radius:12px;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:var(--green)">${completed.length}</div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Completed</div></div>
        <div style="background:var(--card2);border-radius:12px;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${eff}%</div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Efficiency</div></div>
        <div style="background:var(--card2);border-radius:12px;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:var(--gold)">${totalMins}m</div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Focus Time</div></div>
      </div>
      <div id="shutdownSummary" style="font-size:.8rem;color:var(--muted2);text-align:left;background:var(--card2);border-radius:12px;padding:14px;margin-bottom:18px;line-height:1.7;min-height:60px">
        <span style="color:var(--muted);font-size:.72rem;font-family:'JetBrains Mono',monospace">✦ Generating summary...</span>
      </div>
      <button onclick="document.getElementById('shutdownPanel').remove()" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--purple));border:none;color:#fff;font-weight:700;font-size:.9rem;cursor:pointer">Good night ✓</button>
    </div>`;
  document.body.appendChild(panel);
  panel.onclick=e=>{if(e.target===panel)panel.remove();};
  // Generate AI summary
  try{
    const taskNames=completed.map(t=>t.name).slice(0,6).join(', ')||'nothing specific';
    const res=await fetch(API.ai,{method:'POST',headers:await fluxAuthHeaders(),
      body:JSON.stringify({system:'You are a supportive academic coach. Be warm and brief (2-3 sentences max).',
        messages:[{role:'user',content:`Student completed today: ${taskNames}. Efficiency: ${eff}%. Focus time: ${totalMins} minutes. Write a brief motivating shutdown summary.`}]})});
    const data=await res.json();
    const txt=(data.content?.[0]?.text||'').replace(/```actions[\s\S]*?```/g,'').trim();
    const el=document.getElementById('shutdownSummary');
    if(el&&txt)el.textContent=txt;
  }catch(e){
    const el=document.getElementById('shutdownSummary');
    if(el)el.textContent=completed.length?'Great work today! '+completed.length+' task'+(completed.length>1?'s':'')+'  completed. Rest well.':'Tomorrow is a new day. Rest up and start fresh.';
  }
}


// ══ AUTO-NEXT TASK SUGGESTION ═════════════════════════════════
let _autoNextTimer=null;
function showAutoNext(){
  const existing=document.getElementById('autoNextBar');if(existing)existing.remove();
  const next=smartSortTasks(tasks.filter(t=>!t.done&&t.date)).slice(0,1)[0]||tasks.filter(t=>!t.done).slice(0,1)[0];
  if(!next)return;
  const bar=document.createElement('div');
  bar.id='autoNextBar';
  bar.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:3000;background:var(--card);border:1px solid rgba(var(--accent-rgb),.3);border-radius:14px;padding:10px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);animation:slideUpToast .3s var(--ease-spring);max-width:400px;width:90%';
  bar.innerHTML=`
    <div style="flex:1;min-width:0">
      <div style="font-size:.65rem;color:var(--accent);font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px">Up next</div>
      <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(next.name)}</div>
    </div>
    <button onclick="document.getElementById('autoNextBar').remove();nav('dashboard');setTimeout(()=>startDeepWork(${next.id}),200)" style="padding:6px 14px;border-radius:10px;font-size:.75rem;font-weight:700;background:var(--accent);border:none;color:#fff;cursor:pointer;white-space:nowrap">Start →</button>
    <button onclick="document.getElementById('autoNextBar').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:2px 6px">✕</button>`;
  document.body.appendChild(bar);
  clearTimeout(_autoNextTimer);
  _autoNextTimer=setTimeout(()=>{const el=document.getElementById('autoNextBar');if(el){el.style.opacity='0';el.style.transition='opacity .4s';setTimeout(()=>el.remove(),400);}},8000);
}


// ══ TASK TEMPLATES ════════════════════════════════════════════
const TASK_TEMPLATES=[
  {name:'Homework',type:'hw',estTime:30,difficulty:2,priority:'med',icon:'📝'},
  {name:'Study Session',type:'study',estTime:60,difficulty:3,priority:'med',icon:'📖'},
  {name:'Essay',type:'essay',estTime:120,difficulty:4,priority:'high',icon:'✍'},
  {name:'Lab Report',type:'lab',estTime:90,difficulty:4,priority:'high',icon:'🧪'},
  {name:'Project Milestone',type:'project',estTime:60,difficulty:3,priority:'high',icon:'🎯'},
  {name:'Test Prep',type:'test',estTime:45,difficulty:4,priority:'high',icon:'📋'},
  {name:'Reading',type:'reading',estTime:30,difficulty:2,priority:'low',icon:'📚'},
  {name:'Problem Set',type:'hw',estTime:45,difficulty:4,priority:'med',icon:'🔢'},
];
function showTemplateMenu(){
  const existing=document.getElementById('templateMenu');if(existing){existing.remove();return;}
  const menu=document.createElement('div');
  menu.id='templateMenu';
  menu.style.cssText='position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  menu.innerHTML=`<div style="background:var(--card);border:1px solid var(--border2);border-radius:20px;max-width:440px;width:100%;padding:24px;max-height:80vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:.95rem;font-weight:800">Task Templates</div>
      <button onclick="document.getElementById('templateMenu').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.2rem">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${TASK_TEMPLATES.map(t=>`
        <button type="button" onclick="applyTemplate(${JSON.stringify(t).replace(/"/g,'&quot;')})" style="padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:12px;text-align:left;cursor:pointer;transition:all .15s">
          <div style="font-size:1.2rem;margin-bottom:4px">${t.icon}</div>
          <div style="font-size:.82rem;font-weight:700">${t.name}</div>
          <div style="font-size:.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${t.estTime}min · Diff ${t.difficulty}</div>
        </button>`).join('')}
    </div>
    <div style="margin-top:14px;font-size:.68rem;color:var(--muted);font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px">Multi-task packs</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      <button type="button" onclick="applyExamWeekPack()" style="padding:12px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.25);border-radius:12px;text-align:left;cursor:pointer;font-weight:700;font-size:.82rem">📚 Exam week (3 tasks)</button>
      <button type="button" onclick="applyProjectMilestonePack()" style="padding:12px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.25);border-radius:12px;text-align:left;cursor:pointer;font-weight:700;font-size:.82rem">🧩 Project milestones (3 tasks)</button>
    </div>
  </div>`;
  document.body.appendChild(menu);
  menu.onclick=e=>{if(e.target===menu)menu.remove();};
}
function applyTemplate(tpl){
  document.getElementById('templateMenu')?.remove();
  openDashAddTaskModal();
  const ni=document.getElementById('taskName');const ti=document.getElementById('taskType');
  const ei=document.getElementById('taskEstTime');const di=document.getElementById('taskDifficulty');
  const pi=document.getElementById('taskPriority');
  if(ni)ni.value=tpl.name;
  if(ti)ti.value=tpl.type;
  if(ei)ei.value=tpl.estTime;
  if(di)di.value=tpl.difficulty;
  if(pi)pi.value=tpl.priority;
  if(ni)ni.focus();
  showToast('Template applied: '+tpl.name,'info');
}
function applyExamWeekPack(){
  document.getElementById('templateMenu')?.remove();
  const base=Date.now();
  const push=(name,date,type,est,priority)=>{
    const t={id:base+Math.random(),name,date:date||'',subject:'',priority,type,estTime:est,difficulty:4,notes:'',subtasks:[],done:false,rescheduled:0,createdAt:Date.now()};
    t.urgencyScore=calcUrgency(t);tasks.unshift(t);
  };
  const t0=todayStr();
  push('Exam week: Review all key units',t0,'study',90,'high');
  push('Practice test / past paper','','test',60,'high');
  push('Exam week: Sleep & light review',t0,'hw',25,'med');
  save('tasks',tasks);
  renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();
  syncKey('tasks',tasks);
  showToast('Added 3 exam-week starter tasks — edit dates as needed','success');
}
function applyProjectMilestonePack(){
  document.getElementById('templateMenu')?.remove();
  const base=Date.now();
  const push=(name,type,est,priority)=>{
    const t={id:base+Math.random(),name,date:'',subject:'',priority,type,estTime:est,difficulty:3,notes:'',subtasks:[],done:false,rescheduled:0,createdAt:Date.now()};
    t.urgencyScore=calcUrgency(t);tasks.unshift(t);
  };
  push('Project: Research & outline','hw',60,'med');
  push('Project: First draft','essay',90,'high');
  push('Project: Revise & final','project',75,'high');
  save('tasks',tasks);
  renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();
  syncKey('tasks',tasks);
  showToast('Added 3 project milestone tasks','success');
}


// ══ VOICE INPUT ═══════════════════════════════════════════════
function startVoiceInput(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){showToast('Voice input not supported in this browser','error');return;}
  const btn=document.getElementById('voiceBtn');
  if(!btn)return;
  const r=new SR();r.lang='en-US';r.interimResults=false;r.maxAlternatives=1;
  r.onstart=()=>{if(btn){btn.textContent='🎙 Listening...';btn.style.color='var(--red)';}};
  r.onresult=e=>{
    const text=e.results[0][0].transcript;
    const qa=document.getElementById('taskName')||document.getElementById('quickAddInput');
    if(qa){qa.value=text;qa.focus();}
    const parsed=parseNLTask(text);
    if(parsed.date){const di=document.getElementById('taskDate');if(di)di.value=parsed.date;}
    if(parsed.priority){const pi=document.getElementById('taskPriority');if(pi)pi.value=parsed.priority;}
    if(parsed.type){const ti=document.getElementById('taskType');if(ti)ti.value=parsed.type;}
    if(parsed.estTime){const ei=document.getElementById('taskEstTime');if(ei)ei.value=parsed.estTime;}
    showToast('🎙 "'+text+'"','info');
  };
  r.onerror=()=>showToast('Voice input error','error');
  r.onend=()=>{if(btn){btn.textContent='🎙';btn.style.color='';}};
  r.start();
}


// ══ POMODORO AUTO-PAUSE + DISTRACTION TRACKING ═══════════════
let _pomDistractions=0;
function initPomodoroVisibilityPause(){
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&tRunning){
      pauseTimer();
      _pomDistractions++;
      const el=document.getElementById('distractionCount');
      if(el)el.textContent=_pomDistractions+' distraction'+(+_pomDistractions!==1?'s':'');
      showToast('⏸ Pomodoro paused — tab switch detected','warning');
    }
  });
}

function showSessionRecap(subject,mins){
  const existing=document.getElementById('sessionRecap');if(existing)existing.remove();
  const recap=document.createElement('div');
  recap.id='sessionRecap';
  recap.style.cssText='position:fixed;bottom:90px;right:20px;z-index:3000;background:var(--card);border:1px solid rgba(var(--accent-rgb),.3);border-radius:14px;padding:12px 16px;box-shadow:0 8px 32px rgba(0,0,0,.4);animation:slideUp .3s var(--ease-spring);max-width:280px';
  recap.innerHTML=`
    <div style="font-size:.65rem;color:var(--accent);font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Session Complete ✓</div>
    <div style="font-size:.85rem;font-weight:700;margin-bottom:2px">${mins} min${subject?' · '+esc(getSubjects()[subject]?.name||subject):''}${_pomDistractions?' · '+_pomDistractions+' distraction'+(+_pomDistractions!==1?'s':''):''}</div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button onclick="document.getElementById('sessionRecap').remove()" style="flex:1;padding:5px;font-size:.72rem;border-radius:8px;background:var(--card2);border:1px solid var(--border)">Dismiss</button>
    </div>`;
  document.body.appendChild(recap);
  setTimeout(()=>{const el=document.getElementById('sessionRecap');if(el){el.style.opacity='0';el.style.transition='opacity .4s';setTimeout(()=>el.remove(),400);}},10000);
  _pomDistractions=0;
}


// ══ VERSION HISTORY + UNDO ════════════════════════════════════
let _taskHistory=[];
function snapshotTasks(){
  _taskHistory.push(JSON.parse(JSON.stringify(tasks)));
  if(_taskHistory.length>10)_taskHistory.shift();
}
function undoLastChange(){
  if(!_taskHistory.length){showToast('Nothing to undo','info');return;}
  tasks=_taskHistory.pop();
  save('tasks',tasks);
  renderStats();renderTasks();renderCalendar();renderCountdown();
  syncKey('tasks',tasks);
  showToast('↩ Change undone','info');
}
function showUndoSnackbar(msg,undoFn){
  const existing=document.getElementById('undoSnackbar');if(existing)existing.remove();
  const bar=document.createElement('div');
  bar.id='undoSnackbar';
  bar.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:3500;background:var(--card);border:1px solid var(--border2);border-radius:10px;padding:9px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:slideUpToast .25s var(--ease-spring);font-size:.8rem;white-space:nowrap';
  bar.innerHTML=`<span style="color:var(--text)">${esc(msg)}</span><button onclick="undoLastChange();document.getElementById('undoSnackbar')?.remove()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:700;font-size:.78rem;padding:0">Undo</button><button onclick="this.closest('#undoSnackbar').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;padding:0 2px">✕</button>`;
  document.body.appendChild(bar);
  setTimeout(()=>{const el=document.getElementById('undoSnackbar');if(el){el.style.opacity='0';el.style.transition='opacity .4s';setTimeout(()=>el.remove(),400);}},5000);
}


// ══ COGNITIVE LOAD METER ══════════════════════════════════════
// Delegates to the pure behavior engine (public/js/core/behavior-engine.js)
// when available so the static app, the Next.js shell, and any future
// surface compute load identically. Falls back to local logic if the
// module hasn't loaded yet (e.g. during early boot).
function calcCognitiveLoad(){
  if(window.FluxBehavior&&typeof window.FluxBehavior.calcCognitiveLoad==='function'){
    try{
      const r=window.FluxBehavior.calcCognitiveLoad({tasks,classes,now:new Date()});
      return r.score;
    }catch(_){}
  }
  const now=new Date();const h=now.getHours();
  const ts=todayStr();
  const active=tasks.filter(t=>!t.done);
  const overdue=active.filter(t=>t.date&&new Date(t.date+'T00:00:00')<new Date(now.toDateString()));
  const todayTasks=active.filter(t=>t.date===ts);
  const highPri=active.filter(t=>t.priority==='high');
  const srsWeight=active.filter(t=>t.srsReview).length*0.5;
  const tf=h>=10&&h<=14?1.2:h>=20?0.6:1.0;
  return Math.min(100,Math.round((overdue.length*15+todayTasks.length*8+highPri.length*10-srsWeight)*tf));
}
function updateCognitiveLoadMeter(){
  const bar=document.getElementById('cogLoadBar');
  const lbl=document.getElementById('cogLoadLabel');
  const wrap=document.getElementById('cogLoadWrap');
  const cluster=document.getElementById('fluxPulseCluster');
  if(!bar)return;
  try{window.FluxAnim?.initCogLoadMeter?.();}catch(e){}

  let payload=null;
  if(window.FluxBehavior&&typeof window.FluxBehavior.tick==='function'){
    try{
      const lastActiveAt=Number(localStorage.getItem('flux_last_active_ms'))||null;
      payload=window.FluxBehavior.tick({
        tasks,classes,
        momentumLevel:typeof _momentum==='number'?_momentum:0,
        streak:Number(localStorage.getItem('flux_streak_count'))||0,
        lastActiveAt:lastActiveAt?new Date(lastActiveAt):null,
        now:new Date(),
      });
    }catch(_){payload=null;}
  }
  const load=payload?payload.load.score:calcCognitiveLoad();
  const color=load>=85?'var(--red)':load>=60?'var(--gold)':'var(--green)';
  const text=load>=85?'High':load>=60?'Med':'Low';
  let usedFlux=false;
  try{
    if(typeof window.FluxAnim?.updateCogLoad==='function'){
      window.FluxAnim.updateCogLoad(load);
      usedFlux=true;
    }
  }catch(e){}
  if(!usedFlux){bar.style.width=load+'%';bar.style.background=color;}
  if(lbl){lbl.textContent=text+' '+load+'%';lbl.style.color=color;}
  if(wrap)wrap.title='Cognitive Load: '+load+'% — based on overdue, today density, exam proximity, time of day';

  if(cluster){
    const inRecovery=load>=85;
    cluster.removeAttribute('hidden');
    cluster.dataset.recovery=inRecovery?'true':'false';
    document.body.dataset.recovery=inRecovery?'true':'false';
    if(inRecovery&&!cluster._recoveryToastShown){
      cluster._recoveryToastShown=true;
      showToast('⚠ High cognitive load ('+load+'%). Recovery Mode hides non-essential tasks.','warning');
    }else if(!inRecovery&&cluster._recoveryToastShown){
      cluster._recoveryToastShown=false;
    }
  }
}


// ══ MOMENTUM SYSTEM ═══════════════════════════════════════════
let _momentum=0,_momentumTimer=null;
function addMomentum(){
  _momentum++;
  clearTimeout(_momentumTimer);
  _momentumTimer=setTimeout(()=>{_momentum=0;updateMomentumUI();},10*60*1000);
  updateMomentumUI();
  if(_momentum>=2){
    try{
      const pe=document.getElementById('momentumPill');
      if(pe&&window.FluxAnim?.momentumPop)FluxAnim.momentumPop(pe);
    }catch(e){}
  }
  if(_momentum>=3)showToast('🔥 '+_momentum+'× Momentum! Keep going!','success');
  if(_momentum>=5)spawnConfetti();
}
function updateMomentumUI(){
  const el=document.getElementById('momentumPill');
  if(el){
    if(_momentum>=2){
      el.style.display='flex';el.textContent='🔥 '+_momentum+'×';
      el.style.background=_momentum>=5?'rgba(244,63,94,.2)':'rgba(251,191,36,.15)';
      el.style.border='1px solid '+(_momentum>=5?'rgba(244,63,94,.3)':'rgba(251,191,36,.25)');
      el.style.color=_momentum>=5?'var(--red)':'var(--gold)';
    }else{el.style.display='none';}
  }
  const cluster=document.getElementById('fluxPulseCluster');
  const flameLabel=document.getElementById('fluxFlameLabel');
  const grad=document.querySelector('#fluxFlame linearGradient#fluxFlameGrad');
  if(!cluster)return;
  const state=(window.FluxBehavior&&window.FluxBehavior.momentumState)
    ? window.FluxBehavior.momentumState(_momentum)
    : (_momentum>=5?{tier:'inferno',label:_momentum+'× momentum',gradient:['#a855f7','#7c3aed']}
       :_momentum>=3?{tier:'blaze',label:_momentum+'× momentum',gradient:['#fb923c','#f97316']}
       :_momentum>=2?{tier:'spark',label:_momentum+'× momentum',gradient:['#60a5fa','#3b82f6']}
       :{tier:'idle',label:'Idle',gradient:['#475569','#334155']});
  cluster.removeAttribute('hidden');
  cluster.dataset.tier=state.tier;
  if(flameLabel)flameLabel.textContent=state.label;
  if(grad&&grad.children&&grad.children.length>=2){
    grad.children[0].setAttribute('stop-color',state.gradient[0]);
    grad.children[1].setAttribute('stop-color',state.gradient[1]);
  }
}


// ══ EFFORT ACCURACY SYSTEM ════════════════════════════════════
let _effortLog=load('flux_effort_log',[]);
function logEffort(taskId,actualMins,el){
  const t=tasks.find(x=>x.id===taskId);
  if(t){
    _effortLog.push({taskId,subject:t.subject||'',estimated:t.estTime||0,actual:actualMins,date:todayStr()});
    if(_effortLog.length>300)_effortLog=_effortLog.slice(-300);
    save('flux_effort_log',_effortLog);
    showToast('Effort logged: '+actualMins+'m','success');
  }
  if(el)el.remove();
}
function renderEffortReport(){
  const el=document.getElementById('effortReport');if(!el)return;
  if(!_effortLog.length){el.innerHTML='<div style="color:var(--muted);font-size:.82rem">Complete tasks with time estimates to see accuracy data.</div>';return;}
  const bySubject={};
  _effortLog.forEach(e=>{
    if(!e.subject)return;
    if(!bySubject[e.subject])bySubject[e.subject]={est:[],act:[]};
    bySubject[e.subject].est.push(e.estimated);
    bySubject[e.subject].act.push(e.actual);
  });
  const subjs=getSubjects();
  el.innerHTML=Object.entries(bySubject).map(([k,data])=>{
    const avgEst=data.est.reduce((a,b)=>a+b,0)/data.est.length;
    const avgAct=data.act.reduce((a,b)=>a+b,0)/data.act.length;
    const acc=Math.round((Math.min(avgEst,avgAct)/Math.max(avgEst,avgAct,1))*100);
    const trend=avgAct>avgEst?'⬆ Over':'⬇ Under';
    const c=acc>=80?'var(--green)':acc>=60?'var(--gold)':'var(--red)';
    const s=subjs[k];
    return`<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:.82rem;font-weight:600">${esc(s?s.name:k)}</span>
        <span style="font-size:.72rem;font-weight:700;color:${c};font-family:'JetBrains Mono',monospace">${acc}% accurate</span>
      </div>
      <div style="font-size:.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace">Est ${Math.round(avgEst)}m · Actual ${Math.round(avgAct)}m · ${trend}estimating</div>
    </div>`;
  }).join('')||'<div style="color:var(--muted);font-size:.82rem">Log effort on subject-tagged tasks to see data.</div>';
}


// ══ CUSTOM SAVED VIEWS ════════════════════════════════════════
let _savedViews=load('flux_saved_views',[]);
function saveCurrentView(){
  const name=prompt('Name this view (e.g. "Exam Week"):');if(!name)return;
  const cur=load('flux_view_mode','list');
  _savedViews.push({id:Date.now(),name,view:cur,createdAt:Date.now()});
  save('flux_saved_views',_savedViews);
  renderSavedViewsDropdown();
  showToast('View "'+name+'" saved','success');
}
function loadSavedView(id){
  const v=_savedViews.find(x=>x.id===id);if(!v)return;
  switchView(v.view);
  showToast('Loaded: '+v.name,'info');
}
function deleteSavedView(id){
  _savedViews=_savedViews.filter(x=>x.id!==id);
  save('flux_saved_views',_savedViews);
  renderSavedViewsDropdown();
}
function renderSavedViewsDropdown(){
  const el=document.getElementById('savedViewsList');if(!el)return;
  const sec=document.getElementById('savedViewsSection');
  if(!_savedViews.length){if(sec)sec.style.display='none';return;}
  if(sec)sec.style.display='block';
  el.innerHTML=_savedViews.map(v=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <button onclick="loadSavedView(${v.id})" style="flex:1;text-align:left;background:none;border:none;color:var(--text);font-size:.82rem;cursor:pointer">${esc(v.name)}</button>
      <span style="font-size:.6rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${v.view}</span>
      <button onclick="deleteSavedView(${v.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.85rem">✕</button>
    </div>`).join('');
}


// ══ SUBJECT EFFICIENCY HEATMAP ════════════════════════════════
function renderSubjectEfficiencyHeatmap(){
  const el=document.getElementById('subjectEffHeatmap');if(!el)return;
  const subjs=getSubjects();const keys=Object.keys(subjs);
  if(!keys.length||!sessionLog.length){
    el.innerHTML='<div style="color:var(--muted);font-size:.82rem">Complete focus sessions by subject to see efficiency.</div>';return;
  }
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const grid={};keys.forEach(k=>{grid[k]=new Array(7).fill(0);});
  sessionLog.forEach(s=>{
    if(!s.subject||!grid[s.subject])return;
    const d=new Date(s.date+'T00:00:00');
    const dow=(d.getDay()+6)%7;
    grid[s.subject][dow]+=s.mins;
  });
  const maxVal=Math.max(...keys.flatMap(k=>grid[k]),1);
  el.innerHTML=`<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.68rem;width:100%">
    <thead><tr><th style="text-align:left;padding:3px 8px;color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:.6rem"></th>
    ${days.map(d=>`<th style="padding:3px 5px;color:var(--muted);font-family:'JetBrains Mono',monospace;text-align:center;font-size:.6rem">${d}</th>`).join('')}</tr></thead>
    <tbody>${keys.map(k=>{
      const s=subjs[k];
      return`<tr><td style="padding:3px 8px;white-space:nowrap;color:${s.color};font-weight:600;font-size:.7rem">${s.name.slice(0,12)}</td>
      ${grid[k].map(mins=>{
        const i=mins/maxVal;
        const bg=i>0.7?'var(--green)':i>0.3?'var(--accent)':i>0?'rgba(var(--accent-rgb),.25)':'var(--card2)';
        return`<td style="padding:2px"><div title="${mins}m" style="width:26px;height:20px;border-radius:4px;background:${bg};margin:auto;cursor:default"></div></td>`;
      }).join('')}</tr>`;
    }).join('')}</tbody></table></div>`;
}


// ══ COLLAPSIBLE SECTIONS ══════════════════════════════════════
const _collapsedSections=load('flux_collapsed_sections',{});
function toggleSection(sectionId){
  _collapsedSections[sectionId]=!_collapsedSections[sectionId];
  save('flux_collapsed_sections',_collapsedSections);
  applyCollapsedSections();
}
function applyCollapsedSections(){
  Object.entries(_collapsedSections).forEach(([id,collapsed])=>{
    const content=document.getElementById('section-content-'+id);
    const icon=document.getElementById('section-chevron-'+id);
    if(content){content.style.display=collapsed?'none':'block';}
    if(icon){icon.textContent=collapsed?'▸':'▾';}
  });
}


// ══ PROGRESSIVE ONBOARDING TOUR ══════════════════════════════
function startOnboardingTour(){
  if(isTourCompleted())return;
  const steps=[
    {nav:'dashboard',sel:'[data-tab="dashboard"]',title:'Dashboard',body:'Your home base: tasks, energy, and quick stats. Use ＋ New task in the top bar, the FAB, or quick-add to capture work fast.'},
    {nav:'calendar',sel:'[data-tab="calendar"]',title:'Calendar',body:'Month view, A/B cycle days, and weekly activities. Link Google Calendar under Settings if you use it.'},
    {nav:'school',sel:'[data-tab="school"]',title:'School & schedule',body:'Classes, bell schedule, and Vision import — snap a timetable and let AI fill your periods.'},
    {nav:'canvas',sel:'[data-tab="canvas"]',title:'Canvas',body:'Pull assignments and announcements from Canvas, pin pages for Flux AI, and add work to your planner.'},
    {nav:'notes',sel:'[data-tab="notes"]',title:'Notes & flashcards',body:'Subject notes with flashcard mode for cram sessions before tests.'},
    {nav:'timer',sel:'[data-tab="timer"]',title:'Focus timer',body:'Pomodoro-style sessions, subject budgets, and a weekly focus heatmap.'},
    {nav:'ai',sel:'[data-tab="ai"]',title:'Flux AI',body:'Ask anything about your planner — study help, scheduling, and workload. Full context from your snapshot.'},
    {nav:'dashboard',sel:'.view-btn[data-view="list"]',title:'Task views',body:'Switch List, Board, or Timeline on the dashboard to match how you like to work.'},
    {nav:'goals',sel:'[data-tab="goals"]',title:'Extracurriculars',body:'Activities, college list, and milestones — IB/AP progress lives here too when relevant.'},
    {nav:'profile',sel:'[data-tab="profile"]',title:'Profile',body:'Academic snapshot, study DNA, and habits — keep it updated for better AI hints.'},
    {nav:'settings',sel:'[data-tab="settings"]',title:'Settings',body:'Look & theme, accent, sync, account, and replay this tour anytime under Data & info.'},
  ];
  let step=0;
  function cleanupTour(){
    document.removeEventListener('keydown',tourEscHandler);
  }
  function tourEscHandler(e){
    if(e.key!=='Escape')return;
    document.querySelectorAll('.tour-tooltip').forEach(el=>el.remove());
    cleanupTour();
    markTourCompleted();
  }
  document.addEventListener('keydown',tourEscHandler);
  function placeTip(tip,target){
    const rect=target.getBoundingClientRect();
    const pad=12;
    const vw=window.innerWidth, vh=window.innerHeight;
    const tipRect=tip.getBoundingClientRect();
    const w=tipRect.width||320, h=tipRect.height||180;
    const margin=12;
    const spaceBelow=vh-rect.bottom-margin;
    const spaceAbove=rect.top-margin;
    let top;
    if(spaceBelow>=h+pad){
      top=rect.bottom+pad;
    }else if(spaceAbove>=h+pad){
      top=rect.top-h-pad;
    }else{
      top=Math.max(margin,vh-h-margin);
    }
    top=Math.max(margin,Math.min(top,vh-h-margin));
    let left=rect.left+rect.width/2-w/2;
    left=Math.max(margin,Math.min(left,vw-w-margin));
    tip.style.top=Math.round(top)+'px';
    tip.style.left=Math.round(left)+'px';
  }
  function showStep(){
    document.querySelectorAll('.tour-tooltip').forEach(e=>e.remove());
    if(step>=steps.length){cleanupTour();markTourCompleted();return;}
    const s=steps[step];
    const run=()=>{
      const candidates=document.querySelectorAll(s.sel);
      let target=null;
      for(const el of candidates){
        const r=el.getBoundingClientRect();
        if(r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'){target=el;break;}
      }
      if(!target)target=candidates[0];
      if(!target){step++;showStep();return;}
      const tip=document.createElement('div');
      tip.className='tour-tooltip';
      tip.innerHTML=`
        <div class="tour-tooltip__title"><span class="tour-tooltip__step">${step+1}/${steps.length}</span>${esc(s.title)}</div>
        <div class="tour-tooltip__body">${esc(s.body)}</div>
        <div class="tour-tooltip__actions">
          <button type="button" class="tour-tooltip__skip">Skip tour</button>
          <button type="button" class="tour-tooltip__next">${step<steps.length-1?'Next →':'Done ✓'}</button>
        </div>`;
      document.body.appendChild(tip);
      target.style.outline='2px solid rgba(var(--accent-rgb),.6)';
      target.style.outlineOffset='3px';
      try{target.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){target.scrollIntoView();}
      const showAt=()=>{
        if(!document.body.contains(tip))return;
        placeTip(tip,target);
        requestAnimationFrame(()=>tip.classList.add('is-visible'));
      };
      setTimeout(showAt,520);
      let tipScrollRaf=0;
      const onScroll=()=>{
        if(!document.body.contains(tip))return;
        if(tipScrollRaf)return;
        tipScrollRaf=requestAnimationFrame(()=>{
          tipScrollRaf=0;
          if(document.body.contains(tip))placeTip(tip,target);
        });
      };
      const onResize=()=>{
        if(!document.body.contains(tip))return;
        if(tipScrollRaf)return;
        tipScrollRaf=requestAnimationFrame(()=>{
          tipScrollRaf=0;
          if(document.body.contains(tip))placeTip(tip,target);
        });
      };
      window.addEventListener('resize',onResize,{passive:true});
      window.addEventListener('scroll',onScroll,{capture:true,passive:true});
      const cleanupTip=()=>{
        if(tipScrollRaf){cancelAnimationFrame(tipScrollRaf);tipScrollRaf=0;}
        window.removeEventListener('resize',onResize);
        window.removeEventListener('scroll',onScroll,true);
        target.style.outline='';
      };
      tip.querySelector('.tour-tooltip__skip').onclick=()=>{cleanupTip();tip.remove();cleanupTour();markTourCompleted();};
      tip.querySelector('.tour-tooltip__next').onclick=()=>{cleanupTip();tip.remove();step++;showStep();};
    };
    if(s.nav){nav(s.nav);setTimeout(run,500);}else run();
  }
  window._tourStep=()=>{step++;showStep();};
  setTimeout(showStep,1500);
}


// ══ HIGH CONTRAST MODE ════════════════════════════════════════
let _highContrast=load('flux_high_contrast',false);
function toggleHighContrast(){
  _highContrast=!_highContrast;
  save('flux_high_contrast',_highContrast);
  applyHighContrast();
  const btn=document.getElementById('highContrastBtn');
  if(btn){btn.textContent=_highContrast?'High Contrast: ON':'High Contrast: OFF';
    btn.style.background=_highContrast?'rgba(var(--accent-rgb),.15)':'';}
}
function applyHighContrast(){
  if(_highContrast){
    document.documentElement.style.setProperty('--text','#ffffff');
    document.documentElement.style.setProperty('--muted','#aaaaaa');
    document.documentElement.style.setProperty('--muted2','#bbbbbb');
    document.documentElement.style.setProperty('--border','rgba(255,255,255,.3)');
    document.documentElement.style.setProperty('--border2','rgba(255,255,255,.5)');
  }else{
    ['--text','--muted','--muted2','--border','--border2'].forEach(v=>document.documentElement.style.removeProperty(v));
  }
}

// ══ TASK SWIPE GESTURES ═══════════════════════════════════════
function initTaskSwipeGestures(){
  const list=document.getElementById('taskList');if(!list)return;
  let _touchStartX=0,_touchEl=null;
  list.addEventListener('touchstart',e=>{
    _touchEl=e.target.closest('[data-task-id]');
    if(_touchEl)_touchStartX=e.touches[0].clientX;
  },{passive:true});
  list.addEventListener('touchmove',e=>{
    if(!_touchEl)return;
    const dx=e.touches[0].clientX-_touchStartX;
    if(Math.abs(dx)>10){
      _touchEl.style.transform=`translateX(${Math.sign(dx)*Math.min(Math.abs(dx),80)}px)`;
      _touchEl.style.transition='none';
      _touchEl.style.opacity=String(1-Math.abs(dx)/200);
    }
  },{passive:true});
  list.addEventListener('touchend',e=>{
    if(!_touchEl)return;
    const dx=e.changedTouches[0].clientX-_touchStartX;
    _touchEl.style.transition='transform .3s var(--ease-spring),opacity .3s';
    if(dx>60){
      // Swipe right → complete
      const id=parseInt(_touchEl.dataset.taskId);
      _touchEl.style.transform='translateX(100vw)';_touchEl.style.opacity='0';
      setTimeout(()=>toggleTask(id),300);
    }else if(dx<-60){
      // Swipe left → show reschedule
      const id=parseInt(_touchEl.dataset.taskId);
      _touchEl.style.transform='translateX(0)';_touchEl.style.opacity='1';
      openEdit(id);
    }else{
      _touchEl.style.transform='translateX(0)';_touchEl.style.opacity='1';
    }
    _touchEl=null;
  },{passive:true});
}


// ══ LOADING SKELETONS ═════════════════════════════════════════
function showSkeleton(containerId,rows=3,height=36){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML=Array(rows).fill(0).map(()=>
    `<div style="height:${height}px;background:linear-gradient(90deg,var(--card2) 25%,var(--card3,var(--card)) 50%,var(--card2) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:8px;margin-bottom:6px"></div>`
  ).join('');
}


// ══ IMAGE IMPORT FEATURES ══

// Utility: file to base64 (returns just the data part, no prefix)
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>resolve(e.target.result.split(',')[1]);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

// Generic Gemini vision call via edge function
async function callGemini(imageBase64,mimeType,prompt){
  const res=await fetch(API.gemini,{
    method:'POST',headers:await fluxAuthHeaders(),
    body:JSON.stringify({imageBase64,mimeType,prompt})
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Gemini error '+res.status);}
  const data=await res.json();
  return data.text||'';
}

// Import note/assignment guide content from photo
async function importNoteFromPhoto(event){
  const file=event.target.files[0];if(!file)return;
  const resEl=document.getElementById('aiNoteResult');
  resEl.style.display='block';
  resEl.innerHTML='<div style="color:var(--muted2);font-size:.82rem">📷 Reading image with Gemini AI...</div>';
  try{
    const base64=await fileToBase64(file);
    const txt=await callGemini(base64,file.type,
      'This is a student assignment guide, worksheet, or lesson material. Extract all the text and content. Format it clearly with headers and bullet points where appropriate. Preserve all important details including questions, instructions, and due dates.');
    const editor=document.getElementById('noteEditor');
    if(editor){
      const existing=editor.innerHTML;
      editor.innerHTML=existing+(existing?'<hr style="border-color:var(--border);margin:12px 0">':'')+'<p>'+fmtAI(txt)+'</p>';
    }
    resEl.innerHTML='<div style="color:var(--green);font-size:.82rem">✓ Content added to note. Save when ready.</div>';
  }catch(e){
    resEl.innerHTML=`<div style="color:var(--red);font-size:.82rem">Could not read image: ${e.message}</div>`;
  }
}

// Import schedule from PDF or photo (school tab)
async function importScheduleFromPhoto(event,resultElId){
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_SCHEDULE_IMPORT_GATE&&requiresPro('schedulePhotoImport')){
    showUpgradePrompt('schedulePhotoImport','Import your class schedule from a photo with Flux Pro');
    if(event.target)event.target.value='';
    return;
  }
  const file=event.target?.files?.[0];
  if(!file)return;
  bindScheduleImportDropzones();
  const resEl=document.getElementById(resultElId||'schoolImgResult');
  const errBox=document.getElementById('schoolScheduleImportError');
  const overlay=document.getElementById('schoolSchedulePdfOverlay');
  if(errBox){errBox.textContent='';errBox.setAttribute('hidden','');}
  if(resEl){resEl.style.display='block';resEl.innerHTML='<div style="color:var(--muted2);font-size:.82rem;font-family:JetBrains Mono,monospace">📷 Reading schedule with Gemini AI...</div>';}
  let base64;
  let mime;
  try{
    if(isPdfScheduleFile(file)){
      if(overlay)overlay.removeAttribute('hidden');
      await ensurePdfJsLoaded();
      schoolSchedulePdfPages=await pdfFileToPageScreenshots(file);
      if(!schoolSchedulePdfPages.length)throw new Error('No pages in PDF.');
      renderSchoolSchedulePages();
      updateSchoolFileMeta(file,schoolSchedulePdfPages.length);
      base64=schoolSchedulePdfPages[0].dataUrl.split(',')[1];
      mime='image/png';
    }else{
      schoolSchedulePdfPages=[];
      renderSchoolSchedulePages();
      updateSchoolFileMeta(file,1);
      base64=await fileToBase64(file);
      mime=file.type||'image/jpeg';
    }
  }catch(e){
    console.error(e);
    schoolSchedulePdfPages=[];
    renderSchoolSchedulePages();
    if(errBox){errBox.textContent=e.message||'Could not prepare file.';errBox.removeAttribute('hidden');}
    if(resEl)resEl.innerHTML=`<div style="color:var(--red);font-size:.82rem">Could not read file: ${e.message}</div>`;
    if(overlay)overlay.setAttribute('hidden','');
    return;
  }finally{
    if(overlay)overlay.setAttribute('hidden','');
  }
  try{
    const txt=await callGemini(base64,mime,
      'This is a student class schedule image. Extract every class/period. Return ONLY a valid JSON array with no extra text, no markdown, no backticks: [{"period":1,"name":"Chemistry","teacher":"Mr. Smith","room":"204"}]. Number periods 1,2,3... if not shown. Use empty string for missing fields. Return ONLY the JSON array.');
    if(!txt||!txt.trim()){throw new Error('Gemini returned empty response — check your GEMINI_API_KEY in Supabase secrets');}
    let jsonStr=txt.trim();
    jsonStr=jsonStr.replace(/```json/g,'').replace(/```/g,'').trim();
    const start=jsonStr.indexOf('[');
    const end=jsonStr.lastIndexOf(']');
    if(start===-1||end===-1)throw new Error('No class list found in response. Try a clearer photo or first page of the PDF.');
    jsonStr=jsonStr.slice(start,end+1);
    const parsed=JSON.parse(jsonStr);
    if(!Array.isArray(parsed)||!parsed.length)throw new Error('No classes detected. Try a clearer photo of your schedule.');
    classes=parsed.map((c,i)=>({id:Date.now()+i,period:c.period||i+1,name:cleanClassName(c.name||'Class '+(i+1)),teacher:c.teacher||'',room:c.room||''}));
    save('flux_classes',classes);
    renderSchool();populateSubjectSelects();
    if(resEl)resEl.innerHTML=`<div style="color:var(--green);font-size:.82rem">✓ Imported ${classes.length} classes! Check School Info tab.</div>`;
    syncKey('classes',classes);
  }catch(e){
    if(resEl)resEl.innerHTML=`<div style="color:var(--red);font-size:.82rem">Could not read schedule: ${e.message}</div>`;
  }
}

// ══ CANVAS + GMAIL HUB ══

function gmailListContainer(){return document.getElementById('canvasGmailList')||document.getElementById('gmailList');}

function saveCanvasConfig(){
  const nextTok=document.getElementById('canvasToken')?.value.trim()||'';
  if(nextTok&&FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_CANVAS_GATE&&requiresPro('canvasSync')){
    showUpgradePrompt('canvasSync','Pull assignments directly from Canvas into your planner');
    return;
  }
  canvasToken=nextTok;
  canvasUrl=document.getElementById('canvasUrl')?.value.trim()||'';
  save('flux_canvas_token',canvasToken);
  save('flux_canvas_url',canvasUrl);
  try{
    const raw=canvasUrl.trim();
    if(raw){
      const u=new URL(raw.includes('://')?raw:'https://'+raw);
      if(u.hostname)save('flux_canvas_host',u.hostname);
    }
  }catch(e){}
  const b=event?.target;if(b){b.textContent='✓ Saved';setTimeout(()=>b.textContent='Save',1500);}
  renderCanvasHubPanel();
}

function fluxCanvasProxyHost(){
  const h=load('flux_canvas_host',null);
  if(h&&String(h).trim())return String(h).trim();
  const raw=(canvasUrl||'').trim();
  if(!raw)return'';
  try{
    const u=new URL(raw.includes('://')?raw:'https://'+raw);
    return u.hostname||'';
  }catch(e){return'';}
}

async function canvasProxyGet(apiPath){
  if(FLUX_FLAGS.PAYMENTS_ENABLED&&FLUX_FLAGS.ENFORCE_CANVAS_GATE&&requiresPro('canvasSync')){
    showUpgradePrompt('canvasSync','Pull assignments directly from Canvas into your planner');
    throw new Error('Canvas sync requires Flux Pro');
  }
  if(!canvasToken||!canvasUrl)throw new Error('Configure Canvas URL and token first.');
  const host=fluxCanvasProxyHost();
  if(!host)throw new Error('Invalid Canvas URL');
  const p=apiPath.startsWith('/')?apiPath:'/'+apiPath;
  const fullPath=p.startsWith('/api/v1/')?p:('/api/v1'+p);
  const res=await fetch(API.canvas,{
    method:'POST',
    headers:await fluxAuthHeaders(),
    body:JSON.stringify({host,path:fullPath,method:'GET',canvasToken:canvasToken})
  });
  const text=await res.text();
  let data;try{data=JSON.parse(text);}catch(e){throw new Error('Canvas did not return JSON. Check URL and token.');}
  if(data&&typeof data==='object'&&!Array.isArray(data)&&Array.isArray(data.errors))throw new Error(data.errors.map(x=>x.message).join('; '));
  if(!res.ok){
    const err=new Error((data&&data.error)||(data&&data.message)||('Canvas request failed ('+res.status+')'));
    err.status=res.status;
    throw err;
  }
  return data;
}

async function canvasProxyPostForm(apiPath,bodyString){
  if(!canvasToken||!canvasUrl)throw new Error('Canvas not configured');
  const host=fluxCanvasProxyHost();
  if(!host)throw new Error('Invalid Canvas URL');
  const p=apiPath.startsWith('/')?apiPath:'/'+apiPath;
  const fullPath=p.startsWith('/api/v1/')?p:('/api/v1'+p);
  const res=await fetch(API.canvas,{
    method:'POST',
    headers:await fluxAuthHeaders(),
    body:JSON.stringify({host,path:fullPath,method:'POST',canvasToken:canvasToken,body:bodyString,contentType:'application/x-www-form-urlencoded'})
  });
  const text=await res.text();
  let data;try{data=JSON.parse(text);}catch(e){throw new Error(text.slice(0,400));}
  if(data&&data.errors)throw new Error(data.errors.map(e=>e.message).join('; '));
  if(!res.ok){
    const err=new Error(data.message||data.error||('HTTP '+res.status));
    err.status=res.status;
    throw err;
  }
  return data;
}

/** Paginate Canvas JSON array endpoints (page + per_page). */
async function canvasProxyGetPaged(basePath,maxPages=50){
  const all=[];
  for(let page=1;page<=maxPages;page++){
    const sep=basePath.includes('?')?'&':'?';
    const chunk=await canvasProxyGet(basePath+sep+`per_page=100&page=${page}`);
    await new Promise(r=>setTimeout(r,22));
    if(!Array.isArray(chunk)||chunk.length===0)break;
    all.push(...chunk);
    if(chunk.length<100)break;
  }
  return all;
}

function canvasStripHtml(s){
  return String(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}

/** Compact assignment list + instruction excerpts for Flux AI snapshot. */
function buildCanvasHubAssignmentsAISnapshot(maxN){
  if(!fluxCanvasHubData||!Array.isArray(fluxCanvasHubData.assignments))return'';
  const n=Math.max(1,Math.min(80,parseInt(maxN,10)||26));
  const rows=filteredCanvasAssignments().slice().sort((a,b)=>{
    const da=a.due_at||'',db=b.due_at||'';
    if(!da&&!db)return 0;
    if(!da)return 1;
    if(!db)return-1;
    return da.localeCompare(db);
  }).slice(0,n);
  if(!rows.length)return'(no assignments in current time filter — widen "Hide old" or refresh Canvas)';
  const meta=fluxCanvasHubData.fetchedAt?`Last hub sync: ${new Date(fluxCanvasHubData.fetchedAt).toLocaleString()}`:'';
  const lines=rows.map(a=>{
    const due=a.due_at?String(a.due_at).slice(0,10):'no date';
    const desc=canvasStripHtml(a.description||'').slice(0,380);
    return`- [${a.course_name||'Course'}] ${a.name||'Assignment'} — due ${due}${desc?`\n  Excerpt: ${desc}`:''}`;
  });
  return [meta,...lines].join('\n');
}

/** Machine-friendly Canvas hub slice for Flux AI (course ids + due-soon assignments). */
function buildCanvasHubStructuredAIContext(maxItems){
  if(!fluxCanvasHubData||!Array.isArray(fluxCanvasHubData.assignments))return'';
  const n=Math.max(4,Math.min(40,parseInt(maxItems,10)||16));
  const rows=filteredCanvasAssignments().slice().sort((a,b)=>{
    const da=a.due_at||'',db=b.due_at||'';
    if(!da&&!db)return 0;
    if(!da)return 1;
    if(!db)return-1;
    return da.localeCompare(db);
  }).slice(0,n);
  const obj={
    syncedAt:fluxCanvasHubData.fetchedAt||null,
    courses:(fluxCanvasHubData.courses||[]).map(c=>({id:c.id,name:c.name||c.course_code||''})).slice(0,32),
    assignmentsDueSoon:rows.map(a=>({
      id:a.id,
      course_id:a.course_id,
      course:a.course_name||'',
      name:a.name||'',
      due_at:a.due_at||null,
      has_description:!!(a.description&&String(a.description).trim()),
      html_url:a.html_url||null
    }))
  };
  return JSON.stringify(obj);
}

function fluxCanvasPopulateReaderCourses(){
  const sel=document.getElementById('fluxCanvasReaderCourse');
  if(!sel)return;
  if(!fluxCanvasHubData||!Array.isArray(fluxCanvasHubData.courses)){
    sel.innerHTML='<option value="">Sync hub first</option>';
    const asn=document.getElementById('fluxCanvasReaderAssignment');
    if(asn)asn.innerHTML='<option value="">—</option>';
    return;
  }
  sel.innerHTML=fluxCanvasHubData.courses.map(c=>`<option value="${c.id}">${esc(c.name||c.course_code||'Course')}</option>`).join('')||'<option value="">No courses</option>';
  fluxCanvasReaderOnCourseChange();
  const st=document.getElementById('canvasHubFetchStatus');
  if(st&&fluxCanvasHubData.fetchedAt&&!String(st.textContent||'').trim()){
    st.textContent='Cached '+new Date(fluxCanvasHubData.fetchedAt).toLocaleString();
  }
}
window.fluxCanvasPopulateReaderCourses=fluxCanvasPopulateReaderCourses;
window.fluxCanvasHubToolbarSync=async function(){
  if(typeof refreshCanvasHubFullFetch!=='function')return;
  await refreshCanvasHubFullFetch({quietSuccessToast:false});
};

function pinCanvasPageForAI(payload){
  if(!payload||!String(payload.bodyPlain||'').trim()){clearCanvasPageForAI();return;}
  save('flux_canvas_ai_focus',{...payload,bodyPlain:String(payload.bodyPlain).slice(0,120000),updatedAt:Date.now()});
  showToast('Canvas text pinned for Flux AI','success');
}
function clearCanvasPageForAI(){
  save('flux_canvas_ai_focus',null);
  showToast('Cleared Canvas pin for Flux AI','info');
}

function openCanvasReaderForAssignment(courseId,assignmentId){
  if(window.CanvasViews){
    nav('canvas');
    CanvasViews.navigate('assignment',{courseId:+courseId,assignmentId:+assignmentId});
    return;
  }
  _fluxCanvasReaderPending={cid:+courseId,aid:+assignmentId};
  fluxCanvasHubSubTab='canvaswindow';
  save('flux_canvas_hub_tab','canvaswindow');
  if(typeof nav==='function')nav('canvas');
}

async function loadCanvasAssignmentIntoReader(courseId,assignmentId,opts){
  const silent=opts&&opts.silent;
  const ta=document.getElementById('fluxCanvasReaderBody');
  const metaEl=document.getElementById('fluxCanvasReaderMeta');
  if(!courseId||!assignmentId){if(!silent)showToast('Pick a course and assignment','warning');return;}
  if(ta){ta.value='Loading from Canvas…';}
  if(metaEl)metaEl.textContent='…';
  try{
    const raw=await canvasProxyGet(`/courses/${courseId}/assignments/${assignmentId}`);
    const title=raw.name||'Assignment';
    const fromHub=(fluxCanvasHubData?.assignments||[]).find(x=>x.course_id===courseId&&x.id===assignmentId);
    const courseName=(fromHub&&fromHub.course_name)||(fluxCanvasHubData?.courses||[]).find(c=>c.id===courseId)?.name||('Course '+courseId);
    const bodyPlain=canvasStripHtml(raw.description||'').trim()||'(No description text in Canvas for this assignment.)';
    if(ta)ta.value=bodyPlain;
    if(metaEl)metaEl.textContent=`${courseName} · ${title}`;
    const autoPin=document.getElementById('fluxCanvasReaderAutoPin');
    if(!autoPin||autoPin.checked){
      pinCanvasPageForAI({
        title,
        courseName,
        bodyPlain,
        html_url:raw.html_url||'',
        courseId,
        assignmentId
      });
    }
  }catch(e){
    if(ta)ta.value='Could not load: '+(e.message||String(e));
    if(!silent)showToast(e.message||'Canvas load failed','error');
  }
}

function pinReaderTextFromCanvasHub(){
  const ta=document.getElementById('fluxCanvasReaderBody');
  const meta=document.getElementById('fluxCanvasReaderMeta')?.textContent||'';
  const parts=meta.split(' · ');
  const courseName=parts[0]||'';
  const title=parts.length>1?parts.slice(1).join(' · '):'Canvas assignment';
  const body=(ta?.value||'').trim();
  if(!body||body.startsWith('Loading')||body.startsWith('Could not load')){showToast('Load an assignment first, or wait for Canvas to respond','warning');return;}
  pinCanvasPageForAI({title,courseName,bodyPlain:body,html_url:''});
}

function fluxCanvasEmbedGo(){
  const inp=document.getElementById('fluxCanvasIframeUrl');
  const fr=document.getElementById('fluxCanvasEmbedFrame');
  if(!inp||!fr)return;
  let u=(inp.value||'').trim();
  if(!u)return;
  if(!/^https?:\/\//i.test(u))u='https://'+u;
  try{
    const parsed=new URL(u);
    const base=new URL((canvasUrl||'').replace(/\/+$/,''));
    if(parsed.origin!==base.origin){
      if(!confirm('That URL is not on your saved Canvas host. Load it in the frame anyway?'))return;
    }
  }catch(e){}
  save('flux_canvas_embed_url',u);
  fr.src=u;
}
function fluxCanvasEmbedHome(){
  const base=(canvasUrl||'').replace(/\/+$/,'');
  if(!base)return;
  const home=base+'/';
  const inp=document.getElementById('fluxCanvasIframeUrl');
  const fr=document.getElementById('fluxCanvasEmbedFrame');
  if(inp)inp.value=home;
  save('flux_canvas_embed_url',home);
  if(fr)fr.src=home;
}
function fluxCanvasEmbedOpenExternal(){
  const inp=document.getElementById('fluxCanvasIframeUrl');
  const u=(inp?.value||'').trim()||(canvasUrl||'').replace(/\/+$/,'')+'/';
  if(u)window.open(/^https?:\/\//i.test(u)?u:'https://'+u,'_blank','noopener,noreferrer');
}
function fluxCanvasEmbedRefresh(){
  const fr=document.getElementById('fluxCanvasEmbedFrame');
  if(fr&&fr.src)try{fr.contentWindow.location.reload();}catch(e){fr.src=fr.src;}
}

function canvasPassesTimeFilter(iso){
  if(fluxCanvasDueFilterDays<=0)return true;
  if(!iso)return true;
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return true;
  const cutoff=new Date();
  cutoff.setHours(0,0,0,0);
  cutoff.setDate(cutoff.getDate()-fluxCanvasDueFilterDays);
  return d>=cutoff;
}

function filteredCanvasAssignments(){
  if(!fluxCanvasHubData||!Array.isArray(fluxCanvasHubData.assignments))return [];
  return fluxCanvasHubData.assignments.filter(a=>canvasPassesTimeFilter(a.due_at));
}

function filteredCanvasAnnouncements(){
  if(!fluxCanvasHubData||!Array.isArray(fluxCanvasHubData.announcements))return [];
  return fluxCanvasHubData.announcements.filter(an=>canvasPassesTimeFilter(an.posted_at));
}

function mapCanvasAssignmentType(a){
  const n=(a.name||'').toLowerCase();
  if(/quiz|exam|test|assessment/.test(n))return'test';
  if(/project/.test(n))return'project';
  return'hw';
}

function canvasAssignmentTaskExists(cid,aid){
  return tasks.some(t=>t.canvasCourseId===cid&&t.canvasAssignmentId===aid);
}

function canvasQuizTaskExists(cid,qid){
  return tasks.some(t=>t.canvasCourseId===cid&&t.canvasQuizId===qid);
}

function addCanvasQuizToPlanner(courseId,quizId,opts){
  const silent=opts&&opts.silent;
  const skipRender=opts&&opts.skipRender;
  const q=fluxCanvasHubData?.quizzes?.find(x=>x.course_id===courseId&&x.id===quizId);
  if(!q){if(!silent)showToast('Quiz not found — refresh Canvas','warning');return;}
  if(canvasQuizTaskExists(courseId,quizId)){if(!silent)showToast('Already in planner','info');return;}
  const due=q.due_at?q.due_at.slice(0,10):'';
  const name=('📝 '+(q.title||'Quiz')).slice(0,240);
  const t={
    id:Date.now()+Math.random(),
    name,
    date:due,
    subject:'',
    priority:'high',
    type:/test|exam|final/i.test(q.title||'')?'test':'quiz',
    notes:`Canvas quiz · ${q.course_name||'Course'}\n${q.html_url||''}`,
    done:false,rescheduled:0,createdAt:Date.now(),
    canvasCourseId:courseId,
    canvasQuizId:quizId
  };
  t.urgencyScore=calcUrgency(t);
  tasks.unshift(t);save('tasks',tasks);
  if(!skipRender){syncKey('tasks',tasks);renderStats();renderTasks();renderCalendar();renderCountdown();}
  if(!silent)showToast('Added to planner','success');
}

function upsertClassFromCanvasCourse(c,primaryTeacher){
  const name=cleanClassName(c.name||c.course_code||'Course');
  const ex=classes.find(x=>x.canvasCourseId===c.id);
  if(ex){
    ex.name=name;
    if(primaryTeacher)ex.teacher=primaryTeacher;
    return;
  }
  let maxP=0;
  classes.forEach(cl=>{
    const p=parseInt(String(cl.period),10);
    if(!isNaN(p)&&p>maxP)maxP=p;
  });
  const col=SUBJECT_COLORS[classes.length%SUBJECT_COLORS.length];
  classes.push({
    id:Date.now()+Math.random(),
    period:maxP+1,
    name,
    teacher:primaryTeacher||'',
    room:'',
    days:'',
    timeStart:'',
    timeEnd:'',
    color:col,
    canvasCourseId:c.id
  });
}

function upsertTeacherNoteFromCanvas(t,courseList){
  const name=(t.name||'').trim();
  if(!name)return false;
  const cnames=(t.courseIds||[]).map(cid=>{
    const co=(courseList||[]).find(x=>x.id===cid);
    return co?co.name||co.course_code:'';
  }).filter(Boolean).join(', ');
  const noteLine=t.email?`Canvas · ${t.email}`:'Canvas';
  const body=cnames?`${noteLine}\nCourses: ${cnames}`:noteLine;
  const dupe=teacherNotes.find(n=>n.teacher===name&&(n.note||'').includes('Canvas'));
  if(dupe){
    if(cnames&&!(dupe.note||'').includes(cnames))dupe.note=(dupe.note||'')+'\nCourses: '+cnames;
    return false;
  }
  teacherNotes.push({id:Date.now()+Math.random(),teacher:name,note:body});
  return true;
}

function addCanvasAnnouncementAsNoteIfNew(an){
  const aid=an.id;
  if(aid==null||notes.some(n=>n.canvasAnnouncementId===aid))return false;
  const title=('📢 '+(an.title||'Announcement')).slice(0,200);
  const body=canvasStripHtml(an.message||'').slice(0,12000);
  notes.unshift({
    id:Date.now()+Math.random(),
    title,
    body,
    subject:'',
    starred:false,
    flashcards:[],
    createdAt:Date.now(),
    updatedAt:Date.now(),
    canvasAnnouncementId:aid
  });
  return true;
}

function addCanvasDiscussionAsNoteIfNew(disc){
  const id=disc.id;
  if(id==null||notes.some(n=>n.canvasDiscussionId===id))return false;
  const title=(disc.title||'Discussion').slice(0,200);
  const msg=canvasStripHtml(disc.message||'').slice(0,8000);
  const body=`${disc.course_name||'Course'}\n\n${msg||'(Open in Canvas for thread)'}`;
  notes.unshift({
    id:Date.now()+Math.random(),
    title:`💬 ${title}`,
    body,
    subject:'',
    starred:false,
    flashcards:[],
    createdAt:Date.now(),
    updatedAt:Date.now(),
    canvasDiscussionId:id
  });
  return true;
}

function canvasCalendarEventTaskExists(evId){
  return tasks.some(t=>t.canvasCalendarEventId!=null&&String(t.canvasCalendarEventId)===String(evId));
}

function addCanvasCalendarEventTaskIfNew(ev){
  const id=ev.id;
  if(id==null||canvasCalendarEventTaskExists(id))return false;
  if(ev.assignment||ev.assignment_id)return false;
  const title=(ev.title||'Event').slice(0,240);
  const due=ev.start_at?ev.start_at.slice(0,10):'';
  if(!due)return false;
  const t={
    id:Date.now()+Math.random(),
    name:title,
    date:due,
    subject:'',
    priority:'low',
    type:'hw',
    notes:`Canvas calendar\n${ev.html_url||''}`,
    done:false,rescheduled:0,createdAt:Date.now(),
    canvasCalendarEventId:id
  };
  t.urgencyScore=calcUrgency(t);
  tasks.unshift(t);
  return true;
}

async function importEverythingFromCanvas(){
  if(!canvasToken||!canvasUrl){showToast('Configure Canvas URL and token first','warning');return;}
  const st=document.getElementById('canvasHubFetchStatus');
  if(st)st.textContent='Importing — refreshing Canvas…';
  await refreshCanvasHubFullFetch({quietSuccessToast:true});
  if(!fluxCanvasHubData){
    if(st)st.textContent='';
    return;
  }
  const d=fluxCanvasHubData;
  let nClass=0,nTeach=0,nTask=0,nNote=0,nCal=0;

  const teacherFirstByCourse={};
  (d.teachers||[]).forEach(t=>{
    (t.courseIds||[]).forEach(cid=>{
      if(!teacherFirstByCourse[cid])teacherFirstByCourse[cid]=t.name||'';
    });
  });

  for(const c of d.courses||[]){
    const before=classes.some(x=>x.canvasCourseId===c.id);
    upsertClassFromCanvasCourse(c,teacherFirstByCourse[c.id]||'');
    if(!before)nClass++;
  }

  for(const t of d.teachers||[]){
    if(upsertTeacherNoteFromCanvas(t,d.courses))nTeach++;
  }

  const assignIds=new Set((d.assignments||[]).map(a=>a.id));
  for(const a of d.assignments||[]){
    if(canvasAssignmentTaskExists(a.course_id,a.id))continue;
    if(a.due_at){
      addCanvasAssignmentToPlanner(a.course_id,a.id,{silent:true,skipRender:true});
    }else{
      const name=(a.name||'Assignment').slice(0,240);
      const t={
        id:Date.now()+Math.random(),
        name,
        date:'',
        subject:'',
        priority:'low',
        type:mapCanvasAssignmentType(a),
        notes:`Canvas (no due date) · ${a.course_name||'Course'}\n${a.html_url||''}`,
        done:false,rescheduled:0,createdAt:Date.now(),
        canvasCourseId:a.course_id,
        canvasAssignmentId:a.id
      };
      t.urgencyScore=calcUrgency(t);
      tasks.unshift(t);
    }
    nTask++;
  }
  for(const q of d.quizzes||[]){
    if(!q.due_at)continue;
    if(q.assignment_id&&assignIds.has(q.assignment_id))continue;
    if(!canvasQuizTaskExists(q.course_id,q.id)){
      addCanvasQuizToPlanner(q.course_id,q.id,{silent:true,skipRender:true});
      nTask++;
    }
  }

  for(const an of d.announcements||[]){
    if(addCanvasAnnouncementAsNoteIfNew(an))nNote++;
  }
  for(const disc of d.discussions||[]){
    if(addCanvasDiscussionAsNoteIfNew(disc))nNote++;
  }
  for(const ev of d.calendarEvents||[]){
    if(addCanvasCalendarEventTaskIfNew(ev))nCal++;
  }

  syncKey('tasks',tasks);

  save('flux_classes',classes);
  save('flux_teacher_notes',teacherNotes);
  save('tasks',tasks);
  save('flux_notes',notes);
  syncKey('classes',classes);
  syncKey('teacherNotes',teacherNotes);
  syncKey('tasks',tasks);
  syncKey('notes',notes);
  populateSubjectSelects();
  renderSchool();
  renderStats();renderTasks();renderCalendar();renderCountdown();
  if(st)st.textContent='Imported '+new Date().toLocaleTimeString();
  renderCanvasHubPanel();
  showToast(`Imported into Flux: ${nClass} new classes · ${nTeach} teacher notes · ${nTask} tasks · ${nNote} notes · ${nCal} calendar items`,'success');
}

function addCanvasAnnouncementToPlanner(announcementId){
  if(announcementId==null||!Number.isFinite(Number(announcementId)))return;
  const aid=Number(announcementId);
  const an=(fluxCanvasHubData?.announcements||[]).find(x=>x.id===aid);
  if(!an){showToast('Announcement not found — refresh Canvas','warning');return;}
  if(tasks.some(t=>t.canvasAnnouncementId===aid)){showToast('Already in planner','info');return;}
  const title=('📢 '+String(an.title||'Announcement')).slice(0,240);
  const due=an.posted_at?an.posted_at.slice(0,10):'';
  const body=String(an.message||'').replace(/<[^>]+>/g,'').slice(0,800);
  const t={
    id:Date.now()+Math.random(),
    name:title,
    date:due,
    subject:'',
    priority:'low',
    type:'hw',
    notes:`Canvas announcement\n${body}`,
    done:false,rescheduled:0,createdAt:Date.now(),
    canvasAnnouncementId:aid
  };
  t.urgencyScore=calcUrgency(t);
  tasks.unshift(t);save('tasks',tasks);syncKey('tasks',tasks);
  renderStats();renderTasks();renderCalendar();renderCountdown();
  showToast('Added to planner','success');
}

function canvasFluxSubjectKeyFromCourseName(courseName){
  const strip=s=>String(s||'').toLowerCase().replace(/\b(ap|ib|honors|honours)\b/gi,'').replace(/\s+/g,' ').trim();
  const t=strip(cleanClassName(courseName||''));
  if(!t)return'';
  for(const c of classes){
    if(!c.name)continue;
    const cn=strip(cleanClassName(c.name));
    if(!cn)continue;
    if(cn===t||t.includes(cn)||cn.includes(t))return'CLS'+c.id;
  }
  return cleanClassName(courseName||'').slice(0,80);
}
function fluxInferCanvasTaskType(a){
  const st=(a.submission_types||[]).map(x=>String(x).toLowerCase()).join(' ');
  const n=(a.name||'').toLowerCase();
  const desc=String(a.description||'').toLowerCase();
  if(st.includes('online_quiz')||/\bquiz\b/.test(n))return'quiz';
  if(st.includes('online_text_entry')&&/(essay|paper|report)/.test(desc))return'essay';
  if(/\blab\b/.test(n))return'lab';
  if(/\bproject\b/.test(n))return'project';
  if(/\b(test|exam|final)\b/.test(n))return'test';
  return'hw';
}
function fluxCanvasPriorityForAssignment(a){
  const due=a.due_at?new Date(a.due_at):null;
  if(!due||isNaN(+due))return'med';
  const h=(due-Date.now())/3600000;
  const done=a.submission&&a.submission.submitted_at;
  if(h>0&&h<=48&&!done)return'high';
  return'med';
}
async function addCanvasAssignmentToPlanner(courseId,assignmentId,opts){
  const silent=opts&&opts.silent;
  const skipRender=opts&&opts.skipRender;
  if(canvasAssignmentTaskExists(courseId,assignmentId)){
    if(!silent)showToast('Already in your planner ✓','info');
    const existing=tasks.find(x=>x.canvasCourseId===courseId&&x.canvasAssignmentId===assignmentId);
    if(existing){
      const el=document.querySelector(`[data-task-id="${existing.id}"]`);
      if(el){
        el.classList.add('flux-task-canvas-highlight');
        setTimeout(()=>el.classList.remove('flux-task-canvas-highlight'),2400);
      }
    }
    return;
  }
  let a=fluxCanvasHubData?.assignments?.find(x=>x.course_id===courseId&&x.id===assignmentId);
  if(!a){
    try{
      a=await canvasProxyGet(`/courses/${courseId}/assignments/${assignmentId}`);
      const co=(fluxCanvasHubData?.courses||[]).find(c=>c.id===courseId)||(window.CanvasState&&window.CanvasState.courses&&window.CanvasState.courses.find(c=>c.id===courseId));
      a.course_id=courseId;
      a.course_name=(co&&co.name)||(co&&co.course_code)||'Course';
      a.html_url=a.html_url||'';
    }catch(e){
      if(!silent)showToast(e.message||'Could not load assignment','warning');
      return;
    }
  }
  const due=a.due_at?a.due_at.slice(0,10):'';
  const name=(a.name||'Assignment').slice(0,240);
  const subKey=canvasFluxSubjectKeyFromCourseName(a.course_name||'');
  const notesPlain=canvasStripHtml(a.description||'').slice(0,500);
  const t={
    id:Date.now()+Math.random(),
    name,
    date:due,
    subject:subKey,
    priority:fluxCanvasPriorityForAssignment(a),
    type:fluxInferCanvasTaskType(a),
    notes:notesPlain+(a.html_url?('\n'+a.html_url):''),
    estTime:60,
    done:false,rescheduled:0,createdAt:Date.now(),
    canvasCourseId:courseId,
    canvasAssignmentId:assignmentId
  };
  t.urgencyScore=calcUrgency(t);
  tasks.unshift(t);save('tasks',tasks);
  if(!skipRender){syncKey('tasks',tasks);renderStats();renderTasks();renderCalendar();renderCountdown();}
  if(!silent)showToast(`Added '${name.slice(0,48)}' to your planner ✓`,'success');
  if(!silent){
    requestAnimationFrame(()=>{
      try{
        const b=document.querySelector(`.canvas-add-btn[data-canvas-cid="${Number(courseId)}"][data-canvas-aid="${Number(assignmentId)}"]`);
        if(b&&window.FluxAnim?.addToPlannerSuccess)FluxAnim.addToPlannerSuccess(b);
      }catch(e){}
    });
  }
}

function canvasRowKey(c,a){return String(c)+'_'+String(a);}

function canvasToggleSelect(courseId,assignmentId){
  const k=canvasRowKey(courseId,assignmentId);
  if(_canvasHubSel.has(k))_canvasHubSel.delete(k);else _canvasHubSel.add(k);
  renderCanvasHubPanel();
}

function canvasSelectAllFilteredAssignments(){
  _canvasHubSel.clear();
  filteredCanvasAssignments().forEach(a=>_canvasHubSel.add(canvasRowKey(a.course_id,a.id)));
  renderCanvasHubPanel();
}

function canvasClearSelection(){
  _canvasHubSel.clear();
  renderCanvasHubPanel();
}

function addSelectedCanvasAssignmentsToPlanner(){
  let n=0;
  _canvasHubSel.forEach(k=>{
    const[cid,aid]=k.split('_');
    const ci=parseInt(cid,10),ai=parseInt(aid,10);
    if(!canvasAssignmentTaskExists(ci,ai)){
      addCanvasAssignmentToPlanner(ci,ai,{silent:true});
      n++;
    }
  });
  _canvasHubSel.clear();
  renderCanvasHubPanel();
  showToast(n?`Added ${n} to planner`:'No new items added','success');
}

function onCanvasDueFilterChange(v){
  const n=parseInt(v,10);
  fluxCanvasDueFilterDays=Number.isFinite(n)?n:120;
  save('flux_canvas_due_filter',fluxCanvasDueFilterDays);
  _canvasHubSel.clear();
  renderCanvasHubPanel();
}

function setCanvasHubSubTab(t){
  fluxCanvasHubSubTab=t;
  save('flux_canvas_hub_tab',t);
  renderCanvasHubPanel();
}

async function refreshCanvasHubFullFetch(opts){
  const quietToast=opts&&opts.quietSuccessToast;
  const statusEl=document.getElementById('canvasHubFetchStatus');
  const setSt=t=>{if(statusEl)statusEl.textContent=t;};
  setSt('Pulling from Canvas…');
  try{
    let coursesRaw;
    try{
      coursesRaw=await canvasProxyGet('/courses?enrollment_state=active&per_page=100&include[]=term&include[]=total_scores');
    }catch(e1){
      coursesRaw=await canvasProxyGet('/courses?enrollment_state=active&per_page=100&include[]=term');
    }
    if(!Array.isArray(coursesRaw))throw new Error('Unexpected courses response');
    const courses=coursesRaw.filter(c=>c.workflow_state!=='deleted');
    const assignments=[];
    const announcements=[];
    const quizzes=[];
    const discussions=[];
    const calendarEvents=[];
    const teachersMap=new Map();
    const courseScores={};

    for(const c of courses){
      await new Promise(r=>setTimeout(r,26));
      try{
        const list=await canvasProxyGetPaged(`/courses/${c.id}/assignments?bucket=all&include[]=submission`,60);
        list.forEach(a=>{
          assignments.push({...a,course_id:c.id,course_name:c.name||c.course_code||'Course',course_code:c.course_code||''});
        });
      }catch(err){console.warn('Canvas assignments',c.id,err);}

      await new Promise(r=>setTimeout(r,26));
      try{
        const qz=await canvasProxyGetPaged(`/courses/${c.id}/quizzes`,25);
        qz.forEach(q=>{
          if(q.published===false)return;
          quizzes.push({...q,course_id:c.id,course_name:c.name||c.course_code||'Course',course_code:c.course_code||''});
        });
      }catch(err){console.warn('Canvas quizzes',c.id,err);}

      await new Promise(r=>setTimeout(r,26));
      try{
        const dt=await canvasProxyGetPaged(`/courses/${c.id}/discussion_topics`,25);
        dt.forEach(d=>{
          if(d.published===false)return;
          discussions.push({...d,course_id:c.id,course_name:c.name||c.course_code||'Course'});
        });
      }catch(err){console.warn('Canvas discussions',c.id,err);}

      await new Promise(r=>setTimeout(r,26));
      try{
        const ens=await canvasProxyGet(`/courses/${c.id}/enrollments?user_id=self&per_page=20&type[]=StudentEnrollment&include[]=grades`);
        if(Array.isArray(ens)){
          const en=ens.find(x=>String(x.type||'').includes('StudentEnrollment')||String(x.type||'').includes('Student'))||ens[0];
          if(en&&en.grades){
            const gr=en.grades;
            courseScores[c.id]={
              current_grade:gr.current_grade,
              final_grade:gr.final_grade,
              current_score:gr.current_score,
              final_score:gr.final_score,
              html_url:gr.html_url
            };
          }
        }
      }catch(err){console.warn('Canvas enrollment grades',c.id,err);}

      await new Promise(r=>setTimeout(r,26));
      try{
        const ens=await canvasProxyGet(`/courses/${c.id}/enrollments?type[]=teacher&per_page=40&include[]=user`);
        if(Array.isArray(ens)){
          ens.forEach(en=>{
            const u=en.user||{};
            const id=u.id;
            if(!id)return;
            if(!teachersMap.has(id)){
              teachersMap.set(id,{id,name:u.name||u.short_name||('User '+id),email:'',short_name:u.short_name||'',courseIds:[]});
            }
            teachersMap.get(id).courseIds.push(c.id);
          });
        }
      }catch(err){console.warn('Canvas teacher enrollments',c.id,err);}
    }

    await new Promise(r=>setTimeout(r,40));
    try{
      const allEn=await canvasProxyGetPaged('/users/self/enrollments?state[]=active&include[]=grades',25);
      if(Array.isArray(allEn)){
        allEn.forEach(en=>{
          const cid=en.course_id;
          if(!cid||!en.grades)return;
          const gr=en.grades;
          if(courseScores[cid])return;
          courseScores[cid]={
            current_grade:gr.current_grade,
            final_grade:gr.final_grade,
            current_score:gr.current_score,
            final_score:gr.final_score,
            html_url:gr.html_url
          };
        });
      }
    }catch(err){console.warn('Canvas self enrollments',err);}

    for(let i=0;i<courses.length;i+=6){
      const batch=courses.slice(i,i+6);
      const qs=batch.map(cc=>`context_codes[]=course_${cc.id}`).join('&');
      await new Promise(r=>setTimeout(r,34));
      try{
        const ann=await canvasProxyGetPaged(`/announcements?${qs}&active_only=true`,20);
        announcements.push(...ann);
      }catch(err){console.warn('Canvas announcements',err);}
    }

    const today=new Date();
    const start=new Date(today);start.setDate(start.getDate()-30);
    const end=new Date(today);end.setDate(end.getDate()+365);
    const sd=start.toISOString().slice(0,10);
    const ed=end.toISOString().slice(0,10);
    await new Promise(r=>setTimeout(r,36));
    try{
      const cal=await canvasProxyGetPaged(`/users/self/calendar_events?start_date=${sd}&end_date=${ed}`,40);
      if(Array.isArray(cal))calendarEvents.push(...cal);
    }catch(err){
      try{
        const cal2=await canvasProxyGetPaged(`/calendar_events?start_date=${sd}&end_date=${ed}`,40);
        if(Array.isArray(cal2))calendarEvents.push(...cal2);
      }catch(e2){console.warn('Canvas calendar',e2);}
    }

    for(const t of teachersMap.values()){
      await new Promise(r=>setTimeout(r,20));
      try{
        const prof=await canvasProxyGet(`/users/${t.id}/profile`);
        if(prof&&prof.primary_email)t.email=prof.primary_email;
      }catch(e){}
    }

    fluxCanvasHubData={
      fetchedAt:Date.now(),
      courses,
      assignments,
      announcements,
      quizzes,
      discussions,
      calendarEvents,
      courseScores,
      teachers:[...teachersMap.values()]
    };
    try{save('flux_canvas_hub_cache',fluxCanvasHubData);}catch(e){}
    setSt('Updated '+new Date().toLocaleTimeString());
    renderCanvasHubPanel();
    if(typeof window.fluxCanvasPopulateReaderCourses==='function')window.fluxCanvasPopulateReaderCourses();
    if(!quietToast)showToast('Canvas data updated','success');
  }catch(e){
    setSt('');
    showToast(e.message||String(e),'error');
    fluxCanvasHubData=null;
    renderCanvasHubPanel();
    if(typeof window.fluxCanvasPopulateReaderCourses==='function')window.fluxCanvasPopulateReaderCourses();
  }
}

function fluxCanvasReaderOnCourseChange(){
  const cid=parseInt(document.getElementById('fluxCanvasReaderCourse')?.value||'0',10);
  const sel=document.getElementById('fluxCanvasReaderAssignment');
  if(!sel||!fluxCanvasHubData)return;
  const list=(fluxCanvasHubData.assignments||[]).filter(a=>a.course_id===cid);
  sel.innerHTML=list.map(a=>`<option value="${a.id}">${esc(a.name||'Assignment')}</option>`).join('')||'<option value="">No assignments</option>';
}

function renderCanvasHubPanel(){
  if(window.__fluxRenderCanvasPanel)window.__fluxRenderCanvasPanel();
}

async function syncCanvas(){
  if(!canvasToken||!canvasUrl){alert('Enter your Canvas URL and token first.');return;}
  if(!fluxCanvasHubData){
    await refreshCanvasHubFullFetch();
    if(!fluxCanvasHubData)return;
  }
  let added=0;
  for(const a of filteredCanvasAssignments()){
    if(!a.due_at)continue;
    if(canvasAssignmentTaskExists(a.course_id,a.id))continue;
    addCanvasAssignmentToPlanner(a.course_id,a.id,{silent:true});
    added++;
  }
  showToast(added?`Imported ${added} dated assignments`:'Nothing new to import','success');
  renderCanvasHubPanel();
}

// ══ GMAIL PANEL ══

async function ensureGmailTokenFromSession(){
  if(gmailToken)return true;
  const sb=getSB();
  if(!sb)return false;
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(session?.provider_token){
      gmailToken=session.provider_token;
      sessionStorage.setItem('flux_gmail_token',gmailToken);
      return true;
    }
  }catch(e){}
  return !!gmailToken;
}

/** Fills global gmailEmails — usable without Gmail list DOM */
async function refreshGmailEmailsFromApi(){
  await ensureGmailTokenFromSession();
  if(!gmailToken)return false;
  try{
    const res=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=14&q=in:inbox',{
      headers:{'Authorization':`Bearer ${gmailToken}`}
    });
    if(res.status===401){
      gmailToken=null;
      sessionStorage.removeItem('flux_gmail_token');
      return false;
    }
    if(!res.ok)throw new Error('Gmail API error '+res.status);
    const data=await res.json();
    if(!data.messages?.length){gmailEmails=[];try{renderGmailList();}catch(e){}return true;}
    gmailEmails=await Promise.all(data.messages.map(async m=>{
      try{
        const detail=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,{
          headers:{'Authorization':`Bearer ${gmailToken}`}
        });
        const d=await detail.json();
        const headers=d.payload?.headers||[];
        const get=name=>headers.find(h=>h.name===name)?.value||'';
        return{id:m.id,subject:get('Subject'),from:get('From'),date:get('Date'),snippet:d.snippet||''};
      }catch(e){return{id:m.id,subject:'(error)',from:'',date:'',snippet:''};}
    }));
    try{renderGmailList();}catch(e){}
    return true;
  }catch(e){return false;}
}

async function fetchGmailMessages(count=10,filter='all'){
  await ensureGmailTokenFromSession();
  if(!gmailToken)throw new Error('No Gmail token');
  const q=filter==='unread'?'in:inbox is:unread':'in:inbox';
  const res=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(30,count)}&q=${encodeURIComponent(q)}`,{headers:{'Authorization':`Bearer ${gmailToken}`}});
  if(res.status===401){gmailToken=null;sessionStorage.removeItem('flux_gmail_token');throw new Error('Gmail session expired');}
  if(!res.ok)throw new Error('Gmail API '+res.status);
  const data=await res.json();
  if(!data.messages?.length)return [];
  return Promise.all(data.messages.map(async m=>{
    try{
      const detail=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,{headers:{'Authorization':`Bearer ${gmailToken}`}});
      const d=await detail.json();
      const headers=d.payload?.headers||[];
      const get=n=>headers.find(h=>h.name===n)?.value||'';
      return {id:m.id,subject:get('Subject'),from:get('From'),snippet:d.snippet||''};
    }catch(e){return {id:m.id,subject:'',from:'',snippet:''};}
  }));
}

async function fetchSentEmails(n=5){
  await ensureGmailTokenFromSession();
  if(!gmailToken)return [];
  const res=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(15,n)}&q=in:sent`,{headers:{'Authorization':`Bearer ${gmailToken}`}});
  if(!res.ok)return [];
  const data=await res.json();
  if(!data.messages?.length)return [];
  return Promise.all(data.messages.map(async m=>{
    try{
      const detail=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject`,{headers:{'Authorization':`Bearer ${gmailToken}`}});
      const d=await detail.json();
      const sub=(d.payload?.headers||[]).find(h=>h.name==='Subject')?.value||'';
      const sn=d.snippet||'';
      return {id:m.id,subject:sub,snippet:sn,body:sn};
    }catch(e){return {id:m.id,subject:'',snippet:'',body:''};}
  }));
}
window.fetchGmailMessages=fetchGmailMessages;
window.fetchSentEmails=fetchSentEmails;

async function loadGmail(){
  const el=gmailListContainer();if(!el)return;
  await ensureGmailTokenFromSession();
  if(!gmailToken){
    el.innerHTML=`<div class="card" style="text-align:center;padding:28px 20px">
      <div style="font-size:2rem;margin-bottom:12px">📧</div>
      <div style="font-size:.95rem;font-weight:700;margin-bottom:8px">Connect Gmail</div>
      <div style="font-size:.8rem;color:var(--muted2);margin-bottom:20px;line-height:1.6">Sign in with Google to view your school emails and add them as tasks.</div>
      <button onclick="signInWithGoogle()" style="width:100%;padding:12px;display:flex;align-items:center;justify-content:center;gap:10px">
        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Sign in with Google
      </button>
    </div>`;
    return;
  }
  el.innerHTML='<div style="color:var(--muted2);font-size:.82rem;padding:16px;font-family:JetBrains Mono,monospace">Loading emails...</div>';
  const ok=await refreshGmailEmailsFromApi();
  if(!gmailToken){
    el.innerHTML=`<div class="card" style="text-align:center;padding:24px"><div style="color:var(--red);font-size:.85rem;margin-bottom:14px">Gmail session expired.</div><button onclick="signInWithGoogle()" style="padding:10px 20px">Re-connect Gmail</button></div>`;
    return;
  }
  if(!ok){
    el.innerHTML=`<div style="color:var(--red);font-size:.82rem;padding:16px">Could not load Gmail.<br><br><button onclick="signInWithGoogle()" style="padding:8px 16px;font-size:.8rem;margin-top:8px">Re-connect Google</button></div>`;
    return;
  }
  if(!gmailEmails.length){el.innerHTML='<div class="empty">No emails found in inbox.</div>';return;}
  renderGmailList();
}

function renderGmailList(){
  const el=gmailListContainer();if(!el)return;
  if(!gmailEmails.length){el.innerHTML='<div class="empty">No emails found.</div>';return;}
  el.innerHTML=`<div style="font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace;padding:4px 4px 10px">${gmailEmails.length} recent emails · tap + Task to add to planner</div>`
    +gmailEmails.map(e=>`
    <div class="gmail-item">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:.87rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.subject||'(no subject)')}</div>
          <div style="font-size:.72rem;color:var(--muted2);font-family:'JetBrains Mono',monospace;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.from)}</div>
          <div style="font-size:.79rem;color:var(--muted2);margin-top:5px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(e.snippet)}</div>
        </div>
        <button onclick="addEmailAsTask('${e.id}')" style="padding:6px 12px;font-size:.72rem;white-space:nowrap;background:rgba(var(--accent-rgb),.14);border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);flex-shrink:0;border-radius:10px;margin:0">+ Task</button>
      </div>
    </div>`).join('');
}

function addEmailAsTask(id){
  const email=gmailEmails.find(e=>e.id===id);if(!email)return;
  const task={
    id:Date.now(),name:email.subject||'Email task',
    date:'',subject:'',priority:'med',type:'hw',
    notes:`From: ${email.from}\n\n${email.snippet}`,
    done:false,rescheduled:0,createdAt:Date.now()
  };
  task.urgencyScore=calcUrgency(task);
  tasks.unshift(task);save('tasks',tasks);
  renderStats();renderTasks();
  syncKey('tasks',tasks);
  const btn=event?.target;
  if(btn){btn.textContent='✓ Added';btn.style.color='var(--green)';setTimeout(()=>{btn.textContent='+ Task';btn.style.color='var(--accent)';},2000);}
}

function renderGmail(){loadGmail();}

// ══ KANBAN VIEW ══
let _kanbanOpen=false;
function showKanban(){
  if(_kanbanOpen)return;
  _kanbanOpen=true;
  const overlay=document.createElement('div');
  overlay.id='kanbanOverlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:800;background:var(--bg);overflow:auto;animation:fadeIn .2s ease';
  const cols=['todo','inprogress','done'];
  const colLabels={'todo':'📋 To Do','inprogress':'⚡ In Progress','done':'✅ Done'};
  const colColors={'todo':'var(--accent)','inprogress':'var(--gold)','done':'var(--green)'};
  
  // Assign kanban col to tasks
  const tasksWithCol=tasks.map(t=>({...t,kanbanCol:t.kanbanCol||(t.done?'done':'todo')}));
  
  function renderKanban(){
    const cols2=['todo','inprogress','done'];
    cols2.forEach(col=>{
      const el=document.getElementById('kcol-'+col);
      if(!el)return;
      const colTasks=tasksWithCol.filter(t=>t.kanbanCol===col&&!t.done||col==='done'&&t.done);
      const subjs=getSubjects();
      el.innerHTML=colTasks.map(t=>{
        const s=subjs[t.subject];
        const c=s?s.color:'var(--accent)';
        const due=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
        return`<div class="kanban-card" draggable="true" data-id="${t.id}" style="background:var(--card);border:1px solid var(--border);border-left:3px solid ${c};border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:grab;transition:all .15s">
          <div style="font-size:.82rem;font-weight:700;margin-bottom:4px;line-height:1.3">${esc(t.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${s?`<span style="font-size:.62rem;padding:2px 7px;border-radius:20px;background:${c}22;color:${c}">${s.short}</span>`:''}
            ${due?`<span style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${due}</span>`:''}
            ${t.priority==='high'?'<span style="font-size:.6rem;color:var(--red)">●</span>':''}
            ${t.estTime?`<span style="font-size:.62rem;color:var(--muted)">~${t.estTime}m</span>`:''}
          </div>
        </div>`;
      }).join('')||`<div style="padding:16px;text-align:center;color:var(--muted);font-size:.78rem;border:1px dashed var(--border);border-radius:10px">Drop tasks here</div>`;
    });
    // Drag handlers
    document.querySelectorAll('.kanban-card').forEach(card=>{
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('taskId',card.dataset.id);card.setAttribute('data-dragging','true');card.style.opacity='.5';});
      card.addEventListener('dragend',e=>{card.removeAttribute('data-dragging');card.style.opacity='1';});
    });
    document.querySelectorAll('.kanban-col-body').forEach(col=>{
      col.addEventListener('dragover',e=>{e.preventDefault();col.style.background='rgba(var(--accent-rgb),.06)';});
      col.addEventListener('dragleave',()=>{col.style.background='';});
      col.addEventListener('drop',e=>{
        e.preventDefault();col.style.background='';
        const id=parseInt(e.dataTransfer.getData('taskId'));
        const colId=col.dataset.col;
        const t=tasksWithCol.find(x=>x.id===id);
        if(t){
          t.kanbanCol=colId;
          if(colId==='done'&&!t.done){t.done=true;t.completedAt=Date.now();}
          if(colId!=='done'&&t.done){t.done=false;delete t.completedAt;}
          // Update in tasks array
          const orig=tasks.find(x=>x.id===id);
          if(orig){orig.kanbanCol=colId;orig.done=t.done;if(orig.done)orig.completedAt=t.completedAt;else delete orig.completedAt;}
          save('tasks',tasks);renderKanban();
          renderStats();renderTasks();checkAllPanic();
        }
      });
    });
  }
  
  overlay.innerHTML=`
    <div style="max-width:1200px;margin:0 auto;padding:20px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button onclick="closeKanban()" style="background:var(--card2);border:1px solid var(--border2);border-radius:10px;padding:7px 14px;font-size:.8rem;cursor:pointer">← Back</button>
        <div style="font-size:1.1rem;font-weight:800">Kanban Board</div>
        <div style="font-size:.75rem;color:var(--muted)">Drag tasks between columns</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${['todo','inprogress','done'].map(col=>`
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
              <div style="width:8px;height:8px;border-radius:50%;background:${colColors[col]}"></div>
              <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px">${colLabels[col].split(' ').slice(1).join(' ')}</div>
              <div style="margin-left:auto;font-size:.7rem;color:var(--muted)" id="kcount-${col}"></div>
            </div>
            <div class="kanban-col-body" data-col="${col}" id="kcol-${col}" style="min-height:200px;padding:4px;border-radius:12px;transition:background .15s"></div>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  renderKanban();
  // Update counts
  ['todo','inprogress','done'].forEach(col=>{
    const el=document.getElementById('kcount-'+col);
    if(el)el.textContent=tasksWithCol.filter(t=>t.kanbanCol===col||col==='done'&&t.done).length;
  });
}
function closeKanban(){
  const el=document.getElementById('kanbanOverlay');
  if(el)el.remove();
  _kanbanOpen=false;
  renderTasks();renderStats();
}

// ══ WORKLOAD FORECASTING ══
function renderWorkloadForecast(){
  const el=document.getElementById('workloadForecast');if(!el)return;
  const now=new Date();now.setHours(0,0,0,0);
  const days=[];
  for(let i=0;i<7;i++){
    const d=new Date(now);d.setDate(now.getDate()+i);
    const ds=d.toISOString().slice(0,10);
    const dayTasks=tasks.filter(t=>!t.done&&t.date===ds);
    const mins=dayTasks.reduce((s,t)=>s+(t.estTime||20),0);
    const label=i===0?'Today':i===1?'Tmrw':d.toLocaleDateString('en-US',{weekday:'short'});
    days.push({label,mins,count:dayTasks.length,date:ds,tasks:dayTasks});
  }
  const maxMins=Math.max(...days.map(d=>d.mins),0);
  const html=`
    <div class="workload-forecast-block">
    <div class="workload-mins-row">
      ${days.map(d=>{
        const warn=d.mins>180?'<span style="color:var(--red)" title="Heavy day">⚠</span> ':'';
        const txt=d.mins>0?`${d.mins}m`:'';
        return`<div>${warn}${txt}</div>`;
      }).join('')}
    </div>
    <div class="workload-chart" role="img" aria-label="Estimated minutes per day this week">
      ${days.map(d=>{
        const barPx=maxMins>0?Math.max(4,Math.min(95,Math.round((d.mins/maxMins)*95))):4;
        const color=d.mins>180?'var(--red)':d.mins>90?'var(--gold)':'var(--green)';
        const isToday=d.label==='Today';
        return`<div class="workload-bar-wrap">
          <div class="workload-bar-outer" style="height:${barPx}px" title="${d.count} tasks · ${d.mins} min" onclick="showDayTasksPopup('${d.date}')">
            <div class="workload-bar-fill" data-target-height="${barPx}" style="background:${color};opacity:${isToday?1:.72}"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="workload-labels-row">
      ${days.map(d=>`<div class="${d.label==='Today'?'is-today':''}">${d.label}</div>`).join('')}
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;font-size:.65rem;color:var(--muted)">
      <span>🟢 &lt;60min</span><span>🟡 60–3h</span><span>🔴 &gt;3h</span>
    </div></div>`;
  el.innerHTML=html;
  requestAnimationFrame(()=>{
    try{
      const fills=el.querySelectorAll('.workload-bar-fill');
      if(fills.length&&window.FluxAnim?.workloadBarsIn)FluxAnim.workloadBarsIn(Array.from(fills));
    }catch(e){}
  });
  
  // Burnout detection
  const heavyDays=days.filter(d=>d.mins>180).length;
  const overdueTasks=tasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<now).length;
  const burnoutEl=document.getElementById('burnoutWarning');
  if(burnoutEl){
    if(heavyDays>=3||overdueTasks>=4){
      burnoutEl.style.display='block';
      burnoutEl.innerHTML=`<span style="font-size:.85rem">⚠️</span> <div><div style="font-weight:700;font-size:.82rem">Burnout Risk Detected</div><div style="font-size:.72rem;color:var(--muted2);margin-top:2px">${heavyDays>=3?`${heavyDays} heavy days this week`:''}${heavyDays>=3&&overdueTasks>=4?' · ':''}${overdueTasks>=4?`${overdueTasks} overdue tasks`:''} — consider redistributing</div></div>`;
    } else {
      burnoutEl.style.display='none';
    }
  }
}
function showDayTasksPopup(dateStr){
  const dayTasks=tasks.filter(t=>!t.done&&t.date===dateStr);
  if(!dayTasks.length)return;
  const d=new Date(dateStr+'T12:00:00');
  const label=d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const subjs=getSubjects();
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML=`<div style="background:var(--card);border:1px solid var(--border2);border-radius:16px;padding:20px;max-width:360px;width:100%;max-height:70vh;overflow:auto">
    <div style="font-weight:800;margin-bottom:12px">${label}</div>
    ${dayTasks.map(t=>{const s=subjs[t.subject];return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="width:8px;height:8px;border-radius:50%;background:${s?s.color:'var(--accent)'}"></div>
      <div style="flex:1;font-size:.83rem">${esc(t.name)}</div>
      ${t.estTime?`<div style="font-size:.7rem;color:var(--muted)">~${t.estTime}m</div>`:''}
    </div>`}).join('')}
    <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;margin-top:12px;padding:8px">Close</button>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  document.body.appendChild(m);
}

// ══ DEEP WORK MODE ══
let _dwTimer=null,_dwSecs=0,_dwTask=null;
function startDeepWork(taskId){
  const task=taskId?tasks.find(t=>t.id===taskId):tasks.filter(t=>!t.done).sort((a,b)=>(b.urgencyScore||0)-(a.urgencyScore||0))[0];
  if(!task){showToast('No tasks to focus on!');return;}
  _dwTask=task;
  _dwSecs=(task.estTime||25)*60;
  const overlay=document.createElement('div');
  overlay.id='deepWorkOverlay';
  overlay.className='deep-work-bg';
  overlay.style.cssText='position:fixed;inset:0;z-index:8000;background:#000810;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;animation:fadeIn .3s ease';
  const sub=getSubjects()[task.subject];
  const color=sub?sub.color:'var(--accent)';
  overlay.innerHTML=`
    <div style="text-align:center;max-width:480px;padding:20px">
      <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:4px;color:rgba(255,255,255,.3);margin-bottom:20px;font-family:'JetBrains Mono',monospace">Deep Work Mode</div>
      <div style="font-size:clamp(1.2rem,4vw,1.8rem);font-weight:800;color:#fff;margin-bottom:8px;line-height:1.3">${esc(task.name)}</div>
      ${sub?`<div style="font-size:.8rem;color:${color};margin-bottom:24px">${sub.name}</div>`:'<div style="margin-bottom:24px"></div>'}
      <div id="dwTime" style="font-size:clamp(3rem,12vw,6rem);font-weight:800;font-family:'JetBrains Mono',monospace;color:${color};letter-spacing:-2px;margin-bottom:8px">--:--</div>
      <div id="dwProgress" style="width:200px;height:3px;background:rgba(255,255,255,.1);border-radius:2px;margin:0 auto 28px">
        <div id="dwProgressFill" style="height:100%;background:${color};border-radius:2px;transition:width 1s linear;width:100%"></div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button id="dwPauseBtn" onclick="toggleDWTimer()" style="padding:12px 28px;border-radius:50px;background:${color};border:none;color:#fff;font-weight:700;font-size:.9rem;cursor:pointer">Pause</button>
        <button onclick="endDeepWork(true)" style="padding:12px 28px;border-radius:50px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;font-weight:700;font-size:.9rem;cursor:pointer">✓ Done</button>
        <button onclick="endDeepWork(false)" style="padding:12px 16px;border-radius:50px;background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);font-size:.8rem;cursor:pointer">ESC</button>
      </div>
      <div style="margin-top:20px;font-size:.72rem;color:rgba(255,255,255,.2);font-family:'JetBrains Mono',monospace">Press ESC to exit · Stay focused</div>
    </div>`;
  document.body.appendChild(overlay);
  document.addEventListener('keydown',_dwKeyHandler);
  startDWTimer();
  updateDWDisplay();
}
function _dwKeyHandler(e){if(e.key==='Escape')endDeepWork(false);}
let _dwPaused=false;
function startDWTimer(){
  _dwTimer=setInterval(()=>{
    if(_dwPaused)return;
    _dwSecs--;
    updateDWDisplay();
    if(_dwSecs<=0){clearInterval(_dwTimer);endDeepWork(true);}
  },1000);
}
function toggleDWTimer(){
  _dwPaused=!_dwPaused;
  const btn=document.getElementById('dwPauseBtn');
  if(btn)btn.textContent=_dwPaused?'Resume':'Pause';
}
function updateDWDisplay(){
  const el=document.getElementById('dwTime');if(!el)return;
  const m=Math.floor(_dwSecs/60),s=_dwSecs%60;
  el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  const total=(_dwTask?.estTime||25)*60;
  const fill=document.getElementById('dwProgressFill');
  if(fill)fill.style.width=Math.max(0,(_dwSecs/total*100))+'%';
}
function endDeepWork(completed){
  clearInterval(_dwTimer);_dwTimer=null;
  document.removeEventListener('keydown',_dwKeyHandler);
  const overlay=document.getElementById('deepWorkOverlay');
  if(overlay){overlay.style.opacity='0';overlay.style.transition='opacity .3s';setTimeout(()=>overlay.remove(),300);}
  if(completed&&_dwTask){
    const t=tasks.find(x=>x.id===_dwTask.id);
    if(t&&!t.done){t.done=true;t.completedAt=Date.now();spawnConfetti();save('tasks',tasks);renderStats();renderTasks();checkAllPanic();syncKey('tasks',tasks);}
    showToast('🎯 Session complete! Great work.');
  }
  _dwTask=null;_dwSecs=0;_dwPaused=false;
}

// ══ SUBJECT HEALTH DASHBOARD ══
function renderSubjectHealth(){
  const el=document.getElementById('subjectHealth');if(!el)return;
  const subjs=getSubjects();
  if(!Object.keys(subjs).length){el.innerHTML='';return;}
  
  const now=new Date();now.setHours(0,0,0,0);
  const health=Object.entries(subjs).map(([k,s])=>{
    const subTasks=tasks.filter(t=>t.subject===k);
    const overdue=subTasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<now).length;
    const pending=subTasks.filter(t=>!t.done).length;
    const done=subTasks.filter(t=>t.done).length;
    const rate=done+pending>0?Math.round(done/(done+pending)*100):100;
    let status='good';
    if(overdue>=2||rate<40)status='danger';
    else if(overdue>=1||rate<60)status='warning';
    return{key:k,s,overdue,pending,done,rate,status};
  }).filter(h=>h.pending+h.done>0).slice(0,6);
  
  if(!health.length){el.innerHTML='';return;}
  
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
    ${health.map(h=>{
      const statusColor=h.status==='good'?'var(--green)':h.status==='warning'?'var(--gold)':'var(--red)';
      return`<div style="background:var(--card2);border:1px solid ${h.status!=='good'?statusColor+'44':'var(--border)'};border-radius:12px;padding:12px;position:relative">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <div style="width:8px;height:8px;border-radius:50%;background:${h.s.color};flex-shrink:0"></div>
          <div style="font-size:.72rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.s.short)}</div>
          <div style="margin-left:auto;width:6px;height:6px;border-radius:50%;background:${statusColor}"></div>
        </div>
        <div style="font-size:1.05rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${statusColor}">${h.rate}%</div>
        <div style="font-size:.65rem;color:var(--muted);margin-top:4px">${h.pending} pending${h.overdue?` · <span style="color:var(--red)">${h.overdue} overdue</span>`:''}</div>
        <div style="margin-top:6px;height:3px;background:var(--border);border-radius:2px">
          <div style="height:100%;background:${statusColor};border-radius:2px;width:${h.rate}%;transition:width .5s"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ══ PREDICTIVE GAP FILLER ══
function renderGapFiller(){
  const el=document.getElementById('gapFiller');if(!el)return;
  const now=new Date();now.setHours(0,0,0,0);
  const gaps=[];
  for(let i=1;i<=7;i++){
    const d=new Date(now);d.setDate(now.getDate()+i);
    const ds=d.toISOString().slice(0,10);
    const dayCount=tasks.filter(t=>!t.done&&t.date===ds).length;
    if(dayCount===0){
      const label=i===1?'tomorrow':d.toLocaleDateString('en-US',{weekday:'long'});
      gaps.push({label,date:ds,d});
    }
  }
  if(!gaps.length){el.style.display='none';return;}
  
  // Find a task that could be moved
  const moveable=tasks.filter(t=>!t.done&&(!t.date||new Date(t.date+'T00:00:00')>now)).slice(0,3);
  if(!moveable.length){el.style.display='none';return;}
  
  el.style.display='block';
  const gap=gaps[0];
  const suggestion=moveable[0];
  el.innerHTML=`<div style="display:flex;align-items:center;gap:10px">
    <span style="font-size:1rem">💡</span>
    <div style="flex:1;font-size:.78rem">
      <span style="color:var(--muted2)">Free time ${gap.label} —</span> 
      <strong>${esc(suggestion.name)}</strong> 
      <span style="color:var(--muted)">could move here</span>
    </div>
    <button onclick="moveTaskToDate(${suggestion.id},'${gap.date}')" style="padding:4px 10px;font-size:.7rem;background:rgba(var(--accent-rgb),.12);border:1px solid rgba(var(--accent-rgb),.25);color:var(--accent);border-radius:6px;cursor:pointer;white-space:nowrap">Move →</button>
    <button onclick="document.getElementById('gapFiller').style.display='none'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;padding:2px">✕</button>
  </div>`;
}
function moveTaskToDate(id,date){
  const t=tasks.find(x=>x.id===id);
  if(!t)return;
  t.date=date;t.urgencyScore=calcUrgency(t);
  save('tasks',tasks);renderTasks();renderCalendar();renderWorkloadForecast();renderGapFiller();
  syncKey('tasks',tasks);showToast('✓ Task moved');
  document.getElementById('gapFiller').style.display='none';
}

// ══ EFFORT TRACKER ══
function promptEffortTracking(taskId){
  const t=tasks.find(x=>x.id===taskId);
  if(!t||!t.estTime)return;
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML=`<div style="background:var(--card);border:1px solid var(--border2);border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center">
    <div style="font-size:1.1rem;font-weight:800;margin-bottom:8px">⏱ How long did it take?</div>
    <div style="font-size:.8rem;color:var(--muted);margin-bottom:16px">Estimated: ${t.estTime} min</div>
    <input type="number" id="actualTimeInput" placeholder="Actual minutes" min="1" style="width:100%;margin-bottom:12px;text-align:center;font-size:1.1rem" value="${t.estTime}">
    <div style="display:flex;gap:8px">
      <button onclick="saveEffort(${taskId})" style="flex:1">Save</button>
      <button onclick="this.closest('[style*=fixed]').remove()" class="btn-sec" style="flex:1">Skip</button>
    </div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(()=>document.getElementById('actualTimeInput')?.focus(),100);
}
function saveEffort(taskId){
  const actual=parseInt(document.getElementById('actualTimeInput')?.value);
  if(!actual||actual<1)return;
  const t=tasks.find(x=>x.id===taskId);
  if(!t)return;
  t.actualTime=actual;
  const est=t.estTime||0;
  if(est>0){
    const acc=Math.round((Math.min(est,actual)/Math.max(est,actual))*100);
    t.effortAccuracy=acc;
  }
  save('tasks',tasks);
  if(window.FluxEstimateLearn&&t.subject)FluxEstimateLearn.record(t.subject,t.estTime||0,actual);
  document.querySelector('[style*="fixed"][style*="rgba(0,0,0,.5)"]')?.remove();
  showToast(actual>=(t.estTime||0)?'Took longer than expected 📊':'Done faster than expected ⚡');
}

// ══ STUDY ROADMAP GENERATOR ══
function generateStudyRoadmap(taskId){
  const t=tasks.find(x=>x.id===taskId);
  if(!t||!t.date)return;
  const now=new Date();now.setHours(0,0,0,0);
  const due=new Date(t.date+'T00:00:00');
  const daysUntil=Math.floor((due-now)/86400000);
  if(daysUntil<2){showToast('Not enough time for a roadmap');return;}
  
  const sessions=Math.min(daysUntil-1,5);
  const created=[];
  for(let i=1;i<=sessions;i++){
    const d=new Date(now);d.setDate(now.getDate()+Math.floor(i*(daysUntil-1)/sessions));
    const ds=d.toISOString().slice(0,10);
    const sessionNames=['Review notes','Practice problems','Make flashcards','Past paper','Final review'];
    const newTask={
      id:Date.now()+i,
      name:`${sessionNames[(i-1)%5]} — ${t.name}`,
      date:ds,subject:t.subject,priority:'high',type:'study',
      estTime:30,difficulty:t.difficulty||3,notes:'Auto-generated study session',
      subtasks:[],done:false,rescheduled:0,createdAt:Date.now()
    };
    newTask.urgencyScore=calcUrgency(newTask);
    tasks.push(newTask);
    created.push(newTask);
  }
  save('tasks',tasks);renderTasks();renderCalendar();renderWorkloadForecast();
  syncKey('tasks',tasks);
  showToast(`✓ Created ${sessions} study sessions for "${t.name}"`);
}

// ══ PRESENT MODE (Teacher Demo) ══
function startPresentMode(){
  const overlay=document.createElement('div');
  overlay.id='presentMode';
  overlay.style.cssText='position:fixed;inset:0;z-index:9500;background:var(--bg);overflow:auto;animation:fadeIn .3s ease';
  
  const now=new Date();
  const name=localStorage.getItem('flux_user_name')||'Student';
  const focusHrs=Math.round((load('t_minutes',0)||0)/60);
  const totalTasks=tasks.filter(t=>!t.done).length;
  const doneTasks=tasks.filter(t=>t.done).length;
  const rate=totalTasks+doneTasks>0?Math.round(doneTasks/(totalTasks+doneTasks)*100):0;
  const overdue=tasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<now).length;
  const subjs=getSubjects();
  const upcoming=tasks.filter(t=>!t.done&&t.date).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);
  
  // Workload next 7 days
  const days7=[];
  for(let i=0;i<7;i++){
    const d=new Date(now);d.setDate(now.getDate()+i);
    const ds=d.toISOString().slice(0,10);
    const count=tasks.filter(t=>!t.done&&t.date===ds).length;
    days7.push({label:i===0?'Today':d.toLocaleDateString('en-US',{weekday:'short'}),count});
  }
  const maxC=Math.max(...days7.map(d=>d.count),1);
  
  overlay.innerHTML=`
    <div style="max-width:900px;margin:0 auto;padding:40px 24px">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
        <div>
          <div style="font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--text),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent">Flux Planner</div>
          <div style="font-size:.85rem;color:var(--muted);margin-top:4px">${name} · ${now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
        </div>
        <button onclick="document.getElementById('presentMode').remove()" style="padding:8px 20px;border-radius:50px;background:var(--card2);border:1px solid var(--border2)">✕ Exit</button>
      </div>
      
      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        ${[
          [focusHrs+'h','Focus time','var(--accent)'],
          [rate+'%','Completion','var(--green)'],
          [totalTasks,'Pending','var(--gold)'],
          [overdue,'Overdue','var(--red)']
        ].map(([v,l,c])=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;text-align:center">
          <div style="font-size:1.8rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${c}">${v}</div>
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-top:6px">${l}</div>
        </div>`).join('')}
      </div>
      
      <!-- Two columns -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <!-- Upcoming tasks -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:14px">Upcoming Tasks</div>
          ${upcoming.length?upcoming.map(t=>{
            const s=subjs[t.subject];const c=s?s.color:'var(--accent)';
            const due=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
            return`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
              <div style="width:6px;height:6px;border-radius:50%;background:${c};flex-shrink:0"></div>
              <div style="flex:1;font-size:.82rem;font-weight:600">${esc(t.name)}</div>
              <div style="font-size:.7rem;color:var(--muted)">${due}</div>
            </div>`;
          }).join(''):'<div style="color:var(--muted);font-size:.82rem">All caught up! 🎉</div>'}
        </div>
        
        <!-- Workload chart -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:14px">7-Day Workload</div>
          <div style="display:flex;align-items:flex-end;gap:8px;height:80px;margin-bottom:8px">
            ${days7.map(d=>{
              const h=Math.max(4,Math.round((d.count/maxC)*76));
              return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="width:100%;background:var(--accent);border-radius:4px 4px 0 0;height:${h}px;opacity:${d.label==='Today'?1:.6}"></div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:8px">
            ${days7.map(d=>`<div style="flex:1;text-align:center;font-size:.58rem;color:${d.label==='Today'?'var(--accent)':'var(--muted)'};font-family:'JetBrains Mono',monospace">${d.label}</div>`).join('')}
          </div>
        </div>
      </div>
      
      <!-- Subject health -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:14px">Subject Overview</div>
        <div id="presentSubjectHealth"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  
  // Render subject health inside present mode
  const el=document.getElementById('presentSubjectHealth');
  if(el){
    const healthData=Object.entries(subjs).map(([k,s])=>{
      const pending=tasks.filter(t=>!t.done&&t.subject===k).length;
      const done=tasks.filter(t=>t.done&&t.subject===k).length;
      const rate=done+pending>0?Math.round(done/(done+pending)*100):null;
      return{s,pending,done,rate,k};
    }).filter(h=>h.pending>0||h.done>0).slice(0,6);
    if(healthData.length){
      el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:10px">
        ${healthData.map(h=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--card2);border-radius:10px;border:1px solid var(--border)">
          <div style="width:8px;height:8px;border-radius:50%;background:${h.s.color}"></div>
          <div style="font-size:.82rem;font-weight:600">${h.s.name}</div>
          ${h.rate!=null?`<div style="font-size:.78rem;font-family:'JetBrains Mono',monospace;color:var(--accent)">${h.rate}% done</div>`:''}
          ${h.pending?`<div style="font-size:.7rem;color:var(--muted)">${h.pending} open</div>`:''}
        </div>`).join('')}
      </div>`;
    } else {
      el.innerHTML='<div style="color:var(--muted);font-size:.82rem">Add classes and tag tasks by subject to see subject overview</div>';
    }
  }
}

// ── INTELLIGENCE TAB SWITCHER ──
function switchIntelTab(tab, btn){
  ['workload','subjects','gaps'].forEach(t=>{
    const pane=document.getElementById('intelPane-'+t);
    if(pane)pane.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('.intel-tab').forEach(b=>{
    const isActive=b===btn;
    b.style.background=isActive?'rgba(var(--accent-rgb),.12)':'transparent';
    b.style.borderColor=isActive?'rgba(var(--accent-rgb),.3)':'var(--border)';
    b.style.color=isActive?'var(--accent)':'var(--muted)';
    b.classList.toggle('active',isActive);
  });
  // Render the selected tab content
  if(tab==='workload')renderWorkloadForecast();
  if(tab==='subjects')renderSubjectHealth();
  if(tab==='gaps')renderGapFiller();
}

// ════════════════════════════════════════════════════
// FLUX INTELLIGENCE ENGINE v3.0
// 10 Systems: NLP, Risk, MultiView,
// Keyboard Nav, Sessions, Resume,
// Optimistic UI
// ════════════════════════════════════════════════════

// ══ 1. NATURAL LANGUAGE TASK INPUT ══
// Parses: "Physics lab due Tuesday high priority 30min"
const NLP_DAYS={monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:0,
  mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:0,today:0,tomorrow:1};
const NLP_TYPES={test:/\btest\b/i,quiz:/\bquiz\b/i,project:/\bproject\b/i,essay:/\bessay\b/i,lab:/\blab\b/i,exam:/\bexam\b/i,hw:/\bhomework\b|\bhw\b/i};
const NLP_PRI={high:/\bhigh\b|\burgent\b|\basap\b|\bcritical\b/i,low:/\blow\b|\beasy\b/i};

function parseNLTask(text){
  if(!text||!text.trim())return null;
  const result={name:'',priority:'med',date:'',type:'hw',estTime:0,subject:''};
  let t=text.trim();

  // Extract priority
  if(NLP_PRI.high.test(t)){result.priority='high';t=t.replace(NLP_PRI.high,'').trim();}
  else if(NLP_PRI.low.test(t)){result.priority='low';t=t.replace(NLP_PRI.low,'').trim();}

  // Extract type
  for(const[type,re] of Object.entries(NLP_TYPES)){if(re.test(t)){result.type=type;break;}}

  // Extract time estimate: "30min", "1h", "2 hours"
  const timeMatch=t.match(/(\d+)\s*(min(?:utes?)?|h(?:ours?)?)/i);
  if(timeMatch){
    result.estTime=timeMatch[2].toLowerCase().startsWith('h')?parseInt(timeMatch[1])*60:parseInt(timeMatch[1]);
    t=t.replace(timeMatch[0],'').trim();
  }

  // Extract due date: "due Tuesday", "by Friday", "tomorrow", "today"
  const dateMatch=t.match(/(?:due|by|on)\s+(\w+)|^(today|tomorrow)$/i)||t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i);
  if(dateMatch){
    const dayWord=(dateMatch[1]||dateMatch[2]||dateMatch[0]).toLowerCase();
    const offset=NLP_DAYS[dayWord];
    if(offset!==undefined){
      const d=new Date(TODAY);
      if(dayWord==='today'){}
      else if(dayWord==='tomorrow')d.setDate(d.getDate()+1);
      else{
        const current=d.getDay();
        let diff=offset-current;
        if(diff<=0)diff+=7;
        d.setDate(d.getDate()+diff);
      }
      result.date=d.toISOString().slice(0,10);
    }
    t=t.replace(dateMatch[0],'').replace(/due|by|on/gi,'').trim();
  }

  // Match subject from classes
  const subjs=getSubjects();
  for(const[key,s] of Object.entries(subjs)){
    if(t.toLowerCase().includes(s.name.toLowerCase())||t.toLowerCase().includes(key.toLowerCase())){
      result.subject=key;
      t=t.replace(new RegExp(s.name,'gi'),'').replace(new RegExp(key,'gi'),'').trim();
      break;
    }
  }

  // Remaining text = task name
  result.name=t.replace(/\s+/g,' ').trim()||text.trim();
  return result;
}

function addTaskFromNL(text){
  const parsed=parseNLTask(text);
  if(!parsed||!parsed.name)return false;
  const task={
    id:Date.now()+Math.random(),
    name:parsed.name,priority:parsed.priority,
    date:parsed.date,type:parsed.type,
    estTime:parsed.estTime,subject:parsed.subject,
    done:false,rescheduled:0,createdAt:Date.now(),urgencyScore:0,difficulty:3
  };
  task.urgencyScore=calcUrgency(task);
  // Optimistic UI — add immediately
  tasks.unshift(task);
  renderStats();renderTasks();renderCalendar();renderCountdown();
  checkAllPanic();
  // Background sync
  save('tasks',tasks);syncKey('tasks',tasks);
  showToast(`✓ "${parsed.name}" added${parsed.date?' — due '+new Date(parsed.date+'T00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):''}${parsed.priority==='high'?' 🔴':''}`);
  return true;
}

// ══ 2. DEADLINE RISK PREDICTOR ══
function calcDeadlineRisk(task){
  if(!task.date||task.done)return 0;
  const now=new Date();
  const due=new Date(task.date+'T23:59:00');
  const hoursLeft=(due-now)/3600000;
  if(hoursLeft<0)return 1; // overdue = 100%
  const estH=(task.estTime||30)/60;
  const difficulty=(task.difficulty||3)/5;
  // Risk formula: effort / time_available * difficulty weight
  const baseRisk=Math.min(1,(estH/(hoursLeft+0.01))*difficulty*1.4);
  // Boost risk if rescheduled multiple times
  const reschedBoost=Math.min(0.3,(task.rescheduled||0)*0.08);
  return Math.min(1,baseRisk+reschedBoost);
}

function getRiskLabel(r){
  if(r>=0.8)return{label:'Critical',color:'var(--red)',bg:'rgba(255,77,109,.12)'};
  if(r>=0.5)return{label:'At Risk',color:'var(--gold)',bg:'rgba(245,166,35,.1)'};
  if(r>=0.25)return{label:'Watch',color:'var(--accent)',bg:'rgba(var(--accent-rgb),.08)'};
  return null;
}

// ══ 3. MULTI-VIEW SYSTEM ══
let currentView='list'; // list | kanban | timeline

function switchView(view){
  if(view==='workload')view='list';
  if(view==='kanban')view='list';
  currentView=view;
  save('flux_view',view);
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const tl=document.getElementById('taskList');
  if(tl){
    tl.classList.remove('flux-view-swap');
    void tl.offsetWidth;
    tl.classList.add('flux-view-swap');
    setTimeout(()=>tl.classList.remove('flux-view-swap'),420);
  }
  renderCurrentView();
}

function renderCurrentView(){
  if(currentView==='kanban')renderKanban();
  else if(currentView==='timeline')renderTimeline();
  else renderTasks();
}

function renderKanban(){
  const el=document.getElementById('taskList');if(!el)return;
  const cols={todo:tasks.filter(t=>!t.done&&!t.inProgress),
    inprogress:tasks.filter(t=>t.inProgress&&!t.done),
    done:tasks.filter(t=>t.done)};
  el.style.display='grid';
  el.style.gridTemplateColumns='repeat(3,1fr)';
  el.style.gap='12px';
  el.style.alignItems='start';
  const subjs=getSubjects();
  const col=(title,items,colKey,accent)=>`
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:12px;min-height:200px" data-kanban-col="${colKey}"
      ondragover="event.preventDefault()" ondrop="kanbanDrop(event,'${colKey}')">
      <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:1.5px;color:${accent};font-family:'JetBrains Mono',monospace;margin-bottom:10px;display:flex;align-items:center;gap:6px">
        <span style="width:6px;height:6px;border-radius:50%;background:${accent};display:inline-block"></span>${title} <span style="color:var(--muted)">(${items.length})</span>
      </div>
      ${items.map(t=>{
        const sub=subjs[t.subject];
        return`<div draggable="true" data-task-id="${t.id}" ondragstart="kanbanDragStart(event,${t.id})"
          style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;cursor:grab;transition:all .2s;position:relative;overflow:hidden"
          onmouseenter="this.style.transform='translateY(-2px)';this.style.borderColor='rgba(var(--accent-rgb),.3)'"
          onmouseleave="this.style.transform='';this.style.borderColor=''">
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${t.priority==='high'?'var(--red)':t.priority==='low'?'var(--green)':'var(--gold)'}"></div>
          <div style="padding-left:8px">
            <div style="font-size:.84rem;font-weight:600;margin-bottom:4px">${esc(t.name)}</div>
            ${sub?`<span style="font-size:.65rem;padding:2px 7px;border-radius:6px;background:${sub.color}22;color:${sub.color};font-family:'JetBrains Mono',monospace">${sub.short}</span>`:''}
            ${t.date?`<span style="font-size:.65rem;color:var(--muted2);margin-left:4px;font-family:'JetBrains Mono',monospace">📅 ${new Date(t.date+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`:''}
            <div style="display:flex;justify-content:flex-end;margin-top:6px">
              <button onclick="toggleTask(${t.id})" style="font-size:.65rem;padding:3px 8px;background:rgba(var(--green-rgb),.1);border:1px solid rgba(var(--green-rgb),.2);color:var(--green);border-radius:6px;cursor:pointer;transform:none;box-shadow:none">Done</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  el.innerHTML=col('To Do',cols.todo,'todo','var(--accent)')+col('In Progress',cols.inprogress,'inprogress','var(--gold)')+col('Done',cols.done,'done','var(--green)');
}

let _kanbanDragId=null;
function kanbanDragStart(e,id){_kanbanDragId=id;e.dataTransfer.effectAllowed='move';}
function kanbanDrop(e,colKey){
  e.preventDefault();
  if(!_kanbanDragId)return;
  const task=tasks.find(t=>t.id===_kanbanDragId);
  if(!task)return;
  if(colKey==='done'){task.done=true;task.inProgress=false;}
  else if(colKey==='inprogress'){task.done=false;task.inProgress=true;}
  else{task.done=false;task.inProgress=false;}
  save('tasks',tasks);renderCurrentView();checkAllPanic();syncKey('tasks',tasks);
  _kanbanDragId=null;
}

function renderTimeline(){
  const el=document.getElementById('taskList');if(!el)return;
  el.style.display='block';el.style.gridTemplateColumns='';el.style.gap='';el.style.alignItems='';
  const withDates=tasks.filter(t=>t.date&&!t.done).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const noDates=tasks.filter(t=>!t.date&&!t.done);
  if(!withDates.length&&!noDates.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">No upcoming tasks</div><div class="empty-sub">Add tasks with due dates to see the timeline</div></div>';
    return;
  }
  // Group by date
  const byDate={};
  withDates.forEach(t=>{if(!byDate[t.date])byDate[t.date]=[];byDate[t.date].push(t);});
  const subjs=getSubjects();
  const now=new Date();now.setHours(0,0,0,0);
  el.innerHTML=Object.entries(byDate).map(([date,dayTasks])=>{
    const d=new Date(date+'T00:00');
    const isToday=d.getTime()===now.getTime();
    const isPast=d<now;
    const diff=Math.round((d-now)/86400000);
    const label=isToday?'Today':diff===1?'Tomorrow':d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    return`<div style="display:flex;gap:12px;margin-bottom:16px">
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
        <div style="width:10px;height:10px;border-radius:50%;background:${isPast?'var(--red)':isToday?'var(--accent)':'var(--border2)'};border:2px solid ${isPast?'var(--red)':isToday?'var(--accent)':'var(--border2)'};margin-top:14px"></div>
        <div style="flex:1;width:1px;background:var(--border);margin-top:4px"></div>
      </div>
      <div style="flex:1">
        <div style="font-size:.72rem;font-weight:700;color:${isPast?'var(--red)':isToday?'var(--accent)':'var(--muted2)'};font-family:'JetBrains Mono',monospace;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${label}</div>
        ${dayTasks.map(t=>{
          const sub=subjs[t.subject];
          const risk=calcDeadlineRisk(t);const rl=getRiskLabel(risk);
          return`<div style="background:var(--card);border:1px solid ${rl?rl.color+'44':'var(--border)'};border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;transition:all .2s"
            onmouseenter="this.style.transform='translateX(3px)'" onmouseleave="this.style.transform=''">
            <div style="width:3px;height:100%;min-height:36px;border-radius:2px;background:${t.priority==='high'?'var(--red)':t.priority==='low'?'var(--green)':'var(--gold)'};flex-shrink:0;align-self:stretch;margin:-10px 0 -10px -12px;border-radius:10px 0 0 10px"></div>
            <div onclick="toggleTask(${t.id})" style="width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border2);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s"
              onmouseenter="this.style.borderColor='var(--green)'" onmouseleave="this.style.borderColor=''"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.85rem;font-weight:600">${esc(t.name)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
                ${sub?`<span style="font-size:.65rem;padding:1px 7px;border-radius:5px;background:${sub.color}22;color:${sub.color}">${sub.short}</span>`:''}
                ${t.estTime?`<span style="font-size:.65rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">⏱${t.estTime}m</span>`:''}
                ${rl?`<span style="font-size:.65rem;padding:1px 7px;border-radius:5px;background:${rl.bg};color:${rl.color};font-weight:700">${rl.label}</span>`:''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('')+
  (noDates.length?`<div style="margin-top:8px;padding-top:12px;border-top:1px solid var(--border)">
    <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-family:'JetBrains Mono',monospace;margin-bottom:8px">No due date</div>
    ${noDates.map(t=>`<div style="padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:5px;font-size:.84rem;display:flex;align-items:center;gap:8px">
      <div onclick="toggleTask(${t.id})" style="width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border2);cursor:pointer;flex-shrink:0"></div>
      ${esc(t.name)}</div>`).join('')}
  </div>`:'');
}

// ══ 4. FULL KEYBOARD NAVIGATION ══
function initFullKeyboardNav(){
  let focusIdx=-1;
  const getFocusable=()=>[...document.querySelectorAll('.nav-item,.bnav-item,button:not([disabled]),.task-item,.card')].filter(el=>el.offsetParent!==null&&!el.closest('#splash')&&!el.closest('#loginScreen'));

  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;
    const inInput=['INPUT','TEXTAREA','SELECT'].includes(tag);
    if(inInput)return;

    if(e.key==='Tab'){
      e.preventDefault();
      const els=getFocusable();
      if(!els.length)return;
      focusIdx=e.shiftKey?(focusIdx-1+els.length)%els.length:(focusIdx+1)%els.length;
      els[focusIdx]?.focus();
      els[focusIdx]?.scrollIntoView({block:'nearest',behavior:'smooth'});
    }

    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      const items=[...document.querySelectorAll('.task-item')];
      if(!items.length)return;
      const cur=items.findIndex(el=>el===document.activeElement||el.contains(document.activeElement));
      const next=e.key==='ArrowDown'?Math.min(cur+1,items.length-1):Math.max(cur-1,0);
      items[next]?.focus();items[next]?.scrollIntoView({block:'nearest'});
      e.preventDefault();
    }

    if(e.key==='Enter'&&document.activeElement?.classList.contains('task-item')){
      const id=parseInt(document.activeElement.dataset.taskId);
      if(id)toggleTask(id);
    }

    if(e.key==='Delete'&&document.activeElement?.classList.contains('task-item')){
      const id=parseInt(document.activeElement.dataset.taskId);
      if(id&&confirm('Delete this task?'))deleteTask(id);
    }

    // Number keys to navigate sections
    if(!e.metaKey&&!e.ctrlKey&&!e.altKey){
      const sectionKeys={'1':'dashboard','2':'calendar','3':'ai','4':'toolbox','5':'notes','6':'timer'};
      if(sectionKeys[e.key])nav(sectionKeys[e.key]);
    }
  });

  // Make task items focusable
  document.getElementById('taskList')?.addEventListener('DOMSubtreeModified',()=>{
    document.querySelectorAll('.task-item').forEach(el=>{
      if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','0');
    });
  });
}

// ══ 7. SESSION TRACKING ══
let _sessionStart=null,_sessionTasksDone=0;

function startSession(){
  _sessionStart=Date.now();
  _sessionTasksDone=0;
  save('flux_session_start',_sessionStart);
  showToast('📍 Session started — focus up!','info');
}

function endSession(){
  if(!_sessionStart)return;
  const dur=Math.round((Date.now()-_sessionStart)/60000);
  const session={start:_sessionStart,end:Date.now(),durationMin:dur,tasksDone:_sessionTasksDone};
  const sessions=load('flux_sessions',[]);
  sessions.push(session);if(sessions.length>50)sessions.shift();
  save('flux_sessions',sessions);
  _sessionStart=null;save('flux_session_start',null);
  showToast(`✅ Session ended — ${dur}min, ${_sessionTasksDone} tasks done`);
  renderSessionStats();
}

function renderSessionStats(){
  const el=document.getElementById('sessionStatsCard');if(!el)return;
  const sessions=load('flux_sessions',[]);
  if(!sessions.length){el.innerHTML='<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">No sessions yet</div><div class="empty-sub">Start a session to track your work</div></div>';return;}
  const totalMin=sessions.reduce((s,x)=>s+(x.durationMin||0),0);
  const avgMin=Math.round(totalMin/sessions.length);
  const totalDone=sessions.reduce((s,x)=>s+(x.tasksDone||0),0);
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
      <div style="text-align:center;padding:12px 8px;background:rgba(var(--accent-rgb),.08);border-radius:10px">
        <div style="font-size:1.4rem;font-weight:800;color:var(--accent);font-family:'JetBrains Mono',monospace">${sessions.length}</div>
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Sessions</div>
      </div>
      <div style="text-align:center;padding:12px 8px;background:rgba(var(--green-rgb),.08);border-radius:10px">
        <div style="font-size:1.4rem;font-weight:800;color:var(--green);font-family:'JetBrains Mono',monospace">${avgMin}m</div>
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Avg Length</div>
      </div>
      <div style="text-align:center;padding:12px 8px;background:rgba(var(--gold-rgb),.08);border-radius:10px">
        <div style="font-size:1.4rem;font-weight:800;color:var(--gold);font-family:'JetBrains Mono',monospace">${totalDone}</div>
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Tasks Done</div>
      </div>
    </div>
    <div style="font-size:.72rem;color:var(--muted2);font-family:'JetBrains Mono',monospace">
      ${sessions.slice(-3).reverse().map(s=>`<div style="padding:5px 0;border-bottom:1px solid var(--border)">
        ${new Date(s.start).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${s.durationMin}min · ${s.tasksDone} tasks
      </div>`).join('')}
    </div>`;
}

// Track task completions in session
const _origToggleTask=window.toggleTask||function(){};

// ══ 8. INTERRUPT RECOVERY ══
function saveResumptionState(){
  const active=tasks.filter(t=>!t.done&&t.inProgress)[0]||tasks.filter(t=>!t.done)[0];
  if(active){save('flux_resume_task',active.id);save('flux_resume_time',Date.now());}
}

function checkResumption(){
  const resumeId=load('flux_resume_task',null);
  const resumeTime=load('flux_resume_time',null);
  if(!resumeId||!resumeTime)return;
  const elapsed=Date.now()-resumeTime;
  if(elapsed<5*60*1000)return; // less than 5 min, no need to resume
  const task=tasks.find(t=>t.id===resumeId&&!t.done);
  if(!task)return;
  // Show resume card
  const el=document.getElementById('resumeCard');
  if(el){
    el.style.display='flex';
    const nameEl=document.getElementById('resumeTaskName');
    if(nameEl)nameEl.textContent=task.name;
    el.dataset.taskId=resumeId;
  }
}

function dismissResume(){
  const el=document.getElementById('resumeCard');if(el)el.style.display='none';
  save('flux_resume_task',null);
}

function resumeTask(){
  const el=document.getElementById('resumeCard');if(!el)return;
  const id=parseInt(el.dataset.taskId);
  const task=tasks.find(t=>t.id===id);
  if(task){
    nav('dashboard');
    setTimeout(()=>{
      const taskEl=document.querySelector(`[data-task-id="${id}"]`);
      if(taskEl){taskEl.scrollIntoView({behavior:'smooth',block:'center'});taskEl.style.boxShadow='0 0 0 2px var(--accent)';setTimeout(()=>taskEl.style.boxShadow='',2000);}
    },200);
  }
  el.style.display='none';
}

// ══ 9. OPTIMISTIC UI ══
function optimisticToggleTask(id){
  const task=tasks.find(t=>t.id===id);if(!task)return;
  // Instant UI update
  const el=document.querySelector(`[data-task-id="${id}"]`);
  if(el){
    el.style.opacity=task.done?'1':'.45';
    const check=el.querySelector('.check');
    if(check){check.classList.toggle('done',!task.done);check.textContent=task.done?'':' ✓';}
    const txt=el.querySelector('.task-text');
    if(txt)txt.classList.toggle('done',!task.done);
  }
  // Update state
  task.done=!task.done;
  if(task.done){task.completedAt=Date.now();spawnConfetti();_sessionTasksDone++;}
  // Background save + sync (non-blocking)
  save('tasks',tasks);
  syncKey('tasks',tasks);
  // Deferred full render
  setTimeout(()=>{renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();},300);
}

// ══ WIRE INTO EXISTING SYSTEMS ══
// Override renderTasks to add risk badges + make items focusable + show in right view
const _baseRenderTasks=window.renderTasks;
window.renderTasks=function(){
  if(currentView==='kanban'){renderKanban();return;}
  if(currentView==='timeline'){renderTimeline();return;}
  _baseRenderTasks?.();
  // Add risk badges after render
  requestAnimationFrame(()=>{
    document.querySelectorAll('[data-task-id]').forEach(el=>{
      el.setAttribute('tabindex','0');
      const id=parseInt(el.dataset.taskId);
      const task=tasks.find(t=>t.id===id);
      if(!task||task.done)return;
      const risk=calcDeadlineRisk(task);
      const rl=getRiskLabel(risk);
      if(rl){
        const existing=el.querySelector('.risk-badge');
        if(!existing){
          const badge=document.createElement('span');
          badge.className='risk-badge';
          badge.style.cssText=`font-size:.62rem;padding:2px 7px;border-radius:6px;background:${rl.bg};color:${rl.color};font-family:'JetBrains Mono',monospace;font-weight:700;margin-left:6px;flex-shrink:0`;
          badge.textContent=rl.label;
          const tags=el.querySelector('.task-tags');if(tags)tags.appendChild(badge);
        }
      }
      // Panic glow
      if(rl?.label==='Critical'){
        el.style.boxShadow=`0 0 0 1px rgba(255,77,109,.25),0 4px 20px rgba(255,77,109,.1)`;
        el.style.borderColor='rgba(255,77,109,.25)';
      }
    });
  });
};

const _baseKB=window.initKeyboardShortcuts;
window.initKeyboardShortcuts=function(){
  _baseKB?.();
  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key==='s'||e.key==='S'){e.preventDefault();if(_sessionStart)endSession();else startSession();}
  });
};

// Save resumption state periodically
setInterval(saveResumptionState,60000);

// Init all new systems on app start
function initIntelligenceEngine(){
  currentView=load('flux_view','list');
  if(currentView==='workload'||currentView==='kanban'){currentView='list';save('flux_view','list');}
  initFullKeyboardNav();
  // initListControls removed
  checkResumption();
  renderSessionStats();
  // Restore view toggle state
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
}

// (Density/width controls removed)


// ══════════════════════════════════════════════════════════════
// ══ FLUX V4 — NEURO-PREDICTIVE SYSTEMS ══════════════════════
// ══════════════════════════════════════════════════════════════

// ══ EVENT BUS ════════════════════════════════════════════════
const FluxBus={_h:{},on(e,fn){(this._h[e]=this._h[e]||[]).push(fn);},off(e,fn){this._h[e]=(this._h[e]||[]).filter(f=>f!==fn);},emit(e,d){(this._h[e]||[]).forEach(fn=>{try{fn(d);}catch(err){console.warn('FluxBus error on '+e,err);}});}};

// ══ TASK DEPENDENCY SYSTEM ═══════════════════════════════════
function addDependency(taskId,blockedById){
  const t=tasks.find(x=>x.id===taskId);
  const blocker=tasks.find(x=>x.id===blockedById);
  if(!t||!blocker||taskId===blockedById)return;
  if(!t.blockedBy)t.blockedBy=[];
  if(t.blockedBy.includes(blockedById))return;
  t.blockedBy.push(blockedById);
  save('tasks',tasks);renderTasks();syncKey('tasks',tasks);
  showToast('🔗 Dependency added','info');
}
function removeDependency(taskId,blockedById){
  const t=tasks.find(x=>x.id===taskId);if(!t||!t.blockedBy)return;
  t.blockedBy=t.blockedBy.filter(id=>id!==blockedById);
  save('tasks',tasks);renderTasks();syncKey('tasks',tasks);
}
function isBlocked(task){
  if(!task.blockedBy||!task.blockedBy.length)return false;
  return task.blockedBy.some(id=>{const b=tasks.find(x=>x.id===id);return b&&!b.done;});
}
function getBlockerNames(task){
  if(!task.blockedBy)return[];
  return task.blockedBy.map(id=>tasks.find(x=>x.id===id)).filter(b=>b&&!b.done).map(b=>b.name);
}
function getDependentTasks(taskId){
  return tasks.filter(t=>t.blockedBy&&t.blockedBy.includes(taskId)&&!t.done);
}
function renderDepBadge(task){
  if(!isBlocked(task))return'';
  const blockers=getBlockerNames(task);
  return `<span class="dep-badge" title="Blocked by: ${blockers.map(esc).join(', ')}" style="display:inline-flex;align-items:center;gap:3px;font-size:.6rem;padding:2px 6px;border-radius:6px;background:rgba(255,77,109,.12);border:1px solid rgba(255,77,109,.2);color:var(--red);font-weight:600;cursor:help">🔒 ${blockers.length}</span>`;
}
function renderDepSelector(taskId){
  const t=tasks.find(x=>x.id===taskId);if(!t)return'';
  const available=tasks.filter(x=>x.id!==taskId&&!x.done&&!(t.blockedBy||[]).includes(x.id));
  if(!available.length)return'<div style="font-size:.75rem;color:var(--muted)">No available tasks to depend on</div>';
  return available.slice(0,8).map(a=>`<button onclick="addDependency(${taskId},${a.id})" style="display:block;width:100%;text-align:left;padding:6px 10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.78rem;cursor:pointer;margin-bottom:4px;transition:all .15s;transform:none;box-shadow:none" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">${esc(a.name)}</button>`).join('');
}

// Wire dependency unlock into task completion
FluxBus.on('task_completed',function(task){
  const unlocked=getDependentTasks(task.id);
  if(unlocked.length){
    const names=unlocked.map(t=>t.name).slice(0,3);
    showToast('🔓 Unlocked: '+names.join(', '),'success');
    requestAnimationFrame(()=>{
      try{
        const els=unlocked.map(t=>document.querySelector(`[data-task-id="${t.id}"]`)).filter(Boolean);
        if(els.length&&window.FluxAnim?.chainUnlock)FluxAnim.chainUnlock(els);
      }catch(e){}
    });
    const allChainDone=unlocked.every(t=>!isBlocked(t));
    if(allChainDone&&unlocked.length>=2){
      setTimeout(()=>{spawnConfetti();showToast('⚡ Chain Reaction! '+unlocked.length+' tasks unlocked','success');},600);
    }
  }
});


// ══ SMART DASHBOARD REORDER BY TIME OF DAY ═══════════════════
function smartReorderDashboard(){
  // Dashboard sections are now in fixed wrapper divs (.dash-alerts, .dash-section,
  // .dash-row, .dash-workspace). No individual element reordering
  // needed — the HTML structure defines the layout. This function now only ensures
  // the old reorderDashboard() doesn't break anything.
}


// ══ TRANSPARENCY LAYER ("Why this?") ═════════════════════════
function explainTaskRanking(task){
  const reasons=[];
  const now=new Date();now.setHours(0,0,0,0);
  if(task.date){
    const due=new Date(task.date+'T00:00:00');
    const days=Math.floor((due-now)/86400000);
    if(days<0)reasons.push('⚠ Overdue by '+Math.abs(days)+' day'+(Math.abs(days)>1?'s':''));
    else if(days===0)reasons.push('📅 Due today');
    else if(days<=2)reasons.push('⏰ Due in '+days+' day'+(days>1?'s':''));
  }
  if(task.priority==='high')reasons.push('🔴 High priority');
  const energy=parseInt(localStorage.getItem('flux_energy')||'3');
  if(energy<=2&&(task.difficulty||3)<=2)reasons.push('💡 Easy task fits low energy');
  if(energy>=4&&['project','essay'].includes(task.type))reasons.push('🚀 Complex task fits high energy');
  if(task.estTime&&task.estTime<=15)reasons.push('⚡ Quick win (~'+task.estTime+'min)');
  if(isBlocked(task))reasons.push('🔒 Blocked by '+getBlockerNames(task).length+' task(s)');
  if((task.rescheduled||0)>=2)reasons.push('🔄 Rescheduled '+task.rescheduled+'× — needs attention');
  return reasons;
}
function renderWhyTooltip(task){
  const reasons=explainTaskRanking(task);
  if(!reasons.length)return'';
  return `<span class="why-badge" onclick="event.stopPropagation();showWhyPopup(${task.id})" title="${reasons.join(' · ')}" style="font-size:.55rem;padding:1px 5px;border-radius:4px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.15);color:var(--accent);cursor:help;font-weight:600;font-family:'JetBrains Mono',monospace;vertical-align:middle;margin-left:4px">why?</span>`;
}
function showWhyPopup(taskId){
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  const reasons=explainTaskRanking(task);
  const existing=document.getElementById('whyPopup');if(existing)existing.remove();
  const popup=document.createElement('div');
  popup.id='whyPopup';
  popup.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:8000;background:var(--card);border:1px solid rgba(var(--accent-rgb),.25);border-radius:16px;padding:20px;max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5);backdrop-filter:blur(20px);animation:fadeScale .2s ease';
  popup.innerHTML=`
    <div style="font-size:.7rem;color:var(--accent);font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Why This Task?</div>
    <div style="font-size:.9rem;font-weight:700;margin-bottom:12px">${esc(task.name)}</div>
    <div style="display:flex;flex-direction:column;gap:6px">${reasons.map(r=>`<div style="font-size:.8rem;color:var(--text2);padding:6px 10px;background:var(--card2);border-radius:8px;border:1px solid var(--border)">${r}</div>`).join('')}</div>
    <button onclick="document.getElementById('whyPopup').remove()" style="margin-top:14px;width:100%;padding:10px;border-radius:10px;background:rgba(var(--accent-rgb),.1);border:1px solid rgba(var(--accent-rgb),.2);color:var(--accent);font-weight:600;font-size:.82rem;cursor:pointer">Got it</button>`;
  document.body.appendChild(popup);
  popup.addEventListener('click',e=>{if(e.target===popup)popup.remove();});
}


// ══ MICRO-COACHING PROMPTS ═══════════════════════════════════
let _lastCoachTime=0;
function checkMicroCoaching(){
  const now=Date.now();
  if(now-_lastCoachTime<5*60*1000)return;
  const h=new Date().getHours();
  if(h<6||h>23)return;

  if(_momentum>=3&&_momentum<6){
    _lastCoachTime=now;
    showCoachPrompt("You're in flow — keep the momentum going! 🔥");
    return;
  }
  const quickWins=tasks.filter(t=>!t.done&&(t.estTime||30)<=10&&t.date===todayStr());
  if(quickWins.length&&_momentum<2){
    _lastCoachTime=now;
    showCoachPrompt('⚡ Quick win available: "'+quickWins[0].name+'" (~'+( quickWins[0].estTime||10)+'min)');
    return;
  }
  const overdue=tasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<new Date(new Date().toDateString()));
  if(overdue.length>=3){
    _lastCoachTime=now;
    showCoachPrompt('📋 '+overdue.length+' overdue tasks. Use the Overdue filter to focus on what matters.');
    return;
  }
}
function showCoachPrompt(msg){
  const existing=document.getElementById('coachPrompt');if(existing)existing.remove();
  const el=document.createElement('div');
  el.id='coachPrompt';
  el.style.cssText='position:fixed;top:70px;right:20px;z-index:3000;max-width:300px;padding:12px 16px;background:var(--card);border:1px solid rgba(var(--accent-rgb),.2);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.4);font-size:.8rem;color:var(--text2);animation:slideDown .3s var(--ease-spring);backdrop-filter:blur(12px);cursor:pointer';
  el.innerHTML=`<div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1">${esc(msg)}</div><button onclick="this.closest('#coachPrompt').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;padding:0;flex-shrink:0;transform:none;box-shadow:none">✕</button></div>`;
  el.onclick=e=>{if(e.target===el||e.target.closest('#coachPrompt'))el.remove();};
  document.body.appendChild(el);
  setTimeout(()=>{const c=document.getElementById('coachPrompt');if(c){c.style.opacity='0';c.style.transition='opacity .4s';setTimeout(()=>c.remove(),400);}},8000);
}


// ══ SILENT ACHIEVEMENTS ══════════════════════════════════════
const ACHIEVEMENTS={
  first_task:{title:'First Step',desc:'Created your first task',icon:'🌱'},
  ten_tasks:{title:'Productive',desc:'Completed 10 tasks',icon:'📋'},
  fifty_tasks:{title:'Machine',desc:'Completed 50 tasks',icon:'⚙️'},
  streak_3:{title:'On Fire',desc:'3× momentum streak',icon:'🔥'},
  streak_7:{title:'Unstoppable',desc:'7× momentum streak',icon:'💥'},
  first_session:{title:'Focus Starter',desc:'Completed a focus session',icon:'⏱'},
  ten_sessions:{title:'Deep Worker',desc:'10 focus sessions',icon:'🧠'},
  chain_unlock:{title:'Chain Reaction',desc:'Unlocked 3+ tasks at once',icon:'⚡'},
  all_done_today:{title:'Clean Slate',desc:'Finished all tasks for today',icon:'✨'},
};
let _achievements=load('flux_achievements',[]);
function checkAchievement(id){
  if(_achievements.includes(id))return;
  const a=ACHIEVEMENTS[id];if(!a)return;
  _achievements.push(id);
  save('flux_achievements',_achievements);
  syncKey('achievements',_achievements);
  const el=document.createElement('div');
  el.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:3500;padding:10px 18px;background:var(--card);border:1px solid rgba(var(--accent-rgb),.25);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);font-size:.8rem;display:flex;align-items:center;gap:10px;animation:slideUpToast .3s var(--ease-spring);backdrop-filter:blur(12px)';
  el.innerHTML=`<span style="font-size:1.2rem">${a.icon}</span><div><div style="font-weight:700;font-size:.78rem;color:var(--accent)">${a.title}</div><div style="font-size:.68rem;color:var(--muted2)">${a.desc}</div></div>`;
  document.body.appendChild(el);
  try{if(window.FluxVisual&&typeof FluxVisual.spawnAchievementConfetti==='function')FluxVisual.spawnAchievementConfetti(el);}catch(e){}
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .5s';setTimeout(()=>el.remove(),500);},3500);
}

// Wire achievements to events
FluxBus.on('task_completed',function(){
  const done=tasks.filter(t=>t.done).length;
  if(done>=1)checkAchievement('first_task');
  if(done>=10)checkAchievement('ten_tasks');
  if(done>=50)checkAchievement('fifty_tasks');
  const todayDone=tasks.filter(t=>!t.done&&t.date===todayStr()).length===0&&tasks.filter(t=>t.done&&t.date===todayStr()).length>0;
  if(todayDone)checkAchievement('all_done_today');
});
FluxBus.on('momentum_update',function(m){
  if(m>=3)checkAchievement('streak_3');
  if(m>=7)checkAchievement('streak_7');
});
FluxBus.on('session_ended',function(){
  const total=sessionLog.length;
  if(total>=1)checkAchievement('first_session');
  if(total>=10)checkAchievement('ten_sessions');
});


// ══ MOMENTUM ZONES — UI REACTS TO PRODUCTIVITY LEVEL ═════════
let _currentZone='idle';
function updateMomentumZone(){
  const load=calcCognitiveLoad();
  let zone='idle';
  if(_momentum>=5)zone='fire';
  else if(_momentum>=3)zone='flow';
  else if(_momentum>=1)zone='warm';
  if(zone===_currentZone)return;
  _currentZone=zone;
  const root=document.documentElement;
  root.setAttribute('data-zone',zone);
  const zoneStyles={
    idle:{glow:'none',border:'var(--border)'},
    warm:{glow:'0 0 40px rgba(var(--accent-rgb),.04)',border:'rgba(var(--accent-rgb),.08)'},
    flow:{glow:'0 0 60px rgba(var(--accent-rgb),.07)',border:'rgba(var(--accent-rgb),.12)'},
    fire:{glow:'0 0 80px rgba(255,77,109,.06)',border:'rgba(255,77,109,.1)'}
  };
  const s=zoneStyles[zone];
  root.style.setProperty('--zone-glow',s.glow);
  root.style.setProperty('--zone-border',s.border);
}


// ══ V4 INITIALIZATION ════════════════════════════════════════
function initV4Systems(){
  _achievements=load('flux_achievements',[]);

  smartReorderDashboard();

  // Wire event bus into existing toggleTask
  const _origToggle=window.toggleTask;
  window.toggleTask=function(id){
    _origToggle(id);
    const t=tasks.find(x=>x.id===id);
    if(t&&t.done){
      FluxBus.emit('task_completed',t);
      FluxBus.emit('momentum_update',_momentum);
    }
  };

  // Periodic checks
  setInterval(()=>{
    checkMicroCoaching();
    updateMomentumZone();
  },60000);

  updateMomentumZone();
  checkMicroCoaching();
}

// ══════════════════════════════════════════════════════════════
// ══ FLUX V5 — PREMIUM POLISH SYSTEMS ════════════════════════
// ══════════════════════════════════════════════════════════════

// ── GLOBAL SEARCH ──
function openGlobalSearch(){
  closeCommandPalette();
  const overlay=document.getElementById('searchOverlay');
  if(!overlay)return;
  overlay.classList.add('open');
  const input=document.getElementById('globalSearchInput');
  if(input){input.value='';input.focus();}
  document.getElementById('globalSearchResults').innerHTML='';
}
function closeGlobalSearch(){
  const overlay=document.getElementById('searchOverlay');
  if(overlay)overlay.classList.remove('open');
}
let _globalSearchDebounce=null;
function handleGlobalSearch(q){
  const el=document.getElementById('globalSearchResults');if(!el)return;
  const t=(q||'').trim();
  if(!t){clearTimeout(_globalSearchDebounce);el.innerHTML='';return;}
  clearTimeout(_globalSearchDebounce);
  _globalSearchDebounce=setTimeout(()=>runGlobalSearch(t.toLowerCase()),100);
}
function runGlobalSearch(q){
  if(window.Flux100&&typeof Flux100.runGlobalSearch==='function'){
    try{Flux100.runGlobalSearch(q);return;}catch(e){console.warn(e);}
  }
  const el=document.getElementById('globalSearchResults');if(!el)return;
  let results=[];
  tasks.forEach(t=>{
    if(t.name.toLowerCase().includes(q)){
      const sub=getSubjects()[t.subject];
      results.push({type:'task',label:t.name,sub:sub?sub.short:'',id:t.id,done:t.done,
        action:()=>{closeGlobalSearch();nav('dashboard');setTimeout(()=>{const te=document.querySelector(`[data-task-id="${t.id}"]`);if(te)te.scrollIntoView({behavior:'smooth',block:'center'});},200);}});
    }
  });
  (notes||[]).forEach(n=>{
    if((n.title||'').toLowerCase().includes(q)||(strip(n.body||'')).toLowerCase().includes(q)){
      results.push({type:'note',label:n.title||'Untitled',sub:'',
        action:()=>{closeGlobalSearch();nav('notes');setTimeout(()=>openNote(n.id),100);}});
    }
  });
  const subs=getSubjects();
  Object.entries(subs).forEach(([k,v])=>{
    if(v.name.toLowerCase().includes(q)||v.short.toLowerCase().includes(q)){
      results.push({type:'class',label:v.name,sub:v.short,
        action:()=>{closeGlobalSearch();nav('school');}});
    }
  });
  if(!results.length){el.innerHTML='<div class="search-empty">No results for "'+esc(q)+'"</div>';return;}
  el.innerHTML=results.slice(0,12).map((r,i)=>`<div class="search-result-item" onclick="globalSearchResults[${i}]()" tabindex="0">
    <span class="search-result-type">${r.type}</span>
    <span style="flex:1;${r.done?'text-decoration:line-through;opacity:.5':''}">${esc(r.label)}</span>
    ${r.sub?`<span style="font-size:.62rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(r.sub)}</span>`:''}
  </div>`).join('');
  window.globalSearchResults=results.map(r=>r.action);
}

// ── QUICK-ADD PANEL ──
function escapeAttr(s){return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function refreshQuickAddDatalist(){
  const h=load('flux_quick_add_history',[]);
  const dl=document.getElementById('quickAddHistList');
  if(dl)dl.innerHTML=h.map(x=>`<option value="${escapeAttr(x)}">`).join('');
}
function openQuickAdd(){
  const panel=document.getElementById('quickAddPanel');
  if(!panel)return;
  panel.classList.add('open');
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','Quick add task');
  const input=document.getElementById('quickAddInput');
  if(input){input.value='';input.focus();}
  updateQuickAddPreview('');
  refreshQuickAddDatalist();
}
function closeQuickAdd(){
  const panel=document.getElementById('quickAddPanel');
  if(panel){
    panel.classList.remove('open');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.removeAttribute('aria-label');
  }
  updateQuickAddPreview('');
}
function resolveQuickAddParse(raw){
  if(!raw||!String(raw).trim())return null;
  const s=String(raw).trim();
  const nl=parseNLTask(s);
  if(nl&&nl.name&&nl.name.trim()){
    return{
      name:nl.name.trim(),
      priority:nl.priority||'med',
      date:nl.date||'',
      type:nl.type||'hw',
      subject:nl.subject||'',
      estTime:nl.estTime||0,
      difficulty:3
    };
  }
  const p=parseNaturalTask(s);
  let est=0;
  const tm=s.match(/(\d+)\s*(min(?:utes?)?|h(?:ours?)?|hr\b)/i);
  if(tm)est=/h/i.test(tm[2])?parseInt(tm[1],10)*60:parseInt(tm[1],10);
  return{
    name:p.name,
    priority:p.priority,
    date:p.date,
    type:p.type,
    subject:p.subject||'',
    estTime:est,
    difficulty:3
  };
}
function updateQuickAddPreview(raw){
  const el=document.getElementById('quickAddParsed');
  const titleEl=document.getElementById('quickAddPreviewTitle');
  if(!el)return;
  if(!raw.trim()){el.innerHTML='';if(titleEl)titleEl.textContent='';return;}
  const parsed=resolveQuickAddParse(raw);
  if(!parsed){el.innerHTML='';if(titleEl)titleEl.textContent='';return;}
  let chips='';
  if(parsed.subject){const sub=getSubjects()[parsed.subject];chips+=`<span class="task-chip task-chip-subject">${sub?sub.short:parsed.subject}</span>`;}
  if(parsed.priority!=='med')chips+=`<span class="task-chip task-chip-priority ${parsed.priority}">${parsed.priority}</span>`;
  if(parsed.date)chips+=`<span class="task-chip task-chip-due">${new Date(parsed.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`;
  if(parsed.type&&parsed.type!=='hw')chips+=`<span class="task-chip" style="background:rgba(255,255,255,.03);color:var(--muted2);border:1px solid rgba(255,255,255,.06)">${parsed.type}</span>`;
  if(parsed.estTime){
    const tl=parsed.estTime>=60?`${Math.round(parsed.estTime/60)}h`:`${parsed.estTime}m`;
    chips+=`<span class="task-chip task-chip-time">~${tl}</span>`;
  }
  el.innerHTML=chips;
  if(titleEl)titleEl.textContent=parsed.name?`“${parsed.name}”`:'';
}
function submitQuickAdd(){
  const input=document.getElementById('quickAddInput');
  if(!input)return;
  const raw=input.value.trim();
  if(!raw)return;
  const parsed=resolveQuickAddParse(raw);
  if(!parsed||!parsed.name)return;
  pushQuickAddHistory(raw);
  const t={
    id:Date.now()+Math.random(),name:parsed.name,
    subject:parsed.subject||'',priority:parsed.priority||'med',
    date:parsed.date||'',type:parsed.type||'hw',
    estTime:parsed.estTime||0,difficulty:parsed.difficulty||3,
    done:false,rescheduled:0,createdAt:Date.now()
  };
  t.urgencyScore=calcUrgency(t);
  tasks.unshift(t);save('tasks',tasks);
  input.value='';input.focus();
  updateQuickAddPreview('');
  renderStats();renderTasks();renderCalendar();renderCountdown();
  checkAllPanic();
  showToast('Added: '+t.name,'success');
  syncKey('tasks',tasks);panicCheck(t);
}
function parseNaturalTask(raw){
  let name=raw,date='',priority='med',type='hw',subject='';
  const days={monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:0,
    mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:0};
  const today=new Date();
  const words=raw.split(/\s+/);
  const cleaned=[];
  for(const w of words){
    const lower=w.toLowerCase().replace(/[.,!?]/g,'');
    if(lower==='tomorrow'&&!date){
      const d=new Date(today);d.setDate(d.getDate()+1);
      date=d.toISOString().slice(0,10);
    }else if(lower==='today'&&!date){
      date=todayStr();
    }else if(days[lower]!==undefined&&!date){
      const target=days[lower];const curr=today.getDay();
      let diff=target-curr;if(diff<=0)diff+=7;
      const d=new Date(today);d.setDate(d.getDate()+diff);
      date=d.toISOString().slice(0,10);
    }else if((lower==='high'||lower==='urgent'||lower==='important')&&priority==='med'){
      priority='high';
    }else if(lower==='low'){
      priority='low';
    }else if(lower==='priority'){
      // skip "priority" word
    }else if(['test','quiz','project','essay','lab'].includes(lower)){
      type=lower;
    }else{
      const subs=getSubjects();
      let matched=false;
      for(const[k,v]of Object.entries(subs)){
        if(v.short.toLowerCase()===lower||v.name.toLowerCase()===lower){
          subject=k;matched=true;break;
        }
      }
      if(!matched)cleaned.push(w);
    }
  }
  name=cleaned.join(' ')||raw;
  return{name,date,priority,type,subject};
}

// ── Global Escape (search, quick-add, palette, modals) + quick-add Enter ──
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    const pal=document.getElementById('cmdPalette');
    const qa=document.getElementById('quickAddPanel');
    const so=document.getElementById('searchOverlay');
    const qOpen=qa?.classList.contains('open');
    const sOpen=so?.classList.contains('open');
    if(pal||qOpen||sOpen)e.preventDefault();
    closeDashAddTaskModal();
    closeGlobalSearch();
    closeQuickAdd();
    closeCommandPalette();
    document.querySelectorAll('.modal-overlay').forEach(m=>{
      if(m.style.display!=='none'&&m.id&&m.id!=='dashAddTaskModal')closeModal(m.id);
    });
    if(typeof closeKanban==='function')closeKanban();
    return;
  }
  if(e.key==='Enter'&&document.activeElement?.id==='quickAddInput'){
    e.preventDefault();submitQuickAdd();
  }
});

if(typeof fabAddTask==='function'){
  window.fabAddTask=function(){closeFAB();openQuickAdd();};
}

// ══════════════════════════════════════════════════
// FLUX v2 FEATURES
// ══════════════════════════════════════════════════

// ── Feature: Document title badge (overdue count) ──
function updateDocTitle(){
  try{
    const now=new Date();now.setHours(0,0,0,0);
    const overdue=tasks.filter(t=>isTaskOverdueDay(t)).length;
    const today=tasks.filter(t=>!t.done&&t.date===todayStr()).length;
    let prefix='';
    if(overdue>0)prefix=`(${overdue}⚠) `;
    else if(today>0)prefix=`(${today}) `;
    document.title=prefix+'Flux Planner';
  }catch(e){}
}

// ── Feature: Keyboard shortcut overlay ──
function openShortcutOverlay(){
  if(document.getElementById('shortcutOverlay'))return;
  const overlay=document.createElement('div');
  overlay.id='shortcutOverlay';
  overlay.className='shortcut-overlay';
  const groups = [
    { title:'Navigation', items:[
      ['⌘K / Ctrl+K','Command palette'],
      ['⌘⇧K / Ctrl+Shift+K','Search everywhere'],
      ['G','Grades tab'],
      ['C','Calendar tab'],
      ['/','Flux AI tab'],
      ['↑/↓ or J/K','Navigate tasks'],
    ] },
    { title:'Tasks', items:[
      ['N or T','Quick add task'],
      ['+','Quick add overlay'],
      ['Space / Enter','Toggle focused task'],
      ['E','Edit focused task'],
      ['P','Pin focused task'],
      ['⌘Z','Undo last change'],
      ['Right-click','Task context menu'],
    ] },
    { title:'Views', items:[
      ['F','Focus mode (zen)'],
      ['⌘D','Deep Work mode'],
      ['Esc','Close / dismiss / exit focus'],
      ['?','This shortcuts overlay'],
    ] },
    { title:'Reference tools', items:[
      ['M','Math formula sheet'],
      ['H','Chemistry reference'],
      ['U','Unit converter'],
      ['X','CS reference'],
    ] },
    { title:'AI', items:[
      ['/','Open Flux AI'],
      ['⌘↵','Send message (in AI input)'],
      ['⌘⇧N','New AI chat'],
    ] },
  ];
  const col = (g) => `<div class="shortcut-section">
    <div class="shortcut-section-title">${g.title}</div>
    ${g.items.map(([k,d]) => `<div class="shortcut-row"><kbd class="shortcut-kbd">${k}</kbd><span>${d}</span></div>`).join('')}
  </div>`;
  overlay.innerHTML=`<div class="shortcut-dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
    <div class="shortcut-header">
      <span class="shortcut-title">Keyboard Shortcuts</span>
      <button type="button" onclick="document.getElementById('shortcutOverlay').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.1rem;padding:0;margin-left:auto" aria-label="Close">✕</button>
    </div>
    <div class="shortcut-grid">
      ${groups.map(col).join('')}
    </div>
    <div style="font-size:.7rem;color:var(--muted);text-align:center;padding-top:10px;border-top:1px solid var(--border);margin-top:4px">Press <kbd class="shortcut-kbd" style="font-size:.65rem">?</kbd> or <kbd class="shortcut-kbd" style="font-size:.65rem">Esc</kbd> to close</div>
  </div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  document.body.appendChild(overlay);
}

// ── Feature: Inline date picker on task card ──
function openInlineDatePicker(taskId,el){
  const existing=document.getElementById('inlineDatePicker');
  if(existing){existing.remove();return;}
  const t=tasks.find(x=>x.id===taskId);if(!t)return;
  const picker=document.createElement('div');
  picker.id='inlineDatePicker';
  picker.style.cssText='position:fixed;z-index:9998;background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:14px 16px;box-shadow:0 20px 60px rgba(0,0,0,.5);min-width:220px';
  const rect=el.getBoundingClientRect();
  const top=Math.min(rect.bottom+6,window.innerHeight-160);
  const left=Math.max(8,Math.min(rect.left,window.innerWidth-240));
  picker.style.top=top+'px';picker.style.left=left+'px';
  const today=todayStr();
  const tomorrow=new Date(TODAY);tomorrow.setDate(TODAY.getDate()+1);const tmStr=tomorrow.toISOString().slice(0,10);
  picker.innerHTML=`<div style="font-size:.72rem;color:var(--muted);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">Change Due Date</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
      <button type="button" onclick="setTaskDateInline(${taskId},'${today}',this.closest('#inlineDatePicker'))" class="btn-sec" style="font-size:.7rem;padding:4px 8px">Today</button>
      <button type="button" onclick="setTaskDateInline(${taskId},'${tmStr}',this.closest('#inlineDatePicker'))" class="btn-sec" style="font-size:.7rem;padding:4px 8px">Tomorrow</button>
      <button type="button" onclick="setTaskDateInline(${taskId},'',this.closest('#inlineDatePicker'))" class="btn-sec" style="font-size:.7rem;padding:4px 8px;color:var(--muted)">Clear</button>
    </div>
    <input type="date" value="${t.date||''}" style="margin:0;font-size:.82rem;width:100%" onchange="setTaskDateInline(${taskId},this.value,this.closest('#inlineDatePicker'))">`;
  document.body.appendChild(picker);
  setTimeout(()=>{
    function closePicker(ev){if(!picker.contains(ev.target)&&ev.target!==el){picker.remove();document.removeEventListener('click',closePicker);}}
    document.addEventListener('click',closePicker);
  },10);
}
function setTaskDateInline(id,date,pickerEl){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  t.date=date;t.urgencyScore=calcUrgency(t);
  save('tasks',tasks);syncKey('tasks',tasks);
  if(pickerEl)pickerEl.remove();
  renderTasks();renderCalendar();renderStats();
  showToast(date?'Due date updated':'Date cleared','success');
}

// ── Feature: Ask Flux AI about a task ──
function askFluxAIAboutTask(taskId){
  let name,subKey,due,type,notes;
  // Called with a task ID from the task card action button
  if(taskId!=null){
    const t=tasks.find(x=>x.id===taskId||String(x.id)===String(taskId));
    if(t){
      name=t.name||t.text||'';
      subKey=t.subject||'';
      due=t.date||t.due||'';
      type=t.type||'';
      notes=t.notes||'';
    }
  } else {
    // Called from an open modal — read from fields
    name=(document.getElementById('editText')||document.getElementById('taskName'))?.value||'';
    subKey=document.getElementById('editSubject')?.value||document.getElementById('taskSubject')?.value||'';
    due=document.getElementById('editDue')?.value||document.getElementById('taskDate')?.value||'';
    type=document.getElementById('editType')?.value||document.getElementById('taskType')?.value||'';
    notes=document.getElementById('editNotes')?.value||document.getElementById('taskNotes')?.value||'';
    if(typeof closeEdit==='function')closeEdit();
    if(typeof closeDashAddTaskModal==='function')closeDashAddTaskModal();
  }
  const sub=getSubjects()[subKey];
  const parts=[`Task: "${name||'untitled'}"`,sub?`Subject: ${sub.name}`:'',due?`Due: ${due}`:'',type?`Type: ${type}`:'',notes?`Notes: ${notes.slice(0,100)}`:''].filter(Boolean);
  const prompt=`Help me with this task:\n${parts.join('\n')}\n\nWhat are the best steps to tackle it? Any tips for this type of work?`;
  setTimeout(()=>{
    nav('ai');
    setTimeout(()=>{
      const inp=document.getElementById('aiInput');
      if(inp){inp.value=prompt;inp.focus();}
    },200);
  },100);
}

// ── Feature: Sidebar mini-stats strip ──
function renderSidebarMiniStats(){}

// ── Feature: Smart tomorrow warning ──
function checkTomorrowLoad(){
  try{
    const tomorrow=new Date(TODAY);tomorrow.setDate(TODAY.getDate()+1);
    const tmStr=tomorrow.toISOString().slice(0,10);
    const tmTasks=tasks.filter(t=>!t.done&&t.date===tmStr);
    if(tmTasks.length<3)return;
    const mins=tmTasks.reduce((s,t)=>s+(t.estTime||30),0);
    if(mins<90)return;
    const lastWarn=localStorage.getItem('flux_tomorrow_warn');
    if(lastWarn===todayStr())return;
    localStorage.setItem('flux_tomorrow_warn',todayStr());
    showToast(`⚡ Tomorrow: ${tmTasks.length} tasks (~${mins}m) — prep tonight!`,'warning');
  }catch(e){}
}

// ── Feature: Weekly review digest (every Sunday) ──
function checkWeeklyReview(){
  try{
    if(new Date().getDay()!==0)return;
    const lastReview=localStorage.getItem('flux_last_weekly_review');
    if(lastReview===todayStr())return;
    localStorage.setItem('flux_last_weekly_review',todayStr());
    const banner=document.getElementById('weeklyReviewBanner');
    if(banner)banner.style.display='flex';
  }catch(e){}
}
function startWeeklyReview(){
  const banner=document.getElementById('weeklyReviewBanner');if(banner)banner.style.display='none';
  const now=new Date();now.setHours(0,0,0,0);
  const weekAgo=new Date(now);weekAgo.setDate(weekAgo.getDate()-7);
  const wStart=weekAgo.toISOString().slice(0,10);
  const done=tasks.filter(t=>t.done&&t.completedAt&&t.completedAt>weekAgo.getTime()).length;
  const overdue=tasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')<now).length;
  const upcoming=tasks.filter(t=>!t.done&&t.date&&new Date(t.date+'T00:00:00')>=now).slice(0,5).map(t=>t.name).join(', ');
  const prompt=`It's Sunday — time for my weekly review.\n\nThis week I completed ${done} tasks. I currently have ${overdue} overdue tasks.\nUpcoming: ${upcoming||'nothing scheduled yet'}.\n\nGive me a brief Sunday review: what to close out, what to prioritize next week, and a motivating word.`;
  nav('ai');
  setTimeout(()=>{
    const inp=document.getElementById('aiInput');
    if(inp){inp.value=prompt;inp.focus();}
  },200);
}

// ══ FluxKit (ESM modules in public/js/*) — thin bridges for storage sync + AI context ══
try{
  window.__fluxSyncKey=syncKey;
  window.__fluxSaveNote=saveNote;
  window.__fluxRenderCalendar=renderCalendar;
  window.__fluxReloadTasksFromStorage=function(){
    tasks=load('tasks',[]);
    renderStats();renderTasks();renderCalendar();renderCountdown();checkAllPanic();
  };
}catch(e){}

// ════════════════════════════════════════════════════════════════════
// EDUCATOR PLATFORM — role select, staff signup, teacher/counselor
// dashboards, counselor booking, FluxMessaging, role routing.
// ════════════════════════════════════════════════════════════════════

// Panel titles for the new dashboards
try{
  PANEL_TITLES.teacherDashboard='Teacher Dashboard';
  PANEL_TITLES.counselorDashboard='Counselor Dashboard';
}catch(_){}

// Cached role + counselor record once we know who the user is.
window._userRole=window._userRole||null;
window._counselorRecord=null;

function getTimeOfDay(){
  const h=new Date().getHours();
  if(h<12)return 'morning';
  if(h<18)return 'afternoon';
  return 'evening';
}

// ── First-visit gate: show role select before login ───────────────
/* ── Role-select screen is no longer the FIRST screen ──
   The classic login screen is the entry point again. After successful
   sign-in (Google or email), if the user has no role row in user_roles,
   we surface the "I am a Student / Staff" picker as part of onboarding
   (handled in detectUserRoleAndRoute → maybeShowPostLoginRoleSelect). */
function showRoleSelectOrLogin(){
  // Legacy alias — always falls through to the login screen now.
  showLoginScreen();
}
window.showRoleSelectOrLogin=showRoleSelectOrLogin;

/** Render the "I am a…" picker AS AN OVERLAY after sign-in (post-login).
 *  Used by detectUserRoleAndRoute when the user has no role yet. */
function showPostLoginRolePicker(opts){
  return new Promise((resolve)=>{
    if(document.getElementById('postLoginRolePicker'))return resolve(null);
    const ov=document.createElement('div');
    ov.id='postLoginRolePicker';
    ov.style.cssText='position:fixed;inset:0;background:rgba(5,8,16,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);z-index:9990;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto';
    ov.innerHTML=`
      <div style="max-width:560px;width:100%">
        <div style="text-align:center;margin-bottom:8px;font-size:.7rem;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);font-family:'JetBrains Mono',monospace">Welcome to Flux</div>
        <h1 style="text-align:center;margin:0 0 6px;font-size:clamp(1.6rem,4vw,2.1rem);font-weight:900;letter-spacing:-.02em" class="flux-color-title">I am a…</h1>
        <p style="text-align:center;color:var(--muted2);font-size:.92rem;margin:0 0 26px">Pick your role so Flux sets up the right dashboard for you.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:520px;margin:0 auto">
          <button type="button" id="plrpStudent" style="text-align:left;padding:18px 18px 16px;border-radius:18px;border:1px solid var(--border2);background:linear-gradient(165deg,rgba(var(--accent-rgb),.06),rgba(124,92,255,.04));color:var(--text);cursor:pointer;font-family:inherit;transition:transform .12s, border-color .12s, box-shadow .12s">
            <div style="font-size:2rem;margin-bottom:6px">🎒</div>
            <div style="font-weight:800;font-size:1rem;margin-bottom:4px">Student</div>
            <div style="font-size:.78rem;color:var(--muted2);line-height:1.4">Assignments, study plans, AI tutor, and your counselor.</div>
          </button>
          <button type="button" id="plrpStaff" style="text-align:left;padding:18px 18px 16px;border-radius:18px;border:1px solid var(--border2);background:linear-gradient(165deg,rgba(124,92,255,.08),rgba(var(--accent-rgb),.04));color:var(--text);cursor:pointer;font-family:inherit;transition:transform .12s, border-color .12s, box-shadow .12s">
            <div style="font-size:2rem;margin-bottom:6px">🏫</div>
            <div style="font-weight:800;font-size:1rem;margin-bottom:4px">Staff</div>
            <div style="font-size:.78rem;color:var(--muted2);line-height:1.4">Teacher, counselor, or admin. Post assignments and manage your class.</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
              <span style="font-size:.6rem;padding:2px 7px;border-radius:5px;background:rgba(124,92,255,.16);color:var(--purple, #a78bfa);font-weight:700">Teacher</span>
              <span style="font-size:.6rem;padding:2px 7px;border-radius:5px;background:rgba(124,92,255,.16);color:var(--purple, #a78bfa);font-weight:700">Counselor</span>
              <span style="font-size:.6rem;padding:2px 7px;border-radius:5px;background:rgba(124,92,255,.16);color:var(--purple, #a78bfa);font-weight:700">Admin</span>
            </div>
          </button>
        </div>
        <div style="text-align:center;margin-top:20px;font-size:.74rem;color:var(--muted)">You can change this later in <b>Profile</b>.</div>
      </div>`;
    document.body.appendChild(ov);
    const finish=(role)=>{ov.remove();resolve(role);};
    document.getElementById('plrpStudent')?.addEventListener('click',()=>finish('student'));
    document.getElementById('plrpStaff')?.addEventListener('click',()=>finish('staff'));
  });
}
window.showPostLoginRolePicker=showPostLoginRolePicker;

/** Build the staff-detail mini form (role/name/subject/code) as an overlay.
 *  Resolves to {role,name,subject} or null if cancelled. Email/password are
 *  taken from the already-signed-in session, not collected here. */
function showStaffDetailsForm(){
  return new Promise((resolve)=>{
    if(document.getElementById('staffDetailsForm'))return resolve(null);
    const ov=document.createElement('div');
    ov.id='staffDetailsForm';
    ov.style.cssText='position:fixed;inset:0;background:rgba(5,8,16,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);z-index:9990;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto';
    ov.innerHTML=`
      <div style="max-width:480px;width:100%;background:var(--card);border:1px solid var(--border2);border-radius:22px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.55)">
        <h1 style="margin:0 0 4px;font-size:1.4rem;font-weight:900" class="flux-color-title">Staff details</h1>
        <p style="font-size:.85rem;color:var(--muted2);margin:0 0 20px">Just a few details so we can set up your educator dashboard.</p>
        <label style="display:block;font-size:.72rem;color:var(--muted);margin-bottom:4px">Your role</label>
        <select id="sdfRole" style="width:100%;padding:10px;font-size:.9rem;border-radius:10px;background:var(--card2);border:1px solid var(--border2);color:var(--text);margin-bottom:12px">
          <option value="teacher">Teacher</option>
          <option value="counselor">Counselor</option>
          <option value="staff">Staff / Admin</option>
        </select>
        <label style="display:block;font-size:.72rem;color:var(--muted);margin-bottom:4px">Display name</label>
        <input id="sdfName" type="text" placeholder="e.g. Ms. Johnson" style="width:100%;padding:10px 12px;font-size:.9rem;border-radius:10px;background:var(--card2);border:1px solid var(--border2);color:var(--text);margin-bottom:12px;box-sizing:border-box">
        <div id="sdfSubjectRow"><label style="display:block;font-size:.72rem;color:var(--muted);margin-bottom:4px">Subject (teacher only)</label>
        <input id="sdfSubject" type="text" placeholder="e.g. AP Chemistry" style="width:100%;padding:10px 12px;font-size:.9rem;border-radius:10px;background:var(--card2);border:1px solid var(--border2);color:var(--text);margin-bottom:12px;box-sizing:border-box"></div>
        <label style="display:block;font-size:.72rem;color:var(--muted);margin-bottom:4px">Staff verification code</label>
        <input id="sdfCode" type="text" placeholder="Ask your administrator" style="width:100%;padding:10px 12px;font-size:.9rem;border-radius:10px;background:var(--card2);border:1px solid var(--border2);color:var(--text);margin-bottom:6px;box-sizing:border-box">
        <div style="font-size:.66rem;color:var(--muted);line-height:1.4;margin-bottom:14px">Your school's administrator can provide this code. Without a valid code, we'll switch you to a Student account.</div>
        <div id="sdfError" style="display:none;font-size:.78rem;color:var(--red);padding:8px 12px;background:rgba(255,77,109,.08);border-radius:8px;margin-bottom:12px;border:1px solid rgba(255,77,109,.2)"></div>
        <div style="display:flex;gap:10px">
          <button id="sdfBack" type="button" style="flex:0 0 auto;padding:12px 16px;border-radius:12px;background:var(--card2);border:1px solid var(--border2);color:var(--muted2);font-weight:700;cursor:pointer">← Back</button>
          <button id="sdfSubmit" type="button" style="flex:1;padding:12px;border-radius:12px;background:var(--accent);color:#0a0d18;font-weight:800;border:none;cursor:pointer;font-size:.92rem">Continue</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const roleSel=document.getElementById('sdfRole');
    const subRow=document.getElementById('sdfSubjectRow');
    if(roleSel&&subRow){
      const sync=()=>{subRow.style.display=roleSel.value==='teacher'?'block':'none';};
      sync();
      roleSel.addEventListener('change',sync);
    }
    document.getElementById('sdfBack')?.addEventListener('click',()=>{ov.remove();resolve(null);});
    document.getElementById('sdfSubmit')?.addEventListener('click',()=>{
      const role=roleSel?.value||'teacher';
      const name=(document.getElementById('sdfName')?.value||'').trim();
      const subject=(document.getElementById('sdfSubject')?.value||'').trim();
      const code=String(document.getElementById('sdfCode')?.value||'').trim().toUpperCase();
      const err=document.getElementById('sdfError');
      const setErr=(t)=>{if(err){err.textContent=t;err.style.display='block';}};
      if(!name){setErr('Please enter your name.');return;}
      const expectedRole=FLUX_STAFF_CODES[code];
      if(!expectedRole){setErr('Invalid staff verification code. Ask your administrator.');return;}
      ov.remove();
      resolve({role:expectedRole,name,subject});
    });
  });
}
window.showStaffDetailsForm=showStaffDetailsForm;

function selectRole(role){
  // Legacy entry point used by the now-hidden #roleSelectScreen. We keep
  // it for backwards compat: if someone calls it pre-login it just opens
  // the login screen with a hint stored locally.
  try{localStorage.setItem('flux_pref_role',role);}catch(_){}
  const rs=document.getElementById('roleSelectScreen');
  if(rs){rs.style.display='none';rs.classList.remove('visible');}
  showLoginScreen();
}
window.selectRole=selectRole;

// Patch showLoginScreen so it always hides the role-select screen too
(function patchShowLoginScreen(){
  const orig=window.showLoginScreen||showLoginScreen;
  if(!orig||orig.__fluxEduPatched)return;
  const wrapped=function(){
    const rs=document.getElementById('roleSelectScreen');
    if(rs){rs.style.display='none';rs.classList.remove('visible');}
    return orig.apply(this,arguments);
  };
  wrapped.__fluxEduPatched=true;
  try{window.showLoginScreen=wrapped;}catch(_){}
})();

// ── Staff signup flow ─────────────────────────────────────────────
// NOTE: codes are validated client-side as a placeholder. Production
// should call a Supabase Edge Function that checks a secure list.
const FLUX_STAFF_CODES={
  TEACHER2025:'teacher',
  COUNSELOR2025:'counselor',
  STAFF2025:'staff',
  ADMIN2025:'admin',
};

function showStaffOnboarding(){
  if(document.getElementById('staffOnboarding'))return;
  const overlay=document.createElement('div');
  overlay.id='staffOnboarding';
  overlay.innerHTML=`
    <div style="max-width:480px;width:100%">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Staff sign up</div>
        <div style="font-size:.85rem;color:var(--muted2)">Create your educator account</div>
      </div>
      <div class="mrow"><label for="staffRoleSelect">Your role</label>
        <select id="staffRoleSelect">
          <option value="teacher">Teacher</option>
          <option value="counselor">Counselor</option>
          <option value="staff">Staff / Admin</option>
        </select>
      </div>
      <div class="mrow"><label for="staffName">Full name</label>
        <input id="staffName" type="text" placeholder="e.g. Ms. Johnson">
      </div>
      <div class="mrow" id="staffSubjectRow"><label for="staffSubject">Subject</label>
        <input id="staffSubject" type="text" placeholder="e.g. AP Chemistry, Math 10">
      </div>
      <div class="mrow"><label for="staffEmail">School email</label>
        <input id="staffEmail" type="email" placeholder="your@school.edu" autocomplete="email">
      </div>
      <div class="mrow"><label for="staffPassword">Password</label>
        <input id="staffPassword" type="password" placeholder="At least 8 characters" autocomplete="new-password">
      </div>
      <div class="mrow"><label for="staffCode">Staff verification code</label>
        <input id="staffCode" type="text" placeholder="Ask your administrator">
        <div style="font-size:.72rem;color:var(--muted2);margin-top:4px">Your school's administrator can provide this code.</div>
      </div>
      <div id="staffSignupError" style="display:none;font-size:.78rem;color:var(--red);padding:10px 14px;background:rgba(255,77,109,.08);border-radius:8px;margin-bottom:12px;border:1px solid rgba(255,77,109,.2)"></div>
      <button id="staffSignupBtn" style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:14px;color:#0a0d18;font-weight:700;font-size:.95rem;cursor:pointer">Create staff account</button>
      <div style="text-align:center;margin-top:16px;font-size:.8rem;color:var(--muted2)">
        Already have an account?
        <span id="staffBackToLogin" style="color:var(--accent);cursor:pointer">Sign in</span>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const roleSel=document.getElementById('staffRoleSelect');
  const subjectRow=document.getElementById('staffSubjectRow');
  roleSel?.addEventListener('change',function(){
    if(subjectRow)subjectRow.style.display=this.value==='teacher'?'block':'none';
  });
  document.getElementById('staffSignupBtn')?.addEventListener('click',submitStaffSignup);
  document.getElementById('staffBackToLogin')?.addEventListener('click',()=>{
    overlay.remove();
    showLoginScreen();
  });
}
window.showStaffOnboarding=showStaffOnboarding;

async function submitStaffSignup(){
  const errEl=document.getElementById('staffSignupError');
  const setErr=(t)=>{if(errEl){errEl.textContent=t;errEl.style.display='block';}};
  const role=document.getElementById('staffRoleSelect')?.value||'teacher';
  const name=(document.getElementById('staffName')?.value||'').trim();
  const subject=(document.getElementById('staffSubject')?.value||'').trim();
  const email=(document.getElementById('staffEmail')?.value||'').trim();
  const password=document.getElementById('staffPassword')?.value||'';
  const code=String(document.getElementById('staffCode')?.value||'').trim().toUpperCase();

  if(!name||!email||!password){setErr('Please fill out all required fields');return;}
  if(password.length<8){setErr('Password must be at least 8 characters');return;}
  const expectedRole=FLUX_STAFF_CODES[code];
  if(!expectedRole){setErr('Invalid staff verification code — contact your administrator.');return;}

  const btn=document.getElementById('staffSignupBtn');
  if(btn){btn.disabled=true;btn.textContent='Creating account…';}

  try{
    const sb=getSB();
    if(!sb)throw new Error('Auth not available right now');
    // Cache so detectUserRoleAndRoute can upsert on first sign-in even if
    // the project requires email confirmation (no session at signup time).
    try{
      localStorage.setItem('flux_pending_staff_role',expectedRole);
      localStorage.setItem('flux_pending_staff_name',name);
      if(subject)localStorage.setItem('flux_pending_staff_subject',subject);
    }catch(_){}
    const {data,error}=await sb.auth.signUp({
      email,password,
      options:{data:{full_name:name,role:expectedRole}},
    });
    if(error)throw error;
    const user=data?.user;
    if(!user)throw new Error('Account creation failed');
    if(data?.session){
      await sb.from('user_roles').upsert({
        user_id:user.id,
        role:expectedRole,
        display_name:name,
        subject:subject||null,
        updated_at:new Date().toISOString(),
      });
      if(expectedRole==='counselor'){
        const lastName=name.split(' ').filter(Boolean).pop();
        if(lastName){
          try{
            await sb.from('counselors').update({user_id:user.id})
              .ilike('name','%'+lastName+'%')
              .is('user_id',null);
          }catch(_){}
        }
      }
      try{
        localStorage.removeItem('flux_pending_staff_role');
        localStorage.removeItem('flux_pending_staff_name');
        localStorage.removeItem('flux_pending_staff_subject');
      }catch(_){}
      document.getElementById('staffOnboarding')?.remove();
      showToast(`Welcome, ${name}! Your ${expectedRole} account is ready.`);
    }else{
      document.getElementById('staffOnboarding')?.remove();
      showToast('Account created — check your email for a confirmation link, then sign in.','info',6000);
      showLoginScreen();
    }
  }catch(e){
    setErr(String(e.message||e));
    if(btn){btn.disabled=false;btn.textContent='Create staff account';}
  }
}
window.submitStaffSignup=submitStaffSignup;

// ── Role detection + routing after sign-in ────────────────────────
async function detectUserRoleAndRoute(){
  if(!currentUser)return 'student';
  const sb=getSB();
  if(!sb)return 'student';
  let role='student';
  let counselorRow=null;
  let displayName=null;
  try{
    const {data}=await sb.from('user_roles')
      .select('role,display_name')
      .eq('user_id',currentUser.id)
      .maybeSingle();
    if(data?.role)role=data.role;
    if(data?.display_name)displayName=data.display_name;
  }catch(_){}

  // First sign-in after email-confirm staff signup: apply pending role now
  let hadExplicitRole=false;
  if(role==='student'){
    let pendingRole='',pendingName='',pendingSubject='';
    try{
      pendingRole=localStorage.getItem('flux_pending_staff_role')||'';
      pendingName=localStorage.getItem('flux_pending_staff_name')||'';
      pendingSubject=localStorage.getItem('flux_pending_staff_subject')||'';
    }catch(_){}
    if(pendingRole&&['teacher','counselor','staff','admin'].includes(pendingRole)){
      try{
        await sb.from('user_roles').upsert({
          user_id:currentUser.id,
          role:pendingRole,
          display_name:pendingName||displayName||null,
          subject:pendingSubject||null,
          updated_at:new Date().toISOString(),
        });
        role=pendingRole;
        hadExplicitRole=true;
        if(pendingRole==='counselor'&&pendingName){
          const lastName=pendingName.split(' ').filter(Boolean).pop();
          if(lastName){
            try{
              await sb.from('counselors').update({user_id:currentUser.id})
                .ilike('name','%'+lastName+'%')
                .is('user_id',null);
            }catch(_){}
          }
        }
        try{
          localStorage.removeItem('flux_pending_staff_role');
          localStorage.removeItem('flux_pending_staff_name');
          localStorage.removeItem('flux_pending_staff_subject');
        }catch(_){}
      }catch(_){}
    }
  }else{
    hadExplicitRole=true;
  }

  /* Brand-new account flow:
     If we still have no role row and this user has never picked one, show the
     post-login "I am a Student / Staff" picker. This is the moved-from-pre-login
     onboarding step. Student picks just write a 'student' row. Staff picks
     open the staff detail form to capture name/subject/code.  We only ever
     show this once per account; subsequent sign-ins skip straight through. */
  const alreadyPicked=(()=>{try{return localStorage.getItem('flux_role_picked_for_'+currentUser.id);}catch(_){return null;}})();
  if(!hadExplicitRole&&!alreadyPicked){
    try{
      const pick=await showPostLoginRolePicker();
      if(pick==='student'){
        try{
          await sb.from('user_roles').upsert({
            user_id:currentUser.id,
            role:'student',
            display_name:displayName||currentUser.user_metadata?.full_name||null,
            updated_at:new Date().toISOString(),
          });
          role='student';
        }catch(_){}
        try{localStorage.setItem('flux_role_picked_for_'+currentUser.id,'student');}catch(_){}
      }else if(pick==='staff'){
        const det=await showStaffDetailsForm();
        if(det&&det.role){
          try{
            await sb.from('user_roles').upsert({
              user_id:currentUser.id,
              role:det.role,
              display_name:det.name||displayName||null,
              subject:det.subject||null,
              updated_at:new Date().toISOString(),
            });
            role=det.role;
            if(det.role==='counselor'&&det.name){
              const lastName=det.name.split(' ').filter(Boolean).pop();
              if(lastName){
                try{
                  await sb.from('counselors').update({user_id:currentUser.id})
                    .ilike('name','%'+lastName+'%')
                    .is('user_id',null);
                }catch(_){}
              }
            }
          }catch(_){}
        }else{
          // Cancelled — default to student so we don't keep nagging.
          try{
            await sb.from('user_roles').upsert({
              user_id:currentUser.id,role:'student',
              display_name:displayName||null,updated_at:new Date().toISOString(),
            });
            role='student';
          }catch(_){}
        }
        try{localStorage.setItem('flux_role_picked_for_'+currentUser.id,role);}catch(_){}
      }
    }catch(e){console.warn('[Flux] post-login role picker error',e);}
  }
  // If counselor, pull their counselor record
  if(role==='counselor'){
    try{
      const {data:cr}=await sb.from('counselors')
        .select('*')
        .eq('user_id',currentUser.id)
        .maybeSingle();
      counselorRow=cr||null;
    }catch(_){}
  }
  window._userRole=role;
  window._counselorRecord=counselorRow;

  // Hide student-only sidebar items for staff accounts
  if(role==='teacher'||role==='counselor'||role==='staff'||role==='admin'){
    document.querySelectorAll('.sidebar .nav-item[data-tab],.mob-drawer .nav-item').forEach((el)=>{
      const tab=el.dataset?.tab||'';
      if(['mood','goals','habits'].includes(tab))el.style.display='none';
    });
  }

  if(role==='teacher'||role==='staff'||role==='admin'){
    nav('teacherDashboard');
    renderTeacherDashboard();
  }else if(role==='counselor'){
    nav('counselorDashboard');
    renderCounselorDashboard();
  }else{
    setTimeout(()=>{
      try{renderMyCounselorSection();}catch(_){}
      try{loadTeacherAssignments();}catch(_){}
    },500);
  }
  return role;
}
window.detectUserRoleAndRoute=detectUserRoleAndRoute;

// Patch handleSignedIn so role routing runs after the existing flow
(function patchHandleSignedIn(){
  if(typeof handleSignedIn!=='function')return;
  if(handleSignedIn.__fluxEduPatched)return;
  const orig=handleSignedIn;
  const wrapped=async function(user,session){
    const out=await orig.call(this,user,session);
    try{await detectUserRoleAndRoute();}catch(e){console.warn('[Flux] role routing failed',e);}
    return out;
  };
  wrapped.__fluxEduPatched=true;
  try{window.handleSignedIn=wrapped;handleSignedIn=wrapped;}catch(_){}
})();

// ── Teacher dashboard ─────────────────────────────────────────────
async function renderTeacherDashboard(){
  const host=document.getElementById('teacherDashboardBody');
  if(!host||!currentUser)return;
  const sb=getSB();if(!sb)return;
  host.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted2)">Loading…</div>';

  let classesRows=[];let recentCompletions=[];let unreadMessages=[];
  try{
    const {data:cls}=await sb.from('teacher_classes')
      .select('*,teacher_assignments(id,title,due_date,visible)')
      .eq('teacher_id',currentUser.id)
      .eq('active',true);
    classesRows=cls||[];
    const assignmentIds=classesRows.flatMap(c=>(c.teacher_assignments||[]).map(a=>a.id));
    if(assignmentIds.length){
      const {data:rc}=await sb.from('student_completions')
        .select('id,status,submitted_at,assignment_id,student_id,grade,teacher_assignments(title)')
        .in('assignment_id',assignmentIds)
        .order('submitted_at',{ascending:false,nullsFirst:false})
        .limit(20);
      recentCompletions=rc||[];
    }
    const {data:um}=await sb.from('flux_messages')
      .select('id,content,sender_id,thread_id,created_at')
      .eq('recipient_id',currentUser.id)
      .eq('read',false)
      .order('created_at',{ascending:false})
      .limit(10);
    unreadMessages=um||[];
  }catch(e){console.warn('[Flux teacher] load failed',e);}

  const teacherFirst=(currentUser.user_metadata?.full_name||currentUser.email||'Teacher').split(' ')[0];
  const totalAssignments=classesRows.reduce((s,c)=>s+((c.teacher_assignments||[]).length||0),0);
  const submittedPending=recentCompletions.filter(c=>c.status==='submitted').length;

  host.innerHTML=`
    <div class="teacher-dashboard">
      <div class="teacher-header">
        <div>
          <div class="teacher-greeting">Welcome back, ${esc(teacherFirst)}</div>
          <div class="teacher-date">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
        </div>
        <div class="teacher-header-actions">
          <button class="btn-primary" data-action="new-assignment">+ New assignment</button>
          <button data-action="new-class">+ New class</button>
        </div>
      </div>

      <div class="teacher-stats">
        <div class="teacher-stat-card">
          <div class="stat-number">${classesRows.length}</div>
          <div class="stat-label">Active classes</div>
        </div>
        <div class="teacher-stat-card">
          <div class="stat-number">${totalAssignments}</div>
          <div class="stat-label">Assignments posted</div>
        </div>
        <div class="teacher-stat-card">
          <div class="stat-number">${submittedPending}</div>
          <div class="stat-label">Pending review</div>
        </div>
        <div class="teacher-stat-card">
          <div class="stat-number">${unreadMessages.length}</div>
          <div class="stat-label">Unread messages</div>
        </div>
      </div>

      <div class="teacher-grid">
        <div class="teacher-section">
          <div class="section-header"><h3>Your classes</h3><button class="btn-sm" data-action="new-class">+ Add</button></div>
          ${classesRows.length
            ? classesRows.map(c=>renderTeacherClassCard(c)).join('')
            : '<div class="empty"><div class="empty-icon">📚</div><div class="empty-title">No classes yet</div><div class="empty-sub">Create your first class to get started.</div></div>'}
        </div>
        <div class="teacher-section">
          <div class="section-header"><h3>Recent submissions</h3></div>
          ${recentCompletions.length
            ? recentCompletions.slice(0,8).map(c=>`
              <div class="submission-row" data-completion-id="${esc(c.id)}">
                <div class="submission-avatar">S</div>
                <div class="submission-info">
                  <div class="submission-student">Student ${esc(String(c.student_id).slice(0,6))}</div>
                  <div class="submission-task">${esc(c.teacher_assignments?.title||'Assignment')}</div>
                </div>
                <div class="submission-status status-${esc(c.status)}">${esc(c.status)}</div>
              </div>`).join('')
            : '<div style="font-size:.82rem;color:var(--muted2);padding:12px 0">No submissions yet</div>'}

          ${unreadMessages.length?`
            <div class="section-header" style="margin-top:20px"><h3>Messages (${unreadMessages.length})</h3></div>
            ${unreadMessages.slice(0,5).map(m=>`
              <div class="message-preview-row" data-message-sender="${esc(m.sender_id)}">
                <div class="msg-avatar">S</div>
                <div class="msg-info">
                  <div class="msg-sender">Student ${esc(String(m.sender_id).slice(0,6))}</div>
                  <div class="msg-preview">${esc((m.content||'').slice(0,60))}</div>
                </div>
                <div class="msg-unread-dot" aria-hidden="true"></div>
              </div>`).join('')}
          `:''}
        </div>
      </div>
    </div>`;

  // Wire actions (avoids inline onclick — keeps CSP friendly)
  host.querySelectorAll('[data-action="new-assignment"]').forEach(b=>b.addEventListener('click',openCreateAssignmentModal));
  host.querySelectorAll('[data-action="new-class"]').forEach(b=>b.addEventListener('click',openCreateClassModal));
  host.querySelectorAll('[data-message-sender]').forEach(row=>{
    row.addEventListener('click',()=>FluxMessaging.openThreadById(row.dataset.messageSender));
  });
  host.querySelectorAll('.teacher-class-card[data-class-id]').forEach(card=>{
    card.addEventListener('click',()=>openTeacherClassView(card.dataset.classId));
  });
}
window.renderTeacherDashboard=renderTeacherDashboard;

function renderTeacherClassCard(cls){
  const assignmentCount=(cls.teacher_assignments||[]).length;
  return `
    <button type="button" class="teacher-class-card" data-class-id="${esc(cls.id)}">
      <div class="class-color-stripe"></div>
      <div class="class-card-body">
        <div class="class-name">${esc(cls.class_name)}</div>
        <div class="class-meta">${esc(cls.subject||'')}${cls.period?' · Period '+esc(cls.period):''}</div>
        <div class="class-stats">
          <span>${assignmentCount} assignment${assignmentCount===1?'':'s'}</span>
          <span class="class-code">Code: ${esc(cls.class_code)}</span>
        </div>
      </div>
      <div class="class-card-arrow" aria-hidden="true">›</div>
    </button>`;
}

function openTeacherClassView(classId){
  // Lightweight view: scroll to top + toast for now. Full view can be wired later.
  showToast(`Class ${String(classId).slice(0,6)} — full view coming soon`,'info',2500);
}
window.openTeacherClassView=openTeacherClassView;

// ── Create class modal ────────────────────────────────────────────
function openCreateClassModal(){
  if(document.getElementById('createClassModal'))return;
  const modal=buildEduModal('createClassModal',`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h3 style="font-size:1rem;font-weight:800">New class</h3>
      <button type="button" class="edu-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="mrow"><label>Class name *</label><input id="cls_name" placeholder="e.g. AP Chemistry — Period 3"></div>
    <div class="mrow"><label>Subject</label><input id="cls_subject" placeholder="e.g. Chemistry"></div>
    <div class="mrow"><label>Period</label><input id="cls_period" placeholder="e.g. 3"></div>
    <div class="mrow"><label>Description</label><textarea id="cls_desc" placeholder="Optional" style="min-height:60px"></textarea></div>
    <div id="clsError" class="edu-modal-error" style="display:none"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button id="cls_submit" style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;color:#0a0d18;font-weight:700;cursor:pointer">Create class</button>
      <button class="edu-modal-close" style="padding:12px 18px;background:var(--card2);border:1px solid var(--border2);border-radius:12px;color:var(--muted2);cursor:pointer">Cancel</button>
    </div>`);
  modal.querySelector('#cls_submit')?.addEventListener('click',submitCreateClass);
}
window.openCreateClassModal=openCreateClassModal;

async function submitCreateClass(){
  const sb=getSB();if(!sb)return;
  const name=document.getElementById('cls_name')?.value.trim();
  const subject=document.getElementById('cls_subject')?.value.trim();
  const period=document.getElementById('cls_period')?.value.trim();
  const desc=document.getElementById('cls_desc')?.value.trim();
  const errEl=document.getElementById('clsError');
  const setErr=(t)=>{if(errEl){errEl.textContent=t;errEl.style.display='block';}};
  if(!name){setErr('Class name is required');return;}
  const code=generateClassCode();
  const {error}=await sb.from('teacher_classes').insert({
    teacher_id:currentUser.id,
    class_name:name,
    class_code:code,
    subject:subject||null,
    period:period||null,
    description:desc||null,
    active:true,
  });
  if(error){setErr(error.message);return;}
  document.getElementById('createClassModal')?.remove();
  showToast(`✓ Class "${name}" created · code ${code}`);
  renderTeacherDashboard();
}
window.submitCreateClass=submitCreateClass;

function generateClassCode(){
  // 6-character base36 — readable, low collision risk for small schools
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='';
  for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}

// ── Create assignment modal ──────────────────────────────────────
function openCreateAssignmentModal(){
  if(document.getElementById('createAsgnModal'))return;
  const sb=getSB();if(!sb)return;
  const modal=buildEduModal('createAsgnModal',`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h3 style="font-size:1rem;font-weight:800">Post new assignment</h3>
      <button type="button" class="edu-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="mrow"><label>Title *</label><input id="asgn_title" placeholder="e.g. Chapter 5 reading"></div>
    <div class="irow modal-labeled-row">
      <div style="flex:1"><label>Class *</label><select id="asgn_class" style="margin:0;width:100%"><option value="">Loading…</option></select></div>
      <div style="flex:1"><label>Type</label>
        <select id="asgn_type" style="margin:0;width:100%">
          <option value="homework">Homework</option>
          <option value="quiz">Quiz</option>
          <option value="test">Test</option>
          <option value="project">Project</option>
          <option value="essay">Essay</option>
          <option value="lab">Lab</option>
          <option value="reading">Reading</option>
        </select>
      </div>
    </div>
    <div class="irow modal-labeled-row">
      <div style="flex:1"><label>Due date</label><input id="asgn_due_date" type="date" style="margin:0"></div>
      <div style="flex:1"><label>Due time</label><input id="asgn_due_time" type="time" value="23:59" style="margin:0"></div>
    </div>
    <div class="irow modal-labeled-row">
      <div style="flex:1"><label>Points</label><input id="asgn_points" type="number" value="100" min="0" style="margin:0"></div>
      <div style="flex:1"><label>Est. minutes</label><input id="asgn_time" type="number" value="30" min="5" style="margin:0"></div>
    </div>
    <div class="mrow"><label>Priority</label>
      <div style="display:flex;gap:14px;font-size:.85rem">
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="asgn_pri" value="high"> High</label>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="asgn_pri" value="med" checked> Medium</label>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="asgn_pri" value="low"> Low</label>
      </div>
    </div>
    <div class="mrow"><label>Description / instructions</label>
      <textarea id="asgn_desc" placeholder="Any details, instructions, or resources…" style="min-height:80px"></textarea>
    </div>
    <div id="asgnError" class="edu-modal-error" style="display:none"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button id="asgn_submit" style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;color:#0a0d18;font-weight:700;cursor:pointer">Post assignment</button>
      <button class="edu-modal-close" style="padding:12px 18px;background:var(--card2);border:1px solid var(--border2);border-radius:12px;color:var(--muted2);cursor:pointer">Cancel</button>
    </div>`);

  sb.from('teacher_classes').select('id,class_name,class_code').eq('teacher_id',currentUser.id).eq('active',true)
    .then(({data})=>{
      const sel=document.getElementById('asgn_class');
      if(!sel)return;
      if(!data||!data.length){
        sel.innerHTML='<option value="">No classes — create a class first</option>';
      }else{
        sel.innerHTML=data.map(c=>`<option value="${esc(c.id)}">${esc(c.class_name)} · ${esc(c.class_code)}</option>`).join('');
      }
    });
  modal.querySelector('#asgn_submit')?.addEventListener('click',submitCreateAssignment);
}
window.openCreateAssignmentModal=openCreateAssignmentModal;

async function submitCreateAssignment(){
  const sb=getSB();if(!sb)return;
  const title=document.getElementById('asgn_title')?.value.trim();
  const classId=document.getElementById('asgn_class')?.value;
  const type=document.getElementById('asgn_type')?.value||'homework';
  const dueDate=document.getElementById('asgn_due_date')?.value||null;
  const dueTime=document.getElementById('asgn_due_time')?.value||'23:59:00';
  const points=parseInt(document.getElementById('asgn_points')?.value)||100;
  const estMin=parseInt(document.getElementById('asgn_time')?.value)||30;
  const desc=document.getElementById('asgn_desc')?.value.trim();
  const priority=document.querySelector('input[name="asgn_pri"]:checked')?.value||'med';
  const errEl=document.getElementById('asgnError');
  const setErr=(t)=>{if(errEl){errEl.textContent=t;errEl.style.display='block';}};
  if(!title||!classId){setErr('Title and class are required');return;}

  const {data:cls}=await sb.from('teacher_classes').select('class_code').eq('id',classId).maybeSingle();
  const {error}=await sb.from('teacher_assignments').insert({
    teacher_id:currentUser.id,
    class_id:classId,
    class_code:cls?.class_code||null,
    title,
    type,
    description:desc||null,
    due_date:dueDate||null,
    due_time:dueTime||'23:59:00',
    points_possible:points,
    estimated_minutes:estMin,
    priority,
    visible:true,
  });
  if(error){setErr(error.message);return;}
  document.getElementById('createAsgnModal')?.remove();
  showToast(`✓ "${title}" posted to your class`);
  renderTeacherDashboard();
}
window.submitCreateAssignment=submitCreateAssignment;

// ── Counselor dashboard ───────────────────────────────────────────
async function renderCounselorDashboard(){
  const host=document.getElementById('counselorDashboardBody');
  if(!host||!currentUser)return;
  const sb=getSB();if(!sb)return;
  host.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted2)">Loading…</div>';

  let counselorRow=window._counselorRecord;
  if(!counselorRow){
    try{
      const {data}=await sb.from('counselors')
        .select('*').eq('user_id',currentUser.id).maybeSingle();
      counselorRow=data||null;
      window._counselorRecord=counselorRow;
    }catch(_){}
  }
  if(!counselorRow){
    host.innerHTML=`
      <div class="empty">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">Counselor record not found</div>
        <div class="empty-sub">Ask the system administrator to link your account to a counselor profile.</div>
      </div>`;
    return;
  }

  const today=new Date().toISOString().slice(0,10);
  let appointments=[];let messages=[];
  try{
    const {data:appts}=await sb.from('counselor_appointments')
      .select('*')
      .eq('counselor_id',counselorRow.id)
      .gte('date',today)
      .order('date',{ascending:true})
      .order('time_slot',{ascending:true})
      .limit(30);
    appointments=appts||[];
    const {data:msgs}=await sb.from('flux_messages')
      .select('id,content,sender_id,thread_id,created_at')
      .eq('recipient_id',currentUser.id)
      .eq('read',false)
      .order('created_at',{ascending:false})
      .limit(15);
    messages=msgs||[];
  }catch(e){console.warn('[Flux counselor] load failed',e);}

  const todayAppts=appointments.filter(a=>a.date===today);
  const upcomingAppts=appointments.filter(a=>a.date>today);

  host.innerHTML=`
    <div class="counselor-dashboard">
      <div class="teacher-header">
        <div>
          <div class="teacher-greeting">Good ${getTimeOfDay()}, ${esc(counselorRow.name||'Counselor')}</div>
          <div class="teacher-date">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
        </div>
      </div>

      <div class="teacher-stats">
        <div class="teacher-stat-card">
          <div class="stat-number">${todayAppts.length}</div>
          <div class="stat-label">Today's appointments</div>
        </div>
        <div class="teacher-stat-card">
          <div class="stat-number">${upcomingAppts.length}</div>
          <div class="stat-label">Upcoming</div>
        </div>
        <div class="teacher-stat-card">
          <div class="stat-number">${messages.length}</div>
          <div class="stat-label">Unread messages</div>
        </div>
      </div>

      <div class="teacher-grid">
        <div class="teacher-section">
          <div class="section-header"><h3>Today's schedule</h3></div>
          ${todayAppts.length?todayAppts.map(a=>`
            <div class="appointment-row">
              <div class="appt-time">${esc(a.time_slot)}</div>
              <div class="appt-student">Student ${esc(String(a.student_id).slice(0,6))}</div>
              <div class="appt-reason">${esc((a.reason||'').slice(0,40)||'No reason given')}</div>
              <div class="appt-status-badge status-${esc(a.status)}">${esc(a.status)}</div>
            </div>`).join('')
            :'<div style="font-size:.82rem;color:var(--muted2);padding:12px 0">No appointments today</div>'}
          ${upcomingAppts.length?`
            <div class="section-header" style="margin-top:20px"><h3>Upcoming (${upcomingAppts.length})</h3></div>
            ${upcomingAppts.slice(0,8).map(a=>`
              <div class="appointment-row">
                <div class="appt-time">${new Date(a.date+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} ${esc(a.time_slot)}</div>
                <div class="appt-student">Student ${esc(String(a.student_id).slice(0,6))}</div>
                <div class="appt-status-badge status-${esc(a.status)}">${esc(a.status)}</div>
              </div>`).join('')}
          `:''}
        </div>
        <div class="teacher-section">
          <div class="section-header"><h3>Messages${messages.length?` (${messages.length})`:''}</h3></div>
          ${messages.length?messages.slice(0,8).map(m=>`
            <div class="message-preview-row" data-message-sender="${esc(m.sender_id)}">
              <div class="msg-avatar">S</div>
              <div class="msg-info">
                <div class="msg-sender">Student ${esc(String(m.sender_id).slice(0,6))}</div>
                <div class="msg-preview">${esc((m.content||'').slice(0,55))}</div>
              </div>
              <div class="msg-unread-dot" aria-hidden="true"></div>
            </div>`).join('')
            :'<div style="font-size:.82rem;color:var(--muted2);padding:12px 0">No unread messages</div>'}
        </div>
      </div>
    </div>`;

  host.querySelectorAll('[data-message-sender]').forEach(row=>{
    row.addEventListener('click',()=>FluxMessaging.openThreadById(row.dataset.messageSender));
  });
}
window.renderCounselorDashboard=renderCounselorDashboard;

// ── Student "My Counselor" section (rendered into profile panel) ──
async function renderMyCounselorSection(){
  const host=document.getElementById('myCounselorSection');
  if(!host||!currentUser)return;
  const sb=getSB();if(!sb)return;

  // Hide for non-students
  if(window._userRole&&window._userRole!=='student'){host.innerHTML='';return;}

  let counselor=null;
  try{
    const {data:sc}=await sb.from('student_counselors')
      .select('counselor_id,counselors(*)')
      .eq('student_id',currentUser.id)
      .maybeSingle();
    counselor=sc?.counselors||null;
  }catch(_){}

  if(!counselor){
    host.innerHTML=`
      <div class="card">
        <h3>School counselor</h3>
        <div class="empty">
          <div class="empty-icon">💬</div>
          <div class="empty-title">No counselor selected</div>
          <div class="empty-sub">Pick your counselor to book appointments and send messages.</div>
        </div>
        <button id="pickCounselorBtn" style="width:100%;margin-top:12px">Select counselor</button>
      </div>`;
    host.querySelector('#pickCounselorBtn')?.addEventListener('click',openCounselorSelectModal);
    return;
  }

  const today=new Date().toISOString().slice(0,10);
  let upcoming=[];
  try{
    const {data}=await sb.from('counselor_appointments')
      .select('id,date,time_slot,reason,status')
      .eq('student_id',currentUser.id)
      .eq('counselor_id',counselor.id)
      .gte('date',today)
      .order('date',{ascending:true})
      .limit(5);
    upcoming=data||[];
  }catch(_){}

  host.innerHTML=`
    <div class="card">
      <h3>My counselor</h3>
      <div class="counselor-profile-row">
        <div class="counselor-avatar-lg" style="background:${esc(counselor.avatar_color||'#7c5cff')}">${esc(counselor.avatar_initial||(counselor.name||'?')[0])}</div>
        <div>
          <div class="counselor-name">${esc(counselor.name)}</div>
          <div class="counselor-bio">${esc((counselor.bio||'').slice(0,120))}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin:14px 0">
        <button id="bookApptBtn" style="flex:1;padding:10px;font-size:.82rem">📅 Book appointment</button>
        <button id="msgCounselorBtn" style="flex:1;padding:10px;font-size:.82rem">💬 Message</button>
      </div>
      ${upcoming.length?`
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace">Upcoming appointments</div>
        ${upcoming.map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
            <div style="font-size:.82rem;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--accent)">
              ${new Date(a.date+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} ${esc(a.time_slot)}
            </div>
            <div style="flex:1;font-size:.78rem;color:var(--muted2)">${esc((a.reason||'').slice(0,40)||'No reason')}</div>
            <div class="appt-status-badge status-${esc(a.status)}">${esc(a.status)}</div>
          </div>`).join('')}
      `:'<div style="font-size:.78rem;color:var(--muted2)">No upcoming appointments</div>'}
    </div>`;
  host.querySelector('#bookApptBtn')?.addEventListener('click',()=>openBookAppointmentModal(counselor.id));
  host.querySelector('#msgCounselorBtn')?.addEventListener('click',()=>openMessageComposer(counselor.user_id,counselor.name));
}
window.renderMyCounselorSection=renderMyCounselorSection;

function openCounselorSelectModal(){
  if(document.getElementById('counselorPickModal'))return;
  const sb=getSB();if(!sb)return;
  const modal=buildEduModal('counselorPickModal',`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h3 style="font-size:1rem;font-weight:800">Pick your counselor</h3>
      <button type="button" class="edu-modal-close" aria-label="Close">✕</button>
    </div>
    <div id="counselorList" class="counselor-select-list">
      <div style="padding:24px;text-align:center;color:var(--muted2)">Loading…</div>
    </div>`);
  sb.from('counselors').select('*').eq('active',true).then(({data})=>{
    const list=document.getElementById('counselorList');
    if(!list)return;
    if(!data?.length){list.innerHTML='<div class="empty"><div class="empty-icon">🤷</div><div class="empty-title">No counselors available</div></div>';return;}
    list.innerHTML=data.map(c=>`
      <button type="button" class="counselor-select-card" data-counselor-id="${esc(c.id)}">
        <div class="counselor-avatar" style="background:${esc(c.avatar_color||'#7c5cff')}">${esc(c.avatar_initial||(c.name||'?')[0])}</div>
        <div class="counselor-info">
          <div class="counselor-name">${esc(c.name)}</div>
          <div class="counselor-bio">${esc((c.bio||'').slice(0,140))}</div>
        </div>
        <div class="counselor-select-check">○</div>
      </button>`).join('');
    list.querySelectorAll('[data-counselor-id]').forEach(card=>{
      card.addEventListener('click',async()=>{
        const id=card.dataset.counselorId;
        await sb.from('student_counselors').upsert({student_id:currentUser.id,counselor_id:id});
        document.getElementById('counselorPickModal')?.remove();
        showToast('✓ Counselor selected');
        renderMyCounselorSection();
      });
    });
  });
}
window.openCounselorSelectModal=openCounselorSelectModal;

// ── Appointment booking ───────────────────────────────────────────
let _selectedApptDate=null,_selectedApptTime=null;

function openBookAppointmentModal(counselorId){
  if(document.getElementById('bookApptModal'))return;
  const sb=getSB();if(!sb)return;
  _selectedApptDate=null;_selectedApptTime=null;
  const days=[];
  for(let i=1;i<=14;i++){
    const d=new Date();d.setDate(d.getDate()+i);
    const dow=d.getDay();
    if(dow===0||dow===6)continue;
    days.push({
      date:d.toISOString().slice(0,10),
      label:d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}),
      dayName:d.toLocaleDateString('en-US',{weekday:'long'}).toLowerCase(),
    });
  }
  const modal=buildEduModal('bookApptModal',`
    <div id="bookApptHeader" style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div id="bookApptAvatar" style="width:40px;height:40px;border-radius:50%;background:#7c5cff;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0">C</div>
      <div>
        <div style="font-size:1rem;font-weight:800" id="bookApptTitle">Book appointment</div>
        <div style="font-size:.75rem;color:var(--muted2)">30-minute meeting</div>
      </div>
      <button type="button" class="edu-modal-close" style="margin-left:auto" aria-label="Close">✕</button>
    </div>
    <div class="mrow"><label>Reason for meeting</label>
      <select id="appt_reason">
        <option>Academic check-in</option>
        <option>Course planning</option>
        <option>College planning</option>
        <option>Personal concern</option>
        <option>Schedule change</option>
        <option>Other</option>
      </select>
    </div>
    <div class="mrow"><label>Additional notes (optional)</label>
      <textarea id="appt_notes" placeholder="Any context you'd like to share…" style="min-height:60px"></textarea>
    </div>
    <div style="font-size:.75rem;font-weight:700;color:var(--muted2);margin-bottom:10px">Select a date</div>
    <div id="dateChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      ${days.map(d=>`<button type="button" class="date-chip" data-date="${esc(d.date)}" data-dayname="${esc(d.dayName)}">${esc(d.label)}</button>`).join('')}
    </div>
    <div id="timeSlotContainer" style="display:none">
      <div style="font-size:.75rem;font-weight:700;color:var(--muted2);margin-bottom:10px">Select a time</div>
      <div id="timeSlots" style="display:flex;gap:6px;flex-wrap:wrap"></div>
    </div>
    <div id="apptError" class="edu-modal-error" style="display:none;margin-top:12px"></div>
    <button id="confirmApptBtn" style="display:none;width:100%;margin-top:16px;padding:13px;background:var(--accent);border:none;border-radius:12px;color:#0a0d18;font-weight:700;cursor:pointer">Confirm appointment</button>
  `);
  sb.from('counselors').select('name,avatar_color,avatar_initial,availability').eq('id',counselorId).maybeSingle()
    .then(({data:c})=>{
      if(!c)return;
      document.getElementById('bookApptTitle').textContent=`Book with ${c.name}`;
      const av=document.getElementById('bookApptAvatar');
      if(av){
        av.style.background=c.avatar_color||'#7c5cff';
        av.textContent=c.avatar_initial||(c.name||'?')[0];
      }
    });
  modal.querySelectorAll('[data-date]').forEach(btn=>{
    btn.addEventListener('click',()=>selectAppointmentDate(btn,counselorId));
  });
  modal.querySelector('#confirmApptBtn')?.addEventListener('click',()=>confirmAppointment(counselorId));
}
window.openBookAppointmentModal=openBookAppointmentModal;

async function selectAppointmentDate(btn,counselorId){
  const sb=getSB();if(!sb)return;
  _selectedApptDate=btn.dataset.date;
  _selectedApptTime=null;
  const dayName=btn.dataset.dayname;
  document.querySelectorAll('#dateChips .date-chip').forEach(b=>{
    b.style.background='';b.style.borderColor='';b.style.color='';
  });
  btn.style.background='rgba(var(--accent-rgb),.15)';
  btn.style.borderColor='var(--accent)';
  btn.style.color='var(--accent)';

  let availability=[];
  try{
    const {data:c}=await sb.from('counselors').select('availability').eq('id',counselorId).maybeSingle();
    availability=c?.availability?.[dayName]||[];
  }catch(_){}
  let booked=new Set();
  try{
    const {data:b}=await sb.from('counselor_appointments')
      .select('time_slot,status')
      .eq('counselor_id',counselorId)
      .eq('date',_selectedApptDate);
    booked=new Set((b||[]).filter(x=>x.status!=='cancelled').map(x=>x.time_slot));
  }catch(_){}

  const container=document.getElementById('timeSlotContainer');
  const slotsEl=document.getElementById('timeSlots');
  if(!container||!slotsEl)return;
  if(!availability.length){
    slotsEl.innerHTML='<div style="font-size:.8rem;color:var(--muted2)">No availability on this day</div>';
  }else{
    slotsEl.innerHTML=availability.map(slot=>{
      const isBooked=booked.has(slot);
      return `<button type="button" class="time-chip ${isBooked?'booked':''}" data-slot="${esc(slot)}" ${isBooked?'disabled':''}>${esc(slot)}${isBooked?' ✓':''}</button>`;
    }).join('');
    slotsEl.querySelectorAll('.time-chip:not(.booked)').forEach(b=>{
      b.addEventListener('click',()=>selectApptTime(b,b.dataset.slot));
    });
  }
  container.style.display='block';
  document.getElementById('confirmApptBtn').style.display='none';
}
window.selectAppointmentDate=selectAppointmentDate;

function selectApptTime(btn,slot){
  _selectedApptTime=slot;
  document.querySelectorAll('.time-chip:not(.booked)').forEach(b=>{
    b.style.background='';b.style.borderColor='';b.style.color='';
  });
  btn.style.background='rgba(var(--accent-rgb),.15)';
  btn.style.borderColor='var(--accent)';
  btn.style.color='var(--accent)';
  const c=document.getElementById('confirmApptBtn');
  if(c)c.style.display='block';
}
window.selectApptTime=selectApptTime;

async function confirmAppointment(counselorId){
  if(!_selectedApptDate||!_selectedApptTime)return;
  const sb=getSB();if(!sb)return;
  const reason=document.getElementById('appt_reason')?.value||'General check-in';
  const notes=document.getElementById('appt_notes')?.value.trim();
  const errEl=document.getElementById('apptError');
  const setErr=(t)=>{if(errEl){errEl.textContent=t;errEl.style.display='block';}};
  const {error}=await sb.from('counselor_appointments').insert({
    counselor_id:counselorId,
    student_id:currentUser.id,
    date:_selectedApptDate,
    time_slot:_selectedApptTime,
    reason,
    notes:notes||null,
    status:'pending',
    duration_minutes:30,
  });
  if(error){setErr(error.message);return;}
  document.getElementById('bookApptModal')?.remove();
  showToast(`✅ Booked for ${_selectedApptDate} at ${_selectedApptTime}`);
  _selectedApptDate=null;_selectedApptTime=null;
  renderMyCounselorSection();
}
window.confirmAppointment=confirmAppointment;

// ── Realtime messaging ────────────────────────────────────────────
const FluxMessaging={
  _subscription:null,
  _activeThread:null,

  async openThread(otherUserId,otherName){
    if(!otherUserId||otherUserId==='undefined'){
      showToast('That counselor has not yet activated their Flux account','error');
      return;
    }
    const sb=getSB();if(!sb||!currentUser)return;
    const myId=currentUser.id;
    let thread=null;
    try{
      const {data}=await sb.from('flux_threads')
        .select('*')
        .or(`and(participant_1.eq.${myId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${myId})`)
        .limit(1)
        .maybeSingle();
      thread=data||null;
    }catch(_){}
    if(!thread){
      try{
        const {data:nt}=await sb.from('flux_threads').insert({
          participant_1:myId,
          participant_2:otherUserId,
          subject:`Message with ${otherName||'user'}`,
        }).select().single();
        thread=nt;
      }catch(e){
        showToast('Could not open message thread','error');
        return;
      }
    }
    if(!thread)return;
    this._activeThread=thread;
    this.renderMessageModal(thread,otherName||'User',otherUserId);
    this.subscribeToThread(thread.id);
  },

  async openThreadById(otherUserId){
    if(!otherUserId)return;
    const sb=getSB();if(!sb)return;
    let displayName='User';
    try{
      const {data}=await sb.from('user_roles').select('display_name').eq('user_id',otherUserId).maybeSingle();
      if(data?.display_name)displayName=data.display_name;
    }catch(_){}
    this.openThread(otherUserId,displayName);
  },

  renderMessageModal(thread,otherName,otherUserId){
    document.getElementById('messageModal')?.remove();
    const modal=document.createElement('div');
    modal.id='messageModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
    modal.innerHTML=`
      <div style="background:var(--card);border:1px solid var(--border2);border-radius:20px;width:100%;max-width:500px;height:80vh;display:flex;flex-direction:column;box-shadow:var(--shadow-float,0 12px 40px rgba(0,0,0,.5))">
        <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;color:#0a0d18;flex-shrink:0">${esc((otherName||'?')[0])}</div>
          <div style="flex:1">
            <div style="font-size:.9rem;font-weight:700">${esc(otherName)}</div>
            <div style="font-size:.7rem;color:var(--muted2)">Direct message</div>
          </div>
          <button id="msgModalClose" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.1rem;padding:0">✕</button>
        </div>
        <div id="messageList" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px"></div>
        <div style="padding:12px 16px;border-top:1px solid var(--border);flex-shrink:0;display:flex;gap:8px">
          <textarea id="messageInput" placeholder="Write a message…" rows="1" style="flex:1;resize:none;background:var(--card2);border:1px solid var(--border2);border-radius:12px;padding:10px 14px;font-family:inherit;font-size:.85rem;color:var(--text);min-height:44px;max-height:100px;overflow-y:auto"></textarea>
          <button id="messageSendBtn" style="padding:10px 14px;background:var(--accent);border:none;border-radius:12px;color:#0a0d18;font-weight:700;cursor:pointer;align-self:flex-end">Send</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const closeAll=()=>{modal.remove();this.unsubscribe();};
    modal.addEventListener('click',e=>{if(e.target===modal)closeAll();});
    document.getElementById('msgModalClose')?.addEventListener('click',closeAll);
    document.getElementById('messageSendBtn')?.addEventListener('click',()=>this.sendMessage(otherUserId));
    document.getElementById('messageInput')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.sendMessage(otherUserId);}
    });
    this.loadMessages(thread.id);
  },

  async loadMessages(threadId){
    const sb=getSB();if(!sb)return;
    let messages=[];
    try{
      const {data}=await sb.from('flux_messages')
        .select('*')
        .eq('thread_id',threadId)
        .order('created_at',{ascending:true})
        .limit(50);
      messages=data||[];
    }catch(_){}
    const list=document.getElementById('messageList');
    if(!list)return;
    list.innerHTML=messages.map(m=>this.renderMessage(m)).join('');
    list.scrollTop=list.scrollHeight;
    try{
      await sb.from('flux_messages')
        .update({read:true,read_at:new Date().toISOString()})
        .eq('thread_id',threadId)
        .eq('recipient_id',currentUser.id)
        .eq('read',false);
    }catch(_){}
  },

  renderMessage(msg){
    const isMe=msg.sender_id===currentUser?.id;
    const time=new Date(msg.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    return `
      <div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
        <div style="max-width:80%;padding:9px 13px;border-radius:${isMe?'14px 14px 4px 14px':'14px 14px 14px 4px'};background:${isMe?'rgba(var(--accent-rgb),.18)':'var(--card2)'};border:1px solid ${isMe?'rgba(var(--accent-rgb),.25)':'var(--border2)'};font-size:.84rem;line-height:1.5;word-break:break-word">
          ${esc(msg.content)}
        </div>
        <div style="font-size:.65rem;color:var(--muted);margin-top:3px;font-family:'JetBrains Mono',monospace">${time}</div>
      </div>`;
  },

  async sendMessage(recipientId){
    const input=document.getElementById('messageInput');
    const content=input?.value?.trim();
    if(!content||!this._activeThread)return;
    const sb=getSB();if(!sb)return;
    input.value='';
    const {error}=await sb.from('flux_messages').insert({
      thread_id:this._activeThread.id,
      sender_id:currentUser.id,
      recipient_id:recipientId,
      content,
    });
    if(!error){
      sb.from('flux_threads').update({
        last_message_at:new Date().toISOString(),
        last_message_preview:content.slice(0,80),
      }).eq('id',this._activeThread.id);
    }
  },

  subscribeToThread(threadId){
    this.unsubscribe();
    const sb=getSB();if(!sb)return;
    try{
      this._subscription=sb.channel(`thread_${threadId}`)
        .on('postgres_changes',{
          event:'INSERT',schema:'public',table:'flux_messages',
          filter:`thread_id=eq.${threadId}`,
        },payload=>{
          const list=document.getElementById('messageList');
          if(!list)return;
          const wrap=document.createElement('div');
          wrap.innerHTML=this.renderMessage(payload.new);
          if(wrap.firstElementChild)list.appendChild(wrap.firstElementChild);
          list.scrollTop=list.scrollHeight;
        })
        .subscribe();
    }catch(e){console.warn('[Flux msg] subscribe failed',e);}
  },

  unsubscribe(){
    if(!this._subscription)return;
    try{getSB()?.removeChannel(this._subscription);}catch(_){}
    this._subscription=null;
  },
};
window.FluxMessaging=FluxMessaging;

function openMessageComposer(userId,name){
  FluxMessaging.openThread(userId,name);
}
window.openMessageComposer=openMessageComposer;
window.openMessageThread=function(userId){FluxMessaging.openThreadById(userId);};

// ── Pull teacher-posted assignments into student's task list ──────
async function loadTeacherAssignments(){
  if(!currentUser)return;
  if(window._userRole&&window._userRole!=='student')return;
  const sb=getSB();if(!sb)return;
  // Use whatever class codes the student has on their schedule
  const myClassCodes=(Array.isArray(classes)?classes:[])
    .map(c=>c?.code||c?.classCode||null)
    .filter(Boolean);
  if(!myClassCodes.length)return;

  // Subscribe codes via RPC so RLS allows reads. Idempotent; missing
  // class codes are silently skipped.
  await Promise.all(myClassCodes.map(async code=>{
    try{await sb.rpc('flux_subscribe_class',{p_code:code});}catch(_){}
  }));

  let assignments=[];
  try{
    const {data}=await sb.from('teacher_assignments')
      .select('id,title,description,type,priority,due_date,due_time,estimated_minutes,points_possible,class_code,created_at,teacher_id')
      .in('class_code',myClassCodes)
      .eq('visible',true)
      .gte('due_date',new Date().toISOString().slice(0,10));
    assignments=data||[];
  }catch(_){}
  if(!assignments.length)return;

  let added=0;
  assignments.forEach(ta=>{
    if(tasks.find(t=>t.teacherAssignmentId===ta.id))return;
    tasks.push({
      id:`teacher_${ta.id}`,
      teacherAssignmentId:ta.id,
      name:ta.title,
      subject:ta.class_code||'',
      type:ta.type||'hw',
      date:ta.due_date,
      priority:ta.priority||'med',
      estTime:ta.estimated_minutes||30,
      notes:(ta.description||'').slice(0,500),
      done:false,
      fromTeacher:true,
      pointsPossible:ta.points_possible||100,
      createdAt:ta.created_at?new Date(ta.created_at).getTime():Date.now(),
    });
    added++;
  });
  if(added){
    save('tasks',tasks);
    try{renderTasks();}catch(_){}
    try{renderCalendar();}catch(_){}
  }
}
window.loadTeacherAssignments=loadTeacherAssignments;

// ── Tiny modal builder used by all educator modals ────────────────
function buildEduModal(id,innerHTML){
  const modal=document.createElement('div');
  modal.id=id;
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML=`
    <div style="background:var(--card);border:1px solid var(--border2);border-radius:20px;padding:26px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-float,0 16px 48px rgba(0,0,0,.5))">
      ${innerHTML}
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  modal.querySelectorAll('.edu-modal-close').forEach(b=>b.addEventListener('click',()=>modal.remove()));
  return modal;
}

// Inject scoped CSS once (for edu-modal-error + error states)
(function injectEduModalCSS(){
  if(document.getElementById('flux-edu-modal-css'))return;
  const style=document.createElement('style');
  style.id='flux-edu-modal-css';
  style.textContent=`
    .edu-modal-error{font-size:.78rem;color:var(--red);padding:8px 12px;background:rgba(255,77,109,.08);border-radius:8px;margin-bottom:12px;border:1px solid rgba(255,77,109,.2)}
    #createClassModal label,#createAsgnModal label,#bookApptModal label,#counselorPickModal label{font-size:.72rem;color:var(--muted);display:block;margin-bottom:4px}
    #createClassModal input,#createClassModal textarea,#createAsgnModal input,#createAsgnModal textarea,#createAsgnModal select,#bookApptModal select,#bookApptModal textarea{
      width:100%;background:var(--card2);border:1px solid var(--border2);
      border-radius:10px;padding:9px 12px;color:var(--text);font-family:inherit;font-size:.85rem;margin:0;
    }
    #createClassModal .mrow,#createAsgnModal .mrow,#bookApptModal .mrow{margin-bottom:10px}
  `;
  document.head.appendChild(style);
})();
