/* ── FLUX PLANNER · splash.js — Orbital Laser System ── */
window.runSplash = function(callback) {
  const splash = document.getElementById('splash');
  if (!splash) { callback(); return; }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', '#000810');

  splash.style.cssText = 'position:fixed;inset:0;background:#000810;z-index:9999;overflow:hidden;display:block';
  splash.innerHTML = `
    <canvas id="orbCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    <div id="orbLogo" style="
      position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;z-index:2;
      opacity:0;transition:opacity .6s ease;pointer-events:none;
    ">
      <div style="
        font-family:'Plus Jakarta Sans',system-ui,sans-serif;
        font-size:clamp(2.8rem,10vw,4.2rem);font-weight:800;
        letter-spacing:-0.04em;text-align:center;
        background:linear-gradient(135deg,#fff 0%,#00d4ff 50%,#3b82f6 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        background-clip:text;filter:drop-shadow(0 0 30px rgba(0,180,255,.6));
      ">Flux</div>
      <div style="
        font-family:'JetBrains Mono',monospace;font-size:clamp(.55rem,2vw,.8rem);
        letter-spacing:4px;text-transform:uppercase;color:rgba(0,200,255,.6);
        margin-top:8px;text-align:center;
      ">Planner</div>
    </div>`;

  const canvas = document.getElementById('orbCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, animId, tick = 0;

  const PH = { ORBIT_START:50, CONVERGE_START:110, FLASH_START:145, LOGO_START:158, EXIT_START:198 };

  const RINGS = [
    { rx:0.38, ry:0.14, tilt: 0,   phase:0,    speed:0.008,  alpha:0.18, color:[0,180,255] },
    { rx:0.30, ry:0.20, tilt: 55,  phase:1.2,  speed:-0.006, alpha:0.14, color:[80,140,255] },
    { rx:0.46, ry:0.10, tilt:-30,  phase:2.4,  speed:0.005,  alpha:0.12, color:[0,220,200] },
    { rx:0.22, ry:0.22, tilt: 80,  phase:3.8,  speed:-0.009, alpha:0.10, color:[120,100,255] },
    { rx:0.52, ry:0.08, tilt: 15,  phase:0.7,  speed:0.004,  alpha:0.09, color:[0,160,255] },
  ];

  let beamAngle = 0, beamBrightness = 0, beamSnapTarget = null, lastSnapTick = 0;
  const beamRingIdx = 0;
  let sparks = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W/2; cy = H/2;
  }
  resize();
  window.addEventListener('resize', resize);

  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function easeIn(t){ return t*t; }

  function getEllipsePoint(ring, angle) {
    const tiltRad = ring.tilt * Math.PI / 180;
    const px = Math.cos(angle) * ring.rx * Math.min(W,H);
    const py = Math.sin(angle) * ring.ry * Math.min(W,H);
    const projX = px * Math.cos(tiltRad*0.4) - py * Math.sin(tiltRad*0.4)*0.3;
    const projY = px * Math.sin(tiltRad*0.15) + py * Math.cos(tiltRad*0.4);
    const depth = 0.5 + 0.5 * Math.sin(angle - ring.phase);
    return { x: cx+projX, y: cy+projY, depth };
  }

  function drawRing(ring, globalAlpha) {
    const steps = 80;
    for (let i=0; i<steps; i++) {
      const a0=(i/steps)*Math.PI*2, a1=((i+1)/steps)*Math.PI*2;
      const p0=getEllipsePoint(ring,a0), p1=getEllipsePoint(ring,a1);
      const depth=(p0.depth+p1.depth)/2;
      const a=ring.alpha*globalAlpha*depth*(0.4+0.6*depth);
      const [r,g,b]=ring.color;
      ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);
      ctx.strokeStyle=`rgba(${r},${g},${b},${a})`;ctx.lineWidth=depth*1.2;ctx.stroke();
    }
  }

  function drawBeam(ring, angle, brightness, alpha) {
    const pt=getEllipsePoint(ring,angle), ptPrev=getEllipsePoint(ring,angle-0.4);
    const front=pt.depth>0.5;
    const depthAlpha=front?pt.depth:pt.depth*0.35;
    const total=brightness*depthAlpha*alpha;
    if(total<0.02)return;
    [30,16,8,4].forEach((blur,i)=>{
      ctx.save();ctx.globalAlpha=total*[0.07,0.14,0.28,0.65][i];
      ctx.shadowBlur=blur;ctx.shadowColor='rgba(0,210,255,1)';
      ctx.beginPath();ctx.arc(pt.x,pt.y,[12,7,4,2.5][i],0,Math.PI*2);
      ctx.fillStyle='rgba(0,210,255,1)';ctx.fill();ctx.restore();
    });
    if(front){
      ctx.save();ctx.globalAlpha=total*0.7;
      const grad=ctx.createLinearGradient(ptPrev.x,ptPrev.y,pt.x,pt.y);
      grad.addColorStop(0,'rgba(0,210,255,0)');grad.addColorStop(1,'rgba(0,210,255,1)');
      ctx.beginPath();ctx.moveTo(ptPrev.x,ptPrev.y);ctx.lineTo(pt.x,pt.y);
      ctx.strokeStyle=grad;ctx.lineWidth=2.5;ctx.lineCap='round';
      ctx.shadowBlur=10;ctx.shadowColor='rgba(0,210,255,0.8)';ctx.stroke();ctx.restore();
    }
    if(front&&Math.random()<0.4*brightness){
      sparks.push({x:pt.x,y:pt.y,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3-1,life:1,decay:.04+Math.random()*.06,size:Math.random()*2+.5});
    }
  }

  function updateSparks(){
    sparks=sparks.filter(s=>s.life>0);
    sparks.forEach(s=>{
      s.x+=s.vx;s.y+=s.vy;s.vy+=.08;s.life-=s.decay;
      ctx.save();ctx.globalAlpha=s.life*.8;
      ctx.beginPath();ctx.arc(s.x,s.y,s.size,0,Math.PI*2);
      ctx.fillStyle='rgba(0,210,255,1)';ctx.shadowBlur=6;ctx.shadowColor='rgba(0,210,255,.8)';
      ctx.fill();ctx.restore();
    });
  }

  function drawCore(intensity){
    if(intensity<=0)return;
    const r=Math.min(W,H)*0.04*intensity;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*6);
    g.addColorStop(0,`rgba(0,220,255,${intensity*.9})`);
    g.addColorStop(.3,`rgba(0,150,255,${intensity*.4})`);
    g.addColorStop(1,'rgba(0,30,80,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=intensity;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.9)';ctx.shadowBlur=20;ctx.shadowColor='rgba(0,200,255,1)';
    ctx.fill();ctx.restore();
  }

  let logoShown = false;

  function frame(){
    tick++;const t=tick;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#000810';ctx.fillRect(0,0,W,H);
    const bgG=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.5);
    bgG.addColorStop(0,'rgba(0,20,60,.8)');bgG.addColorStop(1,'rgba(0,2,12,0)');
    ctx.fillStyle=bgG;ctx.fillRect(0,0,W,H);

    if(t<PH.ORBIT_START){
      const p=t/PH.ORBIT_START;
      RINGS.forEach(r=>drawRing(r,easeIn(p)*.7));
      beamBrightness=easeIn(p)*.5;
      beamAngle+=RINGS[beamRingIdx].speed*.5;
      drawBeam(RINGS[beamRingIdx],beamAngle,beamBrightness,1);
      drawCore(p*.3);
    }
    else if(t<PH.CONVERGE_START){
      const p=(t-PH.ORBIT_START)/(PH.CONVERGE_START-PH.ORBIT_START);
      RINGS.forEach(r=>drawRing(r,1));
      beamBrightness=clamp(beamBrightness+.04,0,1);
      if(t-lastSnapTick>20&&Math.random()<.02){beamSnapTarget=beamAngle+(Math.random()>.5?.3:-.3);lastSnapTick=t;}
      if(beamSnapTarget!==null){const diff=beamSnapTarget-beamAngle;beamAngle+=diff*.3;if(Math.abs(diff)<.01)beamSnapTarget=null;}
      else{beamAngle+=RINGS[beamRingIdx].speed*(1+p*.5);}
      RINGS.forEach(r=>{r.phase+=r.speed;});
      drawBeam(RINGS[beamRingIdx],beamAngle,beamBrightness,1);
      updateSparks();drawCore(.15+.1*Math.sin(t*.15));
    }
    else if(t<PH.FLASH_START){
      const p=(t-PH.CONVERGE_START)/(PH.FLASH_START-PH.CONVERGE_START);
      const shrink=easeIn(p);
      RINGS.forEach(r=>{const cr={...r,rx:r.rx*(1-shrink*.9),ry:r.ry*(1-shrink*.9)};drawRing(cr,1-shrink*.3);});
      beamAngle+=RINGS[beamRingIdx].speed*(1+p*8);
      const cr={...RINGS[beamRingIdx],rx:RINGS[beamRingIdx].rx*(1-shrink*.9),ry:RINGS[beamRingIdx].ry*(1-shrink*.9)};
      drawBeam(cr,beamAngle,beamBrightness,1-shrink*.3);
      updateSparks();drawCore(.2+shrink*.8);
    }
    else if(t<PH.LOGO_START){
      const p=(t-PH.FLASH_START)/(PH.LOGO_START-PH.FLASH_START);
      const fp=p<.4?p/.4:1-(p-.4)/.6;
      ctx.fillStyle=`rgba(0,210,255,${fp*.6})`;ctx.fillRect(0,0,W,H);
      ctx.fillStyle=`rgba(255,255,255,${fp*.35})`;ctx.fillRect(0,0,W,H);
      drawCore(fp);
      if(!logoShown&&p>.5){logoShown=true;document.getElementById('orbLogo').style.opacity='1';}
    }
    else if(t<PH.EXIT_START){
      if(!logoShown){logoShown=true;document.getElementById('orbLogo').style.opacity='1';}
      drawCore(.08+.04*Math.sin(t*.2));
    }
    else{
      window.removeEventListener('resize',resize);
      cancelAnimationFrame(animId);
      splash.style.transition='opacity .45s ease';splash.style.opacity='0';
      setTimeout(()=>{splash.style.display='none';splash.innerHTML='';callback();},450);
      return;
    }
    animId=requestAnimationFrame(frame);
  }
  animId=requestAnimationFrame(frame);
};
