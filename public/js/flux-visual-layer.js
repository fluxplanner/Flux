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
  function spotlightOn(){
    try{
      if(document.body.dataset.fluxCursor==='off') return false;
      var k='flux_cursor_spotlight';
      var nkk=typeof window.fluxNamespacedKey==='function'?window.fluxNamespacedKey(k):k;
      var raw=localStorage.getItem(nkk);
      if(raw!=null&&raw!==''){
        try{
          var v=JSON.parse(raw);
          if(v===false||v===0) return false;
        }catch(_){
          if(raw==='0'||raw==='false') return false;
        }
      }
    }catch(_){}
    return true;
  }
  function ensureLayer(){
    if(!spotlightOn()) return;
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
    if(!spotlightOn()) return;
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
    if(perfSnappy()||liquidGlassOff()||!spotlightOn())return;
    ensureLayer();
    document.addEventListener('mousemove',tick,{passive:true});
  }
  window.FluxCursorSpotlight = window.FluxCursorSpotlight || {};
  window.FluxCursorSpotlight.ensure = ensureLayer;
  document.addEventListener('flux:cursor-spotlight', function(ev){
    var on = ev && ev.detail && ev.detail.on;
    if(on) boot();
    else{
      var el=document.getElementById('fluxCursorAmbient');
      if(el){ el.style.display='none'; el.style.opacity='0'; }
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
