/**
 * Flux visual premium — cursor-linked ambient (additive, no layout changes).
 * Sets --flux-cursor-x / --flux-cursor-y on <html> for #fluxCursorAmbient in flux-visual-premium.css
 */
(function(){
  if(!window.matchMedia||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  function perfSnappy(){
    try{return document.documentElement.getAttribute('data-flux-perf')==='on';}catch(e){return false;}
  }
  function liquidGlassOff(){
    try{return document.documentElement.getAttribute('data-flux-glass')==='off';}catch(e){return true;}
  }
  function ensureLayer(){
    if(document.getElementById('fluxCursorAmbient'))return;
    var el=document.createElement('div');
    el.id='fluxCursorAmbient';
    el.setAttribute('aria-hidden','true');
    var app=document.getElementById('app');
    if(app&&app.parentNode===document.body)document.body.insertBefore(el,app);
    else document.body.appendChild(el);
  }
  var raf=null;
  var lastX=-999,lastY=-999;
  function tick(e){
    if(perfSnappy())return;
    var dx=Math.abs(e.clientX-lastX),dy=Math.abs(e.clientY-lastY);
    if(dx<18&&dy<18)return;
    lastX=e.clientX;lastY=e.clientY;
    if(raf)return;
    raf=requestAnimationFrame(function(){
      raf=null;
      var w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
      document.documentElement.style.setProperty('--flux-cursor-x',(lastX/w*100)+'%');
      document.documentElement.style.setProperty('--flux-cursor-y',(lastY/h*100)+'%');
    });
  }
  function boot(){
    if(perfSnappy()||liquidGlassOff())return;
    ensureLayer();
    document.addEventListener('mousemove',tick,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
