/* ── FLUX PLANNER · splash.js — short loader + cinematic first-time / guest intro ── */

function prefersReducedMotion(){
  try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}
}

function fluxSplashAccentHex(){
  try{
    let h='';
    if(typeof window.fluxLoadStoredString==='function')h=window.fluxLoadStoredString('flux_accent','');
    else{
      try{
        const nk=typeof window.fluxNamespacedKey==='function'?window.fluxNamespacedKey('flux_accent'):'flux_accent';
        const raw=localStorage.getItem(nk);
        if(raw!=null&&raw!==''){
          try{h=String(JSON.parse(raw));}catch(_){h=String(raw);}
        }
      }catch(_){h='';}
    }
    h=String(h||'').replace(/^"|"$/g,'').trim();
    if(h&&/^#[0-9A-Fa-f]{6}$/.test(h))return h;
  }catch(_){}
  return '#00bfff';
}
function fluxSplashHexToRgb(hex){
  const x=String(hex||'').replace('#','');
  if(x.length!==6)return{r:0,g:191,b:255};
  const r=parseInt(x.slice(0,2),16),g=parseInt(x.slice(2,4),16),b=parseInt(x.slice(4,6),16);
  if([r,g,b].some(n=>Number.isNaN(n)))return{r:0,g:191,b:255};
  return{r,g,b};
}
/** Splash-only hue shift (matches app `shiftHueHex` intent; splash runs before app.js). */
function fluxShiftHueHex(hex,deg){
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
  const to=n=>('0'+Math.max(0,Math.min(255,n)).toString(16)).slice(-2);
  return '#'+to(R)+to(G)+to(B);
}

/** The Flux loading screen (styles in flux-loader.css): the infinity mark,
    the wordmark, a line under it. quick: drawn already, for short waits. */
function fluxLoaderMarkup(acc,acc2,label,quick){
  const rgb=fluxSplashHexToRgb(acc);
  return `
    <div aria-hidden="true" style="position:absolute;inset:-20%;pointer-events:none;background:radial-gradient(ellipse 50% 42% at 50% 46%,rgba(${rgb.r},${rgb.g},${rgb.b},.20),transparent 70%);animation:fluxIntroGlow 1.85s ease-out both"></div>
    <div class="flux-loader${quick?' flux-loader--quick':''}" role="img" aria-label="Flux Planner" style="position:relative;--fl-acc:${acc};--fl-acc2:${acc2}">
      <svg class="flux-loader__mark" viewBox="0 0 440 220" aria-hidden="true">
        <defs>
          <linearGradient id="fluxSplashMark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${acc}"/>
            <stop offset="100%" stop-color="${acc2}"/>
          </linearGradient>
        </defs>
        <path class="flux-loader__path" pathLength="1" transform="translate(268,110)" stroke="url(#fluxSplashMark)"
          d="M0,0 C18,-52 148,-52 148,0 C148,52 18,52 0,0 C-52,-110 -252,-110 -252,0 C-252,110 -52,110 0,0 Z"/>
        <path class="flux-loader__run" pathLength="1" transform="translate(268,110)"
          d="M0,0 C18,-52 148,-52 148,0 C148,52 18,52 0,0 C-52,-110 -252,-110 -252,0 C-252,110 -52,110 0,0 Z"/>
        <circle class="flux-loader__dot" cx="268" cy="110" r="13"/>
      </svg>
      <div class="flux-loader__word">Flux</div>
      <div class="flux-loader__label">${label}</div>
    </div>
    <style>@keyframes fluxIntroGlow{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}</style>`;
}

/** Returning visits: the same loading screen as a first visit, already drawn */
function runShortSplash(callback){
  const splash=document.getElementById('splash');
  if(!splash){callback();return;}
  const reduce=prefersReducedMotion();
  // Quick on purpose: 2.5s on every open felt slow once Flux was being
  // opened again and again (demo prep, 2026-10-01).
  const acc=fluxSplashAccentHex();
  const acc2=fluxShiftHueHex(acc,-24);
  splash.style.cssText='position:fixed;inset:0;z-index:9999;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0B0E14;width:100%;height:100%;min-height:100dvh;opacity:1';
  splash.innerHTML=fluxLoaderMarkup(acc,acc2,'Smart school planner',true);
  /* Start signing in now, behind the splash, rather than after it. This used
     to hold a fixed 1.5s before initAuth() even began, so every open paid the
     animation and then the sign-in on top. Now the splash lifts as soon as
     there is something to show (the app, the login screen, onboarding or the
     offline notice), and never later than 9s (the boot watchdog in initAuth shows something by 8s). */
  const runId=String(Date.now())+Math.random();
  splash.dataset.run=runId;
  const started=performance.now();
  const MIN_MS=reduce?0:350, MAX_MS=9000;
  const visible=(id,cls)=>{const el=document.getElementById(id);if(!el)return false;if(cls&&!el.classList.contains(cls))return false;return el.style.display!=='none'&&el.offsetWidth>0;};
  const ready=()=>visible('app','visible')||visible('loginScreen','visible')||visible('onboarding','visible')||!!document.getElementById('fluxOfflineOverlay');
  let lifted=false;
  const lift=()=>{
    if(lifted||splash.dataset.run!==runId)return;
    lifted=true;
    splash.style.transition='opacity .3s cubic-bezier(.22,1,.36,1)';
    splash.style.opacity='0';
    setTimeout(()=>{
      // A cinematic intro may have taken the splash over meanwhile; leave it alone.
      if(splash.dataset.run!==runId)return;
      splash.style.display='none';
      splash.innerHTML='';
      splash.style.opacity='1';
    },300);
  };
  const watch=()=>{
    if(lifted||splash.dataset.run!==runId)return;
    const t=performance.now()-started;
    if((t>=MIN_MS&&ready())||t>=MAX_MS)lift();
    else setTimeout(watch,50);
  };
  setTimeout(()=>{try{callback();}catch(e){console.error(e);}watch();},0);
}

/** First open (and guest entry): the Flux mark draws itself, the wordmark
    rises in under it, then the whole thing fades into the app.

    This replaced a 3s canvas sequence (star streaks, then rings, then the
    logo). Most of it was too dim to read on a laptop and the logo sat
    off-centre on a phone, so a first visit looked like a dark, glitchy screen
    before a second splash. One calm, centred moment instead, about 1.8s. */
function runCinematicSplash(callback){
  const splash=document.getElementById('splash');
  if(!splash){callback();return;}
  splash.dataset.run='cinematic';
  if(prefersReducedMotion()){
    runShortSplash(callback);
    return;
  }
  const metaTheme=document.querySelector('meta[name="theme-color"]');
  if(metaTheme)metaTheme.setAttribute('content','#0B0E14');

  const acc=fluxSplashAccentHex();
  const acc2=fluxShiftHueHex(acc,-24);
  const T_END=1850;
  splash.style.cssText='position:fixed;inset:0;z-index:9999;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0B0E14;opacity:1';
  splash.innerHTML=fluxLoaderMarkup(acc,acc2,'Smart school planner',false);

  // setTimeout, not rAF: rAF is paused in a background tab, and a first visit
  // opened in a new tab must still reach the app.
  let finished=false;
  function finish(){
    if(finished)return;
    finished=true;
    splash.style.transition='opacity .45s cubic-bezier(.22,1,.36,1)';
    splash.style.opacity='0';
    setTimeout(()=>{
      if(splash.dataset.run!=='cinematic')return;
      splash.style.display='none';
      splash.innerHTML='';
      splash.style.opacity='1';
    },450);
    // Hand over as the fade starts, so the app is already there underneath
    // rather than appearing after a blank beat.
    try{callback();}catch(e){console.error(e);}
  }
  setTimeout(finish,T_END);
}

window.runSplash=function(callback,useCinematic){
  if(prefersReducedMotion()&&useCinematic){
    runShortSplash(callback);
    return;
  }
  if(useCinematic){
    runCinematicSplash(callback);
  }else{
    runShortSplash(callback);
  }
};
