/* ════════════════════════════════════════════════════════════════════════════
 * FLUX PULSE — modern layout theme controller (May 2026)
 *
 * Toggles html.flux-layout-pulse based on stored preference.
 * - Per-user pref:    localStorage.flux_layout_theme = 'pulse' | 'legacy'
 * - Global default:   localStorage.flux_layout_default = 'pulse' | 'legacy'
 *                     (set by the owner; consulted when the user has no pref)
 *
 * Public API:
 *   window.FluxPulse.getTheme()                -> 'pulse' | 'legacy'
 *   window.FluxPulse.setTheme(t)               -> set per-user, persist, apply
 *   window.FluxPulse.isPulse()                 -> boolean
 *   window.FluxPulse.setGlobalDefault(t)       -> owner-only: set default for new users
 *   window.FluxPulse.getGlobalDefault()        -> the current default
 *   window.FluxPulse.subscribe(fn)             -> notify on theme change
 * ──────────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  var STORAGE_USER='flux_layout_theme';
  var STORAGE_DEFAULT='flux_layout_default';
  var CLASS='flux-layout-pulse';
  var listeners=[];

  function read(key,fallback){
    try{
      var v=localStorage.getItem(key);
      return v==null?fallback:v;
    }catch(_){return fallback;}
  }
  function write(key,value){
    try{localStorage.setItem(key,value);}catch(_){}
  }

  function getGlobalDefault(){
    var v=read(STORAGE_DEFAULT,null);
    return v==='legacy'?'legacy':'pulse'; // default is pulse
  }

  function getTheme(){
    var v=read(STORAGE_USER,null);
    if(v==='pulse'||v==='legacy')return v;
    return getGlobalDefault();
  }

  function apply(theme){
    var html=document.documentElement;
    if(!html)return;
    if(theme==='pulse')html.classList.add(CLASS);
    else html.classList.remove(CLASS);
    html.setAttribute('data-flux-layout',theme==='pulse'?'pulse':'legacy');
  }

  function notify(theme){
    for(var i=0;i<listeners.length;i++){
      try{listeners[i](theme);}catch(_){}
    }
  }

  function setTheme(theme){
    theme=(theme==='legacy')?'legacy':'pulse';
    write(STORAGE_USER,theme);
    apply(theme);
    syncToggleUI(theme);
    notify(theme);
  }

  function setGlobalDefault(theme){
    theme=(theme==='legacy')?'legacy':'pulse';
    write(STORAGE_DEFAULT,theme);
    // If the current user hasn't set a personal preference, follow the default.
    var personal=read(STORAGE_USER,null);
    if(personal!=='pulse'&&personal!=='legacy'){
      apply(theme);
      syncToggleUI(theme);
      notify(theme);
    }
  }

  function isPulse(){
    return getTheme()==='pulse';
  }

  function subscribe(fn){
    if(typeof fn==='function')listeners.push(fn);
    return function unsubscribe(){
      var i=listeners.indexOf(fn);
      if(i>=0)listeners.splice(i,1);
    };
  }

  /* ── Boot: apply ASAP (before paint when included as <script defer>) ── */
  apply(getTheme());

  /* ── Settings toggle UI: lazy-mount into Settings → Look ── */
  function ensureSettingsSwitch(){
    var spane=document.getElementById('spane-appearance');
    if(!spane)return;
    if(document.getElementById('fluxPulseSwitchCard'))return;
    var card=document.createElement('div');
    card.className='card';
    card.id='fluxPulseSwitchCard';
    card.innerHTML=''+
      '<h3>Layout</h3>'+
      '<div class="ssub" style="font-size:.75rem;color:var(--muted2);margin-bottom:12px;line-height:1.55">'+
        'Pulse is the brand-new modern layout — animated mesh, glass cards, glowing nav. Legacy keeps the original look.'+
      '</div>'+
      '<div class="flux-pulse-switch" role="tablist" aria-label="Layout theme">'+
        '<button type="button" role="tab" data-pulse-theme="pulse" aria-selected="false">'+
          'Pulse <span class="flux-pulse-switch-sub">new · alive</span>'+
        '</button>'+
        '<button type="button" role="tab" data-pulse-theme="legacy" aria-selected="false">'+
          'Legacy <span class="flux-pulse-switch-sub">original</span>'+
        '</button>'+
      '</div>'+
      '<div id="fluxPulseOwnerGlobalRow" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)">'+
        '<div class="slabel" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
          '<span>Default for new users</span>'+
          '<span style="font-size:.56rem;letter-spacing:.14em;color:var(--accent);font-family:\'JetBrains Mono\',monospace;text-transform:uppercase">Owner</span>'+
        '</div>'+
        '<div class="ssub" style="font-size:.7rem;color:var(--muted2);margin-bottom:10px;line-height:1.55">Sets the default layout for anyone who hasn\'t picked one yet. Existing personal choices override this.</div>'+
        '<div class="flux-pulse-switch" role="tablist" aria-label="Default layout">'+
          '<button type="button" role="tab" data-pulse-default="pulse" aria-selected="false">Pulse default</button>'+
          '<button type="button" role="tab" data-pulse-default="legacy" aria-selected="false">Legacy default</button>'+
        '</div>'+
      '</div>';
    spane.insertBefore(card,spane.firstChild);

    // Per-user switch
    card.querySelectorAll('[data-pulse-theme]').forEach(function(b){
      b.addEventListener('click',function(){
        setTheme(b.getAttribute('data-pulse-theme'));
        try{if(window.showToast)showToast('Layout: '+(getTheme()==='pulse'?'Pulse':'Legacy'),'info');}catch(_){}
      });
    });
    // Owner default switch
    card.querySelectorAll('[data-pulse-default]').forEach(function(b){
      b.addEventListener('click',function(){
        setGlobalDefault(b.getAttribute('data-pulse-default'));
        syncToggleUI(getTheme());
        try{if(window.showToast)showToast('Default layout updated','info');}catch(_){}
      });
    });

    syncToggleUI(getTheme());
    maybeShowOwnerRow();
  }

  function maybeShowOwnerRow(){
    var row=document.getElementById('fluxPulseOwnerGlobalRow');
    if(!row)return;
    var owner=false;
    try{owner=typeof window.isOwner==='function'&&window.isOwner();}catch(_){}
    row.style.display=owner?'block':'none';
  }

  function syncToggleUI(active){
    var card=document.getElementById('fluxPulseSwitchCard');
    if(!card)return;
    card.querySelectorAll('[data-pulse-theme]').forEach(function(b){
      var on=b.getAttribute('data-pulse-theme')===active;
      b.classList.toggle('active',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
    var def=getGlobalDefault();
    card.querySelectorAll('[data-pulse-default]').forEach(function(b){
      var on=b.getAttribute('data-pulse-default')===def;
      b.classList.toggle('active',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
  }

  /* ── Pulse badge: insert a tiny "Pulse active" chip in the topbar-right ── */
  function ensurePulseBadge(){
    if(!isPulse())return;
    var right=document.querySelector('#app.visible .topbar-right')||document.querySelector('.topbar-right');
    if(!right)return;
    if(document.getElementById('fluxPulseBadge'))return;
    var b=document.createElement('button');
    b.type='button';
    b.id='fluxPulseBadge';
    b.className='flux-pulse-badge';
    b.title='Pulse layout active — click to manage';
    b.innerHTML='<span class="flux-pulse-badge-dot" aria-hidden="true"></span><span>Pulse</span>';
    b.addEventListener('click',function(){
      try{
        if(typeof window.nav==='function'){
          window.nav('settings');
          setTimeout(function(){
            if(typeof window.switchStab==='function'){
              var stab=document.querySelector('.stab[onclick*="appearance"]');
              window.switchStab('appearance',stab||null);
            }
            var sw=document.getElementById('fluxPulseSwitchCard');
            if(sw)sw.scrollIntoView({behavior:'smooth',block:'center'});
          },120);
        }
      }catch(_){}
    });
    right.insertBefore(b,right.firstChild);
  }
  function removePulseBadge(){
    var el=document.getElementById('fluxPulseBadge');
    if(el)el.remove();
  }

  /* ── React to theme changes: maintain badge + sync UI ── */
  subscribe(function(theme){
    if(theme==='pulse')ensurePulseBadge();
    else removePulseBadge();
  });

  /* ── Lazy mount via bounded polling.
   *  A previous version observed body{subtree:true} which fired on every DOM
   *  mutation during boot. Under parallel Playwright (4 workers / 1 server)
   *  that flooded the main thread enough to push the `load` event past 60s.
   *  We now poll a handful of times over the first ~10 seconds, then stop.
   *  After that, nav('settings') / showApp wrappers below keep things synced
   *  without ever holding open a MutationObserver. */
  var _pollTries=0;
  function pollMount(){
    _pollTries++;
    try{
      var appVisible=document.getElementById('app')?.classList.contains('visible');
      if(appVisible&&isPulse())ensurePulseBadge();
      if(document.getElementById('spane-appearance')){
        ensureSettingsSwitch();
        maybeShowOwnerRow();
      }
    }catch(_){}
    if(_pollTries<24){
      // 24 ticks * ~400ms ≈ 9.6s. Plenty of time for the SPA to mount.
      setTimeout(pollMount,400);
    }
  }

  /* Hook into the SPA's `nav` function so opening Settings always re-mounts
   * the card even if it appears after polling stops. Cheap, one-shot. */
  function wrapNav(){
    if(typeof window.nav!=='function')return;
    if(window.nav._fluxPulseWrapped)return;
    var orig=window.nav;
    function wrapped(){
      var r=orig.apply(this,arguments);
      try{
        setTimeout(function(){
          ensureSettingsSwitch();
          maybeShowOwnerRow();
          if(isPulse())ensurePulseBadge();
        },60);
      }catch(_){}
      return r;
    }
    wrapped._fluxPulseWrapped=true;
    try{window.nav=wrapped;}catch(_){}
  }

  /* Safety net: if a Supabase user is signed in but the login screen is still
   * showing (race conditions during OAuth callback can let it linger), force-
   * hide it. Same idea for the legacy role-select screen, which should never
   * appear post-login. Cheap — runs once a second for the first 30 seconds
   * after boot, then stops. */
  function startAuthVisibilityGuard(){
    var ticks=0;
    function tick(){
      ticks++;
      try{
        var signedIn=false;
        try{signedIn=!!(window.currentUser&&window.currentUser.id);}catch(_){}
        if(!signedIn){
          // Also treat presence of a Supabase auth token as "signed in" so
          // the guard activates during the OAuth callback window.
          try{
            for(var i=0;i<localStorage.length;i++){
              var k=localStorage.key(i);
              if(k&&k.indexOf('sb-')===0&&k.indexOf('-auth-token')>=0){signedIn=true;break;}
            }
          }catch(_){}
        }
        if(signedIn){
          var ls=document.getElementById('loginScreen');
          if(ls&&(ls.classList.contains('visible')||ls.style.display!=='none')){
            ls.style.display='none';
            ls.classList.remove('visible');
            var app=document.getElementById('app');
            if(app&&!app.classList.contains('visible')){
              try{if(typeof window.showApp==='function')window.showApp();}catch(_){}
            }
          }
          var rs=document.getElementById('roleSelectScreen');
          if(rs&&rs.style.display!=='none'){rs.style.display='none';rs.classList.remove('visible');}
          // Also clean any lingering post-login role picker overlay.
          var plrp=document.getElementById('postLoginRolePicker');
          if(plrp)plrp.remove();
        }
      }catch(_){}
      if(ticks<30)setTimeout(tick,1000);
    }
    setTimeout(tick,500);
  }

  function init(){
    apply(getTheme());
    // First-pass attempt now, then bounded polling, then wrap nav once it
    // appears. `nav` is defined in app.js which loads with defer, so it may
    // not be ready at our init time — re-attempt the wrap a few times.
    try{ensureSettingsSwitch();}catch(_){}
    if(isPulse())ensurePulseBadge();
    pollMount();
    startAuthVisibilityGuard();
    var navTries=0;
    function tryWrapNav(){
      navTries++;
      wrapNav();
      if(typeof window.nav!=='function'||!window.nav._fluxPulseWrapped){
        if(navTries<20)setTimeout(tryWrapNav,300);
      }
    }
    tryWrapNav();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }

  /* ── Public API ── */
  window.FluxPulse={
    getTheme:getTheme,
    setTheme:setTheme,
    isPulse:isPulse,
    getGlobalDefault:getGlobalDefault,
    setGlobalDefault:setGlobalDefault,
    subscribe:subscribe,
    _apply:apply,
    _refreshUI:function(){syncToggleUI(getTheme());maybeShowOwnerRow();}
  };
})();
