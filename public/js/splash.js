/* ── FLUX PLANNER · splash.js — short loader + cinematic first-time / guest intro ── */

function prefersReducedMotion(){
  try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}
}

function isLikelyLowEndDevice(){
  try{
    const c=navigator.hardwareConcurrency||4;
    const mem=navigator.deviceMemory;
    if(c<=2)return true;
    if(mem!=null&&mem<=2)return true;
  }catch(_){}
  return false;
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

/** Returning visits: wordmark + laser beam (grows left → right from under “F”) */
function runShortSplash(callback){
  const splash=document.getElementById('splash');
  if(!splash){callback();return;}
  const reduce=prefersReducedMotion();
  const laserAnim=reduce?'none':'fluxLaserGrow 1.35s cubic-bezier(.22,1,.36,1) forwards';
  const acc=fluxSplashAccentHex();
  const acc2=fluxShiftHueHex(acc,-22);
  const rgb=fluxSplashHexToRgb(acc);
  const rgbStr=`${rgb.r},${rgb.g},${rgb.b}`;
  const glow=`rgba(${rgbStr},.14)`;
  const glow2=`rgba(${rgbStr},.95)`;
  const glow3=`rgba(${rgbStr},.55)`;
  splash.style.cssText='position:fixed;inset:0;background:#0B0E14;z-index:9999;display:flex;flex-direction:column;align-items:stretch;justify-content:center;width:100%;height:100%;min-height:100dvh;overflow:hidden';
  splash.innerHTML=`
    <div style="position:absolute;inset:0;pointer-events:none;opacity:.35;background:radial-gradient(ellipse 85% 60% at 50% 42%,${glow},transparent 58%)"></div>
    <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;box-sizing:border-box;padding:max(12px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))">
      <div style="width:100%;max-width:272px;display:flex;flex-direction:column;align-items:stretch;gap:4px;margin-top:-24px;animation:splashFadeIn .55s cubic-bezier(.22,1,.36,1) both">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 32" preserveAspectRatio="xMinYMin meet" style="width:100%;max-width:300px;height:auto;display:block;flex-shrink:0;filter:drop-shadow(0 6px 24px ${glow})" aria-hidden="true">
          <defs>
            <linearGradient id="fluxWGSplash" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#E8F4FC"/>
              <stop offset="55%" stop-color="${acc}"/>
              <stop offset="100%" stop-color="${acc2}"/>
            </linearGradient>
          </defs>
          <text x="0" y="26" font-family="'Plus Jakarta Sans',system-ui,sans-serif" font-size="31" font-weight="800" letter-spacing="-0.04em" fill="url(#fluxWGSplash)">Flux</text>
        </svg>
        <div style="display:flex;align-items:center;width:100%;gap:6px;margin-top:2px">
          <div aria-hidden="true" style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,${acc});box-shadow:0 0 14px ${glow2},0 0 5px rgba(255,255,255,.75)"></div>
          <div style="flex:1;min-width:0;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;position:relative">
            <div class="flux-splash-laser-fill" style="position:absolute;left:0;top:50%;transform:translateY(-50%);height:3px;width:${reduce?'100%':'0'};border-radius:2px;background:linear-gradient(90deg,${acc2},${acc});box-shadow:0 0 12px ${glow3};animation:${laserAnim}"></div>
          </div>
        </div>
        <div style="margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:.78rem;letter-spacing:.28em;text-transform:uppercase;color:rgba(195,210,230,.92);text-align:left;line-height:1.35">PLANNER</div>
        <div style="margin-top:14px;font-family:'JetBrains Mono',monospace;font-size:.74rem;letter-spacing:.1em;text-align:left;color:rgba(150,170,200,.58)">Loading planner</div>
      </div>
    </div>
    <style>
      @keyframes splashFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      @keyframes fluxLaserGrow{from{width:0}to{width:100%}}
    </style>`;
  const dur=reduce?720:2100;
  setTimeout(()=>{
    splash.style.transition='opacity .38s cubic-bezier(.22,1,.36,1)';
    splash.style.opacity='0';
    setTimeout(()=>{
      splash.style.display='none';
      splash.innerHTML='';
      splash.style.opacity='1';
      callback();
    },380);
  },dur);
}

/** ~3s War Robots–inspired Flux intro: hyperspace → rings → logo → handoff */
function runCinematicSplash(callback){
  const splash=document.getElementById('splash');
  if(!splash){callback();return;}
  if(prefersReducedMotion()||isLikelyLowEndDevice()){
    runShortSplash(callback);
    return;
  }
  const metaTheme=document.querySelector('meta[name="theme-color"]');
  if(metaTheme)metaTheme.setAttribute('content','#0B0F1A');

  const T_HYPER=800,T_RINGS=1800,T_LOGO=2500,T_END=3000;
  const acc=fluxSplashAccentHex();
  const acc2=fluxShiftHueHex(acc,-20);
  const rgb=fluxSplashHexToRgb(acc);
  const rgbStr=`${rgb.r},${rgb.g},${rgb.b}`;
  const cinGlow=`rgba(${rgbStr},.45)`;
  const cinGlowLaser=`rgba(${rgbStr},.6)`;
  const cinNode=`rgba(${rgbStr},.9)`;
  splash.style.cssText='position:fixed;inset:0;z-index:9999;overflow:hidden;display:block;background:#070512';

  splash.innerHTML=`
    <canvas id="fluxCinCanvas" style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
    <div id="fluxCinVignette" style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%,transparent 0%,rgba(5,8,20,.25) 55%,rgba(2,4,14,.92) 100%);z-index:1"></div>
    <div id="fluxCinLogo" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:3;pointer-events:none;opacity:0">
      <div style="display:flex;flex-direction:column;align-items:flex-start;width:min(88vw,320px);padding:0 12px;box-sizing:border-box">
        <div id="fluxCinWord" style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:clamp(2.75rem,12vw,3.85rem);font-weight:800;letter-spacing:-0.04em;text-align:left;
          background:linear-gradient(90deg,#E8F4FC 0%,${acc} 52%,${acc2} 100%);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          filter:drop-shadow(0 0 26px ${cinGlow});transform:scale(.88)">Flux</div>
        <div id="fluxCinSweep" style="width:100%;margin-top:12px;opacity:0">
          <div style="display:flex;align-items:center;width:100%;gap:6px">
            <div aria-hidden="true" style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,${acc});box-shadow:0 0 14px ${cinNode}"></div>
            <div style="flex:1;min-width:0;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;position:relative">
              <div style="position:absolute;left:0;top:50%;transform:translateY(-50%);height:3px;width:0;border-radius:2px;background:linear-gradient(90deg,${acc2},${acc});box-shadow:0 0 12px ${cinGlowLaser};animation:fluxCinLaser 1.05s cubic-bezier(.22,1,.36,1) 2.05s forwards"></div>
            </div>
          </div>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:clamp(.62rem,2.2vw,.82rem);letter-spacing:.3em;text-transform:uppercase;color:rgba(190,205,225,.88);margin-top:12px">PLANNER</div>
      </div>
    </div>
    <style>
      @keyframes fluxCinLaser{from{width:0}to{width:100%}}
    </style>`;

  const canvas=document.getElementById('fluxCinCanvas');
  const ctx=canvas.getContext('2d');
  const logoEl=document.getElementById('fluxCinLogo');
  const wordEl=document.getElementById('fluxCinWord');
  const sweepEl=document.getElementById('fluxCinSweep');
  let W,H,cx,cy;
  let prevFrame=performance.now();
  let raf;

  const stars=[];
  const STAR_N=160;
  function initStars(){
    stars.length=0;
    for(let i=0;i<STAR_N;i++){
      stars.push({
        a:Math.random()*Math.PI*2,
        r:Math.random()*Math.min(W,H)*0.55,
        v:120+Math.random()*340,
        w:0.4+Math.random()*1.4,
        tw:Math.random()*Math.PI*2
      });
    }
  }

  const RINGS=[
    {rx:.42,ry:.13,tilt:12,phase:0,spd:.65,alpha:.22,co:[rgb.r,rgb.g,rgb.b]},
    {rx:.34,ry:.18,tilt:58,phase:1.1,spd:-.52,alpha:.16,co:[124,92,255]},
    {rx:.48,ry:.11,tilt:-28,phase:2.3,spd:.42,alpha:.14,co:[34,255,136]},
    {rx:.26,ry:.2,tilt:82,phase:3.5,spd:-.58,alpha:.12,co:[Math.min(255,rgb.r+40),Math.min(255,rgb.g+30),Math.min(255,rgb.b+20)]},
    {rx:.52,ry:.09,tilt:5,spd:.38,alpha:.1,co:[rgb.r,rgb.g,rgb.b]},
  ];
  let sparks=[];

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    W=window.innerWidth;
    H=window.innerHeight;
    canvas.width=Math.floor(W*dpr);
    canvas.height=Math.floor(H*dpr);
    canvas.style.width=W+'px';
    canvas.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cx=W/2;cy=H/2;
  }
  resize();
  initStars();
  const onResize=()=>{resize();initStars();};
  window.addEventListener('resize',onResize);

  function easeOutCubic(t){return 1-Math.pow(1-t,3);}
  function easeInOut(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}

  function getEP(ring,angle){
    const tr=ring.tilt*Math.PI/180;
    const m=Math.min(W,H);
    const px=Math.cos(angle)*ring.rx*m;
    const py=Math.sin(angle)*ring.ry*m;
    const projX=px*Math.cos(tr*.42)-py*Math.sin(tr*.35);
    const projY=px*Math.sin(tr*.18)+py*Math.cos(tr*.38);
    return{x:cx+projX,y:cy+projY,depth:.5+.5*Math.sin(angle*2+ring.phase)};
  }

  function drawSpaceBg(elapsed){
    const g=ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'#140a28');
    g.addColorStop(.35,'#0c1228');
    g.addColorStop(.7,'#081420');
    g.addColorStop(1,'#040810');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,W,H);
    const pulse=0.55+0.45*Math.sin(elapsed*0.004);
    const rg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*0.65);
    rg.addColorStop(0,`rgba(40,20,90,${0.22*pulse})`);
    rg.addColorStop(.45,'rgba(8,20,60,0.08)');
    rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg;
    ctx.fillRect(0,0,W,H);
  }

  function drawHyperspace(elapsed,pPhase,dt){
    const warp=1+0.018*Math.sin(elapsed*0.006);
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(warp,warp);
    ctx.translate(-cx,-cy);
    const fade=0.35+0.65*easeOutCubic(Math.min(1,pPhase));
    stars.forEach(s=>{
      s.r+=s.v*dt*(0.9+fade*0.5);
      s.tw+=dt*2.2;
      const maxR=Math.max(W,H)*0.72;
      if(s.r>maxR){s.r=8+Math.random()*40;s.a=Math.random()*Math.PI*2;}
      const len=10+s.r*0.055;
      const x1=cx+Math.cos(s.a)*s.r;
      const y1=cy+Math.sin(s.a)*s.r;
      const x0=cx+Math.cos(s.a)*(s.r-len);
      const y0=cy+Math.sin(s.a)*(s.r-len);
      const tw=0.5+0.5*Math.sin(s.tw);
      ctx.strokeStyle=`rgba(230,245,255,${fade*s.w*0.09*tw})`;
      ctx.lineWidth=s.w;
      ctx.beginPath();
      ctx.moveTo(x0,y0);
      ctx.lineTo(x1,y1);
      ctx.stroke();
    });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=0.12+0.08*Math.sin(elapsed*0.008);
    ctx.strokeStyle='rgba(160,200,255,0.35)';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.arc(cx,cy,42+Math.sin(elapsed*0.01)*14,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  function drawRingSeg(ring,ga,shrink){
    const sm=1-shrink*0.88;
    for(let i=0;i<72;i++){
      const a0=(i/72)*Math.PI*2+ring.phase,a1=((i+1)/72)*Math.PI*2+ring.phase;
      const r={...ring,rx:ring.rx*sm,ry:ring.ry*sm};
      const p0=getEP(r,a0),p1=getEP(r,a1);
      const d=(p0.depth+p1.depth)/2;
      const [r0,g,b]=ring.co;
      ctx.beginPath();
      ctx.moveTo(p0.x,p0.y);
      ctx.lineTo(p1.x,p1.y);
      ctx.strokeStyle=`rgba(${r0},${g},${b},${ring.alpha*ga*d*(0.45+0.55*d)})`;
      ctx.lineWidth=1.1*d+0.6;
      ctx.stroke();
    }
  }

  function tickSparks(){
    sparks=sparks.filter(s=>s.life>0);
    sparks.forEach(s=>{
      s.x+=s.vx;s.y+=s.vy;s.vy+=0.06;s.life-=s.dec;
      ctx.save();
      ctx.globalAlpha=s.life*0.85;
      ctx.fillStyle='rgba(180,230,255,1)';
      ctx.shadowBlur=8;
      ctx.shadowColor='rgba(0,210,255,0.9)';
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.sz,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }

  const start=performance.now();
  prevFrame=start;

  function frame(now){
    let dt=Math.min(0.05,(now-prevFrame)/1000);
    if(dt>0.08)dt=1/60;
    prevFrame=now;
    const elapsed=now-start;
    if(elapsed>=T_END){
      window.removeEventListener('resize',onResize);
      cancelAnimationFrame(raf);
      splash.style.transition='opacity .48s cubic-bezier(.22,1,.36,1)';
      splash.style.opacity='0';
      setTimeout(()=>{
        splash.style.display='none';
        splash.innerHTML='';
        splash.style.opacity='1';
        callback();
      },480);
      return;
    }

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawSpaceBg(elapsed);

    if(elapsed<T_HYPER){
      const p=elapsed/T_HYPER;
      drawHyperspace(elapsed,p,dt);
    }else if(elapsed<T_RINGS){
      const seg=(elapsed-T_HYPER)/(T_RINGS-T_HYPER);
      const conv=easeInOut(seg);
      ctx.globalAlpha=0.55+0.45*(1-conv*0.5);
      drawHyperspace(elapsed,0.85,dt);
      ctx.globalAlpha=1;
      RINGS.forEach((r,i)=>{
        r.phase+=r.spd*dt*(1+seg);
        drawRingSeg(r,0.75+0.25*conv,conv*(0.65+0.08*i));
        if(Math.random()<0.18*conv){
          const ang=Math.random()*Math.PI*2;
          const rr=RINGS[i%RINGS.length];
          const p=getEP(rr,ang+rr.phase);
          sparks.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*2.2,vy:(Math.random()-0.5)*2.2-1,sz:0.6+Math.random()*1.4,life:1,dec:0.035+Math.random()*0.04});
        }
      });
      tickSparks();
    }else if(elapsed<T_LOGO){
      const seg=(elapsed-T_RINGS)/(T_LOGO-T_RINGS);
      const fade=1-seg;
      RINGS.forEach((r,i)=>{
        r.phase+=r.spd*dt*0.85;
        drawRingSeg(r,fade*0.5,fade*0.92);
      });
      tickSparks();
      logoEl.style.opacity=String(Math.min(1,seg*1.6));
      const sc=0.88+0.12*easeOutCubic(Math.min(1,seg*1.25));
      wordEl.style.transform=`scale(${sc})`;
      sweepEl.style.opacity=String(seg>0.15?Math.min(1,(seg-0.15)*2):0);
    }else{
      const seg=(elapsed-T_LOGO)/(T_END-T_LOGO);
      drawSpaceBg(elapsed);
      ctx.fillStyle=`rgba(5,8,18,${seg*0.55})`;
      ctx.fillRect(0,0,W,H);
      logoEl.style.opacity='1';
      wordEl.style.transform='scale(1)';
      wordEl.style.filter=`drop-shadow(0 0 ${24+seg*20}px rgba(${rgbStr},${0.45+seg*0.25}))`;
      sweepEl.style.opacity=String((1-seg)*0.9);
    }

    raf=requestAnimationFrame(frame);
  }

  raf=requestAnimationFrame(frame);
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
