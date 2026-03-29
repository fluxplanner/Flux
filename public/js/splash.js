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

/** Returning users: gradient bar loader + wordmark (no circle ring). */
function runShortSplash(callback){
  const splash=document.getElementById('splash');
  if(!splash){callback();return;}
  const reduce=prefersReducedMotion();
  splash.style.cssText='position:fixed;inset:0;background:linear-gradient(165deg,#0B0F1A 0%,#121826 45%,#0d1528 100%);z-index:9999;display:flex;align-items:center;justify-content:center;overflow:hidden';
  const barAnim=reduce
    ? 'splashBarFill .38s cubic-bezier(.22,1,.36,1) forwards'
    : 'splashBarFill 0.92s cubic-bezier(.22,1,.36,1) 0.14s forwards, splashBarSheen 2.2s linear infinite';
  splash.innerHTML=`
    <div class="splash-veil" style="position:absolute;inset:0;pointer-events:none;background:
      radial-gradient(ellipse 85% 55% at 50% -10%,rgba(0,194,255,.14) 0%,transparent 52%),
      radial-gradient(ellipse 70% 50% at 100% 100%,rgba(124,92,255,.1) 0%,transparent 55%),
      radial-gradient(ellipse 50% 40% at 0% 90%,rgba(34,255,136,.06) 0%,transparent 50%);
      animation:${reduce?'none':'splashVeilDrift 4.5s ease-in-out infinite alternate'};opacity:.95"></div>
    <div class="splash-grid" style="position:absolute;inset:0;pointer-events:none;opacity:.22;
      background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
      background-size:24px 24px;mask-image:radial-gradient(ellipse 75% 65% at 50% 50%,#000 15%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse 75% 65% at 50% 50%,#000 15%,transparent 75%)"></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:22px;animation:splashFadeIn .5s cubic-bezier(.22,1,.36,1) both;position:relative;z-index:2;width:min(320px,82vw)">
      <div style="position:relative;width:100%;max-width:280px">
        <div class="splash-bar-glow" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:110%;height:28px;pointer-events:none;
          background:radial-gradient(ellipse 55% 90% at 50% 50%,rgba(0,194,255,.35),transparent 72%);
          filter:blur(12px);opacity:.75;animation:${reduce?'none':'splashGlowPulse 1.4s ease-in-out infinite alternate'}"></div>
        <div style="height:7px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;position:relative;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 4px 24px rgba(0,0,0,.35)">
          <div class="splash-bar-fill" style="height:100%;width:100%;transform-origin:left center;transform:scaleX(0);
            background:linear-gradient(90deg,#00C2FF 0%,#5B9DFF 35%,#7C5CFF 68%,#22FF88 100%);
            background-size:200% 100%;border-radius:999px;
            animation:${barAnim};
            box-shadow:0 0 18px rgba(0,194,255,.55),0 0 32px rgba(124,92,255,.25)"></div>
          <div class="splash-bar-glint" style="position:absolute;inset:0;pointer-events:none;border-radius:inherit;overflow:hidden">
            <div style="position:absolute;top:0;bottom:0;width:42%;left:-20%;
              background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);
              animation:${reduce?'none':'splashGlint 1.1s ease-in-out infinite'};opacity:.5"></div>
          </div>
        </div>
      </div>
      <div style="font-family:'Inter','Plus Jakarta Sans',system-ui,sans-serif;font-size:2.25rem;font-weight:800;letter-spacing:-0.04em;text-align:center;
        background:linear-gradient(135deg,#fff 0%,#00C2FF 50%,#7C5CFF 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        filter:drop-shadow(0 0 20px rgba(0,194,255,.4));animation:splashTitle .72s cubic-bezier(.22,1,.36,1) .2s both">Flux</div>
    </div>
    <style>
      @keyframes splashFadeIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
      @keyframes splashTitle{from{opacity:0;transform:translateY(8px);letter-spacing:0.02em}to{opacity:1;transform:none;letter-spacing:-0.04em}}
      @keyframes splashBarFill{to{transform:scaleX(1)}}
      @keyframes splashBarSheen{0%{background-position:0% 50%}100%{background-position:200% 50%}}
      @keyframes splashGlint{0%{transform:translateX(-30%) skewX(-12deg)}100%{transform:translateX(340%) skewX(-12deg)}}
      @keyframes splashGlowPulse{0%{opacity:.45;filter:blur(12px)}100%{opacity:.85;filter:blur(14px)}}
      @keyframes splashVeilDrift{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.04) translate(-1%,1%)}}
    </style>`;
  const dur=reduce?560:1100;
  setTimeout(()=>{
    splash.style.transition='opacity .32s ease';
    splash.style.opacity='0';
    setTimeout(()=>{splash.style.display='none';splash.innerHTML='';callback();},320);
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
  splash.style.cssText='position:fixed;inset:0;z-index:9999;overflow:hidden;display:block;background:#070512';

  splash.innerHTML=`
    <canvas id="fluxCinCanvas" style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
    <div id="fluxCinVignette" style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%,transparent 0%,rgba(5,8,20,.25) 55%,rgba(2,4,14,.92) 100%);z-index:1"></div>
    <div id="fluxCinLogo" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:3;pointer-events:none;opacity:0">
      <div id="fluxCinWord" style="position:relative;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:clamp(2.4rem,11vw,4rem);font-weight:800;letter-spacing:-0.04em;text-align:center;
        background:linear-gradient(135deg,#fff 0%,#00C2FF 42%,#7C5CFF 78%,#22FF88 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        filter:drop-shadow(0 0 28px rgba(0,194,255,.5));transform:scale(.88)">Flux</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:clamp(.55rem,2vw,.75rem);letter-spacing:5px;text-transform:uppercase;color:rgba(0,194,255,.55);margin-top:10px">Planner</div>
      <div id="fluxCinSweep" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-55%);width:min(88vw,380px);height:clamp(3rem,12vw,4.5rem);pointer-events:none;overflow:hidden;border-radius:4px;opacity:0">
        <div style="position:absolute;inset:0;background:linear-gradient(105deg,transparent 0%,transparent 42%,rgba(255,255,255,.35) 50%,transparent 58%,transparent 100%);width:200%;animation:fluxSweep 1.1s ease-in-out 1.85s forwards"></div>
      </div>
    </div>
    <style>
      @keyframes fluxSweep{0%{transform:translateX(-12%)}100%{transform:translateX(38%)}}
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
    {rx:.42,ry:.13,tilt:12,phase:0,spd:.65,alpha:.22,co:[0,194,255]},
    {rx:.34,ry:.18,tilt:58,phase:1.1,spd:-.52,alpha:.16,co:[124,92,255]},
    {rx:.48,ry:.11,tilt:-28,phase:2.3,spd:.42,alpha:.14,co:[34,255,136]},
    {rx:.26,ry:.2,tilt:82,phase:3.5,spd:-.58,alpha:.12,co:[100,180,255]},
    {rx:.52,ry:.09,tilt:5,spd:.38,alpha:.1,co:[0,194,255]},
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
      wordEl.style.filter=`drop-shadow(0 0 ${24+seg*20}px rgba(0,194,255,${0.45+seg*0.25}))`;
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
