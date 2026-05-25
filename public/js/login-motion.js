/* Flux login — lightweight GPU-friendly particle drift (requestAnimationFrame) */
(function(){
  let rafId=null;
  let canvas,ctx;
  let particles=[];
  const MAX=28;
  let resizeBound=false;

  function resize(){
    if(!canvas)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=window.innerWidth,h=window.innerHeight;
    canvas.width=Math.floor(w*dpr);
    canvas.height=Math.floor(h*dpr);
    canvas.style.width=w+'px';
    canvas.style.height=h+'px';
    if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function makeParticle(w,h){
    return{
      x:Math.random()*w,
      y:Math.random()*h,
      vx:(Math.random()-.5)*.45,
      vy:(Math.random()-.5)*.45,
      s:1.5+Math.random()*2.8,
      a:.12+Math.random()*.32,
      ph:Math.random()*Math.PI*2
    };
  }

  function stop(){
    if(rafId){cancelAnimationFrame(rafId);rafId=null;}
    particles=[];
    if(ctx&&canvas){ctx.clearRect(0,0,canvas.width,canvas.height);}
  }

  function frame(time){
    const ls=document.getElementById('loginScreen');
    if(!ls||ls.style.display==='none'||!ls.classList.contains('visible')){
      stop();
      return;
    }
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      stop();
      return;
    }
    const w=window.innerWidth,h=window.innerHeight;
    ctx.clearRect(0,0,w,h);
    const t=time*.0006;
    particles.forEach(p=>{
      p.x+=p.vx+Math.sin(t+p.ph)*.35;
      p.y+=p.vy+Math.cos(t*.85+p.ph)*.22;
      if(p.x<-20)p.x=w+20;if(p.x>w+20)p.x=-20;
      if(p.y<-20)p.y=h+20;if(p.y>h+20)p.y=-20;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.s*2.4);
      g.addColorStop(0,`rgba(0,194,255,${p.a})`);
      g.addColorStop(.45,`rgba(124,92,255,${p.a*.55})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.s,0,Math.PI*2);
      ctx.fill();
    });
    rafId=requestAnimationFrame(frame);
  }

  window.initLoginAmbient=function(){
    canvas=document.getElementById('loginParticles');
    if(!canvas)return;
    const ls=document.getElementById('loginScreen');
    if(!ls||!ls.classList.contains('visible'))return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    stop();
    ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
    resize();
    const w=window.innerWidth,h=window.innerHeight;
    particles=[];
    for(let i=0;i<MAX;i++)particles.push(makeParticle(w,h));
    if(!resizeBound){
      resizeBound=true;
      window.addEventListener('resize',resize,{passive:true});
    }
    rafId=requestAnimationFrame(frame);
  };

  window.stopLoginAmbient=stop;
})();

/* Login screen — whisper-soft cursor glow (CSS vars on #loginScreen) */
(function(){
  let raf=null;
  function onMove(e){
    const ls=document.getElementById('loginScreen');
    if(!ls||ls.style.display==='none'||!ls.classList.contains('visible'))return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    if(raf)return;
    raf=requestAnimationFrame(function(){
      raf=null;
      const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
      ls.style.setProperty('--login-cursor-x',(e.clientX/w*100)+'%');
      ls.style.setProperty('--login-cursor-y',(e.clientY/h*100)+'%');
    });
  }
  document.addEventListener('mousemove',onMove,{passive:true});
})();

/* Login — magnetic button hover (buttons subtly follow the cursor) */
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.addEventListener('mousemove',function(e){
    var ls=document.getElementById('loginScreen');
    if(!ls||!ls.classList.contains('visible'))return;
    var btns=ls.querySelectorAll('.login-google-btn--compact,.login-email-summary,.login-feature-card');
    for(var i=0;i<btns.length;i++){
      var b=btns[i];
      var r=b.getBoundingClientRect();
      var cx=r.left+r.width/2,cy=r.top+r.height/2;
      var dx=e.clientX-cx,dy=e.clientY-cy;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<150){
        var pull=Math.max(0,(150-dist)/150)*3;
        b.style.transform='translate('+(dx*pull/150)+'px,'+(dy*pull/150)+'px)';
      }else{
        b.style.transform='';
      }
    }
  },{passive:true});
})();

/* Login — counter animation for any stat numbers on the page */
(function(){
  function animateLoginCounters(){
    var ls=document.getElementById('loginScreen');
    if(!ls||!ls.classList.contains('visible'))return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var els=ls.querySelectorAll('[data-login-count]');
    for(var i=0;i<els.length;i++){
      (function(el){
        if(el.dataset.counted)return;
        el.dataset.counted='1';
        var to=parseInt(el.dataset.loginCount,10)||0;
        var suffix=el.dataset.loginSuffix||'';
        if(window.FluxMagic&&window.FluxMagic.counter){
          FluxMagic.counter(el,to,{suffix:suffix,duration:1200});
        }
      })(els[i]);
    }
  }
  var obs=new MutationObserver(animateLoginCounters);
  var target=document.getElementById('loginScreen');
  if(target)obs.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('DOMContentLoaded',animateLoginCounters);
})();
